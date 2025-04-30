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
 * Gets watch history entries, most recent first.
 * @param {number} [limit=50] - Number of entries to retrieve.
 * @param {number} [offset=0] - Offset for pagination.
 * @returns {Promise<Array<object>>}
 */
export const getWatchHistory = (limit = 50, offset = 0) => {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT video_id, title, channel_name, channel_id, watched_at, duration_seconds, watched_seconds, thumbnail_url FROM watch_history ORDER BY watched_at DESC LIMIT ? OFFSET ?',
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
 * Deletes a specific entry from watch history.
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