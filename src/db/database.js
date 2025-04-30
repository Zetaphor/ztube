import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Determine the project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Go up two levels from src/db to the project root
const projectRoot = path.resolve(__dirname, '../../');

// TODO: In a packaged Electron app, use app.getPath('userData') for storing the DB
const dbPath = path.join(projectRoot, 'ztube.db');
const dbExists = fs.existsSync(dbPath);

console.log(`Database path: ${dbPath}`);

// Use verbose mode for more detailed stack traces during development
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE | sqlite3.OPEN_FULLMUTEX, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    // Propagate the error or handle it appropriately
    throw err;
  } else {
    console.log('Connected to the SQLite database.');
    // Enable WAL mode for better concurrency and performance
    db.run('PRAGMA journal_mode=WAL;', (walErr) => {
      if (walErr) {
        console.error('Error enabling WAL mode:', walErr.message);
      } else {
        console.log('WAL mode enabled.');
      }
    });
    // Enforce foreign key constraints
    db.run('PRAGMA foreign_keys=ON;', (fkErr) => {
      if (fkErr) {
        console.error('Error enabling foreign key constraints:', fkErr.message);
      } else {
        console.log('Foreign key constraints enabled.');
      }
    });
    // Initialize the database schema if it's a new database
    if (!dbExists) {
      console.log('Database file not found, initializing schema...');
      initializeSchema();
    } else {
      console.log('Existing database found.');
      // TODO: Implement migration logic here if needed in the future
    }
  }
});

function initializeSchema() {
  const schema = `
        -- Subscriptions Table
        CREATE TABLE IF NOT EXISTS subscriptions (
            channel_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            avatar_url TEXT,
            subscribed_at INTEGER DEFAULT (strftime('%s', 'now')) -- Unix epoch timestamp
        );

        -- Playlists Table
        CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now')) -- Unix epoch timestamp
        );

        -- Playlist Videos Table (Junction Table)
        CREATE TABLE IF NOT EXISTS playlist_videos (
            playlist_id INTEGER NOT NULL,
            video_id TEXT NOT NULL,
            title TEXT,
            channel_name TEXT,
            thumbnail_url TEXT,
            added_at INTEGER DEFAULT (strftime('%s', 'now')), -- Unix epoch timestamp
            sort_order INTEGER DEFAULT 0, -- Optional: for manual ordering
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            PRIMARY KEY (playlist_id, video_id)
        );

        -- Watch History Table
        CREATE TABLE IF NOT EXISTS watch_history (
            video_id TEXT PRIMARY KEY,
            title TEXT,
            channel_name TEXT,
            channel_id TEXT,
            watched_at INTEGER DEFAULT (strftime('%s', 'now')), -- Unix epoch timestamp (last watched)
            duration_seconds INTEGER,
            watched_seconds INTEGER DEFAULT 0,
            thumbnail_url TEXT -- Added thumbnail URL
        );
        CREATE INDEX IF NOT EXISTS idx_watch_history_watched_at ON watch_history(watched_at);

        -- Settings Table
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        -- Hidden Channels Table
        CREATE TABLE IF NOT EXISTS hidden_channels (
            channel_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            hidden_at INTEGER DEFAULT (strftime('%s', 'now'))
        );

        -- Hidden Keywords Table
        CREATE TABLE IF NOT EXISTS hidden_keywords (
            keyword TEXT PRIMARY KEY COLLATE NOCASE, -- Store keywords case-insensitively
            hidden_at INTEGER DEFAULT (strftime('%s', 'now'))
        );

        -- Default Settings (Example)
        INSERT OR IGNORE INTO settings (key, value) VALUES
            ('theme', 'dark'),
            ('autoplay', 'true'),
            ('default_quality', 'auto');
    `;

  db.exec(schema, (err) => {
    if (err) {
      console.error('Error initializing database schema:', err.message);
    } else {
      console.log('Database schema initialized successfully.');
    }
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      return console.error('Error closing database:', err.message);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});

export default db;