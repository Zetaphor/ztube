import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { Innertube } from 'youtubei.js';
import youtubeDl from 'youtube-dl-exec';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Initialize YouTube client
let youtube;
(async () => {
  youtube = await Innertube.create();
})();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));
app.set('view engine', 'ejs');
app.set('views', join(__dirname, '../views'));

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

// Search videos
app.get('/api/search', async (req, res) => {
  try {
    const { query } = req.query;
    const results = await youtube.search(query);

    // Transform the results to ensure we have all required fields
    const videos = Array.isArray(results.videos) ? results.videos.map(video => ({
      id: video.id,
      title: video.title?.text || video.title,
      duration: video.duration?.text || '0:00',
      viewCount: video.short_view_count?.text || video.view_count?.text || '0 views',
      uploadedAt: video.published?.text || 'Unknown date',
      thumbnails: video.thumbnails || [],
      channel: {
        name: video.author?.name || 'Unknown',
        avatar: video.author?.thumbnails || [],
        verified: video.author?.is_verified || false
      }
    })) : [];

    res.json(videos);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get video details
app.get('/api/video/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const video = await youtube.getInfo(id);

    // Debug logging
    console.log('Raw video info:', video.basic_info);
    console.log('Channel info:', video.basic_info.channel);

    // Transform the response to include all necessary information
    const videoDetails = {
      id: video.basic_info.id,
      title: video.basic_info.title?.text || video.basic_info.title,
      description: video.basic_info.description || '',
      view_count: typeof video.basic_info.view_count === 'number'
        ? formatViewCount(video.basic_info.view_count)
        : video.basic_info.view_count?.text || '0 views',
      like_count: video.basic_info.like_count?.text || video.basic_info.like_count,
      published: video.basic_info.publish_date || video.basic_info.published?.text || video.basic_info.published || 'Unknown date',
      author: {
        id: video.basic_info.channel?.id,
        name: video.basic_info.channel?.name?.text || video.basic_info.channel?.name,
        thumbnails: Array.isArray(video.basic_info.channel?.thumbnails) && video.basic_info.channel.thumbnails.length > 0
          ? video.basic_info.channel.thumbnails
          : [{ url: '/img/default-avatar.svg', width: 48, height: 48 }],
        subscriber_count: video.basic_info.channel?.subscriber_count?.text || video.basic_info.channel?.subscriber_count || '',
        verified: video.basic_info.channel?.is_verified
      },
      thumbnails: video.basic_info.thumbnails || [],
      duration: video.basic_info.duration?.text || formatDuration(video.basic_info.duration),
      is_live: video.basic_info.is_live
    };

    // Debug logging
    console.log('Transformed video details:', videoDetails);

    res.json(videoDetails);
  } catch (error) {
    console.error('Video details error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions for formatting
function formatViewCount(count) {
  if (!count) return '0 views';

  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M views`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K views`;
  }
  return `${count} views`;
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${padZero(minutes)}:${padZero(secs)}`;
  }
  return `${minutes}:${padZero(secs)}`;
}

function padZero(num) {
  return num.toString().padStart(2, '0');
}

// Get comments
app.get('/api/comments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { continuation } = req.query;

    let commentsData;
    if (continuation) {
      commentsData = await youtube.getComments(continuation);
    } else {
      commentsData = await youtube.getComments(id);
    }

    // Debug logging
    console.log('Raw comments data:', commentsData);

    // Check if we have valid comments data
    if (!commentsData || !commentsData.contents) {
      console.log('No comments data found');
      return res.json({
        comments: [],
        continuation: null
      });
    }

    // Extract comments from the CommentThread objects
    const extractedComments = [];
    commentsData.contents.forEach(thread => {
      if (thread.comment) {
        const commentView = thread.comment;
        extractedComments.push({
          id: commentView.comment_id || '',
          content: commentView.content?.text || '',
          published: commentView.published_time || '',
          author: {
            id: commentView.author?.id || '',
            name: commentView.author?.name || 'Unknown',
            thumbnails: commentView.author?.thumbnails || []
          },
          like_count: commentView.like_count || '0',
          reply_count: commentView.reply_count || '0'
        });
      }
    });

    // Debug logging
    console.log('Extracted comments:', extractedComments);

    res.json({
      comments: extractedComments,
      continuation: commentsData.page?.continuation_item?.continuation || null
    });
  } catch (error) {
    console.error('Comments error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get channel details
app.get('/api/channel/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const channel = await youtube.getChannel(id);
    res.json(channel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download video (if enabled)
app.get('/api/download/:id', async (req, res) => {
  if (!process.env.ENABLE_DOWNLOADS === 'true') {
    return res.status(403).json({ error: 'Downloads are disabled' });
  }

  try {
    const { id } = req.params;
    const { quality = 'best' } = req.query;
    const downloadDir = process.env.DOWNLOAD_DIR || './downloads';

    // Select format based on quality preference
    let format = 'bestvideo+bestaudio/best';  // Default to highest quality video+audio
    if (quality === 'audio') {
      format = 'bestaudio';
    } else if (quality === '720p') {
      format = 'bestvideo[height<=720]+bestaudio/best[height<=720]';
    } else if (quality === '1080p') {
      format = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]';
    }

    const options = {
      output: join(downloadDir, '%(title)s.%(ext)s'),
      format: format,
      noWarnings: true,
      noCallHome: true
    };

    await youtubeDl(`https://youtube.com/watch?v=${id}`, options);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});