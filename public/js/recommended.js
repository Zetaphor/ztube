import { showError } from './utils.js';
// DOM Elements
const getRecommendedContainer = () => document.getElementById('recommendedVideos')?.querySelector('.space-y-3');

// === Recommended Videos Functions ===

/**
 * Creates the HTML card element for a recommended video.
 * @param {object} video - The video data object.
 * @returns {HTMLElement} The created card element.
 */
function createRecommendedVideoCard(video) {
  const card = document.createElement('div');
  // Added cursor-pointer and slight hover effect, group for hover effect on button
  card.className = 'recommended-video-card group flex gap-2 cursor-pointer hover:bg-zinc-700/50 p-1 rounded relative'; // Added relative

  const thumbnail = video.thumbnails?.[0]?.url || '/img/default-video.png';
  let duration = video.duration || '';
  let views = video.viewCount || '';
  let uploadedAt = video.uploadedAt || '';
  const channelNameText = video.channel?.name || 'Unknown';
  const channelId = video.channel?.id;
  const videoTitle = video.title || 'Untitled'; // Store title

  // Add video data to dataset for easy access
  card.dataset.videoId = video.id;
  card.dataset.videoTitle = videoTitle;
  card.dataset.channelName = channelNameText;
  card.dataset.thumbnailUrl = thumbnail; // Use the fetched thumbnail

  // Check if it looks like a livestream
  const isLivestream = duration === "N/A" && typeof views === 'string' && views.includes("watching");

  if (isLivestream) {
    uploadedAt = ''; // Don't show upload date for livestreams
    duration = '🔴 LIVE';
  }

  // Calls the global load function, passes null for element
  // Ensure window.loadAndDisplayVideo is globally available or passed in
  card.onclick = () => {
    if (window.loadAndDisplayVideo) {
      window.loadAndDisplayVideo(video.id, null);
    } else {
      console.error("loadAndDisplayVideo function not found on window.");
    }
  };


  card.innerHTML = `
      <div class="recommended-thumbnail relative flex-shrink-0 w-40">
        <img src="${thumbnail}" alt="${video.title || 'Thumbnail'}" loading="lazy" class="w-full h-auto object-cover rounded-md aspect-video">
        ${duration ? `<span class="recommended-duration absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded">${duration}</span>` : ''}
      </div>
      <div class="recommended-details flex flex-col justify-start overflow-hidden">
        <h4 class="recommended-title text-sm font-medium text-zinc-100 line-clamp-2 mb-1">${videoTitle}</h4>
        <div class="recommended-channel text-xs text-zinc-400 truncate mb-0.5">
          ${channelId ? `<a href="/channel/${channelId}" class="hover:text-green-500" onclick="event.stopPropagation();">${channelNameText}</a>` : `<span>${channelNameText}</span>`}
        </div>
        <div class="recommended-meta text-xs text-zinc-400 flex flex-wrap gap-x-1.5">
          ${views ? `<span>${views}</span>` : ''}
          ${views && uploadedAt ? '<span class="separator">•</span>' : ''}
          ${uploadedAt ? `<span>${uploadedAt}</span>` : ''}
        </div>
      </div>
      <!-- Add to Playlist Button (Hidden by default, shown on group-hover) -->
      <button class="add-to-playlist-btn absolute top-1 right-1 bg-zinc-800/80 hover:bg-green-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10" title="Add to Playlist">
          <i class="fas fa-plus"></i>
      </button>
    `;

  // Add listener for the new button
  const addToPlaylistBtn = card.querySelector('.add-to-playlist-btn');
  if (addToPlaylistBtn) {
    addToPlaylistBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent card click (playing video)
      // Call the global add to playlist function (will be defined later)
      if (window.handleAddToPlaylistClick) {
        window.handleAddToPlaylistClick(card.dataset);
      } else {
        console.error("handleAddToPlaylistClick function not found.");
      }
    });
  }


  return card;
}


/**
 * Displays the list of recommended videos in the UI.
 * @param {Array} videos - An array of video objects.
 */
function displayRecommendedVideos(videos) {
  const recommendedContainer = getRecommendedContainer();
  if (!recommendedContainer) return;

  recommendedContainer.innerHTML = ''; // Clear loading/error message

  if (!videos || videos.length === 0) {
    recommendedContainer.innerHTML = '<p class="text-zinc-400 text-sm">No recommendations found.</p>';
    return;
  }

  videos.forEach(video => {
    const card = createRecommendedVideoCard(video);
    recommendedContainer.appendChild(card);
  });
}

/**
 * Fetches recommended videos for a given video ID and displays them.
 * @param {string} videoId - The ID of the video to get recommendations for.
 */
export async function fetchRecommendedVideos(videoId) {
  const recommendedContainer = getRecommendedContainer();
  if (!recommendedContainer) {
    console.error("[Recommended] Recommended videos container element not found!");
    return;
  }

  recommendedContainer.innerHTML = '<p class="text-zinc-400 text-sm">Loading recommendations...</p>';

  try {
    const response = await fetch(`/api/video/${videoId}/recommendations`);

    if (!response.ok) {
      let errorText = `Failed to fetch recommendations: ${response.status}`;
      try {
        const errorData = await response.text();
        errorText += ` - ${errorData}`;
      } catch (e) { /* Ignore if reading text fails */ }
      console.error("[Recommended] Fetch Error Text:", errorText);
      throw new Error(errorText);
    }

    const recommendations = await response.json();
    displayRecommendedVideos(recommendations);

  } catch (error) {
    console.error('[Recommended] Error in fetchRecommendedVideos:', error);
    recommendedContainer.innerHTML = '<p class="text-red-500 text-sm">Failed to load recommendations.</p>';
    showError('Failed to load recommendations.');
  }
}

/**
 * Clears the recommended videos list in the UI.
 */
export function clearRecommendedVideos() {
  const recommendedContainer = getRecommendedContainer();
  if (recommendedContainer) {
    recommendedContainer.innerHTML = ''; // Clear recommendations
  }
}