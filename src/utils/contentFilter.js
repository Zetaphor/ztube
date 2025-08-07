import * as HiddenContentRepo from '../db/hiddenContentRepository.js';

/**
 * Get all blocked channel IDs
 * @returns {Promise<Set<string>>} Set of blocked channel IDs
 */
async function getBlockedChannelIds() {
  try {
    const blockedChannels = await HiddenContentRepo.getAllHiddenChannels();
    return new Set(blockedChannels.map(channel => channel.channel_id));
  } catch (error) {
    console.error('Error fetching blocked channels:', error);
    return new Set(); // Return empty set on error to avoid breaking functionality
  }
}

/**
 * Filter out videos from blocked channels
 * @param {Array} videos - Array of video objects
 * @returns {Promise<Array>} Filtered array of videos
 */
export async function filterBlockedChannels(videos) {
  if (!Array.isArray(videos) || videos.length === 0) {
    return videos;
  }

  const blockedChannelIds = await getBlockedChannelIds();

  if (blockedChannelIds.size === 0) {
    return videos; // No blocked channels, return all videos
  }

  const filteredVideos = videos.filter(video => {
    // Check multiple possible locations for channel ID
    const channelId = video.channel?.id || video.channelId || video.author?.id;

    if (!channelId) {
      // If no channel ID, keep the video (better safe than sorry)
      return true;
    }

    const isBlocked = blockedChannelIds.has(channelId);

    if (isBlocked) {
      console.log(`Filtered out video "${video.title}" from blocked channel: ${video.channel?.name || video.channelName || 'Unknown'}`);
    }

    return !isBlocked;
  });

  const filteredCount = videos.length - filteredVideos.length;
  if (filteredCount > 0) {
    console.log(`Filtered out ${filteredCount} videos from blocked channels`);
  }

  return filteredVideos;
}

/**
 * Check if a specific channel is blocked
 * @param {string} channelId - Channel ID to check
 * @returns {Promise<boolean>} True if channel is blocked
 */
export async function isChannelBlocked(channelId) {
  if (!channelId) return false;

  try {
    return await HiddenContentRepo.isChannelHidden(channelId);
  } catch (error) {
    console.error('Error checking if channel is blocked:', error);
    return false; // Return false on error to avoid breaking functionality
  }
}