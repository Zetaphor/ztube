import express from 'express';
import * as WatchHistoryRepo from '../db/watchHistoryRepository.js';

const router = express.Router();

// Get watch history with pagination
router.get('/', async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = parseInt(req.query.offset, 10) || 0;
  try {
    const history = await WatchHistoryRepo.getWatchHistory(limit, offset);
    res.json(history);
  } catch (error) {
    console.error('API Error GET /api/watch-history:', error);
    res.status(500).json({ error: 'Failed to retrieve watch history' });
  }
});

// Add or update watch history entry
router.post('/', async (req, res) => {
  const { videoId, title, channelName, channelId, durationSeconds, watchedSeconds, thumbnailUrl } = req.body;
  // Basic validation
  if (!videoId || !title || !channelName || !channelId || typeof durationSeconds !== 'number' || typeof watchedSeconds !== 'number') {
    return res.status(400).json({ error: 'Missing or invalid fields in request body for watch history entry' });
  }
  try {
    await WatchHistoryRepo.upsertWatchHistory(videoId, title, channelName, channelId, durationSeconds, watchedSeconds, thumbnailUrl);
    res.status(201).json({ message: `Watch history entry added/updated for video ${videoId}` });
  } catch (error) {
    console.error(`API Error POST /api/watch-history (videoId: ${videoId}):`, error);
    res.status(500).json({ error: `Failed to add/update watch history for video ${videoId}: ${error.message}` });
  }
});

// Get a specific watch history entry
router.get('/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId in request parameters' });
  }
  try {
    const entry = await WatchHistoryRepo.getWatchHistoryEntry(videoId);
    if (entry) {
      res.json(entry);
    } else {
      res.status(404).json({ message: 'No watch history found for this video.' });
    }
  } catch (error) {
    console.error(`API Error GET /api/watch-history/${videoId}:`, error);
    res.status(500).json({ error: `Failed to retrieve watch history entry for video ${videoId}: ${error.message}` });
  }
});

// Update watch progress for a specific video
router.put('/:videoId/progress', async (req, res) => {
  const { videoId } = req.params;
  const { watchedSeconds } = req.body;
  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId in request parameters' });
  }
  if (typeof watchedSeconds !== 'number') {
    return res.status(400).json({ error: 'Missing or invalid watchedSeconds in request body' });
  }
  try {
    await WatchHistoryRepo.updateWatchProgress(videoId, watchedSeconds);
    res.status(200).json({ message: `Watch progress updated for video ${videoId}` });
  } catch (error) {
    console.error(`API Error PUT /api/watch-history/${videoId}/progress:`, error);
    res.status(500).json({ error: `Failed to update watch progress for video ${videoId}: ${error.message}` });
  }
});

// Delete a specific watch history entry
router.delete('/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId in request parameters' });
  }
  try {
    await WatchHistoryRepo.deleteWatchHistoryEntry(videoId);
    res.status(200).json({ message: `Watch history entry deleted for video ${videoId}` });
  } catch (error) {
    console.error(`API Error DELETE /api/watch-history/${videoId}:`, error);
    res.status(500).json({ error: `Failed to delete watch history entry for video ${videoId}: ${error.message}` });
  }
});

// Clear all watch history
router.delete('/', async (req, res) => {
  try {
    await WatchHistoryRepo.clearWatchHistory();
    res.status(200).json({ message: 'Watch history cleared successfully.' });
  } catch (error) {
    console.error('API Error DELETE /api/watch-history:', error);
    res.status(500).json({ error: 'Failed to clear watch history' });
  }
});

export default router;