import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { Innertube } from 'youtubei.js';
import { YTNodes } from 'youtubei.js';
import db from './db/database.js'; // Import the database connection
import * as SettingsRepo from './db/settingsRepository.js';
import * as SubscriptionsRepo from './db/subscriptionsRepository.js';
import * as PlaylistsRepo from './db/playlistsRepository.js';
import * as WatchHistoryRepo from './db/watchHistoryRepository.js';
import * as HiddenContentRepo from './db/hiddenContentRepository.js'; // Import the new repo
import multer from 'multer'; // For file uploads
import { parse } from 'csv-parse'; // For CSV parsing
import { Readable } from 'stream'; // To create readable stream from buffer
import fetch from 'node-fetch'; // <-- Add node-fetch
import { XMLParser } from 'fast-xml-parser'; // <-- Add fast-xml-parser

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

// Multer configuration for handling CSV uploads in memory
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

// NEW: Subscriptions Page Route
app.get('/subscriptions', (req, res) => {
  res.render('subscriptions');
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
    // Keep this log uncommented for now, it's very helpful for debugging structure issues
    // console.log('Full video getInfo response:', JSON.stringify(video, null, 2));

    let chapters = [];
    let markersMap = null;

    try {
      // Safely access nested properties using optional chaining (?.)
      markersMap = video.player_overlays?.decorated_player_bar?.player_bar?.markers_map;

      // --- Process the found markersMap ---
      if (markersMap && Array.isArray(markersMap)) {
        console.info(`Found markersMap with ${markersMap.length} items.`);
        // Find the marker group with the key "DESCRIPTION_CHAPTERS"
        const chapterMarkerGroup = markersMap.find(group => group.marker_key === 'DESCRIPTION_CHAPTERS');

        if (chapterMarkerGroup?.value?.chapters && Array.isArray(chapterMarkerGroup.value.chapters)) {
          const chapterList = chapterMarkerGroup.value.chapters;
          console.info(`Found chapters list with ${chapterList.length} chapters.`);
          chapters = chapterList
            .map((chapter, index) => {
              // Safely access potentially missing nested properties
              const title = chapter?.title?.text;
              const startTimeMs = chapter?.time_range_start_millis;
              const thumbnailUrl = chapter?.thumbnail?.[0]?.url;

              if (typeof title !== 'string' || typeof startTimeMs !== 'number') {
                console.warn(`Invalid or missing data in chapter object at index ${index}:`, chapter); // Log the whole chapter object for debugging
                return null;
              }

              return {
                title: title,
                startTimeSeconds: startTimeMs / 1000,
                thumbnailUrl: thumbnailUrl || null,
              };
            })
            .filter(chapter => chapter !== null)
            .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
        } else {
          console.warn('Could not find marker group with key "DESCRIPTION_CHAPTERS" or it lacks a valid "value.chapters" array.');
        }
      } else {
        console.warn('No valid markersMap array found for chapter extraction.'); // Updated log message
      }
    } catch (e) {
      console.error("Error during chapter extraction:", e);
      chapters = []; // Ensure chapters is empty on error
    }

    const videoDetails = {
      id: video.basic_info.id,
      title: video.basic_info.title?.text || video.basic_info.title,
      description: video.secondary_info?.description?.text || video.basic_info.description || '',
      view_count: typeof video.basic_info.view_count === 'number'
        ? formatViewCount(video.basic_info.view_count)
        : video.basic_info.view_count?.text || '0 views',
      like_count: video.basic_info.like_count?.text || video.basic_info.like_count,
      published: video.basic_info.published?.text || 'Unknown date',
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
      durationSeconds: video.basic_info.duration || 0,
      is_live: video.basic_info.is_live,
      chapters: chapters,
      primary_info: video.primary_info,
      secondary_info: video.secondary_info
    };

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
    // console.log('Raw comments data:', commentsData);

    // Check if we have valid comments data
    if (!commentsData || !commentsData.contents) {
      console.warn('No comments data found');
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
    // console.log('Extracted comments:', extractedComments);

    res.json({
      comments: extractedComments,
      continuation: commentsData.page?.continuation_item?.continuation || null
    });
  } catch (error) {
    console.error('Comments error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recommended videos
app.get('/api/video/:id/recommendations', async (req, res) => {
  const { id } = req.params;
  try {
    const infoResponse = await youtube.getInfo(id);

    // console.log('Full getInfo response for recommendations:', JSON.stringify(infoResponse, null, 2)); // Optional: Log the full structure

    // --- Extract recommendations from watch_next_feed ---
    let resultsNodes = [];
    if (Array.isArray(infoResponse.watch_next_feed)) {
      resultsNodes = infoResponse.watch_next_feed;
    } else {
      console.warn(`Could not find recommendations array at infoResponse.watch_next_feed for ${id}`);
    }

    // Filter these nodes to get only video recommendations (e.g., CompactVideo)
    const recommendedVideoNodes = resultsNodes.filter(node => node.is(YTNodes.CompactVideo) || node.constructor.name === 'CompactVideoRenderer') || [];

    const recommendations = recommendedVideoNodes.map(video => {
      // Adapt mapping based on the actual node type (CompactVideo)
      return {
        id: video.id,
        title: video.title?.text || video.title || 'Untitled',
        duration: video.duration?.text || '0:00',
        viewCount: video.short_view_count?.text || video.view_count?.text || '0 views',
        uploadedAt: video.published_time_text?.text || video.published?.text || 'Unknown date',
        thumbnails: video.thumbnails || [],
        channel: {
          name: video.author?.name || 'Unknown',
          avatar: video.author?.thumbnails || [],
          verified: video.author?.is_verified || false,
          id: video.author?.id || null
        }
      };
    }).filter(v => v.id && v.title); // Ensure basic validity

    res.json(recommendations);

  } catch (error) {
    console.error(`Recommendations error for video ${id}:`, error);
    res.status(500).json({ error: `Failed to retrieve recommendations: ${error.message}` });
  }
});

// Get channel details API (remains for potential direct API use)
app.get('/api/channel/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Add a simple validation check
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }
    const channel = await youtube.getChannel(id);

    // Basic check if channel data was found
    if (!channel || !channel.header) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Extract relevant data for the API response (optional, but good practice)
    const channelData = {
      id: id,
      name: channel.header?.channel_header?.title?.text || channel.header?.title?.text || 'Unknown Channel',
      avatar: channel.header?.channel_header?.author?.thumbnails?.[0]?.url || channel.header?.author?.thumbnails?.[0]?.url || '/img/default-avatar.svg',
      banner: channel.header?.banner?.thumbnails?.[0]?.url || null,
      subscriber_count: channel.header?.subscriber_count?.text || channel.header?.subscribers?.text || '',
      video_count: channel.header?.video_count?.text || '',
      // You might want to add more fields as needed
    };

    res.json(channelData); // Send back curated data
  } catch (error) {
    console.error(`Channel API error for ID ${req.params.id}:`, error);
    // Avoid sending detailed internal errors to the client
    if (error.message?.includes('404')) {
      res.status(404).json({ error: 'Channel not found or private' });
    } else {
      res.status(500).json({ error: 'Failed to retrieve channel details' });
    }
  }
});

// Channel Page Route
app.get('/channel/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).send('Invalid channel ID');
    }
    const channel = await youtube.getChannel(id);

    // Prepare data for the template based on observed LTT structure
    const header = channel.header;
    const headerContent = header?.content; // Specific to PageHeader in LTT example
    const microformat = channel.metadata; // LTT example had MicroformatData here

    let channelName = 'Unknown Channel';
    if (headerContent?.title?.text?.text) channelName = headerContent.title.text.text;
    else if (microformat?.title) channelName = microformat.title;

    let avatarUrl = '/img/default-avatar.svg'; // Default fallback
    const potentialAvatars = [
      headerContent?.image?.avatar?.image?.[0]?.url, // From PageHeader
      microformat?.avatar?.[0]?.url, // From MicroformatData
      channel.header?.channel_header?.author?.thumbnails?.[0]?.url, // Another common path
      channel.header?.author?.thumbnails?.[0]?.url // Fallback path
    ];
    avatarUrl = potentialAvatars.find(url => url && (url.startsWith('http://') || url.startsWith('https://'))) || avatarUrl;

    let bannerUrl = null; // Default fallback
    const potentialBanners = [
      headerContent?.banner?.image?.[0]?.url, // From PageHeader Banner
    ];
    bannerUrl = potentialBanners.find(url => url && (url.startsWith('http://') || url.startsWith('https://'))) || bannerUrl;

    // Extract counts from PageHeader structure
    let subscriberCount = '';
    let videoCount = '';
    if (headerContent?.metadata?.metadata_rows?.[1]?.metadata_parts) {
      subscriberCount = headerContent.metadata.metadata_rows[1].metadata_parts[0]?.text?.text || '';
      videoCount = headerContent.metadata.metadata_rows[1].metadata_parts[1]?.text?.text || '';
    }

    const channelData = {
      id: id,
      name: channelName,
      avatar: avatarUrl,
      banner: bannerUrl,
      subscriber_count: subscriberCount,
      video_count: videoCount,
    };

    res.render('channel', { channel: channelData });

  } catch (error) {
    console.error(`Channel page error for ID ${req.params.id}:`, error);
    // Send plain text error instead of rendering a non-existent view
    res.status(500).send('Error: Could not load channel information.');
  }
});

// API: Get Channel Videos (with basic pagination)
app.get('/api/channel/:id/videos', async (req, res) => {
  const { id } = req.params;
  const { continuation } = req.query;

  try {
    let channelVideosResponse;
    if (continuation) {
      // If we have a continuation token, use it to get the next batch
      // Note: youtubei.js might handle continuations differently depending on context.
      // This assumes getting the full channel object again and then applying continuation,
      // which might not be the most efficient way. A more direct continuation fetch might exist.
      // Re-fetch channel to potentially get continuation context if needed
      const channel = await youtube.getChannel(id);
      // You might need a more specific method if getVideos() doesn't accept continuation directly
      // For now, we assume getContinuation applies to the current state of the object
      // This part might need adjustment based on youtubei.js specifics for channel continuations.
      channelVideosResponse = await channel.getContinuation();
      // TODO: Verify the structure of continuation response and adapt mapping

    } else {
      // Initial load: Get the channel and its first batch of videos
      const channel = await youtube.getChannel(id);
      // Attempt to switch to the videos tab explicitly if possible/needed
      // This depends on whether getChannel lands on the featured tab or videos tab by default
      // channel = await channel.getVideos(); // Might be needed if getChannel doesn't default to videos
      channelVideosResponse = await channel.getVideos(); // Fetch videos from the current channel state
    }

    // Map the video data (adapt structure as needed based on actual response)
    // This assumes the response has a `videos` array similar to search results
    // or continuation data includes items.
    const videos = (channelVideosResponse.videos || channelVideosResponse.items || []).map(video => ({
      id: video.id,
      title: video.title?.text || video.title,
      duration: video.duration?.text || '0:00',
      viewCount: video.short_view_count?.text || video.view_count?.text || '0 views',
      uploadedAt: video.published?.text || 'Unknown date',
      thumbnails: video.thumbnails || [],
      channel: { // Include channel info for consistency, even if redundant here
        id: id,
        name: video.author?.name || 'Unknown',
        avatar: video.author?.thumbnails || [],
        verified: video.author?.is_verified || false
      }
    })).filter(Boolean); // Filter out any null/undefined entries

    // Find the continuation token for the next page
    // The path to the continuation token might vary based on the response structure
    const nextContinuation = channelVideosResponse.continuation || channelVideosResponse.continuation_contents?.continuation || null;

    res.json({
      videos: videos,
      continuation: nextContinuation
    });

  } catch (error) {
    console.error(`Error fetching videos for channel ${id}:`, error);
    res.status(500).json({ error: 'Failed to retrieve channel videos' });
  }
});

// --- NEW: Subscriptions Feed Aggregation ---
app.get('/api/subscriptions/feed', async (req, res) => {
  try {
    const subscriptions = await SubscriptionsRepo.getAllSubscriptions();
    console.info(`Found ${subscriptions.length} subscriptions.`);

    if (subscriptions.length === 0) {
      return res.json([]); // Return empty if no subscriptions
    }

    const xmlParser = new XMLParser({
      ignoreAttributes: false, // Keep attributes like href, url
      attributeNamePrefix: "@_", // Prefix attributes to avoid name clash
      allowBooleanAttributes: true
    });

    const feedPromises = subscriptions.map(async (sub) => {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${sub.channel_id}`;
      try {
        const response = await fetch(feedUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} for ${sub.channel_id}`);
        }
        const xmlData = await response.text();
        const feed = xmlParser.parse(xmlData);

        // Handle case where feed.feed.entry is not an array (single video)
        const entries = Array.isArray(feed?.feed?.entry)
          ? feed.feed.entry
          : feed?.feed?.entry ? [feed.feed.entry] : [];

        return entries.map(entry => {
          const videoId = entry['yt:videoId'];
          const title = entry.title;
          const channelName = entry.author?.name;
          const channelId = entry['yt:channelId'];
          const published = entry.published; // Keep as ISO string for sorting
          const thumbnail = entry['media:group']?.['media:thumbnail']?.['@_url'];

          if (!videoId || !title || !channelName || !channelId || !published || !thumbnail) {
            console.warn(`Skipping entry due to missing data in feed for ${sub.channel_id}:`, entry);
            return null; // Skip incomplete entries
          }

          return {
            id: videoId,
            title: title,
            channelName: channelName,
            channelId: channelId,
            published: published,
            thumbnailUrl: thumbnail
          };
        }).filter(video => video !== null); // Filter out null (skipped) entries
      } catch (error) {
        console.error(`Failed to fetch or parse feed for ${sub.channel_id}:`, error);
        return []; // Return empty array for this channel on error
      }
    });

    const allVideosNested = await Promise.all(feedPromises);
    const allVideos = allVideosNested.flat(); // Flatten the array of arrays

    // Sort by published date (descending)
    allVideos.sort((a, b) => new Date(b.published) - new Date(a.published));
    res.json(allVideos);

  } catch (error) {
    console.error('Error aggregating subscription feeds:', error);
    res.status(500).json({ error: 'Failed to aggregate subscription feeds' });
  }
});
// --- End Subscriptions Feed Aggregation ---

// --- Database API Routes ---

// Settings
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await SettingsRepo.getAllSettings();
    res.json(settings);
  } catch (error) {
    console.error('API Error GET /api/settings:', error);
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

app.put('/api/settings', async (req, res) => {
  const { key, value } = req.body;
  if (typeof key !== 'string' || typeof value === 'undefined') {
    return res.status(400).json({ error: 'Missing or invalid key/value in request body' });
  }
  try {
    await SettingsRepo.setSetting(key, String(value)); // Ensure value is stored as string
    res.status(200).json({ message: `Setting '${key}' updated successfully.` });
  } catch (error) {
    console.error(`API Error PUT /api/settings (key: ${key}):`, error);
    res.status(500).json({ error: `Failed to update setting '${key}'` });
  }
});

// Subscriptions
app.get('/api/subscriptions', async (req, res) => {
  try {
    const subs = await SubscriptionsRepo.getAllSubscriptions();
    res.json(subs);
  } catch (error) {
    console.error('API Error GET /api/subscriptions:', error);
    res.status(500).json({ error: 'Failed to retrieve subscriptions' });
  }
});

app.post('/api/subscriptions', async (req, res) => {
  const { channelId, name, avatarUrl } = req.body;
  if (!channelId || !name) {
    return res.status(400).json({ error: 'Missing channelId or name in request body' });
  }
  try {
    await SubscriptionsRepo.addSubscription(channelId, name, avatarUrl);
    res.status(201).json({ message: `Subscription added for channel ${channelId}` });
  } catch (error) {
    console.error(`API Error POST /api/subscriptions (channelId: ${channelId}):`, error);
    res.status(500).json({ error: `Failed to add subscription for channel ${channelId}` });
  }
});

// NEW ROUTE: Import Subscriptions from CSV
app.post('/api/subscriptions/import', upload.single('subscriptionsCsv'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file uploaded.' });
  }

  const csvBuffer = req.file.buffer;
  const parser = parse({
    columns: true, // Treat the first row as headers
    skip_empty_lines: true,
    trim: true,
  });

  const records = [];
  let importedCount = 0;
  const errors = [];

  const stream = Readable.from(csvBuffer);

  stream.pipe(parser)
    .on('data', (record) => {
      // Match headers case-insensitively and handle potential extra quotes
      const channelIdKey = Object.keys(record).find(key => key.toLowerCase().trim() === 'channel id');
      const channelTitleKey = Object.keys(record).find(key => key.toLowerCase().trim() === 'channel title');

      if (channelIdKey && channelTitleKey) {
        const channelId = record[channelIdKey]?.trim();
        let channelTitle = record[channelTitleKey]?.trim();

        // Remove surrounding quotes if present
        if (channelTitle?.startsWith('"') && channelTitle?.endsWith('"')) {
          channelTitle = channelTitle.substring(1, channelTitle.length - 1);
        }

        if (channelId && channelTitle) {
          records.push({ channelId, name: channelTitle });
        } else {
          console.warn('Skipping row due to missing channelId or channelTitle:', record);
        }
      } else {
        console.warn('Skipping row due to missing header keys (expected "Channel ID", "Channel title"):', record);
      }
    })
    .on('end', async () => {
      console.info(`CSV parsing finished. Found ${records.length} valid records.`);
      for (const record of records) {
        try {
          // Fetch channel details to get the avatar
          let avatarUrl = null;
          try {
            const channel = await youtube.getChannel(record.channelId);
            // Extract avatar URL - adapt logic based on getChannel response structure
            // (Similar logic to the /channel/:id route might be needed)
            const header = channel.header;
            const headerContent = header?.content; // Specific to PageHeader
            const microformat = channel.metadata; // MicroformatData

            const potentialAvatars = [
              headerContent?.image?.avatar?.image?.[0]?.url, // From PageHeader
              microformat?.avatar?.[0]?.url, // From MicroformatData
              channel.header?.channel_header?.author?.thumbnails?.[0]?.url, // Another common path
              channel.header?.author?.thumbnails?.[0]?.url // Fallback path
            ];
            avatarUrl = potentialAvatars.find(url => url && (url.startsWith('http://') || url.startsWith('https://'))) || null; // Use null if not found

            if (!avatarUrl) {
              console.warn(`Could not find avatar for channel ${record.channelId} (${record.name}). Proceeding without it.`);
            }
          } catch (channelError) {
            console.error(`Error fetching channel details for ${record.channelId} (${record.name}):`, channelError.message);
            // Continue import without avatar if fetching fails
            errors.push(`Failed to fetch avatar for ${record.name} (${record.channelId}): ${channelError.message}`);
          }

          // AddSubscription already handles INSERT OR IGNORE
          await SubscriptionsRepo.addSubscription(record.channelId, record.name, avatarUrl); // Pass the fetched avatarUrl
          importedCount++;
        } catch (dbError) {
          console.error(`Failed to import subscription ${record.channelId} (${record.name}) into DB:`, dbError);
          errors.push(`Failed to import ${record.name} (${record.channelId}) into DB: ${dbError.message}`);
        }
      }

      console.info(`Import process finished. Imported ${importedCount} subscriptions.`);

      if (errors.length > 0) {
        res.status(207).json({
          message: `Import partially completed. Processed ${records.length} records, successfully imported ${importedCount} subscriptions. Some errors occurred.`,
          errors: errors
        });
      } else if (importedCount > 0) {
        res.status(200).json({ message: `Import successful. Added or found ${importedCount} subscriptions.` });
      } else {
        res.status(200).json({ message: 'Import finished. No new subscriptions were added (they might already exist).' });
      }
    })
    .on('error', (err) => {
      console.error('CSV Parsing Error:', err);
      res.status(400).json({ error: `Failed to parse CSV file: ${err.message}` });
    });
});

app.delete('/api/subscriptions/:channelId', async (req, res) => {
  const { channelId } = req.params;
  if (!channelId) {
    return res.status(400).json({ error: 'Missing channelId in request parameters' });
  }
  try {
    await SubscriptionsRepo.removeSubscription(channelId);
    res.status(200).json({ message: `Subscription removed for channel ${channelId}` });
  } catch (error) {
    console.error(`API Error DELETE /api/subscriptions/${channelId}:`, error);
    res.status(500).json({ error: `Failed to remove subscription for channel ${channelId}` });
  }
});

app.get('/api/subscriptions/:channelId/status', async (req, res) => {
  const { channelId } = req.params;
  if (!channelId) {
    return res.status(400).json({ error: 'Missing channelId in request parameters' });
  }
  try {
    const isSubbed = await SubscriptionsRepo.isSubscribed(channelId);
    res.json({ isSubscribed: isSubbed });
  } catch (error) {
    console.error(`API Error GET /api/subscriptions/${channelId}/status:`, error);
    res.status(500).json({ error: `Failed to check subscription status for channel ${channelId}` });
  }
});

// Playlists
app.get('/api/playlists', async (req, res) => {
  try {
    const playlists = await PlaylistsRepo.getAllPlaylists();
    res.json(playlists);
  } catch (error) {
    console.error('API Error GET /api/playlists:', error);
    res.status(500).json({ error: 'Failed to retrieve playlists' });
  }
});

app.post('/api/playlists', async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Missing playlist name in request body' });
  }
  try {
    const newPlaylistId = await PlaylistsRepo.createPlaylist(name, description);
    res.status(201).json({ id: newPlaylistId, name: name, description: description || '' });
  } catch (error) {
    console.error(`API Error POST /api/playlists (name: ${name}):`, error);
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: `Playlist with name "${name}" already exists.` });
    } else {
      res.status(500).json({ error: `Failed to create playlist "${name}"` });
    }
  }
});

app.get('/api/playlists/:id', async (req, res) => {
  const playlistId = parseInt(req.params.id, 10);
  if (isNaN(playlistId)) {
    return res.status(400).json({ error: 'Invalid playlist ID' });
  }
  try {
    const playlist = await PlaylistsRepo.getPlaylistById(playlistId);
    if (!playlist) {
      return res.status(404).json({ error: `Playlist with ID ${playlistId} not found` });
    }
    res.json(playlist);
  } catch (error) {
    console.error(`API Error GET /api/playlists/${playlistId}:`, error);
    res.status(500).json({ error: `Failed to retrieve playlist ${playlistId}` });
  }
});

app.put('/api/playlists/:id', async (req, res) => {
  const playlistId = parseInt(req.params.id, 10);
  const { name, description } = req.body;
  if (isNaN(playlistId)) {
    return res.status(400).json({ error: 'Invalid playlist ID' });
  }
  if (!name) { // Description can be empty/null
    return res.status(400).json({ error: 'Missing playlist name in request body' });
  }
  try {
    // Optional: Check if playlist exists first? Repo function handles non-existence.
    await PlaylistsRepo.updatePlaylistDetails(playlistId, name, description || '');
    res.status(200).json({ message: `Playlist ${playlistId} updated successfully.` });
  } catch (error) {
    console.error(`API Error PUT /api/playlists/${playlistId}:`, error);
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: `Playlist with name "${name}" already exists.` });
    } else {
      res.status(500).json({ error: `Failed to update playlist ${playlistId}` });
    }
  }
});

app.delete('/api/playlists/:id', async (req, res) => {
  const playlistId = parseInt(req.params.id, 10);
  if (isNaN(playlistId)) {
    return res.status(400).json({ error: 'Invalid playlist ID' });
  }
  try {
    await PlaylistsRepo.deletePlaylist(playlistId);
    res.status(200).json({ message: `Playlist ${playlistId} deleted successfully.` });
  } catch (error) {
    console.error(`API Error DELETE /api/playlists/${playlistId}:`, error);
    res.status(500).json({ error: `Failed to delete playlist ${playlistId}` });
  }
});

// Playlist Videos
app.post('/api/playlists/:id/videos', async (req, res) => {
  const playlistId = parseInt(req.params.id, 10);
  const { videoId, title, channelName, thumbnailUrl } = req.body;
  if (isNaN(playlistId)) {
    return res.status(400).json({ error: 'Invalid playlist ID' });
  }
  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId in request body' });
  }
  try {
    // Optional: Check if playlist exists first
    await PlaylistsRepo.addVideoToPlaylist(playlistId, videoId, title, channelName, thumbnailUrl);
    res.status(201).json({ message: `Video ${videoId} added to playlist ${playlistId}` });
  } catch (error) {
    console.error(`API Error POST /api/playlists/${playlistId}/videos:`, error);
    // Could check for foreign key constraint error if playlist doesn't exist
    res.status(500).json({ error: `Failed to add video ${videoId} to playlist ${playlistId}` });
  }
});

app.delete('/api/playlists/:id/videos/:videoId', async (req, res) => {
  const playlistId = parseInt(req.params.id, 10);
  const { videoId } = req.params;
  if (isNaN(playlistId)) {
    return res.status(400).json({ error: 'Invalid playlist ID' });
  }
  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId in request parameters' });
  }
  try {
    await PlaylistsRepo.removeVideoFromPlaylist(playlistId, videoId);
    res.status(200).json({ message: `Video ${videoId} removed from playlist ${playlistId}` });
  } catch (error) {
    console.error(`API Error DELETE /api/playlists/${playlistId}/videos/${videoId}:`, error);
    res.status(500).json({ error: `Failed to remove video ${videoId} from playlist ${playlistId}` });
  }
});

app.put('/api/playlists/:id/videos/order', async (req, res) => {
  const playlistId = parseInt(req.params.id, 10);
  const { videoOrder } = req.body;
  if (isNaN(playlistId)) {
    return res.status(400).json({ error: 'Invalid playlist ID' });
  }
  if (!Array.isArray(videoOrder) || videoOrder.some(item => !item.videoId || typeof item.sortOrder !== 'number')) {
    return res.status(400).json({ error: 'Invalid videoOrder array in request body. Expected [{videoId: string, sortOrder: number}]' });
  }
  try {
    await PlaylistsRepo.updatePlaylistVideoOrder(playlistId, videoOrder);
    res.status(200).json({ message: `Video order updated for playlist ${playlistId}` });
  } catch (error) {
    console.error(`API Error PUT /api/playlists/${playlistId}/videos/order:`, error);
    res.status(500).json({ error: `Failed to update video order for playlist ${playlistId}` });
  }
});

// Watch History
app.get('/api/watch-history', async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = parseInt(req.query.offset, 10) || 0;
  try {
    const history = await WatchHistoryRepo.getWatchHistory(limit, offset);
    res.json(history);
  } catch (error) {
    console.error('API Error GET /api/watch-history:', error);
    res.status(500).json({ error: 'Failed to retrieve watch history' });
  }
});

app.post('/api/watch-history', async (req, res) => {
  const { videoId, title, channelName, channelId, durationSeconds, watchedSeconds, thumbnailUrl } = req.body;
  // Basic validation
  if (!videoId || !title || !channelName || !channelId || typeof durationSeconds !== 'number' || typeof watchedSeconds !== 'number') {
    return res.status(400).json({ error: 'Missing or invalid fields in request body for watch history entry' });
  }
  try {
    await WatchHistoryRepo.upsertWatchHistory(videoId, title, channelName, channelId, durationSeconds, watchedSeconds, thumbnailUrl);
    res.status(201).json({ message: `Watch history entry added/updated for video ${videoId}` });
  } catch (error) {
    console.error(`API Error POST /api/watch-history (videoId: ${videoId}):`, error);
    res.status(500).json({ error: `Failed to add/update watch history for video ${videoId}` });
  }
});

app.put('/api/watch-history/:videoId/progress', async (req, res) => {
  const { videoId } = req.params;
  const { watchedSeconds } = req.body;
  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId in request parameters' });
  }
  if (typeof watchedSeconds !== 'number') {
    return res.status(400).json({ error: 'Missing or invalid watchedSeconds in request body' });
  }
  try {
    await WatchHistoryRepo.updateWatchProgress(videoId, watchedSeconds);
    res.status(200).json({ message: `Watch progress updated for video ${videoId}` });
  } catch (error) {
    console.error(`API Error PUT /api/watch-history/${videoId}/progress:`, error);
    res.status(500).json({ error: `Failed to update watch progress for video ${videoId}` });
  }
});

app.delete('/api/watch-history/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId in request parameters' });
  }
  try {
    await WatchHistoryRepo.deleteWatchHistoryEntry(videoId);
    res.status(200).json({ message: `Watch history entry deleted for video ${videoId}` });
  } catch (error) {
    console.error(`API Error DELETE /api/watch-history/${videoId}:`, error);
    res.status(500).json({ error: `Failed to delete watch history entry for video ${videoId}` });
  }
});

app.delete('/api/watch-history', async (req, res) => {
  try {
    await WatchHistoryRepo.clearWatchHistory();
    res.status(200).json({ message: 'Watch history cleared successfully.' });
  } catch (error) {
    console.error('API Error DELETE /api/watch-history:', error);
    res.status(500).json({ error: 'Failed to clear watch history' });
  }
});

// --- Hidden Content API Routes ---

// Hidden Channels
app.get('/api/hidden/channels', async (req, res) => {
  try {
    const channels = await HiddenContentRepo.getAllHiddenChannels();
    res.json(channels);
  } catch (error) {
    console.error('API Error GET /api/hidden/channels:', error);
    res.status(500).json({ error: 'Failed to retrieve hidden channels' });
  }
});

app.post('/api/hidden/channels', async (req, res) => {
  const { channelId, name } = req.body;
  if (!channelId || !name) {
    return res.status(400).json({ error: 'Missing channelId or name in request body' });
  }
  try {
    await HiddenContentRepo.addHiddenChannel(channelId, name);
    res.status(201).json({ message: `Channel ${channelId} hidden successfully.` });
  } catch (error) {
    console.error(`API Error POST /api/hidden/channels (channelId: ${channelId}):`, error);
    res.status(500).json({ error: `Failed to hide channel ${channelId}` });
  }
});

app.delete('/api/hidden/channels/:channelId', async (req, res) => {
  const { channelId } = req.params;
  if (!channelId) {
    return res.status(400).json({ error: 'Missing channelId in request parameters' });
  }
  try {
    await HiddenContentRepo.removeHiddenChannel(channelId);
    res.status(200).json({ message: `Channel ${channelId} unhidden successfully.` });
  } catch (error) {
    console.error(`API Error DELETE /api/hidden/channels/${channelId}:`, error);
    res.status(500).json({ error: `Failed to unhide channel ${channelId}` });
  }
});

// Hidden Keywords
app.get('/api/hidden/keywords', async (req, res) => {
  try {
    const keywords = await HiddenContentRepo.getAllHiddenKeywords();
    // Return just the keyword strings for simplicity
    res.json(keywords.map(k => k.keyword));
  } catch (error) {
    console.error('API Error GET /api/hidden/keywords:', error);
    res.status(500).json({ error: 'Failed to retrieve hidden keywords' });
  }
});

app.post('/api/hidden/keywords', async (req, res) => {
  const { keyword } = req.body;
  if (!keyword || typeof keyword !== 'string' || keyword.trim() === '') {
    return res.status(400).json({ error: 'Missing or invalid keyword in request body' });
  }
  const trimmedKeyword = keyword.trim();
  try {
    await HiddenContentRepo.addHiddenKeyword(trimmedKeyword);
    res.status(201).json({ message: `Keyword "${trimmedKeyword}" hidden successfully.` });
  } catch (error) {
    console.error(`API Error POST /api/hidden/keywords (keyword: ${trimmedKeyword}):`, error);
    res.status(500).json({ error: `Failed to hide keyword "${trimmedKeyword}"` });
  }
});

app.delete('/api/hidden/keywords', async (req, res) => {
  const { keyword } = req.body; // Get keyword from body for DELETE
  if (!keyword || typeof keyword !== 'string' || keyword.trim() === '') {
    return res.status(400).json({ error: 'Missing or invalid keyword in request body' });
  }
  const trimmedKeyword = keyword.trim();
  try {
    await HiddenContentRepo.removeHiddenKeyword(trimmedKeyword);
    res.status(200).json({ message: `Keyword "${trimmedKeyword}" removed successfully.` });
  } catch (error) {
    console.error(`API Error DELETE /api/hidden/keywords (keyword: ${trimmedKeyword}):`, error);
    res.status(500).json({ error: `Failed to remove hidden keyword "${trimmedKeyword}"` });
  }
});

// Start server
app.listen(port, () => {
  console.info(`Server running at http://localhost:${port}`);
});