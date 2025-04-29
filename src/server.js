import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { Innertube } from 'youtubei.js';
import { YTNodes } from 'youtubei.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Initialize YouTube client
let youtube;
(async () => {
  youtube = await Innertube.create();
})();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));
app.set('view engine', 'ejs');
app.set('views', join(__dirname, '../views'));

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

// Search videos
app.get('/api/search', async (req, res) => {
  try {
    const { query } = req.query;
    const results = await youtube.search(query);

    // Transform the results to ensure we have all required fields
    const videos = Array.isArray(results.videos) ? results.videos.map(video => ({
      id: video.id,
      title: video.title?.text || video.title,
      duration: video.duration?.text || '0:00',
      viewCount: video.short_view_count?.text || video.view_count?.text || '0 views',
      uploadedAt: video.published?.text || 'Unknown date',
      thumbnails: video.thumbnails || [],
      channel: {
        name: video.author?.name || 'Unknown',
        avatar: video.author?.thumbnails || [],
        verified: video.author?.is_verified || false
      }
    })) : [];

    res.json(videos);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get video details
app.get('/api/video/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const video = await youtube.getInfo(id);
    // Keep this log uncommented for now, it's very helpful for debugging structure issues
    console.log('Full video getInfo response:', JSON.stringify(video, null, 2));

    let chapters = [];
    let markersMap = null;

    try {
      console.log('Attempting to extract chapters...');

      const decoratedPlayerBar = video.player_overlays?.decorated_player_bar;
      const playerBar = decoratedPlayerBar?.player_bar;
      markersMap = playerBar?.markers_map;

      // --- Process the found markersMap ---
      if (markersMap && Array.isArray(markersMap)) {
        console.log(`Found markersMap with ${markersMap.length} items.`);
        // Find the marker group with the key "DESCRIPTION_CHAPTERS"
        const chapterMarkerGroup = markersMap.find(group => group.marker_key === 'DESCRIPTION_CHAPTERS');

        if (chapterMarkerGroup && chapterMarkerGroup.value?.chapters && Array.isArray(chapterMarkerGroup.value.chapters)) {
          const chapterList = chapterMarkerGroup.value.chapters;
          console.log(`Found chapters list with ${chapterList.length} chapters.`);
          chapters = chapterList
            .map((chapter, index) => {
              // Extract title using the correct path: chapter.title.text
              const title = chapter.title?.text;
              // Extract startTimeMs directly from chapter object
              const startTimeMs = chapter.time_range_start_millis;
              // Extract the first thumbnail URL
              const thumbnailUrl = chapter.thumbnail?.[0]?.url;

              if (typeof title !== 'string' || typeof startTimeMs !== 'number') {
                console.warn(`Invalid data in chapter at index ${index}: title=${title}, startTimeMs=${startTimeMs}`);
                return null;
              }

              return {
                title: title || `Chapter ${index + 1}`,
                startTimeSeconds: startTimeMs / 1000,
                thumbnailUrl: thumbnailUrl || null,
              };
            })
            .filter(chapter => chapter !== null)
            .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
          console.log(`Successfully extracted ${chapters.length} chapters.`);
        } else {
          console.log('Could not find marker group with key "DESCRIPTION_CHAPTERS" or it lacks a valid "value.chapters" array.');
        }
      } else {
        console.log('Could not find a valid markersMap array at player_overlays.decorated_player_bar.player_bar.markers_map.');
      }
    } catch (e) {
      console.error("Error during chapter extraction:", e);
    }

    const videoDetails = {
      id: video.basic_info.id,
      title: video.basic_info.title?.text || video.basic_info.title,
      description: video.secondary_info?.description?.text || video.basic_info.description || '',
      view_count: typeof video.basic_info.view_count === 'number'
        ? formatViewCount(video.basic_info.view_count)
        : video.basic_info.view_count?.text || '0 views',
      like_count: video.basic_info.like_count?.text || video.basic_info.like_count,
      published: video.basic_info.published?.text || 'Unknown date',
      author: {
        id: video.basic_info.channel?.id,
        name: video.basic_info.channel?.name?.text || video.basic_info.channel?.name,
        thumbnails: Array.isArray(video.basic_info.channel?.thumbnails) && video.basic_info.channel.thumbnails.length > 0
          ? video.basic_info.channel.thumbnails
          : [{ url: '/img/default-avatar.svg', width: 48, height: 48 }],
        subscriber_count: video.basic_info.channel?.subscriber_count?.text || video.basic_info.channel?.subscriber_count || '',
        verified: video.basic_info.channel?.is_verified
      },
      thumbnails: video.basic_info.thumbnails || [],
      duration: video.basic_info.duration?.text || formatDuration(video.basic_info.duration),
      durationSeconds: video.basic_info.duration || 0,
      is_live: video.basic_info.is_live,
      chapters: chapters,
      primary_info: video.primary_info,
      secondary_info: video.secondary_info
    };

    res.json(videoDetails);
  } catch (error) {
    console.error('Video details error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions for formatting
function formatViewCount(count) {
  if (!count) return '0 views';

  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M views`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K views`;
  }
  return `${count} views`;
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${padZero(minutes)}:${padZero(secs)}`;
  }
  return `${minutes}:${padZero(secs)}`;
}

function padZero(num) {
  return num.toString().padStart(2, '0');
}

// Get comments
app.get('/api/comments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { continuation } = req.query;

    let commentsData;
    if (continuation) {
      commentsData = await youtube.getComments(continuation);
    } else {
      commentsData = await youtube.getComments(id);
    }

    // Debug logging
    // console.log('Raw comments data:', commentsData);

    // Check if we have valid comments data
    if (!commentsData || !commentsData.contents) {
      console.log('No comments data found');
      return res.json({
        comments: [],
        continuation: null
      });
    }

    // Extract comments from the CommentThread objects
    const extractedComments = [];
    commentsData.contents.forEach(thread => {
      if (thread.comment) {
        const commentView = thread.comment;
        extractedComments.push({
          id: commentView.comment_id || '',
          content: commentView.content?.text || '',
          published: commentView.published_time || '',
          author: {
            id: commentView.author?.id || '',
            name: commentView.author?.name || 'Unknown',
            thumbnails: commentView.author?.thumbnails || []
          },
          like_count: commentView.like_count || '0',
          reply_count: commentView.reply_count || '0'
        });
      }
    });

    // Debug logging
    // console.log('Extracted comments:', extractedComments);

    res.json({
      comments: extractedComments,
      continuation: commentsData.page?.continuation_item?.continuation || null
    });
  } catch (error) {
    console.error('Comments error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recommended videos
app.get('/api/video/:id/recommendations', async (req, res) => {
  const { id } = req.params;
  try {
    const infoResponse = await youtube.getInfo(id);

    // console.log('Full getInfo response for recommendations:', JSON.stringify(infoResponse, null, 2)); // Optional: Log the full structure

    // --- Extract recommendations from watch_next_feed ---
    let resultsNodes = [];
    if (Array.isArray(infoResponse.watch_next_feed)) {
      resultsNodes = infoResponse.watch_next_feed;
      console.log('Found recommendations in infoResponse.watch_next_feed');
    } else {
      console.log(`Could not find recommendations array at infoResponse.watch_next_feed for ${id}`);
    }

    // Filter these nodes to get only video recommendations (e.g., CompactVideo)
    const recommendedVideoNodes = resultsNodes.filter(node => node.is(YTNodes.CompactVideo) || node.constructor.name === 'CompactVideoRenderer') || [];

    console.log(`Recommendations extraction: Found ${recommendedVideoNodes.length} potential video nodes for ${id}.`);

    const recommendations = recommendedVideoNodes.map(video => {
      // Adapt mapping based on the actual node type (CompactVideo)
      return {
        id: video.id,
        title: video.title?.text || video.title || 'Untitled',
        duration: video.duration?.text || '0:00',
        viewCount: video.short_view_count?.text || video.view_count?.text || '0 views',
        uploadedAt: video.published_time_text?.text || video.published?.text || 'Unknown date',
        thumbnails: video.thumbnails || [],
        channel: {
          name: video.author?.name || 'Unknown',
          avatar: video.author?.thumbnails || [],
          verified: video.author?.is_verified || false,
          id: video.author?.id || null
        }
      };
    }).filter(v => v.id && v.title); // Ensure basic validity

    res.json(recommendations);

  } catch (error) {
    console.error(`Recommendations error for video ${id}:`, error);
    res.status(500).json({ error: `Failed to retrieve recommendations: ${error.message}` });
  }
});

// Get channel details API (remains for potential direct API use)
app.get('/api/channel/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Add a simple validation check
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }
    const channel = await youtube.getChannel(id);

    // Basic check if channel data was found
    if (!channel || !channel.header) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Extract relevant data for the API response (optional, but good practice)
    const channelData = {
      id: id,
      name: channel.header?.channel_header?.title?.text || channel.header?.title?.text || 'Unknown Channel',
      avatar: channel.header?.channel_header?.author?.thumbnails?.[0]?.url || channel.header?.author?.thumbnails?.[0]?.url || '/img/default-avatar.svg',
      banner: channel.header?.banner?.thumbnails?.[0]?.url || null,
      subscriber_count: channel.header?.subscriber_count?.text || channel.header?.subscribers?.text || '',
      video_count: channel.header?.video_count?.text || '',
      // You might want to add more fields as needed
    };

    res.json(channelData); // Send back curated data
  } catch (error) {
    console.error(`Channel API error for ID ${req.params.id}:`, error);
    // Avoid sending detailed internal errors to the client
    if (error.message?.includes('404')) {
      res.status(404).json({ error: 'Channel not found or private' });
    } else {
      res.status(500).json({ error: 'Failed to retrieve channel details' });
    }
  }
});

// Channel Page Route
app.get('/channel/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).send('Invalid channel ID');
    }
    const channel = await youtube.getChannel(id);

    // Prepare data for the template based on observed LTT structure
    const header = channel.header;
    const headerContent = header?.content; // Specific to PageHeader in LTT example
    const microformat = channel.metadata; // LTT example had MicroformatData here

    let channelName = 'Unknown Channel';
    if (headerContent?.title?.text?.text) channelName = headerContent.title.text.text;
    else if (microformat?.title) channelName = microformat.title;

    let avatarUrl = '/img/default-avatar.svg'; // Default fallback
    const potentialAvatars = [
      headerContent?.image?.avatar?.image?.[0]?.url, // From PageHeader
      microformat?.avatar?.[0]?.url // From MicroformatData
    ];
    avatarUrl = potentialAvatars.find(url => url && (url.startsWith('http://') || url.startsWith('https://'))) || avatarUrl;

    let bannerUrl = null; // Default fallback
    const potentialBanners = [
      headerContent?.banner?.image?.[0]?.url, // From PageHeader Banner
    ];
    bannerUrl = potentialBanners.find(url => url && (url.startsWith('http://') || url.startsWith('https://'))) || bannerUrl;

    // Extract counts from PageHeader structure
    let subscriberCount = '';
    let videoCount = '';
    if (headerContent?.metadata?.metadata_rows?.[1]?.metadata_parts) {
      subscriberCount = headerContent.metadata.metadata_rows[1].metadata_parts[0]?.text?.text || '';
      videoCount = headerContent.metadata.metadata_rows[1].metadata_parts[1]?.text?.text || '';
    }

    // Final check logs
    console.log('Final Extracted Name:', channelName);
    console.log('Final Extracted Avatar URL:', avatarUrl);
    console.log('Final Extracted Banner URL:', bannerUrl);
    console.log('Final Extracted Subscriber Count:', subscriberCount);
    console.log('Final Extracted Video Count:', videoCount);

    const channelData = {
      id: id,
      name: channelName,
      avatar: avatarUrl,
      banner: bannerUrl,
      subscriber_count: subscriberCount,
      video_count: videoCount,
    };

    res.render('channel', { channel: channelData });

  } catch (error) {
    console.error(`Channel page error for ID ${req.params.id}:`, error);
    // Send plain text error instead of rendering a non-existent view
    res.status(500).send('Error: Could not load channel information.');
  }
});

// API: Get Channel Videos (with basic pagination)
app.get('/api/channel/:id/videos', async (req, res) => {
  const { id } = req.params;
  const { continuation } = req.query;

  try {
    let channelVideosResponse;
    if (continuation) {
      // If we have a continuation token, use it to get the next batch
      // Note: youtubei.js might handle continuations differently depending on context.
      // This assumes getting the full channel object again and then applying continuation,
      // which might not be the most efficient way. A more direct continuation fetch might exist.
      console.log(`Fetching continuation for channel ${id}`);
      // Re-fetch channel to potentially get continuation context if needed
      const channel = await youtube.getChannel(id);
      // You might need a more specific method if getVideos() doesn't accept continuation directly
      // For now, we assume getContinuation applies to the current state of the object
      // This part might need adjustment based on youtubei.js specifics for channel continuations.
      channelVideosResponse = await channel.getContinuation();
      // TODO: Verify the structure of continuation response and adapt mapping

    } else {
      // Initial load: Get the channel and its first batch of videos
      console.log(`Fetching initial videos for channel ${id}`);
      const channel = await youtube.getChannel(id);
      // Attempt to switch to the videos tab explicitly if possible/needed
      // This depends on whether getChannel lands on the featured tab or videos tab by default
      // channel = await channel.getVideos(); // Might be needed if getChannel doesn't default to videos
      channelVideosResponse = await channel.getVideos(); // Fetch videos from the current channel state
    }

    // Map the video data (adapt structure as needed based on actual response)
    // This assumes the response has a `videos` array similar to search results
    // or continuation data includes items.
    const videos = (channelVideosResponse.videos || channelVideosResponse.items || []).map(video => ({
      id: video.id,
      title: video.title?.text || video.title,
      duration: video.duration?.text || '0:00',
      viewCount: video.short_view_count?.text || video.view_count?.text || '0 views',
      uploadedAt: video.published?.text || 'Unknown date',
      thumbnails: video.thumbnails || [],
      channel: { // Include channel info for consistency, even if redundant here
        id: id,
        name: video.author?.name || 'Unknown',
        avatar: video.author?.thumbnails || [],
        verified: video.author?.is_verified || false
      }
    })).filter(Boolean); // Filter out any null/undefined entries

    // Find the continuation token for the next page
    // The path to the continuation token might vary based on the response structure
    const nextContinuation = channelVideosResponse.continuation || channelVideosResponse.continuation_contents?.continuation || null;

    res.json({
      videos: videos,
      continuation: nextContinuation
    });

  } catch (error) {
    console.error(`Error fetching videos for channel ${id}:`, error);
    res.status(500).json({ error: 'Failed to retrieve channel videos' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});