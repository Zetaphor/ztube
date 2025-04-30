import db from './database.js';

/**
 * Adds a subscription.
 * @param {string} channelId
 * @param {string} name
 * @param {string} [avatarUrl]
 * @returns {Promise<void>}
 */
export const addSubscription = (channelId, name, avatarUrl = null) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR IGNORE INTO subscriptions (channel_id, name, avatar_url) VALUES (?, ?, ?)',
      [channelId, name, avatarUrl],
      function (err) {
        if (err) {
          console.error(`Error adding subscription '${channelId}':`, err.message);
          return reject(err);
        }
        console.log(`Subscription added/ignored '${channelId}'. Changes: ${this.changes}`);
        resolve();
      }
    );
  });
};

/**
 * Removes a subscription.
 * @param {string} channelId
 * @returns {Promise<void>}
 */
export const removeSubscription = (channelId) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM subscriptions WHERE channel_id = ?', [channelId], function (err) {
      if (err) {
        console.error(`Error removing subscription '${channelId}':`, err.message);
        return reject(err);
      }
      console.log(`Subscription removed '${channelId}'. Changes: ${this.changes}`);
      resolve();
    });
  });
};

/**
 * Gets all subscriptions.
 * @returns {Promise<Array<object>>} - Array of subscription objects.
 */
export const getAllSubscriptions = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT channel_id, name, avatar_url, subscribed_at FROM subscriptions ORDER BY name COLLATE NOCASE ASC', [], (err, rows) => {
      if (err) {
        console.error('Error getting subscriptions:', err.message);
        return reject(err);
      }
      resolve(rows || []);
    });
  });
};

/**
 * Checks if a channel is subscribed.
 * @param {string} channelId
 * @returns {Promise<boolean>}
 */
export const isSubscribed = (channelId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT 1 FROM subscriptions WHERE channel_id = ?', [channelId], (err, row) => {
      if (err) {
        console.error(`Error checking subscription for '${channelId}':`, err.message);
        return reject(err);
      }
      resolve(!!row);
    });
  });
};