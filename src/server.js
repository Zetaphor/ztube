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
const port = process.env.PORT || 4420;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));
app.set('view engine', 'ejs');
app.set('views', join(__dirname, '../views'));

app.get('/', (req, res) => {
  res.render('subscriptions');
});

// Route for listing all playlists
app.get('/playlists', (req, res) => {
  res.render('playlists');
});

// Route for viewing a specific playlist
app.get('/playlists/:id', (req, res) => {
  res.render('playlistDetail', { playlistId: req.params.id });
});

// Mount Routers
app.use('/api/search', searchRouter);
app.use('/api/video', videoRouter);
app.use('/channel', channelRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/playlists', playlistsRouter);
app.use('/api/watch-history', watchHistoryRouter);
app.use('/api/hidden', hiddenContentRouter);
app.use('/api/settings', settingsRouter);

// Start server
app.listen(port, () => {
  console.info(`Server running at http://localhost:${port}`);
});