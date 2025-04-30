import db from './database.js';

/**
 * Creates a new playlist.
 * @param {string} name
 * @param {string} [description]
 * @returns {Promise<number>} - The ID of the newly created playlist.
 */
export const createPlaylist = (name, description = '') => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO playlists (name, description) VALUES (?, ?)',
      [name, description],
      function (err) {
        if (err) {
          console.error(`Error creating playlist '${name}':`, err.message);
          return reject(err);
        }
        console.log(`Playlist created '${name}' with ID ${this.lastID}`);
        resolve(this.lastID);
      }
    );
  });
};

/**
 * Gets all playlists.
 * @returns {Promise<Array<object>>} - Array of playlist objects.
 */
export const getAllPlaylists = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, name, description, created_at, is_default FROM playlists ORDER BY is_default ASC, name COLLATE NOCASE ASC', [], (err, rows) => {
      if (err) {
        console.error('Error getting playlists:', err.message);
        return reject(err);
      }
      resolve(rows || []);
    });
  });
};

/**
 * Gets a specific playlist by ID, including its videos.
 * @param {number} playlistId
 * @returns {Promise<object|null>} - Playlist object with videos array, or null if not found.
 */
export const getPlaylistById = (playlistId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, name, description, created_at FROM playlists WHERE id = ?', [playlistId], (err, playlistRow) => {
      if (err) {
        console.error(`Error getting playlist ID ${playlistId}:`, err.message);
        return reject(err);
      }
      if (!playlistRow) {
        return resolve(null); // Playlist not found
      }

      db.all('SELECT video_id, title, channel_name, thumbnail_url, added_at, sort_order FROM playlist_videos WHERE playlist_id = ? ORDER BY sort_order ASC, added_at ASC',
        [playlistId],
        (videosErr, videoRows) => {
          if (videosErr) {
            console.error(`Error getting videos for playlist ID ${playlistId}:`, videosErr.message);
            return reject(videosErr);
          }
          playlistRow.videos = videoRows || [];
          resolve(playlistRow);
        }
      );
    });
  });
};

/**
 * Updates playlist details (name, description).
 * @param {number} playlistId
 * @param {string} name
 * @param {string} description
 * @returns {Promise<void>}
 */
export const updatePlaylistDetails = (playlistId, name, description) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE playlists SET name = ?, description = ? WHERE id = ?',
      [name, description, playlistId],
      function (err) {
        if (err) {
          console.error(`Error updating playlist ID ${playlistId}:`, err.message);
          return reject(err);
        }
        if (this.changes === 0) {
          console.warn(`Attempted to update playlist ID ${playlistId}, but it was not found.`);
        }
        console.log(`Playlist details updated for ID ${playlistId}. Changes: ${this.changes}`);
        resolve();
      }
    );
  });
};

/**
 * Deletes a playlist.
 * @param {number} playlistId
 * @returns {Promise<void>}
 */
export const deletePlaylist = (playlistId) => {
  return new Promise((resolve, reject) => {
    // First, check if the playlist is the default one
    db.get('SELECT is_default FROM playlists WHERE id = ?', [playlistId], (err, row) => {
      if (err) {
        console.error(`Error checking default status for playlist ID ${playlistId}:`, err.message);
        return reject(err);
      }
      if (!row) {
        // Playlist doesn't exist, maybe resolve successfully or reject?
        // Rejecting for consistency, as the delete would fail anyway.
        return reject(new Error(`Playlist with ID ${playlistId} not found.`));
      }
      if (row.is_default === 1) {
        return reject(new Error('Cannot delete the default playlist.'));
      }

      // If not default, proceed with deletion
      // Foreign key constraint ON DELETE CASCADE handles deleting playlist_videos entries
      db.run('DELETE FROM playlists WHERE id = ?', [playlistId], function (err) {
        if (err) {
          console.error(`Error deleting playlist ID ${playlistId}:`, err.message);
          return reject(err);
        }
        console.log(`Playlist deleted ID ${playlistId}. Changes: ${this.changes}`);
        resolve();
      });
    });
  });
};

/**
 * Sets a specific playlist as the default.
 * Ensures only one playlist is marked as default.
 * @param {number} playlistId The ID of the playlist to set as default.
 * @returns {Promise<void>}
 */
export const setDefaultPlaylist = (playlistId) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) return reject(beginErr);

        // Step 1: Unset the current default playlist
        db.run('UPDATE playlists SET is_default = 0 WHERE is_default = 1', [], function (unsetErr) {
          if (unsetErr) {
            console.error('Error unsetting current default playlist:', unsetErr.message);
            return db.run('ROLLBACK', () => reject(unsetErr));
          }
          // console.log(`Unset previous default playlist. Changes: ${this.changes}`);

          // Step 2: Set the new default playlist
          db.run('UPDATE playlists SET is_default = 1 WHERE id = ?', [playlistId], function (setErr) {
            if (setErr) {
              console.error(`Error setting playlist ID ${playlistId} as default:`, setErr.message);
              return db.run('ROLLBACK', () => reject(setErr));
            }
            if (this.changes === 0) {
              // This means the playlist ID didn't exist
              console.warn(`Attempted to set non-existent playlist ID ${playlistId} as default.`);
              return db.run('ROLLBACK', () => reject(new Error(`Playlist with ID ${playlistId} not found.`)));
            }
            console.log(`Playlist ID ${playlistId} set as default. Changes: ${this.changes}`);

            // Step 3: Commit the transaction
            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                console.error('Error committing transaction for setting default playlist:', commitErr.message);
                return reject(commitErr);
              }
              resolve();
            });
          });
        });
      });
    });
  });
};

/**
 * Adds a video to a playlist.
 * @param {number} playlistId
 * @param {string} videoId
 * @param {string} [title]
 * @param {string} [channelName]
 * @param {string} [thumbnailUrl]
 * @returns {Promise<void>}
 */
export const addVideoToPlaylist = (playlistId, videoId, title = null, channelName = null, thumbnailUrl = null) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR IGNORE INTO playlist_videos (playlist_id, video_id, title, channel_name, thumbnail_url) VALUES (?, ?, ?, ?, ?)',
      [playlistId, videoId, title, channelName, thumbnailUrl],
      function (err) {
        if (err) {
          console.error(`Error adding video '${videoId}' to playlist ${playlistId}:`, err.message);
          return reject(err);
        }
        console.log(`Video '${videoId}' added/ignored in playlist ${playlistId}. Changes: ${this.changes}`);
        resolve();
      }
    );
  });
};

/**
 * Removes a video from a playlist.
 * @param {number} playlistId
 * @param {string} videoId
 * @returns {Promise<void>}
 */
export const removeVideoFromPlaylist = (playlistId, videoId) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM playlist_videos WHERE playlist_id = ? AND video_id = ?',
      [playlistId, videoId],
      function (err) {
        if (err) {
          console.error(`Error removing video '${videoId}' from playlist ${playlistId}:`, err.message);
          return reject(err);
        }
        console.log(`Video '${videoId}' removed from playlist ${playlistId}. Changes: ${this.changes}`);
        resolve();
      }
    );
  });
};

/**
 * Updates the sort order of videos in a playlist.
 * @param {number} playlistId
 * @param {Array<{videoId: string, sortOrder: number}>} videoOrder - Array of objects with videoId and new sortOrder.
 * @returns {Promise<void>}
 */
export const updatePlaylistVideoOrder = (playlistId, videoOrder) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) return reject(beginErr);

        const stmt = db.prepare('UPDATE playlist_videos SET sort_order = ? WHERE playlist_id = ? AND video_id = ?');
        let errorOccurred = false;

        videoOrder.forEach(item => {
          stmt.run([item.sortOrder, playlistId, item.videoId], (runErr) => {
            if (runErr) {
              console.error(`Error updating sort order for video '${item.videoId}' in playlist ${playlistId}:`, runErr.message);
              errorOccurred = true;
              // Don't reject immediately, let it try others but eventually rollback
            }
          });
        });

        stmt.finalize((finalizeErr) => {
          if (finalizeErr) {
            console.error('Error finalizing statement for playlist order update:', finalizeErr.message);
            errorOccurred = true;
          }

          if (errorOccurred) {
            db.run('ROLLBACK', (rollbackErr) => {
              if (rollbackErr) console.error('Error rolling back transaction:', rollbackErr.message);
              reject(new Error('Failed to update one or more video sort orders.'));
            });
          } else {
            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                console.error('Error committing transaction:', commitErr.message);
                return reject(commitErr);
              }
              console.log(`Updated video order for playlist ${playlistId}.`);
              resolve();
            });
          }
        });
      });
    });
  });
};