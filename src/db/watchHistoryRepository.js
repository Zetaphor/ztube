import db from './database.js';

/**
 * Adds or updates a video in the watch history.
 * Uses INSERT OR REPLACE to update watched_at and watched_seconds if the video already exists.
 * @param {string} videoId
 * @param {string} title
 * @param {string} channelName
 * @param {string} channelId
 * @param {number} durationSeconds
 * @param {number} watchedSeconds
 * @param {string} [thumbnailUrl]
 * @returns {Promise<void>}
 */
export const upsertWatchHistory = (videoId, title, channelName, channelId, durationSeconds, watchedSeconds, thumbnailUrl = null) => {
  return new Promise((resolve, reject) => {
    const now = Math.floor(Date.now() / 1000); // Current Unix timestamp
    db.run(
      'INSERT OR REPLACE INTO watch_history (video_id, title, channel_name, channel_id, duration_seconds, watched_seconds, thumbnail_url, watched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [videoId, title, channelName, channelId, durationSeconds, watchedSeconds, thumbnailUrl, now],
      function (err) {
        if (err) {
          console.error(`Error upserting watch history for '${videoId}':`, err.message);
          return reject(err);
        }
        console.log(`Watch history upserted for '${videoId}'. Changes: ${this.changes}`);
        resolve();
      }
    );
  });
};

/**
 * Adds or updates a video in the watch history with a custom timestamp.
 * @param {string} videoId
 * @param {string} title
 * @param {string} channelName
 * @param {string} channelId
 * @param {number} durationSeconds
 * @param {number} watchedSeconds
 * @param {string} [thumbnailUrl]
 * @param {number} customTimestamp - Unix timestamp in seconds
 * @returns {Promise<void>}
 */
export const upsertWatchHistoryWithTimestamp = (videoId, title, channelName, channelId, durationSeconds, watchedSeconds, thumbnailUrl = null, customTimestamp) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR REPLACE INTO watch_history (video_id, title, channel_name, channel_id, duration_seconds, watched_seconds, thumbnail_url, watched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [videoId, title, channelName, channelId, durationSeconds, watchedSeconds, thumbnailUrl, customTimestamp],
      function (err) {
        if (err) {
          console.error(`Error upserting watch history for '${videoId}':`, err.message);
          return reject(err);
        }
        console.log(`Watch history upserted for '${videoId}' with custom timestamp. Changes: ${this.changes}`);
        resolve();
      }
    );
  });
};

/**
 * Updates only the watched seconds and timestamp for a video.
 * @param {string} videoId
 * @param {number} watchedSeconds
 * @returns {Promise<void>}
 */
export const updateWatchProgress = (videoId, watchedSeconds) => {
  return new Promise((resolve, reject) => {
    const now = Math.floor(Date.now() / 1000); // Current Unix timestamp
    db.run(
      'UPDATE watch_history SET watched_seconds = ?, watched_at = ? WHERE video_id = ?',
      [watchedSeconds, now, videoId],
      function (err) {
        if (err) {
          console.error(`Error updating watch progress for '${videoId}':`, err.message);
          return reject(err);
        }
        if (this.changes === 0) {
          console.warn(`Attempted to update watch progress for non-existent history entry '${videoId}'.`);
        }
        // console.log(`Watch progress updated for '${videoId}'. Changes: ${this.changes}`); // Can be noisy
        resolve();
      }
    );
  });
};

/**
 * Gets watch history entries with pagination and sorting.
 * @param {number} [limit=50] - Number of entries to retrieve.
 * @param {number} [offset=0] - Offset for pagination.
 * @param {string} [sort='recent'] - Sort order: 'recent', 'oldest', 'title', 'channel'
 * @returns {Promise<Array<object>>}
 */
export const getWatchHistory = (limit = 50, offset = 0, sort = 'recent') => {
  return new Promise((resolve, reject) => {
    let orderBy = 'watched_at DESC'; // Default: most recent first

    switch (sort) {
      case 'oldest':
        orderBy = 'watched_at ASC';
        break;
      case 'title':
        orderBy = 'title ASC';
        break;
      case 'channel':
        orderBy = 'channel_name ASC';
        break;
      case 'recent':
      default:
        orderBy = 'watched_at DESC';
        break;
    }

    db.all(
      `SELECT rowid as id, video_id, title, channel_name, channel_id, watched_at, duration_seconds, watched_seconds, thumbnail_url FROM watch_history ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [limit, offset],
      (err, rows) => {
        if (err) {
          console.error('Error getting watch history:', err.message);
          return reject(err);
        }
        resolve(rows || []);
      }
    );
  });
};

/**
 * Gets a specific watch history entry by video ID.
 * @param {string} videoId
 * @returns {Promise<object|null>}
 */
export const getWatchHistoryEntry = (videoId) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT video_id, title, channel_name, channel_id, watched_at, duration_seconds, watched_seconds, thumbnail_url FROM watch_history WHERE video_id = ?',
      [videoId],
      (err, row) => {
        if (err) {
          console.error(`Error getting watch history entry for '${videoId}':`, err.message);
          return reject(err);
        }
        resolve(row || null);
      }
    );
  });
};

/**
 * Deletes a specific entry from watch history by video ID.
 * @param {string} videoId
 * @returns {Promise<void>}
 */
export const deleteWatchHistoryEntry = (videoId) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM watch_history WHERE video_id = ?', [videoId], function (err) {
      if (err) {
        console.error(`Error deleting watch history entry '${videoId}':`, err.message);
        return reject(err);
      }
      console.log(`Watch history entry deleted for '${videoId}'. Changes: ${this.changes}`);
      resolve();
    });
  });
};

/**
 * Deletes a specific entry from watch history by entry ID.
 * @param {number} id
 * @returns {Promise<void>}
 */
export const deleteWatchHistoryEntryById = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM watch_history WHERE rowid = ?', [id], function (err) {
      if (err) {
        console.error(`Error deleting watch history entry ${id}:`, err.message);
        return reject(err);
      }
      console.log(`Watch history entry deleted for ID ${id}. Changes: ${this.changes}`);
      resolve();
    });
  });
};

/**
 * Clears all watch history.
 * @returns {Promise<void>}
 */
export const clearWatchHistory = () => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM watch_history', [], function (err) {
      if (err) {
        console.error('Error clearing watch history:', err.message);
        return reject(err);
      }
      console.log(`Watch history cleared. Changes: ${this.changes}`);
      resolve();
    });
  });
};

/**
 * Gets watch history entries for a batch of video IDs.
 * @param {string[]} videoIds - An array of video IDs.
 * @returns {Promise<Map<string, object|null>>} - A Map where keys are video IDs and values are history objects or null if not found.
 */
export const getWatchHistoryBatch = (videoIds) => {
  return new Promise((resolve, reject) => {
    if (!videoIds || videoIds.length === 0) {
      return resolve(new Map());
    }
    // Create placeholders for the IN clause: (?, ?, ...)
    const placeholders = videoIds.map(() => '?').join(',');
    const sql = `
      SELECT video_id, watched_seconds, duration_seconds
      FROM watch_history
      WHERE video_id IN (${placeholders})
    `;

    db.all(sql, videoIds, (err, rows) => {
      if (err) {
        console.error(`Error getting batch watch history for IDs [${videoIds.join(', ')}]:`, err.message);
        return reject(err);
      }
      // Create a map for quick lookup
      const historyMap = new Map();
      videoIds.forEach(id => historyMap.set(id, null)); // Initialize all requested IDs with null
      rows.forEach(row => {
        if (row.video_id) {
          historyMap.set(row.video_id, {
            watchedSeconds: row.watched_seconds,
            durationSeconds: row.duration_seconds,
          });
        }
      });
      resolve(historyMap);
    });
  });
};