import express from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import * as WatchHistoryRepo from '../db/watchHistoryRepository.js';

const router = express.Router();

// Multer configuration for handling file uploads in memory
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Get watch history with pagination and sorting
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const offset = (page - 1) * limit;
  const sort = req.query.sort || 'recent';

  try {
    const history = await WatchHistoryRepo.getWatchHistory(limit, offset, sort);
    res.json({ history, page, limit });
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

// Delete a specific watch history entry by ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Missing entry ID in request parameters' });
  }
  try {
    await WatchHistoryRepo.deleteWatchHistoryEntryById(id);
    res.status(200).json({ message: `Watch history entry deleted` });
  } catch (error) {
    console.error(`API Error DELETE /api/watch-history/${id}:`, error);
    res.status(500).json({ error: `Failed to delete watch history entry: ${error.message}` });
  }
});

// Delete a specific watch history entry by video ID (keep for backward compatibility)
router.delete('/video/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId in request parameters' });
  }
  try {
    await WatchHistoryRepo.deleteWatchHistoryEntry(videoId);
    res.status(200).json({ message: `Watch history entry deleted for video ${videoId}` });
  } catch (error) {
    console.error(`API Error DELETE /api/watch-history/video/${videoId}:`, error);
    res.status(500).json({ error: `Failed to delete watch history entry for video ${videoId}: ${error.message}` });
  }
});

// Clear all watch history
router.delete('/clear', async (req, res) => {
  try {
    await WatchHistoryRepo.clearWatchHistory();
    res.status(200).json({ message: 'Watch history cleared successfully.' });
  } catch (error) {
    console.error('API Error DELETE /api/watch-history/clear:', error);
    res.status(500).json({ error: 'Failed to clear watch history' });
  }
});

// Get watch history status for multiple videos
router.post('/batch-status', async (req, res) => {
  const { videoIds } = req.body;

  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid videoIds array in request body' });
  }

  // Basic sanitization/validation (optional, adjust as needed)
  const validVideoIds = videoIds.filter(id => typeof id === 'string' && id.length > 0);

  if (validVideoIds.length === 0) {
    return res.status(400).json({ error: 'No valid video IDs provided' });
  }

  try {
    const historyMap = await WatchHistoryRepo.getWatchHistoryBatch(validVideoIds);
    // Convert Map to a plain object for JSON response
    const historyObject = Object.fromEntries(historyMap);
    res.json(historyObject);
  } catch (error) {
    console.error(`API Error POST /api/watch-history/batch-status for IDs [${validVideoIds.join(', ')}]:`, error);
    res.status(500).json({ error: 'Failed to retrieve batch watch history status' });
  }
});

// API: Import Watch History from FreeTube NDJSON
router.post('/import', upload.single('historyFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No history file uploaded.' });
  }

  try {
    const fileBuffer = req.file.buffer;
    const fileContent = fileBuffer.toString('utf8');
    const lines = fileContent.split('\n').filter(line => line.trim());

    let importedCount = 0;
    const errors = [];

    for (const line of lines) {
      try {
        const historyEntry = JSON.parse(line);

        // Extract relevant fields from FreeTube format
        const videoId = historyEntry.videoId;
        const title = historyEntry.title || 'Unknown Title';
        const channelName = historyEntry.author || 'Unknown Channel';
        const channelId = historyEntry.authorId || '';
        const durationSeconds = historyEntry.lengthSeconds || 0;

        // Calculate watched seconds from FreeTube's watchProgress (percentage)
        const watchProgress = historyEntry.watchProgress || 0;
        const watchedSeconds = Math.floor((watchProgress / 100) * durationSeconds);

        // Convert FreeTube timestamp from milliseconds to Unix seconds
        const timeWatchedMs = historyEntry.timeWatched || Date.now();
        const timeWatchedSeconds = Math.floor(timeWatchedMs / 1000);

        // Use FreeTube's timeWatched as the thumbnail URL placeholder (we don't have thumbnail in FreeTube export)
        const thumbnailUrl = null;

        if (videoId && title) {
          await WatchHistoryRepo.upsertWatchHistoryWithTimestamp(
            videoId,
            title,
            channelName,
            channelId,
            durationSeconds,
            watchedSeconds,
            thumbnailUrl,
            timeWatchedSeconds
          );
          importedCount++;
        } else {
          console.warn('Skipping entry due to missing videoId or title:', historyEntry);
        }
      } catch (parseError) {
        console.error('Error parsing line:', parseError.message);
        errors.push(`Failed to parse entry: ${parseError.message}`);
      }
    }

    console.info(`History import finished. Imported ${importedCount} entries.`);

    if (errors.length > 0) {
      res.status(207).json({
        message: `Import partially completed. Successfully imported ${importedCount} history entries. Some errors occurred.`,
        imported: importedCount,
        errors: errors
      });
    } else if (importedCount > 0) {
      res.status(200).json({
        message: `Import successful. Added or updated ${importedCount} history entries.`,
        imported: importedCount
      });
    } else {
      res.status(400).json({ message: 'Import failed. No valid history entries found in the file.' });
    }
  } catch (error) {
    console.error('History Import Error:', error);
    res.status(500).json({ error: `Failed to import history: ${error.message}` });
  }
});

export default router;