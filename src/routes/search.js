import express from 'express';
import getYoutubeClient from '../utils/youtubeClient.js';
import { separateVideosAndShorts } from '../utils/shortsDetection.js';
import { filterBlockedChannels } from '../utils/contentFilter.js';

const router = express.Router();

// Search videos
router.get('/', async (req, res) => {
  const youtube = await getYoutubeClient();
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Missing search query' });
    }
    const results = await youtube.search(query);

    // Transform the results to ensure we have all required fields
    const videos = Array.isArray(results.videos) ? results.videos.map(video => ({
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

    // Filter out videos from blocked channels
    const filteredVideos = await filterBlockedChannels(videos);

    // Check if we should separate videos and Shorts or filter for Shorts only
    const filterShorts = req.query.shorts_only === 'true';
    const separateContent = req.query.separate === 'true';
    const filterOutShorts = req.query.filter_shorts === 'false'; // Default is to filter out shorts

    if (filterShorts) {
      const { shorts } = separateVideosAndShorts(filteredVideos);
      res.json(shorts);
    } else if (separateContent) {
      const separated = separateVideosAndShorts(filteredVideos);
      res.json(separated);
    } else if (filterOutShorts !== false) { // Default behavior: filter out shorts
      const { videos } = separateVideosAndShorts(filteredVideos);
      console.log(`🎬 SEARCH FILTERED SHORTS: Showing ${videos.length} regular videos (${filteredVideos.length - videos.length} shorts filtered out)`);
      res.json(videos);
    } else {
      res.json(filteredVideos);
    }
  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({ error: `Search failed: ${error.message}` });
  }
});

export default router;