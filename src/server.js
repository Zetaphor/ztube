import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
// No longer need Innertube or specific nodes here
// No longer need db connection here, it's used in repos
// No longer need specific Repo imports here, they are used in routes
// No longer need multer, csv-parse, Readable, fetch, fast-xml-parser here

// Import routers
import searchRouter from './routes/search.js';
import videoRouter from './routes/video.js';
import channelRouter from './routes/channel.js';
import subscriptionsRouter from './routes/subscriptions.js';
import playlistsRouter from './routes/playlists.js';
import watchHistoryRouter from './routes/watchHistory.js';
import hiddenContentRouter from './routes/hiddenContent.js';
import settingsRouter from './routes/settings.js';

// Import youtube client initializer (it runs itself)
import './utils/youtubeClient.js';
// No longer need formatters here, they are imported in routes/utils

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));
app.set('view engine', 'ejs');
app.set('views', join(__dirname, '../views'));

app.get('/', (req, res) => {
  res.render('index');
});

// Mount Routers
app.use('/api/search', searchRouter);
app.use('/api/video', videoRouter); // Handles /api/video/:id, /api/video/:id/comments, /api/video/:id/recommendations
app.use('/channel', channelRouter); // Handles /channel/:id, /api/channel/:id, /api/channel/:id/videos
app.use('/subscriptions', subscriptionsRouter); // Handles /subscriptions page ONLY
app.use('/api/subscriptions', subscriptionsRouter); // Mount for API routes (e.g., /api/subscriptions/feed, /api/subscriptions/:channelId/status)
app.use('/api/playlists', playlistsRouter); // Handles all /api/playlists/*
app.use('/api/watch-history', watchHistoryRouter); // Handles all /api/watch-history/*
app.use('/api/hidden', hiddenContentRouter); // Handles /api/hidden/channels/* and /api/hidden/keywords/*
app.use('/api/settings', settingsRouter); // Handles /api/settings/*

// Start server
app.listen(port, () => {
  console.info(`Server running at http://localhost:${port}`);
});