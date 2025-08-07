import express from 'express';
import getYoutubeClient from '../utils/youtubeClient.js';
import { isShort, separateVideosAndShorts } from '../utils/shortsDetection.js';
import { formatViewCount, formatDuration } from '../utils/formatters.js';
import { filterBlockedChannels } from '../utils/contentFilter.js';

const router = express.Router();

// Get trending/popular Shorts
router.get('/trending', async (req, res) => {
  const youtube = await getYoutubeClient();
  try {
    // Try to get Shorts from trending or search for short videos
    let shortsResults = [];

    try {
      // First, try to search for videos with duration filter
      const searchResults = await youtube.search('', {
        type: 'video',
        duration: 'short' // This should filter for videos under 4 minutes, we'll filter further
      });

      if (searchResults && searchResults.videos) {
        const { shorts } = separateVideosAndShorts(searchResults.videos.map(video => ({
          id: video.id,
          title: video.title?.text || video.title || 'Untitled',
          duration: video.duration?.text || '0:00',
          durationSeconds: video.duration?.seconds || 0,
          viewCount: video.short_view_count?.text || video.view_count?.text || '0 views',
          uploadedAt: video.published?.text || 'Unknown date',
          thumbnails: video.thumbnails || [],
          channel: {
            name: video.author?.name || 'Unknown',
            avatar: video.author?.thumbnails || [],
            verified: video.author?.is_verified || false,
            id: video.author?.id || null
          }
        })));

        shortsResults = shorts;
      }
    } catch (searchError) {
      console.warn('Could not fetch Shorts from search, trying alternative method:', searchError.message);

      // Alternative: Get trending videos and filter for Shorts
      try {
        const trendingResults = await youtube.search('trending', { type: 'video' });
        if (trendingResults && trendingResults.videos) {
          const { shorts } = separateVideosAndShorts(trendingResults.videos.map(video => ({
            id: video.id,
            title: video.title?.text || video.title || 'Untitled',
            duration: video.duration?.text || '0:00',
            durationSeconds: video.duration?.seconds || 0,
            viewCount: video.short_view_count?.text || video.view_count?.text || '0 views',
            uploadedAt: video.published?.text || 'Unknown date',
            thumbnails: video.thumbnails || [],
            channel: {
              name: video.author?.name || 'Unknown',
              avatar: video.author?.thumbnails || [],
              verified: video.author?.is_verified || false,
              id: video.author?.id || null
            }
          })));

          shortsResults = shorts;
        }
      } catch (trendingError) {
        console.warn('Could not fetch trending Shorts:', trendingError.message);
      }
    }

    res.json(shortsResults);
  } catch (error) {
    console.error('Shorts trending error:', error);
    res.status(500).json({ error: `Failed to retrieve trending Shorts: ${error.message}` });
  }
});

// Get Shorts from subscriptions feed
router.get('/subscriptions', async (req, res) => {
  try {
    // Import node-fetch, utilities, and repository
    const fetch = (await import('node-fetch')).default;
    const { XMLParser } = await import('fast-xml-parser');
    const SubscriptionsRepo = await import('../db/subscriptionsRepository.js');
    const { formatViewCount, formatRelativeDate } = await import('../utils/formatters.js');

    const subscriptions = await SubscriptionsRepo.getAllSubscriptions();

    if (subscriptions.length === 0) {
      return res.json([]);
    }

    const xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      allowBooleanAttributes: true
    });

    // Fetch subscription feeds
    const feedPromises = subscriptions.map(async (sub) => {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${sub.channel_id}`;
      try {
        const response = await fetch(feedUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} for ${sub.channel_id}`);
        }
        const xmlData = await response.text();
        const feed = xmlParser.parse(xmlData);

        const entries = Array.isArray(feed?.feed?.entry)
          ? feed.feed.entry
          : feed?.feed?.entry ? [feed.feed.entry] : [];

        return entries.map(entry => {
          const videoId = entry['yt:videoId'];
          const title = entry.title;
          const channelName = entry.author?.name || sub.name;
          const channelId = entry['yt:channelId'];
          const published = entry.published;
          const thumbnail = entry['media:group']?.['media:thumbnail']?.['@_url'];

          let viewCount = '0 views';
          const viewCountStr = entry['media:group']?.['media:community']?.['media:statistics']?.['@_views'];
          if (viewCountStr) {
            const count = parseInt(viewCountStr, 10);
            if (!isNaN(count)) {
              viewCount = formatViewCount(count);
            }
          }

          if (!videoId || !title || !channelId || !published || !thumbnail) {
            return null;
          }

          return {
            id: videoId,
            title: title,
            channelName: channelName,
            channelId: channelId,
            channelAvatar: sub.avatar_url,
            published: published,
            publishedText: formatRelativeDate(published),
            thumbnailUrl: thumbnail,
            viewCount: viewCount,
            channel: {
              name: channelName,
              avatar: [{ url: sub.avatar_url }],
              verified: false,
              id: channelId
            },
            thumbnails: [{ url: thumbnail }]
          };
        }).filter(video => video !== null);
      } catch (error) {
        console.error(`Failed to fetch feed for ${sub.channel_id}:`, error.message);
        return [];
      }
    });

    const allVideosNested = await Promise.all(feedPromises);
    const allVideos = allVideosNested.flat();

    // Since RSS feeds don't include duration, we'll fetch video details for a subset
    // to detect shorts (limiting to recent videos to avoid too many API calls)
    const youtube = await getYoutubeClient();
    const recentVideos = allVideos.slice(0, 20); // Limit to recent 20 videos to avoid API overload

    const shortsPromises = recentVideos.map(async (video) => {
      try {
        const videoInfo = await youtube.getInfo(video.id);
        const durationSeconds = videoInfo.basic_info.duration || 0;

        // Check if it's a short (60 seconds or less)
        if (durationSeconds > 0 && durationSeconds <= 60) {
          return {
            ...video,
            duration: videoInfo.basic_info.duration?.text || `${durationSeconds}s`,
            durationSeconds: durationSeconds
          };
        }
        return null;
      } catch (error) {
        console.warn(`Failed to get video info for ${video.id}:`, error.message);
        return null;
      }
    });

    const shortsResults = await Promise.all(shortsPromises);
    const shorts = shortsResults.filter(short => short !== null);

    // Filter out shorts from blocked channels
    const filteredShorts = await filterBlockedChannels(shorts);
    console.log(`🔒 FILTERED: ${shorts.length - filteredShorts.length} shorts removed from blocked channels`);

    console.info(`Found ${filteredShorts.length} shorts from ${recentVideos.length} recent subscription videos`);
    res.json(filteredShorts);

  } catch (error) {
    console.error('Shorts subscriptions error:', error);
    res.status(500).json({ error: `Failed to retrieve subscription Shorts: ${error.message}` });
  }
});

// Search for Shorts
router.get('/search', async (req, res) => {
  const youtube = await getYoutubeClient();
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    const results = await youtube.search(query, { type: 'video' });

    // Filter search results for Shorts only
    const allVideos = Array.isArray(results.videos) ? results.videos.map(video => ({
      id: video.id,
      title: video.title?.text || video.title || 'Untitled',
      duration: video.duration?.text || '0:00',
      durationSeconds: video.duration?.seconds || 0,
      viewCount: video.short_view_count?.text || video.view_count?.text || '0 views',
      uploadedAt: video.published?.text || 'Unknown date',
      thumbnails: video.thumbnails || [],
      channel: {
        name: video.author?.name || 'Unknown',
        avatar: video.author?.thumbnails || [],
        verified: video.author?.is_verified || false,
        id: video.author?.id || null
      }
    })) : [];

    const { shorts } = separateVideosAndShorts(allVideos);

    // Filter out shorts from blocked channels
    const filteredShorts = await filterBlockedChannels(shorts);

    res.json(filteredShorts);
  } catch (error) {
    console.error('Shorts search error:', error);
    res.status(500).json({ error: `Shorts search failed: ${error.message}` });
  }
});

export default router;