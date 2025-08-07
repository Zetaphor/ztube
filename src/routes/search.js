import express from 'express';
import getYoutubeClient from '../utils/youtubeClient.js';
import { separateVideosAndShorts } from '../utils/shortsDetection.js';
import { filterBlockedChannels } from '../utils/contentFilter.js';

const router = express.Router();

// Function to sort videos based on sort parameter
function sortVideos(videos, sortBy) {
  const sortedVideos = [...videos]; // Create a copy to avoid mutating original array

  switch (sortBy) {
    case 'newest':
      // Sort by upload date (newest first) - this will be default
      return sortedVideos.sort((a, b) => {
        // Parse upload dates for comparison
        const parseUploadDate = (dateStr) => {
          if (!dateStr || dateStr === 'Unknown date') return new Date(0);

          // Handle relative dates like "2 hours ago", "1 day ago", etc.
          const now = new Date();
          const lowerStr = dateStr.toLowerCase();

          if (lowerStr.includes('hour') || lowerStr.includes('hours')) {
            const hours = parseInt(lowerStr.match(/(\d+)/)?.[1] || '0');
            return new Date(now.getTime() - hours * 60 * 60 * 1000);
          } else if (lowerStr.includes('day') || lowerStr.includes('days')) {
            const days = parseInt(lowerStr.match(/(\d+)/)?.[1] || '0');
            return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
          } else if (lowerStr.includes('week') || lowerStr.includes('weeks')) {
            const weeks = parseInt(lowerStr.match(/(\d+)/)?.[1] || '0');
            return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
          } else if (lowerStr.includes('month') || lowerStr.includes('months')) {
            const months = parseInt(lowerStr.match(/(\d+)/)?.[1] || '0');
            return new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
          } else if (lowerStr.includes('year') || lowerStr.includes('years')) {
            const years = parseInt(lowerStr.match(/(\d+)/)?.[1] || '0');
            return new Date(now.getTime() - years * 365 * 24 * 60 * 60 * 1000);
          }

          // Try to parse as regular date
          return new Date(dateStr);
        };

        const dateA = parseUploadDate(a.uploadedAt);
        const dateB = parseUploadDate(b.uploadedAt);
        return dateB.getTime() - dateA.getTime(); // Newest first
      });

    case 'oldest':
      // Sort by upload date (oldest first)
      return sortedVideos.sort((a, b) => {
        const parseUploadDate = (dateStr) => {
          if (!dateStr || dateStr === 'Unknown date') return new Date(0);

          const now = new Date();
          const lowerStr = dateStr.toLowerCase();

          if (lowerStr.includes('hour') || lowerStr.includes('hours')) {
            const hours = parseInt(lowerStr.match(/(\d+)/)?.[1] || '0');
            return new Date(now.getTime() - hours * 60 * 60 * 1000);
          } else if (lowerStr.includes('day') || lowerStr.includes('days')) {
            const days = parseInt(lowerStr.match(/(\d+)/)?.[1] || '0');
            return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
          } else if (lowerStr.includes('week') || lowerStr.includes('weeks')) {
            const weeks = parseInt(lowerStr.match(/(\d+)/)?.[1] || '0');
            return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
          } else if (lowerStr.includes('month') || lowerStr.includes('months')) {
            const months = parseInt(lowerStr.match(/(\d+)/)?.[1] || '0');
            return new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
          } else if (lowerStr.includes('year') || lowerStr.includes('years')) {
            const years = parseInt(lowerStr.match(/(\d+)/)?.[1] || '0');
            return new Date(now.getTime() - years * 365 * 24 * 60 * 60 * 1000);
          }

          return new Date(dateStr);
        };

        const dateA = parseUploadDate(a.uploadedAt);
        const dateB = parseUploadDate(b.uploadedAt);
        return dateA.getTime() - dateB.getTime(); // Oldest first
      });

    case 'views':
      // Sort by view count (highest first)
      return sortedVideos.sort((a, b) => {
        const parseViews = (viewStr) => {
          if (!viewStr) return 0;
          const match = viewStr.match(/[\d,]+/);
          if (!match) return 0;
          return parseInt(match[0].replace(/,/g, ''));
        };

        return parseViews(b.viewCount) - parseViews(a.viewCount);
      });

    case 'duration':
      // Sort by duration (longest first)
      return sortedVideos.sort((a, b) => {
        return (b.durationSeconds || 0) - (a.durationSeconds || 0);
      });

    case 'relevance':
    default:
      // Return videos in original order (YouTube's default relevance sorting)
      return sortedVideos;
  }
}

// Search videos
router.get('/', async (req, res) => {
  const youtube = await getYoutubeClient();
  try {
    const { query, sort } = req.query;
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

    // Get sort parameter (default to 'newest' for newest first)
    const sortBy = sort || 'newest';

    if (filterShorts) {
      const { shorts } = separateVideosAndShorts(filteredVideos);
      const sortedShorts = sortVideos(shorts, sortBy);
      res.json(sortedShorts);
    } else if (separateContent) {
      const separated = separateVideosAndShorts(filteredVideos);
      const sortedVideos = sortVideos(separated.videos, sortBy);
      const sortedShorts = sortVideos(separated.shorts, sortBy);
      res.json({ videos: sortedVideos, shorts: sortedShorts });
    } else if (filterOutShorts !== false) { // Default behavior: filter out shorts
      const { videos } = separateVideosAndShorts(filteredVideos);
      const sortedVideos = sortVideos(videos, sortBy);
      console.log(`🎬 SEARCH FILTERED SHORTS: Showing ${sortedVideos.length} regular videos (${filteredVideos.length - sortedVideos.length} shorts filtered out)`);
      res.json(sortedVideos);
    } else {
      const sortedVideos = sortVideos(filteredVideos, sortBy);
      res.json(sortedVideos);
    }
  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({ error: `Search failed: ${error.message}` });
  }
});

export default router;