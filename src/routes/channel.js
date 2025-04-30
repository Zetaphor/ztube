import express from 'express';
import getYoutubeClient from '../utils/youtubeClient.js';
// import { formatViewCount, formatDuration } from '../utils/formatters.js'; // Might need these if we enhance video data

const router = express.Router();

// Get channel details API (remains for potential direct API use)
router.get('/api/:id', async (req, res) => {
  const youtube = await getYoutubeClient();
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
      name: channel.header?.channel_header?.author?.name || channel.header?.title?.text || 'Unknown Channel',
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
router.get('/:id', async (req, res) => {
  const youtube = await getYoutubeClient();
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
    else if (channel.header?.channel_header?.title?.text) channelName = channel.header.channel_header.title.text; // Add fallback
    else if (channel.header?.title?.text) channelName = channel.header.title.text; // Add another fallback

    let avatarUrl = '/img/default-avatar.svg'; // Default fallback
    const potentialAvatars = [
      headerContent?.image?.avatar?.image?.[0]?.url, // From PageHeader
      microformat?.avatar?.[0]?.url, // From MicroformatData
      channel.header?.channel_header?.author?.thumbnails?.[0]?.url, // Another common path
      channel.header?.author?.thumbnails?.[0]?.url // Fallback path
    ];
    avatarUrl = potentialAvatars.find(url => url && (url.startsWith('http://') || url.startsWith('https://'))) || avatarUrl;

    let bannerUrl = null; // Default fallback
    const potentialBanners = [
      headerContent?.banner?.image?.[0]?.url, // From PageHeader Banner
      channel.header?.banner?.thumbnails?.[0]?.url // Add fallback
    ];
    bannerUrl = potentialBanners.find(url => url && (url.startsWith('http://') || url.startsWith('https://'))) || bannerUrl;

    // Extract counts
    let subscriberCount = '';
    let videoCount = '';
    if (headerContent?.metadata?.metadata_rows?.[1]?.metadata_parts) { // PageHeader structure
      subscriberCount = headerContent.metadata.metadata_rows[1].metadata_parts[0]?.text?.text || '';
      videoCount = headerContent.metadata.metadata_rows[1].metadata_parts[1]?.text?.text || '';
    } else { // Fallback structure
      subscriberCount = channel.header?.subscriber_count?.text || channel.header?.subscribers?.text || '';
      videoCount = channel.header?.video_count?.text || '';
    }

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
router.get('/api/:id/videos', async (req, res) => {
  const youtube = await getYoutubeClient();
  const { id } = req.params;
  const { continuation } = req.query;

  try {
    let channelVideosResponse;
    const channel = await youtube.getChannel(id); // Get channel first

    if (continuation) {
      // youtubei.js usually requires fetching the next batch via a method on the previous response/object
      // This needs a more robust implementation based on how youtubei.js structures channel video continuations.
      // It might involve storing the channel object or its continuation state.
      // For now, attempting a generic continuation call which might not work as expected.
      console.warn('Channel video continuation needs verification for youtubei.js specifics');
      // This assumes getContinuation() exists and works for this context
      channelVideosResponse = await channel.getContinuation(continuation); // Pass the token if needed
    } else {
      // Initial load: Get the videos tab data
      channelVideosResponse = await channel.getVideos(); // Fetch videos from the current channel state
    }

    // Map the video data (adapt structure as needed based on actual response)
    const videos = (channelVideosResponse.videos || channelVideosResponse.items || []).map(video => ({
      id: video.id,
      title: video.title?.text || video.title || 'Untitled',
      duration: video.duration?.text || '0:00', // Use formatDuration if needed
      viewCount: video.short_view_count?.text || video.view_count?.text || '0 views', // Use formatViewCount if needed
      uploadedAt: video.published?.text || video.published_time || 'Unknown date', // Check multiple fields
      thumbnails: video.thumbnails || [],
      channel: { // Include channel info for consistency, even if redundant here
        id: id,
        name: video.author?.name || channel.header?.channel_header?.title?.text || 'Unknown', // Try to get channel name from main object too
        avatar: video.author?.thumbnails?.[0]?.url || channel.header?.channel_header?.author?.thumbnails?.[0]?.url, // Add fallback
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
    res.status(500).json({ error: `Failed to retrieve channel videos: ${error.message}` });
  }
});

export default router;