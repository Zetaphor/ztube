/**
 * Utility functions for detecting YouTube Shorts
 */

/**
 * Determines if a video is a YouTube Short based on duration and other properties
 * @param {Object} video - Video object from YouTube API
 * @returns {boolean} - True if the video is considered a Short
 */
export function isShort(video) {
  // Primary method: Check if explicitly marked as Short via node type or class
  // This leverages youtubei.js v15.0.1 improved node detection
  if (video.type === 'ShortsLockupView' ||
    video.constructor?.name === 'ShortsLockupView' ||
    video.type === 'ReelItem' ||
    video.constructor?.name === 'ReelItem' ||
    video.is_shorts === true ||
    video.isShort === true) {
    return true;
  }

  // Secondary method: Check URL patterns (improved patterns for v15.0.1)
  if (video.endpoint?.browseEndpoint?.canonicalBaseUrl?.includes('/shorts/') ||
    video.endpoint?.watchEndpoint?.videoId && video.url?.includes('/shorts/') ||
    video.url?.includes('/shorts/') ||
    video.browse_endpoint?.canonical_base_url?.includes('/shorts/')) {
    return true;
  }

  // Tertiary method: Check duration (Shorts are 60 seconds or less)
  if (video.duration) {
    // Handle different duration formats from youtubei.js v15.0.1
    let durationInSeconds = 0;

    if (typeof video.duration === 'number') {
      durationInSeconds = video.duration;
    } else if (video.duration.seconds_total) {
      // New property in v15.0.1
      durationInSeconds = video.duration.seconds_total;
    } else if (video.duration.seconds) {
      durationInSeconds = video.duration.seconds;
    } else if (video.durationSeconds) {
      durationInSeconds = video.durationSeconds;
    } else if (typeof video.duration === 'string') {
      // Parse duration string like "0:45" or "1:23"
      durationInSeconds = parseDurationString(video.duration);
    }

    // YouTube Shorts are 60 seconds or less
    if (durationInSeconds > 0 && durationInSeconds <= 60) {
      return true;
    }
  }

  // Additional checks for v15.0.1 features
  // Check for short-specific thumbnails or aspect ratios
  if (video.thumbnails && Array.isArray(video.thumbnails)) {
    const thumbnail = video.thumbnails[0];
    if (thumbnail && thumbnail.height > thumbnail.width) {
      // Vertical aspect ratio indicates likely Short
      // But only if duration is also short or unknown
      const hasDuration = video.duration && parseDurationString(video.duration?.text || video.duration) > 0;
      if (!hasDuration || parseDurationString(video.duration?.text || video.duration) <= 60) {
        return true;
      }
    }
  }

  // Enhanced heuristics for RSS feeds where duration might be missing
  // Check for common shorts title patterns
  if (video.title && typeof video.title === 'string') {
    const title = video.title.toLowerCase();
    const shortsKeywords = ['#shorts', '#short', 'shorts', 'tiktok', 'viral', 'meme'];
    if (shortsKeywords.some(keyword => title.includes(keyword))) {
      return true;
    }
  }

  // If we have no duration info (like RSS feeds), be conservative and assume it's NOT a short
  // unless we have other strong indicators
  const hasDurationInfo = video.duration &&
    (video.duration !== '0:00' || video.durationSeconds > 0 || typeof video.duration === 'object');

  if (!hasDurationInfo) {
    // No duration info available - use conservative approach
    // Only mark as short if we have other strong indicators (URL, type, etc.)
    return false;
  }

  return false;
}

/**
 * Parses a duration string like "0:45" or "1:23" into seconds
 * Enhanced for youtubei.js v15.0.1 duration formats
 * @param {string|object} durationStr - Duration string or object
 * @returns {number} - Duration in seconds
 */
function parseDurationString(durationStr) {
  if (!durationStr) return 0;

  // Handle object format from youtubei.js v15.0.1
  if (typeof durationStr === 'object') {
    if (durationStr.seconds_total) return durationStr.seconds_total;
    if (durationStr.seconds) return durationStr.seconds;
    if (durationStr.text) return parseDurationString(durationStr.text);
    return 0;
  }

  if (typeof durationStr !== 'string') return 0;

  // Handle formats like "0:45", "1:23", "45s", or just "45"
  let cleanStr = durationStr.replace(/[^0-9:]/g, ''); // Remove non-numeric chars except colons

  if (!cleanStr) return 0;

  const parts = cleanStr.split(':').map(part => parseInt(part, 10));

  if (parts.length === 1) {
    // Just seconds
    return parts[0] || 0;
  } else if (parts.length === 2) {
    // Minutes:seconds
    return (parts[0] * 60) + (parts[1] || 0);
  } else if (parts.length === 3) {
    // Hours:minutes:seconds
    return (parts[0] * 3600) + (parts[1] * 60) + (parts[2] || 0);
  }

  return 0;
}

/**
 * Separates a list of videos into regular videos and Shorts
 * @param {Array} videos - Array of video objects
 * @returns {Object} - Object with {videos: [], shorts: []} arrays
 */
export function separateVideosAndShorts(videos) {
  const regularVideos = [];
  const shorts = [];

  videos.forEach(video => {
    if (isShort(video)) {
      shorts.push(video);
    } else {
      regularVideos.push(video);
    }
  });

  return { videos: regularVideos, shorts };
}

/**
 * Adds a `isShort` property to video objects for easy identification
 * @param {Array} videos - Array of video objects
 * @returns {Array} - Array of video objects with isShort property added
 */
export function markShortsInVideoList(videos) {
  return videos.map(video => ({
    ...video,
    isShort: isShort(video)
  }));
}