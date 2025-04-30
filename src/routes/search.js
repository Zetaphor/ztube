import express from 'express';
import getYoutubeClient from '../utils/youtubeClient.js';

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
    console.error('Search API error:', error);
    res.status(500).json({ error: `Search failed: ${error.message}` });
  }
});

export default router;