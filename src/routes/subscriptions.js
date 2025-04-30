import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';
import * as SubscriptionsRepo from '../db/subscriptionsRepository.js';
import getYoutubeClient from '../utils/youtubeClient.js';
import { formatViewCount, formatRelativeDate } from '../utils/formatters.js';

const router = express.Router();

// Multer configuration for handling CSV uploads in memory
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Subscriptions Page Route
router.get('/', (req, res) => {
  res.render('subscriptions');
});

// API: Get all subscriptions
router.get('/api', async (req, res) => {
  try {
    const subs = await SubscriptionsRepo.getAllSubscriptions();
    res.json(subs);
  } catch (error) {
    console.error('API Error GET /api/subscriptions:', error);
    res.status(500).json({ error: 'Failed to retrieve subscriptions' });
  }
});

// API: Add a subscription
router.post('/api', async (req, res) => {
  const { channelId, name, avatarUrl } = req.body;
  if (!channelId || !name) {
    return res.status(400).json({ error: 'Missing channelId or name in request body' });
  }
  try {
    // Ensure avatarUrl is either a valid URL or null
    const validAvatarUrl = (typeof avatarUrl === 'string' && avatarUrl.startsWith('http')) ? avatarUrl : null;
    await SubscriptionsRepo.addSubscription(channelId, name, validAvatarUrl);
    res.status(201).json({ message: `Subscription added for channel ${channelId}` });
  } catch (error) {
    console.error(`API Error POST /api/subscriptions (channelId: ${channelId}):`, error);
    res.status(500).json({ error: `Failed to add subscription for channel ${channelId}: ${error.message}` });
  }
});

// API: Import Subscriptions from CSV
router.post('/api/import', upload.single('subscriptionsCsv'), async (req, res) => {
  const youtube = await getYoutubeClient(); // Get client instance
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
      const channelIdKey = Object.keys(record).find(key => key.toLowerCase().trim().replace(/"/g, '') === 'channel id');
      const channelTitleKey = Object.keys(record).find(key => key.toLowerCase().trim().replace(/"/g, '') === 'channel title');

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
        console.warn('Skipping row due to missing header keys (expected "Channel ID", "Channel Title"): Found keys ->', Object.keys(record));
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
      } else if (records.length > 0) {
        res.status(200).json({ message: 'Import finished. No new subscriptions were added (they likely already exist).' });
      } else {
        res.status(400).json({ message: 'Import failed. No valid subscription records found in the CSV file.' });
      }
    })
    .on('error', (err) => {
      console.error('CSV Parsing Error:', err);
      res.status(400).json({ error: `Failed to parse CSV file: ${err.message}` });
    });
});

// API: Remove a subscription
router.delete('/api/:channelId', async (req, res) => {
  const { channelId } = req.params;
  if (!channelId) {
    return res.status(400).json({ error: 'Missing channelId in request parameters' });
  }
  try {
    await SubscriptionsRepo.removeSubscription(channelId);
    res.status(200).json({ message: `Subscription removed for channel ${channelId}` });
  } catch (error) {
    console.error(`API Error DELETE /api/subscriptions/${channelId}:`, error);
    res.status(500).json({ error: `Failed to remove subscription for channel ${channelId}: ${error.message}` });
  }
});

// API: Check subscription status
router.get('/api/:channelId/status', async (req, res) => {
  const { channelId } = req.params;
  if (!channelId) {
    return res.status(400).json({ error: 'Missing channelId in request parameters' });
  }
  try {
    const isSubbed = await SubscriptionsRepo.isSubscribed(channelId);
    res.json({ isSubscribed: isSubbed });
  } catch (error) {
    console.error(`API Error GET /api/subscriptions/${channelId}/status:`, error);
    res.status(500).json({ error: `Failed to check subscription status for channel ${channelId}: ${error.message}` });
  }
});

// Subscriptions Feed Aggregation
router.get('/api/feed', async (req, res) => {
  try {
    const subscriptions = await SubscriptionsRepo.getAllSubscriptions();
    console.info(`Aggregating feed for ${subscriptions.length} subscriptions.`);

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
          throw new Error(`HTTP error! status: ${response.status} for ${sub.channel_id} (${sub.name})`);
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
          // Author name might be missing, fallback to stored sub name
          const channelName = entry.author?.name || sub.name;
          const channelId = entry['yt:channelId'];
          const published = entry.published; // Keep as ISO string for sorting
          const thumbnail = entry['media:group']?.['media:thumbnail']?.['@_url'];

          // --- Extract View Count ---
          let viewCount = '0 views'; // Default
          const viewCountStr = entry['media:group']?.['media:community']?.['media:statistics']?.['@_views'];
          if (viewCountStr) {
            const count = parseInt(viewCountStr, 10);
            if (!isNaN(count)) {
              viewCount = formatViewCount(count); // Use existing helper
            }
          }
          // --- End Extract View Count ---

          if (!videoId || !title || !channelId || !published || !thumbnail) {
            console.warn(`Skipping entry due to missing essential data in feed for ${sub.channel_id} (${channelName}):`, entry);
            return null; // Skip incomplete entries
          }

          return {
            id: videoId,
            title: title,
            channelName: channelName,
            channelId: channelId,
            channelAvatar: sub.avatar_url, // Include avatar from DB
            published: published, // Keep original for sorting
            publishedText: formatRelativeDate(published),
            thumbnailUrl: thumbnail,
            viewCount: viewCount // Add the extracted view count
          };
        }).filter(video => video !== null); // Filter out null (skipped) entries
      } catch (error) {
        console.error(`Failed to fetch or parse feed for ${sub.channel_id} (${sub.name}):`, error.message);
        return []; // Return empty array for this channel on error
      }
    });

    const allVideosNested = await Promise.all(feedPromises);
    const allVideos = allVideosNested.flat(); // Flatten the array of arrays

    // Sort by published date (descending)
    allVideos.sort((a, b) => new Date(b.published) - new Date(a.published));
    console.info(`Feed aggregation complete. Found ${allVideos.length} videos.`);
    res.json(allVideos);

  } catch (error) {
    console.error('Error aggregating subscription feeds:', error);
    res.status(500).json({ error: 'Failed to aggregate subscription feeds' });
  }
});

export default router;