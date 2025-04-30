import express from 'express';
import * as PlaylistsRepo from '../db/playlistsRepository.js';

const router = express.Router();

// Get all playlists
router.get('/', async (req, res) => {
  try {
    const playlists = await PlaylistsRepo.getAllPlaylists();
    res.json(playlists);
  } catch (error) {
    console.error('API Error GET /api/playlists:', error);
    res.status(500).json({ error: 'Failed to retrieve playlists' });
  }
});

// Create a playlist
router.post('/', async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Missing playlist name in request body' });
  }
  try {
    const newPlaylistId = await PlaylistsRepo.createPlaylist(name, description);
    res.status(201).json({ id: newPlaylistId, name: name, description: description || '' });
  } catch (error) {
    console.error(`API Error POST /api/playlists (name: ${name}):`, error);
    if (error.message?.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: `Playlist with name "${name}" already exists.` });
    } else {
      res.status(500).json({ error: `Failed to create playlist "${name}": ${error.message}` });
    }
  }
});

// Get a specific playlist by ID
router.get('/:id', async (req, res) => {
  const playlistId = parseInt(req.params.id, 10);
  if (isNaN(playlistId)) {
    return res.status(400).json({ error: 'Invalid playlist ID' });
  }
  try {
    const playlist = await PlaylistsRepo.getPlaylistById(playlistId);
    if (!playlist) {
      return res.status(404).json({ error: `Playlist with ID ${playlistId} not found` });
    }
    res.json(playlist);
  } catch (error) {
    console.error(`API Error GET /api/playlists/${playlistId}:`, error);
    res.status(500).json({ error: `Failed to retrieve playlist ${playlistId}: ${error.message}` });
  }
});

// Update playlist details
router.put('/:id', async (req, res) => {
  const playlistId = parseInt(req.params.id, 10);
  const { name, description } = req.body;
  if (isNaN(playlistId)) {
    return res.status(400).json({ error: 'Invalid playlist ID' });
  }
  if (!name) { // Description can be empty/null
    return res.status(400).json({ error: 'Missing playlist name in request body' });
  }
  try {
    await PlaylistsRepo.updatePlaylistDetails(playlistId, name, description || '');
    res.status(200).json({ message: `Playlist ${playlistId} updated successfully.` });
  } catch (error) {
    console.error(`API Error PUT /api/playlists/${playlistId}:`, error);
    if (error.message?.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: `Playlist with name "${name}" already exists.` });
    } else {
      res.status(500).json({ error: `Failed to update playlist ${playlistId}: ${error.message}` });
    }
  }
});

// Delete a playlist
router.delete('/:id', async (req, res) => {
  const playlistId = parseInt(req.params.id, 10);
  if (isNaN(playlistId)) {
    return res.status(400).json({ error: 'Invalid playlist ID' });
  }
  try {
    await PlaylistsRepo.deletePlaylist(playlistId);
    res.status(200).json({ message: `Playlist ${playlistId} deleted successfully.` });
  } catch (error) {
    console.error(`API Error DELETE /api/playlists/${playlistId}:`, error);
    res.status(500).json({ error: `Failed to delete playlist ${playlistId}: ${error.message}` });
  }
});

// Add video to playlist
router.post('/:id/videos', async (req, res) => {
  const playlistId = parseInt(req.params.id, 10);
  const { videoId, title, channelName, thumbnailUrl } = req.body;
  if (isNaN(playlistId)) {
    return res.status(400).json({ error: 'Invalid playlist ID' });
  }
  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId in request body' });
  }
  try {
    await PlaylistsRepo.addVideoToPlaylist(playlistId, videoId, title, channelName, thumbnailUrl);
    res.status(201).json({ message: `Video ${videoId} added to playlist ${playlistId}` });
  } catch (error) {
    console.error(`API Error POST /api/playlists/${playlistId}/videos:`, error);
    // Could check for foreign key constraint error if playlist doesn't exist
    res.status(500).json({ error: `Failed to add video ${videoId} to playlist ${playlistId}: ${error.message}` });
  }
});

// Remove video from playlist
router.delete('/:id/videos/:videoId', async (req, res) => {
  const playlistId = parseInt(req.params.id, 10);
  const { videoId } = req.params;
  if (isNaN(playlistId)) {
    return res.status(400).json({ error: 'Invalid playlist ID' });
  }
  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId in request parameters' });
  }
  try {
    await PlaylistsRepo.removeVideoFromPlaylist(playlistId, videoId);
    res.status(200).json({ message: `Video ${videoId} removed from playlist ${playlistId}` });
  } catch (error) {
    console.error(`API Error DELETE /api/playlists/${playlistId}/videos/${videoId}:`, error);
    res.status(500).json({ error: `Failed to remove video ${videoId} from playlist ${playlistId}: ${error.message}` });
  }
});

// Update playlist video order
router.put('/:id/videos/order', async (req, res) => {
  const playlistId = parseInt(req.params.id, 10);
  const { videoOrder } = req.body;
  if (isNaN(playlistId)) {
    return res.status(400).json({ error: 'Invalid playlist ID' });
  }
  if (!Array.isArray(videoOrder) || videoOrder.some(item => !item.videoId || typeof item.sortOrder !== 'number')) {
    return res.status(400).json({ error: 'Invalid videoOrder array in request body. Expected [{videoId: string, sortOrder: number}]' });
  }
  try {
    await PlaylistsRepo.updatePlaylistVideoOrder(playlistId, videoOrder);
    res.status(200).json({ message: `Video order updated for playlist ${playlistId}` });
  } catch (error) {
    console.error(`API Error PUT /api/playlists/${playlistId}/videos/order:`, error);
    res.status(500).json({ error: `Failed to update video order for playlist ${playlistId}: ${error.message}` });
  }
});

export default router;