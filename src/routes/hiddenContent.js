import express from 'express';
import * as HiddenContentRepo from '../db/hiddenContentRepository.js';

const router = express.Router();

// --- Hidden Channels ---

// Get all hidden channels
router.get('/channels', async (req, res) => {
  try {
    const channels = await HiddenContentRepo.getAllHiddenChannels();
    res.json(channels);
  } catch (error) {
    console.error('API Error GET /api/hidden/channels:', error);
    res.status(500).json({ error: 'Failed to retrieve hidden channels' });
  }
});

// Hide a channel
router.post('/channels', async (req, res) => {
  const { channelId, name } = req.body;
  if (!channelId || !name) {
    return res.status(400).json({ error: 'Missing channelId or name in request body' });
  }
  try {
    await HiddenContentRepo.addHiddenChannel(channelId, name);
    res.status(201).json({ message: `Channel ${channelId} hidden successfully.` });
  } catch (error) {
    console.error(`API Error POST /api/hidden/channels (channelId: ${channelId}):`, error);
    res.status(500).json({ error: `Failed to hide channel ${channelId}: ${error.message}` });
  }
});

// Unhide a channel
router.delete('/channels/:channelId', async (req, res) => {
  const { channelId } = req.params;
  if (!channelId) {
    return res.status(400).json({ error: 'Missing channelId in request parameters' });
  }
  try {
    await HiddenContentRepo.removeHiddenChannel(channelId);
    res.status(200).json({ message: `Channel ${channelId} unhidden successfully.` });
  } catch (error) {
    console.error(`API Error DELETE /api/hidden/channels/${channelId}:`, error);
    res.status(500).json({ error: `Failed to unhide channel ${channelId}: ${error.message}` });
  }
});

// --- Hidden Keywords ---

// Get all hidden keywords
router.get('/keywords', async (req, res) => {
  try {
    const keywords = await HiddenContentRepo.getAllHiddenKeywords();
    // Return just the keyword strings for simplicity
    res.json(keywords.map(k => k.keyword));
  } catch (error) {
    console.error('API Error GET /api/hidden/keywords:', error);
    res.status(500).json({ error: 'Failed to retrieve hidden keywords' });
  }
});

// Hide a keyword
router.post('/keywords', async (req, res) => {
  const { keyword } = req.body;
  if (!keyword || typeof keyword !== 'string' || keyword.trim() === '') {
    return res.status(400).json({ error: 'Missing or invalid keyword in request body' });
  }
  const trimmedKeyword = keyword.trim();
  try {
    await HiddenContentRepo.addHiddenKeyword(trimmedKeyword);
    res.status(201).json({ message: `Keyword "${trimmedKeyword}" hidden successfully.` });
  } catch (error) {
    console.error(`API Error POST /api/hidden/keywords (keyword: ${trimmedKeyword}):`, error);
    res.status(500).json({ error: `Failed to hide keyword "${trimmedKeyword}": ${error.message}` });
  }
});

// Unhide a keyword (using DELETE with body)
router.delete('/keywords', async (req, res) => {
  const { keyword } = req.body; // Get keyword from body for DELETE
  if (!keyword || typeof keyword !== 'string' || keyword.trim() === '') {
    return res.status(400).json({ error: 'Missing or invalid keyword in request body' });
  }
  const trimmedKeyword = keyword.trim();
  try {
    await HiddenContentRepo.removeHiddenKeyword(trimmedKeyword);
    res.status(200).json({ message: `Keyword "${trimmedKeyword}" unhidden successfully.` });
  } catch (error) {
    console.error(`API Error DELETE /api/hidden/keywords (keyword: ${trimmedKeyword}):`, error);
    res.status(500).json({ error: `Failed to remove hidden keyword "${trimmedKeyword}": ${error.message}` });
  }
});

export default router;