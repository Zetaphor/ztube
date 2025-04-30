import express from 'express';
import * as SettingsRepo from '../db/settingsRepository.js';

const router = express.Router();

// Get all settings
router.get('/', async (req, res) => {
  try {
    const settings = await SettingsRepo.getAllSettings();
    res.json(settings);
  } catch (error) {
    console.error('API Error GET /api/settings:', error);
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

// Update a setting
router.put('/', async (req, res) => {
  const { key, value } = req.body;
  if (typeof key !== 'string' || typeof value === 'undefined') {
    return res.status(400).json({ error: 'Missing or invalid key/value in request body' });
  }
  try {
    await SettingsRepo.setSetting(key, String(value)); // Ensure value is stored as string
    res.status(200).json({ message: `Setting '${key}' updated successfully.` });
  } catch (error) {
    console.error(`API Error PUT /api/settings (key: ${key}):`, error);
    res.status(500).json({ error: `Failed to update setting '${key}': ${error.message}` });
  }
});

export default router;