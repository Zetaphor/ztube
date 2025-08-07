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
  card.className = 'recommended-video-card group flex gap-2 cursor-pointer hover:bg-zinc-700/50 p-1 rounded relative'; // Added relative, KEEP group

  const thumbnail = video.thumbnails?.[0]?.url || '/img/default-video.png';
  let duration = video.duration || '';
  let views = video.viewCount || '';
  let uploadedAt = video.uploadedAt || '';
  const channelNameText = video.channel?.name || 'Unknown';
  const channelId = video.channel?.id;
  const channelAvatarUrl = video.channel?.avatar?.[0]?.url || '/img/default-avatar.svg';
  const videoTitle = video.title || 'Untitled'; // Store title

  // Add video data to dataset for easy access
  card.dataset.videoId = video.id;
  card.dataset.videoTitle = videoTitle;
  card.dataset.channelName = channelNameText;
  card.dataset.thumbnailUrl = thumbnail; // Use the fetched thumbnail
  card.dataset.channelId = channelId;

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
      <div class="video-thumbnail recommended-thumbnail relative flex-shrink-0 w-40">
        <img src="${thumbnail}" alt="${video.title || 'Thumbnail'}" loading="lazy" class="w-full h-auto object-cover rounded-md aspect-video">
        ${duration ? `<span class="recommended-duration absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded z-10">${duration}</span>` : ''}
        <!-- Watch History Overlay -->
        <div class="watch-history-overlay absolute inset-0 bg-black/60 hidden group-hover:opacity-0 transition-opacity duration-200 rounded-md"></div>
        <!-- Watch History Progress Bar -->
        <div class="watch-history-progress absolute bottom-0 left-0 right-0 h-1 bg-zinc-600 hidden rounded-b-md">
            <div class="watch-history-progress-bar h-full bg-green-600"></div>
        </div>
        <!-- Thumbnail Hover Icons -->
        <div class="thumbnail-icons absolute top-1 right-1 flex flex-row gap-1.5 z-10">
          <button class="add-to-playlist-hover-btn thumbnail-icon-btn" title="Add to Playlist">
            <i class="fas fa-plus"></i>
          </button>
          <button class="bookmark-btn thumbnail-icon-btn" title="Add to Watch Later">
            <i class="far fa-bookmark"></i> <!-- Default state -->
          </button>
          <div class="relative">
            <button class="thumbnail-icon-btn more-options-btn" title="More options" onclick="event.stopPropagation(); this.nextElementSibling.classList.toggle('hidden');">
              <i class="fas fa-ellipsis-v"></i>
            </button>
            <div class="absolute right-0 top-full mt-1 bg-zinc-800 rounded-lg shadow-lg border border-zinc-700 hidden min-w-40 z-20 whitespace-nowrap">
              <button class="copy-link-btn w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 rounded-t-lg flex items-center" onclick="event.stopPropagation(); window.copyVideoLink('${video.id}'); this.closest('.absolute').classList.add('hidden');">
                <i class="fas fa-link mr-2"></i>Copy Link
              </button>
              <button class="remove-history-btn w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 hidden flex items-center" onclick="event.stopPropagation(); this.closest('.absolute').classList.add('hidden');" title="Remove from History">
                <i class="fas fa-eye-slash mr-2"></i>Remove from History
              </button>
              ${channelId ? `<button class="block-channel-btn w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-zinc-700 rounded-b-lg flex items-center" onclick="event.stopPropagation(); window.blockChannelFromVideo('${channelId}', '${channelNameText.replace(/'/g, "\\'")}'); this.closest('.absolute').classList.add('hidden');">
                <i class="fas fa-ban mr-2"></i>Block Channel
              </button>` : ''}
            </div>
          </div>
        </div>
        <!-- End Thumbnail Hover Icons -->
      </div>
      <div class="recommended-details flex flex-col justify-start overflow-hidden">
        <h4 class="recommended-title text-sm font-medium text-zinc-100 line-clamp-2 mb-1">${videoTitle}</h4>
        <div class="recommended-channel flex items-center text-xs text-zinc-400 truncate mb-0.5">
          <a href="${channelId ? `/channel/${channelId}` : '#'}" class="flex-shrink-0 mr-1.5" onclick="event.stopPropagation();">
            <img src="${channelAvatarUrl}" alt="${channelNameText} avatar" class="w-5 h-5 rounded-full">
          </a>
          ${channelId ? `<a href="/channel/${channelId}" class="hover:text-green-500 truncate" onclick="event.stopPropagation();">${channelNameText}</a>` : `<span class="truncate">${channelNameText}</span>`}
        </div>
        <div class="recommended-meta text-xs text-zinc-400 flex flex-wrap gap-x-1.5">
          ${views ? `<span>${views}</span>` : ''}
          ${views && uploadedAt ? '<span class="separator mx-1">•</span>' : ''}
          ${uploadedAt ? `<span>${uploadedAt}</span>` : ''}
        </div>
      </div>
      <!-- Old Add to Playlist Button (Now Hidden) -->
      <button class="add-to-playlist-btn hidden absolute top-1 right-1 bg-zinc-800/80 hover:bg-green-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10" title="Add to Playlist">
        <i class="fas fa-plus"></i>
      </button>
    `;

  // --- Add Listeners for Hover Icons (Copied from app.js) ---
  const bookmarkBtn = card.querySelector('.bookmark-btn');
  const addToPlaylistBtn = card.querySelector('.add-to-playlist-hover-btn');
  const bookmarkIcon = bookmarkBtn?.querySelector('i');

  if (bookmarkBtn && bookmarkIcon && window.toggleVideoInDefaultPlaylist) {
    // Set initial icon state and visibility
    if (window.isVideoInDefaultPlaylist && window.isVideoInDefaultPlaylist(card.dataset.videoId)) {
      bookmarkIcon.classList.add('fas'); // Just make it solid
      bookmarkBtn.title = "Remove from Watch Later";
      bookmarkBtn.classList.add('visible'); // Make visible
    } else {
      bookmarkIcon.className = 'far fa-bookmark'; // Ensure default classes
      bookmarkBtn.title = "Add to Watch Later";
      bookmarkBtn.classList.remove('visible'); // Ensure hidden
    }

    bookmarkBtn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent card click (playing video)
      const currentIconClass = bookmarkIcon.className;
      const wasVisible = bookmarkBtn.classList.contains('visible');
      bookmarkIcon.className = 'fas fa-spinner fa-spin'; // Show loading
      bookmarkBtn.disabled = true;
      bookmarkBtn.classList.add('visible'); // Keep visible during load

      try {
        const isInPlaylist = await window.toggleVideoInDefaultPlaylist(card.dataset);
        if (isInPlaylist) {
          bookmarkIcon.className = 'fas fa-bookmark'; // Solid bookmark
          bookmarkBtn.title = "Remove from Watch Later";
          bookmarkBtn.classList.add('visible');
        } else {
          bookmarkIcon.className = 'far fa-bookmark';
          bookmarkBtn.title = "Add to Watch Later";
          bookmarkBtn.classList.remove('visible');
        }
      } catch (error) {
        showError(`Failed to update Watch Later: ${error.message}`);
        bookmarkIcon.className = currentIconClass; // Revert icon on error
        if (wasVisible) bookmarkBtn.classList.add('visible'); else bookmarkBtn.classList.remove('visible'); // Revert visibility
      } finally {
        bookmarkBtn.disabled = false;
      }
    });
  }

  if (addToPlaylistBtn && window.handleAddToPlaylistClick) {
    addToPlaylistBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.handleAddToPlaylistClick(card.dataset);
    });
  }
  // --- End Hover Icon Listeners ---

  // Remove listener from the old hidden button if it exists
  const oldAddToPlaylistBtn = card.querySelector('.add-to-playlist-btn');
  if (oldAddToPlaylistBtn) {
    oldAddToPlaylistBtn.replaceWith(oldAddToPlaylistBtn.cloneNode(true)); // Simple way to remove listeners
  }

  return card;
}


/**
 * Displays the list of recommended videos in the UI.
 * @param {Array} videos - An array of video objects.
 */
function displayRecommendedVideos(videos) {
  const recommendedContainer = getRecommendedContainer();
  if (!recommendedContainer) {
    console.error("❌ [BROWSER] recommendedContainer not found!");
    return;
  }

  recommendedContainer.innerHTML = ''; // Clear loading/error message

  if (!videos || videos.length === 0) {
    console.log(`⚠️ [BROWSER] No videos to display`);
    recommendedContainer.innerHTML = '<p class="text-zinc-400 text-sm">No recommendations found.</p>';
    return;
  }

  videos.forEach((video, index) => {
    const card = createRecommendedVideoCard(video);
    recommendedContainer.appendChild(card);
  });

  // Process the newly added recommended cards for watch history
  if (window.processCardsForWatchHistory) {
    window.processCardsForWatchHistory(recommendedContainer.childNodes);
  } else {
    console.warn('processCardsForWatchHistory function not found on window');
  }
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
    console.log(`✅ [BROWSER] Received ${recommendations.length} recommendations from server`);
    displayRecommendedVideos(recommendations);

  } catch (error) {
    console.error('❌ [BROWSER] Error in fetchRecommendedVideos:', error);
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