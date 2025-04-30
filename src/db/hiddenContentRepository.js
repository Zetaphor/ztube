import db from './database.js';

// --- Hidden Channels ---

/**
 * Hides a channel (adds it to the hidden list).
 * @param {string} channelId
 * @param {string} name - The name of the channel at the time of hiding.
 * @returns {Promise<void>}
 */
export const addHiddenChannel = (channelId, name) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR IGNORE INTO hidden_channels (channel_id, name) VALUES (?, ?)',
      [channelId, name],
      function (err) {
        if (err) {
          console.error(`Error hiding channel '${channelId}':`, err.message);
          return reject(err);
        }
        console.log(`Channel hidden/ignored '${channelId}'. Changes: ${this.changes}`);
        resolve();
      }
    );
  });
};

/**
 * Unhides a channel (removes it from the hidden list).
 * @param {string} channelId
 * @returns {Promise<void>}
 */
export const removeHiddenChannel = (channelId) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM hidden_channels WHERE channel_id = ?', [channelId], function (err) {
      if (err) {
        console.error(`Error unhiding channel '${channelId}':`, err.message);
        return reject(err);
      }
      console.log(`Channel unhidden '${channelId}'. Changes: ${this.changes}`);
      resolve();
    });
  });
};

/**
 * Gets all hidden channels.
 * @returns {Promise<Array<{channel_id: string, name: string, hidden_at: number}>>}
 */
export const getAllHiddenChannels = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT channel_id, name, hidden_at FROM hidden_channels ORDER BY name COLLATE NOCASE ASC', [], (err, rows) => {
      if (err) {
        console.error('Error getting hidden channels:', err.message);
        return reject(err);
      }
      resolve(rows || []);
    });
  });
};

/**
 * Checks if a specific channel is hidden.
 * @param {string} channelId
 * @returns {Promise<boolean>}
 */
export const isChannelHidden = (channelId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT 1 FROM hidden_channels WHERE channel_id = ?', [channelId], (err, row) => {
      if (err) {
        console.error(`Error checking if channel '${channelId}' is hidden:`, err.message);
        return reject(err);
      }
      resolve(!!row);
    });
  });
};

// --- Hidden Keywords ---

/**
 * Adds a keyword to the hidden list.
 * @param {string} keyword
 * @returns {Promise<void>}
 */
export const addHiddenKeyword = (keyword) => {
  return new Promise((resolve, reject) => {
    // Keyword is PRIMARY KEY COLLATE NOCASE, so INSERT OR IGNORE handles duplicates
    db.run('INSERT OR IGNORE INTO hidden_keywords (keyword) VALUES (?)', [keyword], function (err) {
      if (err) {
        console.error(`Error adding hidden keyword '${keyword}':`, err.message);
        return reject(err);
      }
      console.log(`Hidden keyword added/ignored '${keyword}'. Changes: ${this.changes}`);
      resolve();
    });
  });
};

/**
 * Removes a keyword from the hidden list.
 * @param {string} keyword
 * @returns {Promise<void>}
 */
export const removeHiddenKeyword = (keyword) => {
  return new Promise((resolve, reject) => {
    // Use the same keyword for deletion (case-insensitive due to schema)
    db.run('DELETE FROM hidden_keywords WHERE keyword = ?', [keyword], function (err) {
      if (err) {
        console.error(`Error removing hidden keyword '${keyword}':`, err.message);
        return reject(err);
      }
      console.log(`Hidden keyword removed '${keyword}'. Changes: ${this.changes}`);
      resolve();
    });
  });
};

/**
 * Gets all hidden keywords.
 * @returns {Promise<Array<{keyword: string, hidden_at: number}>>}
 */
export const getAllHiddenKeywords = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT keyword, hidden_at FROM hidden_keywords ORDER BY keyword ASC', [], (err, rows) => {
      if (err) {
        console.error('Error getting hidden keywords:', err.message);
        return reject(err);
      }
      resolve(rows || []);
    });
  });
};