/**
 * Utility functions for detecting YouTube Shorts
 */

/**
 * Determines if a video is a YouTube Short based on duration and other properties
 * @param {Object} video - Video object from YouTube API
 * @returns {boolean} - True if the video is considered a Short
 */
export function isShort(video) {
  // Primary method: Check duration (Shorts are 60 seconds or less)
  if (video.duration) {
    // Handle different duration formats
    let durationInSeconds = 0;

    if (typeof video.duration === 'number') {
      durationInSeconds = video.duration;
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

  // Secondary method: Check if it's a ShortsLockupView or similar node type
  if (video.type === 'ShortsLockupView' || video.constructor?.name === 'ShortsLockupView') {
    return true;
  }

  // Tertiary method: Check URL pattern (if available)
  if (video.endpoint?.browseEndpoint?.canonicalBaseUrl?.includes('/shorts/') ||
    video.endpoint?.watchEndpoint?.videoId && video.url?.includes('/shorts/')) {
    return true;
  }

  return false;
}

/**
 * Parses a duration string like "0:45" or "1:23" into seconds
 * @param {string} durationStr - Duration string
 * @returns {number} - Duration in seconds
 */
function parseDurationString(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') return 0;

  // Handle formats like "0:45", "1:23", or just "45"
  const parts = durationStr.split(':').map(part => parseInt(part, 10));

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