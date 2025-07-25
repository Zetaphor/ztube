import express from 'express';
import { YTNodes } from 'youtubei.js';
import getYoutubeClient from '../utils/youtubeClient.js';
import { formatViewCount, formatDuration } from '../utils/formatters.js';

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

// Get recommended videos
router.get('/:id/recommendations', async (req, res) => {
  const youtube = await getYoutubeClient();
  const { id } = req.params;
  try {
    const infoResponse = await youtube.getInfo(id);

    // console.log('Full getInfo response for recommendations:', JSON.stringify(infoResponse, null, 2)); // Optional: Log the full structure

    // --- Extract recommendations from watch_next_feed ---
    let resultsNodes = [];
    if (Array.isArray(infoResponse.watch_next_feed)) {
      resultsNodes = infoResponse.watch_next_feed;
    } else {
      console.warn(`Could not find recommendations array at infoResponse.watch_next_feed for ${id}`);
    }

    // Filter these nodes to get only video recommendations (e.g., CompactVideo)
    const recommendedVideoNodes = resultsNodes.filter(node => node.is(YTNodes.CompactVideo) || node.constructor.name === 'CompactVideoRenderer') || [];

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

export default router;