import express from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import * as PlaylistsRepo from '../db/playlistsRepository.js';
import { generateUniquePlaylistName } from '../db/playlistsRepository.js';

const router = express.Router();

// Multer configuration for handling file uploads in memory
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Get all playlists
router.get('/', async (req, res) => {
  try {
    const playlists = await PlaylistsRepo.getAllPlaylists();
    // Sort playlists: default first, then by name ascending
    playlists.sort((a, b) => {
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;
      // Optionally, sort non-default playlists alphabetically
      return a.name.localeCompare(b.name);
    });
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

// Set a playlist as default
router.put('/:id/default', async (req, res) => {
  const playlistId = parseInt(req.params.id, 10);
  if (isNaN(playlistId)) {
    return res.status(400).json({ error: 'Invalid playlist ID' });
  }
  try {
    await PlaylistsRepo.setDefaultPlaylist(playlistId);
    res.status(200).json({ message: `Playlist ${playlistId} set as default.` });
  } catch (error) {
    console.error(`API Error PUT /api/playlists/${playlistId}/default:`, error);
    if (error.message?.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: `Failed to set playlist ${playlistId} as default: ${error.message}` });
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

// API: Import Playlists from FreeTube NDJSON
router.post('/import', upload.single('playlistsFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No playlists file uploaded.' });
  }

  try {
    const fileBuffer = req.file.buffer;
    const fileContent = fileBuffer.toString('utf8');
    const lines = fileContent.split('\n').filter(line => line.trim());

    let importedPlaylists = 0;
    let importedVideos = 0;
    const errors = [];

    for (const line of lines) {
      try {
        const playlistData = JSON.parse(line);

        // Extract playlist info
        const playlistName = playlistData.playlistName;
        const description = playlistData.description || '';
        const videos = playlistData.videos || [];

        if (!playlistName) {
          console.warn('Skipping playlist due to missing name:', playlistData);
          continue;
        }

        // Skip protected playlists like "Favorites" if needed
        if (playlistData.protected && playlistName === 'Favorites') {
          console.info(`Skipping protected playlist: ${playlistName}`);
          continue;
        }

        try {
          // Create or get playlist
          const playlistId = await PlaylistsRepo.createPlaylist(playlistName, description);
          importedPlaylists++;

          // Add videos to playlist
          for (const video of videos) {
            try {
              const videoId = video.videoId;
              const title = video.title || 'Unknown Title';
              const channelName = video.author || 'Unknown Channel';
              const thumbnailUrl = video.thumbnailUrl || null;

              if (videoId && title) {
                await PlaylistsRepo.addVideoToPlaylist(
                  playlistId,
                  videoId,
                  title,
                  channelName,
                  thumbnailUrl
                );
                importedVideos++;
              }
            } catch (videoError) {
              console.error(`Error adding video to playlist ${playlistName}:`, videoError.message);
              // Continue with other videos
            }
          }
        } catch (playlistError) {
          if (playlistError.message?.includes('UNIQUE constraint failed')) {
            console.info(`Playlist "${playlistName}" already exists, creating with unique name`);
            try {
              // Generate a unique name and create new playlist
              const uniqueName = await generateUniquePlaylistName(playlistName);
              console.info(`Creating playlist with unique name: "${uniqueName}"`);

              const playlistId = await PlaylistsRepo.createPlaylist(uniqueName, description);
              importedPlaylists++;

              // Add videos to the new playlist
              for (const video of videos) {
                try {
                  const videoId = video.videoId;
                  const title = video.title || 'Unknown Title';
                  const channelName = video.author || 'Unknown Channel';
                  const thumbnailUrl = video.thumbnailUrl || null;

                  if (videoId && title) {
                    await PlaylistsRepo.addVideoToPlaylist(
                      playlistId,
                      videoId,
                      title,
                      channelName,
                      thumbnailUrl
                    );
                    importedVideos++;
                  }
                } catch (videoError) {
                  console.error(`Error adding video to playlist ${uniqueName}:`, videoError.message);
                  // Continue with other videos
                }
              }
            } catch (uniqueError) {
              errors.push(`Failed to create playlist with unique name for "${playlistName}": ${uniqueError.message}`);
            }
          } else {
            errors.push(`Failed to create playlist "${playlistName}": ${playlistError.message}`);
          }
        }
      } catch (parseError) {
        console.error('Error parsing playlist line:', parseError.message);
        errors.push(`Failed to parse playlist entry: ${parseError.message}`);
      }
    }

    console.info(`Playlist import finished. Imported ${importedPlaylists} playlists with ${importedVideos} videos.`);

    if (errors.length > 0) {
      res.status(207).json({
        message: `Import partially completed. Successfully imported ${importedPlaylists} playlists with ${importedVideos} videos. Some errors occurred.`,
        importedPlaylists,
        importedVideos,
        errors: errors
      });
    } else if (importedPlaylists > 0 || importedVideos > 0) {
      res.status(200).json({
        message: `Import successful. Added ${importedPlaylists} playlists with ${importedVideos} videos.`,
        importedPlaylists,
        importedVideos
      });
    } else {
      res.status(400).json({ message: 'Import failed. No valid playlist entries found in the file.' });
    }
  } catch (error) {
    console.error('Playlist Import Error:', error);
    res.status(500).json({ error: `Failed to import playlists: ${error.message}` });
  }
});

export default router;