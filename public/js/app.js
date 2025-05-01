import { showError, showLoading, hideLoading, formatTime } from './utils.js';
import * as SponsorBlock from './sponsorblock.js';
import * as Player from './player.js';
import * as Recommended from './recommended.js';
import * as Comments from './comments.js';
import './addToPlaylist.js'; // Import the new module to register the global function

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const content = document.getElementById('content');
const closePlayerBtn = document.getElementById('closePlayer');
const videoPlayerSubscribeBtn = document.getElementById('videoPlayerSubscribeBtn');
const videoPlayerAddToPlaylistBtn = document.getElementById('addToPlaylistBtnPlayer'); // Get the new button

// Global variables / State (App Level)
let currentVideoId = null;
let currentVideoDetailsForPlaylist = {}; // Store details needed for adding to playlist

// --- Watch History Card Update ---
// Debounce mechanism for batch fetching history
let historyCheckTimeout = null;
const HISTORY_CHECK_DEBOUNCE_MS = 500; // Wait 500ms after last request before fetching
let pendingHistoryChecks = new Set(); // Store video IDs needing history check
let knownHistoryStatus = {}; // Cache fetched history status (video_id: { watchedSeconds, durationSeconds })

// === Helper to Update Bookmark Icon State ===
function updateBookmarkIconState(cardElement) {
  const bookmarkBtn = cardElement.querySelector('.bookmark-btn');
  const bookmarkIcon = bookmarkBtn?.querySelector('i');
  const videoId = cardElement.dataset.videoId;

  if (bookmarkBtn && bookmarkIcon && videoId && typeof window.isVideoInDefaultPlaylist === 'function') {
    try {
      if (window.isVideoInDefaultPlaylist(videoId)) {
        bookmarkIcon.className = 'fas fa-bookmark'; // Solid bookmark
        bookmarkBtn.title = "Remove from Watch Later";
        bookmarkBtn.classList.add('visible'); // Make visible
      } else {
        bookmarkIcon.className = 'far fa-bookmark'; // Empty bookmark
        bookmarkBtn.title = "Add to Watch Later";
        bookmarkBtn.classList.remove('visible'); // Ensure hidden/default state
      }
    } catch (error) {
      console.error(`Error updating bookmark state for ${videoId} in app.js:`, error);
      // Keep default state on error
      bookmarkIcon.className = 'far fa-bookmark';
      bookmarkBtn.title = "Add to Watch Later";
      bookmarkBtn.classList.remove('visible');
    }
  }
}

// === DEFINE GLOBAL FUNCTION EARLY ===
// Make videoCardElement optional and default to null
window.loadAndDisplayVideo = async function (videoId, videoCardElement = null) {
  const videoPlayerContainer = document.getElementById('videoPlayer'); // Get the main player container
  const mainContentContainer = document.querySelector('#main-content > main'); // The <main> element in all pages

  if (!videoPlayerContainer) {
    showError('Video player container not found.');
    return;
  }

  if (!mainContentContainer) {
    showError('Could not find the main content area (#main-content > main) to hide.');
    return; // Stop if we can't hide the main content
  }

  try {
    showLoading();
    currentVideoId = videoId;

    // Hide the main content container
    mainContentContainer.classList.add('hidden');

    videoPlayerContainer.classList.remove('hidden');

    // --- Get and display date from card immediately ---
    const uploadedDateFromCard = videoCardElement?.dataset?.uploadedat;
    const uploadDate = document.getElementById('uploadDate');
    if (uploadedDateFromCard && uploadDate) {
      uploadDate.textContent = uploadedDateFromCard;
    } else if (uploadDate) {
      uploadDate.textContent = '';
    }
    // --- End immediate date display ---

    // Get video details
    const detailsResponse = await fetch(`/api/video/${videoId}`);
    if (!detailsResponse.ok) {
      const errorData = await detailsResponse.json();
      throw new Error(errorData.error || `Failed to fetch video details: ${detailsResponse.status}`);
    }
    const videoDetails = await detailsResponse.json();

    const chapters = videoDetails.chapters || []; // Keep chapters data here

    // Store details needed for watch history and playlist button
    currentVideoDetailsForPlaylist = {
      videoId: videoId,
      videoTitle: videoDetails.title || 'Unknown',
      channelName: videoDetails.author?.name || 'Unknown',
      channelId: videoDetails.author?.id || null,
      thumbnailUrl: videoDetails.thumbnails?.[0]?.url || '/img/default-video.png',
      durationSeconds: videoDetails.durationSeconds || 0
    };

    // --- Update video info UI (Remains in app.js as it modifies non-player elements) ---
    const videoTitle = document.getElementById('videoTitle');
    if (videoTitle) videoTitle.textContent = videoDetails.title || 'Unknown';

    const channelName = document.getElementById('channelName');
    if (channelName) channelName.textContent = videoDetails.author?.name || 'Unknown';
    if (channelName) channelName.href = videoDetails.author?.id ? `/channel/${videoDetails.author?.id}` : '#';

    const channelAvatarLink = document.getElementById('channelAvatarLink');
    const channelAvatar = document.getElementById('channelAvatar');
    const channelIdForLink = videoDetails.author?.id;

    if (channelAvatarLink && channelIdForLink) {
      channelAvatarLink.href = `/channel/${channelIdForLink}`;
    }

    if (channelAvatar) {
      channelAvatar.src = videoDetails.author?.thumbnails?.[0]?.url || '/img/default-avatar.svg';
    }

    // Add Hover Effect Listeners (Remains in app.js)
    if (channelAvatarLink && channelName) {
      // Remove previous listeners to prevent duplicates if re-loading
      channelAvatarLink.replaceWith(channelAvatarLink.cloneNode(true));
      channelName.replaceWith(channelName.cloneNode(true));
      // Re-fetch elements after cloning
      const newAvatarLink = document.getElementById('channelAvatarLink');
      const newChannelName = document.getElementById('channelName');

      if (newAvatarLink && newChannelName) {
        const addHoverEffect = () => newChannelName.classList.add('text-green-500');
        const removeHoverEffect = () => newChannelName.classList.remove('text-green-500');

        newAvatarLink.addEventListener('mouseenter', addHoverEffect);
        newAvatarLink.addEventListener('mouseleave', removeHoverEffect);
        newChannelName.addEventListener('mouseenter', addHoverEffect);
        newChannelName.addEventListener('mouseleave', removeHoverEffect);
      }
    }

    const subscriberCount = document.getElementById('subscriberCount');
    if (subscriberCount) subscriberCount.textContent = videoDetails.author?.subscriber_count?.text || '';

    const viewCount = document.getElementById('viewCount');
    if (viewCount) viewCount.textContent = videoDetails.view_count || '0 views';

    const videoDescription = document.getElementById('videoDescription');
    if (videoDescription) videoDescription.textContent = videoDetails.description || '';

    const uploadDateForDetails = document.getElementById('uploadDate');
    const relativeDate = videoDetails.primary_info?.relative_date?.text;
    const absoluteDate = videoDetails.primary_info?.published?.text;

    if (uploadDateForDetails) {
      uploadDateForDetails.removeAttribute('title');
      if (relativeDate && absoluteDate) {
        uploadDateForDetails.innerHTML = `${relativeDate} • ${absoluteDate}`;
      } else if (relativeDate) {
        uploadDateForDetails.textContent = relativeDate;
      } else if (absoluteDate) {
        uploadDateForDetails.textContent = absoluteDate;
      } else if (uploadedDateFromCard) {
        uploadDateForDetails.textContent = uploadedDateFromCard;
      } else {
        uploadDateForDetails.textContent = 'Unknown date';
      }
    } else {
      console.warn("Upload date element (#uploadDate) not found in player overlay.");
    }
    // --- End video info UI update ---

    // Initialize Comments using the Module
    Comments.initComments(videoId);

    // Fetch and display recommended videos (Uses Recommended module)
    Recommended.fetchRecommendedVideos(videoId);

    // Fetch SponsorBlock data (Remains in app.js, player module will use it)
    SponsorBlock.fetchSponsorBlockSegments(videoId);

    // Initialize YouTube player using the Player module
    Player.initPlayer(videoId, chapters, {
      title: currentVideoDetailsForPlaylist.videoTitle,
      channelName: currentVideoDetailsForPlaylist.channelName,
      channelId: currentVideoDetailsForPlaylist.channelId,
      durationSeconds: currentVideoDetailsForPlaylist.durationSeconds,
      thumbnailUrl: currentVideoDetailsForPlaylist.thumbnailUrl
    });

    // -- Setup Subscribe Button --
    if (videoPlayerSubscribeBtn) {
      videoPlayerSubscribeBtn.dataset.channelId = videoDetails.author?.id;
      videoPlayerSubscribeBtn.dataset.channelName = videoDetails.author?.name;
      videoPlayerSubscribeBtn.dataset.channelAvatar = videoDetails.author?.thumbnails?.[0]?.url || '';
      setupSubscribeButton(videoPlayerSubscribeBtn); // Call the setup function
    }
    // -- End Setup --

    // --- Get button reference *within* the current player context ---
    const videoPlayerToggleWatchLaterBtn = document.getElementById('videoPlayerToggleWatchLaterBtn');

    // -- Setup Toggle Watch Later Button (Player specific) --
    if (videoPlayerToggleWatchLaterBtn && window.toggleVideoInDefaultPlaylist && window.isVideoInDefaultPlaylist) {
      // Set initial state based on *current* knowledge
      const initiallyInDefault = window.isVideoInDefaultPlaylist(videoId);
      const initialIcon = videoPlayerToggleWatchLaterBtn.querySelector('i');
      if (initialIcon) {
        if (initiallyInDefault) {
          initialIcon.className = 'fas fa-bookmark';
          videoPlayerToggleWatchLaterBtn.title = "Remove from Watch Later";
        } else {
          initialIcon.className = 'far fa-bookmark';
          videoPlayerToggleWatchLaterBtn.title = "Add to Watch Later";
        }
      }

      // Remove previous listener if any, then add new one
      const newWatchLaterButton = videoPlayerToggleWatchLaterBtn.cloneNode(true);
      videoPlayerToggleWatchLaterBtn.parentNode.replaceChild(newWatchLaterButton, videoPlayerToggleWatchLaterBtn);

      newWatchLaterButton.addEventListener('click', async () => {
        const iconElement = newWatchLaterButton.querySelector('i');
        if (!iconElement) return; // Safety check

        const currentIconClass = iconElement.className;
        iconElement.className = 'fas fa-spinner fa-spin';
        newWatchLaterButton.disabled = true;

        try {
          // Ensure we have the necessary details
          if (!currentVideoDetailsForPlaylist || !currentVideoDetailsForPlaylist.videoId) {
            throw new Error("Video details not available for Watch Later toggle.");
          }
          const isNowInPlaylist = await window.toggleVideoInDefaultPlaylist(currentVideoDetailsForPlaylist);
          // Update the button directly after success
          if (isNowInPlaylist) {
            iconElement.className = 'fas fa-bookmark';
            newWatchLaterButton.title = "Remove from Watch Later";
          } else {
            iconElement.className = 'far fa-bookmark';
            newWatchLaterButton.title = "Add to Watch Later";
          }
          newWatchLaterButton.disabled = false; // Re-enable on success
        } catch (error) {
          console.error("Error toggling Watch Later from player:", error);
          showError(`Failed to update Watch Later: ${error.message}`);
          iconElement.className = currentIconClass; // Revert icon on error
          newWatchLaterButton.disabled = false; // Re-enable button on error
        }
      });
    } else if (videoPlayerToggleWatchLaterBtn) {
      // Hide or disable button if functionality isn't available
      videoPlayerToggleWatchLaterBtn.style.display = 'none';
      console.warn('Watch Later button found, but toggle functions are missing.')
    }
    // -- End Setup Watch Later Button --

  } catch (error) {
    showError(`Failed to play video: ${error.message}`);
    console.error('Playback error (app.js):', error);
    closeVideoPlayer(); // Ensure cleanup on error
  } finally {
    hideLoading();
  }
}

// Event Listeners (App Level)
if (searchButton) {
  searchButton.addEventListener('click', performSearch);
}
if (searchInput) {
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });
}
if (closePlayerBtn) {
  // Use the app-level closeVideoPlayer function
  closePlayerBtn.addEventListener('click', closeVideoPlayer);
}

// Listener for player close request (e.g., Escape key in player module)
document.addEventListener('closePlayerRequest', closeVideoPlayer);

// Listener for the player's Add to Playlist button
if (videoPlayerAddToPlaylistBtn) {
  videoPlayerAddToPlaylistBtn.addEventListener('click', () => {
    if (window.handleAddToPlaylistClick && currentVideoDetailsForPlaylist.videoId) {
      window.handleAddToPlaylistClick(currentVideoDetailsForPlaylist);
    } else {
      console.error("Add to Playlist handler not found or video details missing.");
      showError("Could not initiate add to playlist.");
    }
  });
}

// Listener for player init failed event
document.addEventListener('playerInitFailed', (event) => {
  console.error("app.js: Received playerInitFailed event", event.detail);
  showError('Failed to initialize video player. Please try again.');
  closeVideoPlayer(); // Ensure cleanup
  currentVideoId = null;
  currentVideoDetailsForPlaylist = {}; // Clear playlist details too
  Comments.clearComments(); // Call the module's clear function
});

// Initialize YouTube player API (Required by YT library)
// This function needs to be global for the YouTube API callback
window.onYouTubeIframeAPIReady = function () {
  console.info("app.js: YouTube Iframe API Ready.");
}

// --- App Level Functions --- (Search, Comments, Recommendations, etc.)

// Search Functions
async function performSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  const videoPlayerContainer = document.getElementById('videoPlayer'); // Get player container

  // If the player is currently visible, close it first
  if (videoPlayerContainer && !videoPlayerContainer.classList.contains('hidden')) {
    closeVideoPlayer();
  }

  // --- Find the main content area --- a <main> tag inside #main-content
  const mainContentArea = document.querySelector('#main-content > main');
  // --- End Find Main Area ---

  if (mainContentArea) {
    try {
      showLoading();
      const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Search failed: ${response.status}`);
      }
      const data = await response.json();
      // Display results within the main content area
      displayResults(data, mainContentArea);
      // Update bookmark icons after displaying results
      document.dispatchEvent(new Event('uiNeedsBookmarkUpdate'));
      // Process newly displayed cards for watch history
      processCardsForWatchHistory(mainContentArea.querySelectorAll('.video-card'));
    } catch (error) {
      console.error('Search error:', error);
      // Display error within the main content area, replacing its content
      mainContentArea.innerHTML = `<div class="col-span-full text-center py-10 text-red-600">${error.message || 'Search failed. Please try again.'}</div>`;
      showError(error.message || 'Search failed. Please try again.');
    } finally {
      hideLoading();
    }
  } else {
    // Fallback: If no main content area found, redirect to index search
    console.warn("Could not find the main content area (#main-content > main). Redirecting to index search.");
    window.location.href = `/?query=${encodeURIComponent(query)}`;
  }
}

function displayResults(results, mainContentElement) {
  // Clear the main content element
  mainContentElement.innerHTML = '';
  // Remove any specific layout classes from the main element itself if necessary
  mainContentElement.className = 'container mx-auto p-4 flex-grow'; // Reset to default main classes

  // Create the grid container *inside* the main element
  const gridContainer = document.createElement('div');
  gridContainer.id = 'content'; // Give it the ID used by index page for consistency
  gridContainer.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4'; // Standard search grid

  if (!results || !results.length) {
    gridContainer.innerHTML = '<div class="col-span-full text-center py-10 text-zinc-500">No results found</div>';
  } else {
    results.forEach(video => {
      const card = createVideoCard(video); // Use existing card creation
      gridContainer.appendChild(card);
    });
  }

  // Append the new grid container to the main content element
  mainContentElement.appendChild(gridContainer);

  // Update bookmark icons after displaying results
  // document.dispatchEvent(new Event('uiNeedsBookmarkUpdate')); // Handled by specific pages now
  // Process any initially visible cards (e.g., on index page if content is pre-loaded, or after search)
  const initialCards = document.querySelectorAll('#main-content > main > #content > .video-card');
  if (initialCards.length > 0) {
    processCardsForWatchHistory(initialCards);
  }
}

function createVideoCard(video) {
  const card = document.createElement('div');
  card.className = 'video-card group bg-zinc-800 rounded-lg shadow-md overflow-hidden cursor-pointer transition-transform duration-200 hover:scale-105 relative';

  const thumbnail = video.thumbnails?.[0]?.url || '/img/default-video.png';
  let duration = video.duration || '';
  let views = video.viewCount || '';
  let uploadedAt = video.uploadedAt || '';
  const videoTitle = video.title || 'Untitled';
  const channelNameText = video.channel?.name || 'Unknown';

  card.dataset.videoId = video.id;
  card.dataset.uploadedat = uploadedAt;
  card.dataset.videoTitle = videoTitle;
  card.dataset.channelName = channelNameText;
  card.dataset.thumbnailUrl = thumbnail;

  const isLivestream = duration === "N/A" && typeof views === 'string' && views.includes("watching");

  if (isLivestream) {
    uploadedAt = '';
    duration = '🔴 LIVE';
  }

  card.onclick = () => window.loadAndDisplayVideo(video.id, card);

  const channelId = video.channel?.id;
  const verifiedBadge = video.channel?.verified ?
    '<i class="fas fa-check-circle text-green-500 ml-1 text-xs" title="Verified Channel"></i>' :
    '';

  const channelLinkContent = channelId ?
    `<a href="/channel/${channelId}" class="hover:text-green-500 truncate" onclick="event.stopPropagation();">${channelNameText}${verifiedBadge}</a>` :
    `<span class="truncate">${channelNameText}${verifiedBadge}</span>`;

  const channelAvatarUrl = video.channel?.avatar?.[0]?.url || '/img/default-avatar.svg';

  let metaHTML = '';
  if (views) {
    metaHTML += `<span>${views}</span>`;
  }
  if (views && uploadedAt) {
    metaHTML += '<span class="separator">•</span>';
  }
  if (uploadedAt) {
    metaHTML += `<span>${uploadedAt}</span>`;
  }

  card.innerHTML = `
        <div class="video-thumbnail relative">
            <img src="${thumbnail}" alt="${videoTitle} thumbnail" loading="lazy" class="w-full h-full object-cover aspect-video">
            ${duration ? `<span class="video-duration absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1.5 py-0.5 rounded z-10">${duration}</span>` : ''}
            <!-- Watch History Overlay -->
            <div class="watch-history-overlay absolute inset-0 bg-black/60 hidden group-hover:opacity-0 transition-opacity duration-200"></div>
            <!-- Watch History Progress Bar -->
            <div class="watch-history-progress absolute bottom-0 left-0 right-0 h-1 bg-zinc-600 hidden">
                <div class="watch-history-progress-bar h-full bg-green-600"></div>
            </div>
            <!-- Thumbnail Hover Icons -->
            <div class="thumbnail-icons absolute top-1 right-1 flex flex-row gap-1.5 z-10">
                <button class="remove-history-btn thumbnail-icon-btn hidden hover:bg-red-600" title="Remove from History">
                    <i class="fas fa-eye-slash"></i>
                </button>
                <button class="add-to-playlist-hover-btn thumbnail-icon-btn" title="Add to Playlist">
                    <i class="fas fa-plus"></i>
                </button>
                <button class="bookmark-btn thumbnail-icon-btn" title="Add to Watch Later">
                    <i class="far fa-bookmark"></i> <!-- Default empty state -->
                </button>
            </div>
            <!-- End Thumbnail Hover Icons -->
        </div>
        <div class="p-3">
            <h3 class="font-semibold text-zinc-100 line-clamp-2 mb-2 text-sm h-10">${videoTitle}</h3>
            <div class="flex items-center mt-1">
                <a href="${channelId ? `/channel/${channelId}` : '#'}" class="flex-shrink-0 mr-2" onclick="event.stopPropagation();">
                    <img src="${channelAvatarUrl}" alt="${channelNameText} avatar" class="w-8 h-8 rounded-full">
                </a>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center text-zinc-300 text-xs">
                      ${channelLinkContent}
                    </div>
                    <div class="video-meta text-zinc-400 text-xs mt-0.5 flex flex-wrap gap-x-1">
                        ${metaHTML}
                    </div>
                </div>
            </div>
        </div>
        <!-- Original Add to Playlist Button (Now hidden, functionality moved to hover icon) -->
        <button class="add-to-playlist-btn hidden absolute top-1 right-1 bg-zinc-800/80 hover:bg-green-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10" title="Add to Playlist">
            <i class="fas fa-plus"></i>
        </button>
    `;

  // --- Add Listeners for Hover Icons ---
  const bookmarkBtn = card.querySelector('.bookmark-btn');
  const addToPlaylistBtn = card.querySelector('.add-to-playlist-hover-btn');
  const bookmarkIcon = bookmarkBtn?.querySelector('i');

  if (bookmarkBtn && bookmarkIcon && window.toggleVideoInDefaultPlaylist) {
    // Remove initial state setting here
    // if (window.isVideoInDefaultPlaylist && window.isVideoInDefaultPlaylist(card.dataset.videoId)) { ... }

    bookmarkBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
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

// This function remains as it calls the global one
async function playVideo(videoId, videoCardElement) {
  window.loadAndDisplayVideo(videoId, videoCardElement);
}

// App-level function to handle closing the player
function closeVideoPlayer() {
  const videoPlayerContainer = document.getElementById('videoPlayer'); // Get the main player container
  const mainContentContainer = document.querySelector('#main-content > main'); // The <main> element in all pages

  Player.destroyPlayer(); // Call the player module's destroy function

  // Hide player container
  if (videoPlayerContainer) videoPlayerContainer.classList.add('hidden');

  // Show the main content container
  if (mainContentContainer) {
    mainContentContainer.classList.remove('hidden');
  } else {
    // This case should ideally not happen now with consistent structure
    console.error(`closeVideoPlayer: Could not find the main content container (#main-content > main) to show!`);
  }

  // Clear app-specific state related to the video
  currentVideoId = null;
  currentVideoDetailsForPlaylist = {}; // Clear playlist details too
  // commentsNextPage = null; // State moved to Comments module
  Comments.clearComments(); // Call the module's clear function

  // Clear recommended videos using the module function
  Recommended.clearRecommendedVideos();
}

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const queryParam = urlParams.get('query');
  const searchInput = document.getElementById('searchInput');
  const content = document.getElementById('content');

  if (queryParam && searchInput && content) {
    searchInput.value = queryParam;
    performSearch();
  } else {
    // If no search query, maybe update icons for initially loaded content (if any)
    document.dispatchEvent(new Event('uiNeedsBookmarkUpdate'));
  }

  // Add IPC Listener (Remains in app.js)
  if (window.electronAPI && typeof window.electronAPI.onVideoLoadRequest === 'function') {
    window.electronAPI.onVideoLoadRequest((videoId) => {
      console.info(`app.js: IPC Listener CALLBACK triggered with videoId: ${videoId}`);
      if (videoId && typeof videoId === 'string') {
        console.info(`app.js: Calling window.loadAndDisplayVideo via IPC with ID: ${videoId}`);
        try {
          // Call the global function, passing null for the element
          window.loadAndDisplayVideo(videoId, null);
        } catch (error) {
          console.error(`app.js: Error calling window.loadAndDisplayVideo for ID ${videoId} via IPC:`, error);
          showError(`Failed to load video (IPC): ${error.message}`);
        }
      } else {
        console.error('app.js: Received invalid video ID via IPC:', videoId);
        showError(`Received invalid video ID via IPC: ${videoId}`);
      }
    });
  } else {
    console.warn('app.js: electronAPI or onVideoLoadRequest not found. IPC listener not set up.');
  }

  // --- Event Listener for Updating Bookmark Icons ---
  const updateAllVisibleBookmarkIcons = () => {
    // Select only cards directly within the main content grid managed by app.js/search
    const cards = document.querySelectorAll('#main-content > main > #content > .video-card');
    console.log(`[app.js] Found ${cards.length} video cards in #content to update bookmark status.`);
    cards.forEach(card => {
      if (card.dataset.videoId) {
        updateBookmarkIconState(card);
      }
    });
  };

  // Listen for the event dispatched when default playlist info is loaded
  document.addEventListener('defaultPlaylistLoaded', () => {
    console.log("[app.js] Received defaultPlaylistLoaded event. Updating icons in #content.");
    updateAllVisibleBookmarkIcons();
  });

  // Listen for a custom event that signals UI might need an update (e.g., after search results display)
  document.addEventListener('uiNeedsBookmarkUpdate', () => {
    console.log("[app.js] Received uiNeedsBookmarkUpdate event. Updating icons.");
    // This check ensures we don't try to update before the data is ready
    if (window.defaultPlaylistInfoLoaded) {
      updateAllVisibleBookmarkIcons();
    } else {
      console.log("[app.js] Default playlist info not yet loaded, skipping immediate update.");
      // The 'defaultPlaylistLoaded' listener will handle it later.
    }
  });
  // --- End Event Listener ---

  // Process any initially visible cards (e.g., on index page if content is pre-loaded, or after search)
  const initialCards = document.querySelectorAll('#main-content > main > #content > .video-card');
  if (initialCards.length > 0) {
    processCardsForWatchHistory(initialCards);
  }
});

// === Subscribe/Unsubscribe Logic ===
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

// --- Watch History Update Functions ---

/**
 * Updates the visual appearance of a single video card based on its watch history.
 * @param {HTMLElement} cardElement - The video card element.
 * @param {object|null} historyData - The history object { watchedSeconds, durationSeconds } or null.
 */
function updateWatchHistoryUI(cardElement, historyData) {
  const overlay = cardElement.querySelector('.watch-history-overlay');
  const progressContainer = cardElement.querySelector('.watch-history-progress');
  const progressBar = cardElement.querySelector('.watch-history-progress-bar');
  const removeHistoryBtn = cardElement.querySelector('.remove-history-btn'); // Find the new button

  // --- Remove existing listener to prevent duplicates ---
  // Clone the button and replace it to remove all old listeners safely
  let newRemoveHistoryBtn = removeHistoryBtn;
  if (removeHistoryBtn) {
    newRemoveHistoryBtn = removeHistoryBtn.cloneNode(true);
    removeHistoryBtn.parentNode.replaceChild(newRemoveHistoryBtn, removeHistoryBtn);
  }
  // --- End Listener Removal ---

  if (!overlay || !progressContainer || !progressBar || !newRemoveHistoryBtn) {
    // console.warn('Watch history UI elements not found in card:', cardElement);
    return;
  }

  if (historyData && historyData.watchedSeconds > 0) {
    overlay.classList.remove('hidden');
    progressContainer.classList.remove('hidden');
    newRemoveHistoryBtn.classList.remove('hidden'); // Show the button

    // Attach click listener ONLY when shown
    newRemoveHistoryBtn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent card click
      const videoId = cardElement.dataset.videoId;
      if (!videoId) return;

      // Optional: Add a visual loading state to the button
      newRemoveHistoryBtn.disabled = true;
      const icon = newRemoveHistoryBtn.querySelector('i');
      const originalIconClass = icon ? icon.className : '';
      if (icon) icon.className = 'fas fa-spinner fa-spin';

      try {
        const response = await fetch(`/api/watch-history/${videoId}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `API Error: ${response.status}`);
        }

        console.log(`Removed video ${videoId} from watch history.`);
        // Update UI immediately on success
        overlay.classList.add('hidden');
        progressContainer.classList.add('hidden');
        progressBar.style.width = '0%';
        newRemoveHistoryBtn.classList.add('hidden'); // Hide the button again
        // Update cache
        knownHistoryStatus[videoId] = null;

      } catch (error) {
        console.error(`Failed to remove ${videoId} from history:`, error);
        showError(`Error removing from history: ${error.message}`);
        // Restore button state on error
        newRemoveHistoryBtn.disabled = false;
        if (icon) icon.className = originalIconClass;
      }
    });

    const duration = historyData.durationSeconds;
    const watched = historyData.watchedSeconds;

    // Calculate progress percentage, handle potential division by zero
    const progressPercent = (duration && duration > 0) ? Math.min(100, (watched / duration) * 100) : 0;

    // Apply the calculated progress percentage FIRST
    progressBar.style.width = `${progressPercent}%`;

    // Consider fully watched if within a few seconds of the end or over 95% watched
    const fullyWatchedThreshold = duration ? Math.max(duration - 5, duration * 0.95) : Infinity;
    if (watched >= fullyWatchedThreshold) {
      progressBar.style.width = '100%'; // THEN override to 100% if fully watched
      // Optionally, change the color or style for fully watched
      // progressBar.style.backgroundColor = '#someOtherColor';
    }

  } else {
    // No history or watchedSeconds is 0
    overlay.classList.add('hidden');
    progressContainer.classList.add('hidden');
    progressBar.style.width = '0%';
  }

  // --- Restore button state (e.g., re-enable if it was disabled) ---
  if (newRemoveHistoryBtn) newRemoveHistoryBtn.disabled = false; // Ensure it's enabled if no listener was added or on error recovery
  const icon = newRemoveHistoryBtn?.querySelector('i');
  if (icon && icon.classList.contains('fa-spinner')) {
    icon.className = 'fas fa-eye-slash'; // Restore original icon if stuck loading
  }
  // --- End Restore Button State ---
}

/**
 * Fetches watch history status for a batch of video IDs.
 * @param {string[]} videoIds - Array of video IDs.
 */
async function fetchAndUpdateWatchHistoryBatch(videoIds) {
  if (!videoIds || videoIds.length === 0) return;

  try {
    const response = await fetch('/api/watch-history/batch-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds }),
    });

    if (!response.ok) {
      console.error(`Failed to fetch batch history status: ${response.status}`);
      return; // Don't update cache or UI on error
    }

    const batchStatus = await response.json();

    // Update cache and UI for each video ID in the response
    Object.keys(batchStatus).forEach(videoId => {
      knownHistoryStatus[videoId] = batchStatus[videoId]; // Update cache
      // --- Debug Logging ---
      // const selector = `.video-card[data-video-id="${videoId}"], .recommended-video-card[data-video-id="${videoId}"]`;
      // const cardsFound = document.querySelectorAll(selector);
      // console.log(`[App.js] fetchAndUpdateWatchHistoryBatch - Updating UI for ${videoId}. Found ${cardsFound.length} cards with selector: ${selector}`, cardsFound);
      // --- End Debug Logging ---
      // Find all visible cards with this video ID and update their UI
      // This might select cards across different sections (search, recommended, etc.)
      const selector = `.video-card[data-video-id="${videoId}"], .recommended-video-card[data-video-id="${videoId}"]`;
      const cardsFound = document.querySelectorAll(selector);
      cardsFound.forEach(card => { // Use cardsFound directly
        updateWatchHistoryUI(card, batchStatus[videoId]);
      });
    });

  } catch (error) {
    console.error('Error fetching/updating batch history:', error);
  }
}

/**
 * Adds video IDs to the pending check list and schedules a debounced fetch.
 * @param {string[]} videoIds - Array of video IDs to check.
 */
function scheduleWatchHistoryCheck(videoIds) {
  let needsFetch = false;
  videoIds.forEach(id => {
    // Only add if we don't already have cached status for it
    if (id && !knownHistoryStatus.hasOwnProperty(id)) {
      pendingHistoryChecks.add(id);
      needsFetch = true;
    }
  });

  if (!needsFetch) return; // Don't reset timeout if nothing new was added

  // Clear existing timeout and set a new one
  clearTimeout(historyCheckTimeout);
  historyCheckTimeout = setTimeout(() => {
    const idsToFetch = Array.from(pendingHistoryChecks);
    pendingHistoryChecks.clear(); // Clear the set for the next batch
    if (idsToFetch.length > 0) {
      fetchAndUpdateWatchHistoryBatch(idsToFetch);
    }
  }, HISTORY_CHECK_DEBOUNCE_MS);
}

/**
 * Processes a list of card elements, updating UI from cache or scheduling checks.
 * @param {NodeListOf<Element>|Element[]} cards - A list of video card elements.
 */
function processCardsForWatchHistory(cards) {
  const idsToCheck = [];
  cards.forEach(card => {
    const videoId = card.dataset.videoId;
    if (videoId) {
      if (knownHistoryStatus.hasOwnProperty(videoId)) {
        // Use cached data immediately
        updateWatchHistoryUI(card, knownHistoryStatus[videoId]);
      } else {
        // Add to the list to be fetched
        idsToCheck.push(videoId);
      }
    }
  });

  if (idsToCheck.length > 0) {
    scheduleWatchHistoryCheck(idsToCheck);
  }
}

/**
 * Removes specified video IDs from the in-memory watch history cache.
 * @param {string[]} videoIds - Array of video IDs to clear from the cache.
 */
function clearWatchHistoryCacheForIds(videoIds) {
  if (!videoIds || videoIds.length === 0) return;
  let clearedCount = 0;
  videoIds.forEach(id => {
    if (knownHistoryStatus.hasOwnProperty(id)) {
      delete knownHistoryStatus[id];
      clearedCount++;
    }
  });
  if (clearedCount > 0) {
    console.log(`[App.js] Cleared ${clearedCount} IDs from watch history cache.`);
  }
}

// --- End Watch History Update Functions ---

// Expose for use by other modules (like subscriptions-page.js)
window.processCardsForWatchHistory = processCardsForWatchHistory;
window.clearWatchHistoryCacheForIds = clearWatchHistoryCacheForIds; // Expose the new function

// === DEFINE GLOBAL FUNCTION EARLY ===
// Make videoCardElement optional and default to null