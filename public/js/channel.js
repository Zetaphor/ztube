// DOM Elements
const channelContent = document.getElementById('channelContent');
const tabsContainer = document.querySelector('nav[aria-label="Tabs"]');
const tabs = tabsContainer ? Array.from(tabsContainer.querySelectorAll('a')) : [];

// State
let currentChannelId = null;
let currentContentType = 'videos'; // Default to videos
let isLoading = false;
let videosContinuation = null;

// --- Utility Functions (Copied from app.js - consider refactoring to shared file later) ---

function createVideoCard(video) {
  const card = document.createElement('div');
  // Add group for hover effect on button
  card.className = 'video-card group bg-zinc-800 rounded-lg shadow-md overflow-hidden cursor-pointer transition-transform duration-200 hover:scale-105 relative'; // Match app.js style

  const thumbnail = video.thumbnails?.[0]?.url || '/img/default-video.png';
  const channelAvatarUrl = video.channel?.avatar?.[0]?.url || '/img/default-avatar.svg';
  let duration = video.duration || '0:00';
  let views = video.viewCount || '0 views';
  let uploadedAt = video.uploadedAt || 'Unknown date';
  const videoTitle = video.title || 'Untitled'; // Store title
  const channelNameText = video.channel?.name || 'Unknown'; // Store channel name

  // Add video data to dataset
  card.dataset.videoId = video.id;
  card.dataset.uploadedat = uploadedAt;
  card.dataset.videoTitle = videoTitle;
  card.dataset.channelName = channelNameText;
  card.dataset.thumbnailUrl = thumbnail;
  card.dataset.channelId = video.channel?.id;

  // Check if it looks like a livestream
  const isLivestream = duration === "N/A" && typeof views === 'string' && views.includes("watching");

  if (isLivestream) {
    uploadedAt = ''; // Don't show upload date for livestreams
    duration = '🔴 LIVE'; // Set duration text for live
  }

  // When clicking a video card on the channel page, call the global loadAndDisplayVideo
  card.onclick = () => {
    if (typeof window.loadAndDisplayVideo === 'function') {
      window.loadAndDisplayVideo(video.id, card); // Pass the video ID and the card element
    } else {
      console.error('loadAndDisplayVideo function not found. Ensure app.js is loaded correctly.');
    }
  };

  const channelId = video.channel?.id;
  const verifiedBadge = video.channel?.verified ?
    '<i class="fas fa-check-circle text-green-500 ml-1 text-xs" title="Verified Channel"></i>' :
    '';

  // Channel link isn't strictly needed *inside* the card on the channel page itself,
  // but keeping it for consistency with the original function doesn't hurt.
  const channelLinkContent = channelId ?
    `<a href="/channel/${channelId}" class="hover:text-green-500 truncate" onclick="event.stopPropagation();">${channelNameText}${verifiedBadge}</a>` :
    `<span class="truncate">${channelNameText}${verifiedBadge}</span>`;

  card.innerHTML = `
        <div class="video-thumbnail relative">
            <img src="${thumbnail}" alt="${videoTitle}" loading="lazy" class="w-full h-full object-cover aspect-video">
            ${duration ? `<span class="video-duration absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1.5 py-0.5 rounded z-10">${duration}</span>` : ''}
            <!-- Watch History Overlay -->
            <div class="watch-history-overlay absolute inset-0 bg-black/60 hidden group-hover:opacity-0 transition-opacity duration-200"></div>
            <!-- Watch History Progress Bar -->
            <div class="watch-history-progress absolute bottom-0 left-0 right-0 h-1 bg-zinc-600 hidden">
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
                        <button class="mark-watched-btn w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 hidden flex items-center" onclick="event.stopPropagation(); this.closest('.absolute').classList.add('hidden');" title="Mark as Watched">
                            <i class="fas fa-check-circle mr-2"></i>Mark as Watched
                        </button>
                        <button class="remove-history-btn w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 hidden flex items-center" onclick="event.stopPropagation(); this.closest('.absolute').classList.add('hidden');" title="Remove from History">
                            <i class="fas fa-eye-slash mr-2"></i>Remove from History
                        </button>
                        ${video.channel?.id ? `<button class="block-channel-btn w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-zinc-700 rounded-b-lg flex items-center" onclick="event.stopPropagation(); window.blockChannelFromVideo('${video.channel.id}', '${channelNameText.replace(/'/g, "\\'")}'); this.closest('.absolute').classList.add('hidden');">
                            <i class="fas fa-ban mr-2"></i>Block Channel
                        </button>` : ''}
                    </div>
                </div>
            </div>
            <!-- End Thumbnail Hover Icons -->
        </div>
        <div class="p-3">
            <h3 class="font-semibold text-zinc-100 line-clamp-2 mb-2 text-sm h-10" title="${videoTitle.replace(/"/g, '&quot;')}">${videoTitle}</h3>
            <div class="flex items-center mt-1">
                <!-- Hide avatar/channel name inside the card when on channel page -->
                <!--
                <img src="${channelAvatarUrl}" alt="${channelNameText}" class="w-8 h-8 rounded-full mr-2 flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center text-zinc-300 text-xs">
                      ${channelLinkContent}
                    </div>
                </div>
                -->
                <div class="video-meta text-zinc-400 text-xs mt-0.5 w-full flex flex-wrap gap-x-1">
                     ${views ? `<span title="${views}">${views}</span>` : ''}
                     ${views && uploadedAt ? '<span class="separator mx-1">•</span>' : ''}
                     ${uploadedAt ? `<span title="${uploadedAt}">${uploadedAt}</span>` : ''}
                 </div>
            </div>
        </div>
        <!-- Old Add to Playlist Button (Hidden) -->
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
        // Use the global showError from utils.js (assuming it's available)
        if (typeof showError === 'function') {
          showError(`Failed to update Watch Later: ${error.message}`);
        } else {
          console.error(`Failed to update Watch Later: ${error.message}`); // Fallback
        }
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

// --- Channel Page Specific Functions ---

function showLoadingIndicator() {
  channelContent.innerHTML = '<p class="col-span-full text-center text-zinc-500 py-8">Loading content...</p>';
}

function displayError(message) {
  channelContent.innerHTML = `<p class="col-span-full text-center text-red-500 py-8">${message}</p>`;
}

async function fetchChannelContent(channelId, contentType, continuation = null) {
  if (isLoading) return;
  isLoading = true;

  // Show loading indicator only on initial load for a content type
  if (!continuation) {
    showLoadingIndicator();
  }

  // TODO: Add Load More button and handle its display

  try {
    let apiUrl = `/channel/api/${channelId}/${contentType}`;
    if (continuation) {
      apiUrl += `?continuation=${encodeURIComponent(continuation)}`;
    }

    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to fetch ${contentType}`);
    }
    const data = await response.json();

    // Clear loading indicator or previous content only on initial load
    if (!continuation) {
      channelContent.innerHTML = '';
    }

    // --- Render Videos ---
    if (contentType === 'videos' && data.videos) {
      if (data.videos.length === 0 && !continuation) {
        channelContent.innerHTML = '<p class="col-span-full text-center text-zinc-500 py-8">No videos found.</p>';
      } else {
        data.videos.forEach(video => {
          const card = createVideoCard(video);
          channelContent.appendChild(card);
        });
        // Process the newly added channel video cards
        const newlyAddedCards = Array.from(channelContent.children).slice(continuation ? -data.videos.length : 0);

        if (window.processCardsForWatchHistory) {
          window.processCardsForWatchHistory(newlyAddedCards);
        } else {
          console.warn('processCardsForWatchHistory function not found on window');
        }
      }
      videosContinuation = data.continuation; // Store continuation for videos
    }
    // --- TODO: Add rendering for playlists, about, etc. ---
    else if (contentType === 'playlists') {
      channelContent.innerHTML = '<p class="col-span-full text-center text-zinc-500 py-8">Playlist loading not implemented yet.</p>';
      // Render playlist cards...
    }
    else if (contentType === 'about') {
      channelContent.innerHTML = '<p class="col-span-full text-center text-zinc-500 py-8">About section loading not implemented yet.</p>';
      // Render about info...
    }

    // TODO: Show/Hide Load More button based on `data.continuation`

  } catch (error) {
    console.error(`Error fetching ${contentType}:`, error);
    // Don't clear content if it was a continuation load error
    if (!continuation) {
      displayError(`Failed to load ${contentType}. Please try again.`);
    }
  } finally {
    isLoading = false;
  }
}

function handleTabClick(event) {
  event.preventDefault();
  if (isLoading) return;

  const clickedTab = event.currentTarget;
  const contentType = clickedTab.getAttribute('data-content-type');

  if (!contentType || contentType === currentContentType) return;

  // Update state
  currentContentType = contentType;
  videosContinuation = null; // Reset continuation when switching tabs
  // Reset other continuations (playlists, etc.) when implemented

  // Update tab appearance
  tabs.forEach(tab => {
    tab.classList.remove('border-green-500', 'text-green-500');
    tab.classList.add('border-transparent', 'text-zinc-400', 'hover:text-zinc-200', 'hover:border-zinc-300');
    tab.removeAttribute('aria-current');
  });
  clickedTab.classList.add('border-green-500', 'text-green-500');
  clickedTab.classList.remove('border-transparent', 'text-zinc-400', 'hover:text-zinc-200', 'hover:border-zinc-300');
  clickedTab.setAttribute('aria-current', 'page');

  // Fetch content for the new tab
  fetchChannelContent(currentChannelId, currentContentType);
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
  // Extract channel ID from the global channelData object set in EJS
  if (typeof channelData !== 'undefined' && channelData.id) {
    currentChannelId = channelData.id;

    // Add data attributes and event listeners to tabs
    tabs.forEach(tab => {
      // Simple text-based content type mapping
      const text = tab.textContent.trim().toLowerCase();
      if (text === 'videos' || text === 'playlists' || text === 'about') {
        tab.setAttribute('data-content-type', text);
        tab.addEventListener('click', handleTabClick);
      }
    });

    // Initial content load (default tab is 'videos')
    const initialTab = tabsContainer?.querySelector('a[aria-current="page"]');
    const initialContentType = initialTab?.getAttribute('data-content-type') || 'videos';
    currentContentType = initialContentType;
    fetchChannelContent(currentChannelId, currentContentType);

  } else {
    console.error('Channel ID not found in channelData.');
    displayError('Could not identify the channel to load content.');
  }

  // TODO: Add infinite scroll or load more button listener
});

// === Subscribe/Unsubscribe Logic ===
// Copied from app.js - Consider refactoring to a shared utility if used more widely
async function setupSubscribeButton(buttonElement) {
  if (!buttonElement) return;

  const channelId = buttonElement.dataset.channelId;
  const channelName = buttonElement.dataset.channelName;
  const channelAvatar = buttonElement.dataset.channelAvatar;

  if (!channelId) {
    buttonElement.disabled = true;
    buttonElement.textContent = 'Error';
    console.error('Subscribe button missing channel ID.');
    return;
  }

  // --- Update Button Appearance Function ---
  const updateButtonAppearance = (isSubscribed) => {
    if (isSubscribed) {
      buttonElement.textContent = 'Subscribed';
      buttonElement.classList.remove('bg-zinc-600', 'hover:bg-zinc-500');
      buttonElement.classList.add('bg-green-600', 'hover:bg-green-700');
    } else {
      buttonElement.textContent = 'Subscribe';
      buttonElement.classList.remove('bg-green-600', 'hover:bg-green-700');
      buttonElement.classList.add('bg-zinc-600', 'hover:bg-zinc-500');
    }
    buttonElement.disabled = false; // Re-enable after check/action
  };

  // --- Check Initial Status ---
  buttonElement.disabled = true; // Disable while checking
  buttonElement.textContent = '...';
  try {
    const response = await fetch(`/api/subscriptions/${channelId}/status`);
    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`);
    }
    const data = await response.json();
    updateButtonAppearance(data.isSubscribed);
  } catch (error) {
    console.error(`Error checking subscription status for ${channelId}:`, error);
    buttonElement.textContent = 'Error';
    // Keep disabled if status check fails
  }

  // --- Add Click Listener ---
  buttonElement.addEventListener('click', async () => {
    buttonElement.disabled = true; // Disable during action
    const isCurrentlySubscribed = buttonElement.textContent === 'Subscribed';
    const method = isCurrentlySubscribed ? 'DELETE' : 'POST';
    const url = isCurrentlySubscribed ? `/api/subscriptions/${channelId}` : '/api/subscriptions';
    const body = isCurrentlySubscribed ? null : JSON.stringify({ channelId, name: channelName, avatarUrl: channelAvatar });
    const headers = isCurrentlySubscribed ? {} : { 'Content-Type': 'application/json' };

    try {
      const response = await fetch(url, { method, headers, body });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Try to get error details
        throw new Error(`API call failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }
      // Toggle state on success
      updateButtonAppearance(!isCurrentlySubscribed);
      console.info(`${isCurrentlySubscribed ? 'Unsubscribed from' : 'Subscribed to'} ${channelName} (${channelId})`);
    } catch (error) {
      console.error(`Error ${isCurrentlySubscribed ? 'unsubscribing' : 'subscribing'} to ${channelId}:`, error);
      // Optionally revert button text or show temporary error?
      updateButtonAppearance(isCurrentlySubscribed); // Revert to previous state on error
      alert(`Failed to ${isCurrentlySubscribed ? 'unsubscribe' : 'subscribe'}. Please try again.`);
    } finally {
      // Re-enable button regardless of success/fail, unless status check failed initially
      if (buttonElement.textContent !== 'Error') {
        buttonElement.disabled = false;
      }
    }
  });
}

// Setup the subscribe button on the channel page when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const subscribeButton = document.getElementById('channelPageSubscribeBtn');
  if (subscribeButton) {
    // Data attributes are already set by EJS
    setupSubscribeButton(subscribeButton);
  }
});