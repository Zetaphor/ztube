import express from 'express';
import { YTNodes } from 'youtubei.js';
import getYoutubeClient from '../utils/youtubeClient.js';
import { formatViewCount, formatDuration } from '../utils/formatters.js';
import { filterBlockedChannels } from '../utils/contentFilter.js';

const router = express.Router();

// Get video details
router.get('/:id', async (req, res) => {
  const youtube = await getYoutubeClient();
  try {
    const { id } = req.params;
    const video = await youtube.getInfo(id);
    // Keep this log uncommented for now, it's very helpful for debugging structure issues
    // console.log('Full video getInfo response:', JSON.stringify(video, null, 2));

    let chapters = [];
    let markersMap = null;

    try {
      // Safely access nested properties using optional chaining (?.)
      markersMap = video.player_overlays?.decorated_player_bar?.player_bar?.markers_map;

      // --- Process the found markersMap ---
      if (markersMap && Array.isArray(markersMap)) {
        // console.info(`Found markersMap with ${markersMap.length} items.`);
        // Find the marker group with the key "DESCRIPTION_CHAPTERS"
        const chapterMarkerGroup = markersMap.find(group => group.marker_key === 'DESCRIPTION_CHAPTERS');

        if (chapterMarkerGroup?.value?.chapters && Array.isArray(chapterMarkerGroup.value.chapters)) {
          const chapterList = chapterMarkerGroup.value.chapters;
          // console.info(`Found chapters list with ${chapterList.length} chapters.`);
          chapters = chapterList
            .map((chapter, index) => {
              // Safely access potentially missing nested properties
              const title = chapter?.title?.text;
              const startTimeMs = chapter?.time_range_start_millis;
              const thumbnailUrl = chapter?.thumbnail?.[0]?.url;

              if (typeof title !== 'string' || typeof startTimeMs !== 'number') {
                console.warn(`Invalid or missing data in chapter object at index ${index}:`, chapter); // Log the whole chapter object for debugging
                return null;
              }

              return {
                title: title,
                startTimeSeconds: startTimeMs / 1000,
                thumbnailUrl: thumbnailUrl || null,
              };
            })
            .filter(chapter => chapter !== null)
            .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
        } else {
          // console.warn('Could not find marker group with key "DESCRIPTION_CHAPTERS" or it lacks a valid "value.chapters" array.');
        }
      } else {
        // console.warn('No valid markersMap array found for chapter extraction.'); // Updated log message
      }
    } catch (e) {
      console.error("Error during chapter extraction:", e);
      chapters = []; // Ensure chapters is empty on error
    }

    console.log("[DEBUG] video.basic_info.channel:", video.basic_info.channel);
    console.log("[DEBUG] video.basic_info.channel.thumbnails:", video.basic_info.channel?.thumbnails);
    console.log("[DEBUG] video.secondary_info.owner:", video.secondary_info?.owner);
    console.log("[DEBUG] video.secondary_info.owner.author:", video.secondary_info?.owner?.author);

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
    console.error(`Video details error for ${req.params.id}:`, error);
    res.status(500).json({ error: `Failed to retrieve video details: ${error.message}` });
  }
});

// Get comments
router.get('/:id/comments', async (req, res) => {
  const youtube = await getYoutubeClient();
  try {
    const { id } = req.params;
    const { continuation } = req.query;

    let commentsData;
    if (continuation) {
      commentsData = await youtube.getComments(continuation); // Should be getNext() on the initial result?
      // Need to adjust based on how youtubei.js handles comment pagination
      console.warn("Comment continuation may need specific handling in youtubei.js");
    } else {
      commentsData = await youtube.getComments(id);
    }

    // Debug logging
    // console.log('Raw comments data:', commentsData);

    // Check if we have valid comments data
    if (!commentsData || !commentsData.contents) {
      console.warn('No comments data found');
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

    // Find the continuation token
    // This path might need verification based on youtubei.js updates
    const nextContinuation = commentsData.page?.continuation_item?.continuation || null;

    res.json({
      comments: extractedComments,
      continuation: nextContinuation
    });
  } catch (error) {
    console.error(`Comments error for video ${req.params.id}:`, error);
    res.status(500).json({ error: `Failed to retrieve comments: ${error.message}` });
  }
});

// Get recommended videos - Using watch_next_feed with search fallback
router.get('/:id/recommendations', async (req, res) => {
  const youtube = await getYoutubeClient();
  const { id } = req.params;

  try {
    console.log(`=== FETCHING RECOMMENDATIONS FOR ${id} ===`);

    const videoInfo = await youtube.getInfo(id);
    console.log('Video info keys:', Object.keys(videoInfo));

    let recommendations = [];

    // APPROACH 1: Try to get recommendations from watch_next_feed (primary method)
    if (videoInfo.watch_next_feed && Array.isArray(videoInfo.watch_next_feed) && videoInfo.watch_next_feed.length > 0) {
      console.log(`🎯 PRIMARY METHOD: Using watch_next_feed with ${videoInfo.watch_next_feed.length} items`);

      recommendations = videoInfo.watch_next_feed
        .filter(item => {
          // Filter for video-like objects with required properties
          return item && (item.id || item.video_id) && item.title;
        })
        .map(video => {
          console.log('Processing watch_next video:', video.id || video.video_id, video.title?.text || video.title);
          return {
            id: video.id || video.video_id,
            title: video.title?.text || video.title || 'Untitled',
            duration: video.duration?.text || video.duration_text?.text || '0:00',
            viewCount: video.short_view_count?.text || video.view_count?.text || '0 views',
            uploadedAt: video.published?.text || video.published_time_text?.text || 'Unknown date',
            thumbnails: video.thumbnails || [],
            channel: {
              name: video.author?.name || video.channel?.name || 'Unknown',
              avatar: video.author?.thumbnails || video.channel?.thumbnails || [],
              verified: video.author?.is_verified || video.channel?.is_verified || false,
              id: video.author?.id || video.channel?.id || null
            }
          };
        })
        .filter(v => v.id && v.title && v.id !== id); // Ensure valid videos and exclude current video

      console.log(`✅ PRIMARY METHOD SUCCESS: Extracted ${recommendations.length} valid recommendations from watch_next_feed`);
    }

    // APPROACH 2: If we don't have enough recommendations, use search fallback
    if (recommendations.length < 5) {
      console.log(`🔄 FALLBACK METHOD: Only found ${recommendations.length} recommendations from primary method, using search fallback...`);

      const videoTitle = videoInfo.basic_info?.title || '';
      const channelName = videoInfo.basic_info?.channel?.name || '';

      console.log(`Video title: "${videoTitle}"`);
      console.log(`Channel name: "${channelName}"`);

      if (videoTitle) {
        try {
          const searchResults = await youtube.search(videoTitle, { type: 'video' });
          console.log('Search results length:', searchResults.results?.length || 0);

          if (searchResults.results && searchResults.results.length > 0) {
            const searchVideos = searchResults.results
              .filter(video => video.id !== id) // Exclude current video
              .slice(0, 15) // Get top 15 recommendations
              .map(video => ({
                id: video.id,
                title: video.title?.text || video.title || 'Untitled',
                duration: video.duration?.text || '0:00',
                viewCount: video.short_view_count?.text || video.view_count?.text || '0 views',
                uploadedAt: video.published?.text || 'Unknown date',
                thumbnails: video.thumbnails || [],
                channel: {
                  name: video.author?.name || 'Unknown',
                  avatar: video.author?.thumbnails || [],
                  verified: video.author?.is_verified || false,
                  id: video.author?.id || null
                }
              }))
              .filter(v => v.id && v.title);

            // Add search results that aren't already in recommendations
            searchVideos.forEach(video => {
              if (!recommendations.find(r => r.id === video.id)) {
                recommendations.push(video);
              }
            });

            console.log(`✅ FALLBACK METHOD SUCCESS: Added ${searchVideos.length} videos from search, total: ${recommendations.length}`);
          }
        } catch (searchError) {
          console.warn('❌ FALLBACK METHOD FAILED:', searchError.message);
        }
      }
    }

    // Add a clear summary of what method was used
    const methodUsed = recommendations.length > 0 ?
      (videoInfo.watch_next_feed && videoInfo.watch_next_feed.length > 0 ? "PRIMARY (watch_next_feed)" : "FALLBACK (search)")
      : "NONE";

    console.log(`🎉 FINAL RESULT: ${recommendations.length} recommendations using ${methodUsed} method`);

    // Filter out videos from blocked channels
    const filteredRecommendations = await filterBlockedChannels(recommendations);
    console.log(`🔒 FILTERED: ${recommendations.length - filteredRecommendations.length} recommendations removed from blocked channels`);

    res.json(filteredRecommendations);

  } catch (error) {
    console.error(`Recommendations error for video ${id}:`, error);
    res.status(500).json({ error: `Failed to retrieve recommendations: ${error.message}` });
  }
});

// Debug endpoint for analyzing getInfo response structure
router.get('/:id/debug', async (req, res) => {
  const youtube = await getYoutubeClient();
  const { id } = req.params;

  try {
    console.log(`\n=== DEBUG ANALYSIS FOR VIDEO ${id} ===`);
    const infoResponse = await youtube.getInfo(id);

    // Helper function to analyze object structure
    const analyzeObject = (obj, path = '', maxDepth = 3, currentDepth = 0) => {
      if (currentDepth >= maxDepth || !obj || typeof obj !== 'object') {
        return { type: typeof obj, isArray: Array.isArray(obj) };
      }

      const analysis = {
        type: typeof obj,
        isArray: Array.isArray(obj),
        keys: Array.isArray(obj) ? [] : Object.keys(obj),
        length: Array.isArray(obj) ? obj.length : undefined,
        children: {}
      };

      if (Array.isArray(obj) && obj.length > 0) {
        analysis.sampleItem = analyzeObject(obj[0], `${path}[0]`, maxDepth, currentDepth + 1);
      } else if (!Array.isArray(obj)) {
        for (const key of Object.keys(obj).slice(0, 10)) { // Limit to first 10 keys
          analysis.children[key] = analyzeObject(obj[key], `${path}.${key}`, maxDepth, currentDepth + 1);
        }
      }

      return analysis;
    };

    const analysis = {
      topLevel: analyzeObject(infoResponse, 'root', 4),
      videoDetails: infoResponse.basic_info ? {
        id: infoResponse.basic_info.id,
        title: infoResponse.basic_info.title?.text || infoResponse.basic_info.title,
        channel: infoResponse.basic_info.channel?.name?.text || infoResponse.basic_info.channel?.name
      } : 'Not found',
      possibleRecommendationLocations: {}
    };

    // Check all possible locations for recommendations
    const locationsToCheck = [
      'watch_next_feed',
      'watch_next.results',
      'watch_next.contents',
      'results',
      'secondary_results',
      'sidebar',
      'related_videos',
      'contents.twoColumnWatchNextResults.secondaryResults',
      'contents.twoColumnWatchNextResults.sidebar',
      'response.contents.twoColumnWatchNextResults.secondaryResults'
    ];

    for (const location of locationsToCheck) {
      const keys = location.split('.');
      let current = infoResponse;
      let exists = true;

      for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key];
        } else {
          exists = false;
          break;
        }
      }

      if (exists) {
        analysis.possibleRecommendationLocations[location] = {
          exists: true,
          type: typeof current,
          isArray: Array.isArray(current),
          length: Array.isArray(current) ? current.length : undefined,
          structure: analyzeObject(current, location, 2)
        };

        // If it's an array, analyze the first few items
        if (Array.isArray(current) && current.length > 0) {
          analysis.possibleRecommendationLocations[location].sampleItems = current.slice(0, 3).map((item, index) => ({
            index,
            analysis: analyzeObject(item, `${location}[${index}]`, 2)
          }));
        }
      } else {
        analysis.possibleRecommendationLocations[location] = { exists: false };
      }
    }

    // Look for any properties that might contain video-like objects
    const findVideoLikeObjects = (obj, path = '', depth = 0) => {
      if (depth > 3 || !obj || typeof obj !== 'object') return [];

      let found = [];

      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          if (item && typeof item === 'object' && (item.id || item.video_id || item.videoId)) {
            found.push({
              path: `${path}[${index}]`,
              hasId: !!(item.id || item.video_id || item.videoId),
              hasTitle: !!(item.title),
              hasThumbnails: !!(item.thumbnails),
              hasAuthor: !!(item.author || item.channel),
              keys: Object.keys(item)
            });
          }
          found = found.concat(findVideoLikeObjects(item, `${path}[${index}]`, depth + 1));
        });
      } else {
        for (const [key, value] of Object.entries(obj)) {
          if (value && typeof value === 'object' && (value.id || value.video_id || value.videoId)) {
            found.push({
              path: `${path}.${key}`,
              hasId: !!(value.id || value.video_id || value.videoId),
              hasTitle: !!(value.title),
              hasThumbnails: !!(value.thumbnails),
              hasAuthor: !!(value.author || value.channel),
              keys: Object.keys(value)
            });
          }
          found = found.concat(findVideoLikeObjects(value, `${path}.${key}`, depth + 1));
        }
      }

      return found;
    };

    analysis.videoLikeObjects = findVideoLikeObjects(infoResponse, 'root');

    console.log('Debug analysis complete');
    res.json(analysis);

  } catch (error) {
    console.error(`Debug error for video ${id}:`, error);
    res.status(500).json({
      error: `Debug failed: ${error.message}`,
      stack: error.stack
    });
  }
});

export default router;