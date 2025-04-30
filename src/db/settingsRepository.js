import db from './database.js';

/**
 * Retrieves a specific setting value.
 * @param {string} key - The setting key.
 * @returns {Promise<string|null>} - The setting value or null if not found.
 */
export const getSetting = (key) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      if (err) {
        console.error(`Error getting setting '${key}':`, err.message);
        return reject(err);
      }
      resolve(row ? row.value : null);
    });
  });
};

/**
 * Retrieves all settings.
 * @returns {Promise<Record<string, string>>} - An object containing all settings.
 */
export const getAllSettings = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT key, value FROM settings', [], (err, rows) => {
      if (err) {
        console.error('Error getting all settings:', err.message);
        return reject(err);
      }
      const settings = rows.reduce((acc, row) => {
        acc[row.key] = row.value;
        return acc;
      }, {});
      resolve(settings);
    });
  });
};

/**
 * Updates or inserts a setting.
 * @param {string} key - The setting key.
 * @param {string} value - The setting value.
 * @returns {Promise<void>}
 */
export const setSetting = (key, value) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value], function (err) {
      if (err) {
        console.error(`Error setting setting '${key}':`, err.message);
        return reject(err);
      }
      console.log(`Setting '${key}' set to '${value}'. Changes: ${this.changes}`);
      resolve();
    });
  });
};