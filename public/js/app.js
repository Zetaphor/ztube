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

    // Store details needed for the add to playlist button
    currentVideoDetailsForPlaylist = {
      videoId: videoId,
      videoTitle: videoDetails.title || 'Unknown',
      channelName: videoDetails.secondary_info?.owner?.author?.name || 'Unknown',
      thumbnailUrl: videoDetails.primary_info?.thumbnail?.url || 'img/default-video.png' // Need a thumbnail
    };

    // --- Update video info UI (Remains in app.js as it modifies non-player elements) ---
    const videoTitle = document.getElementById('videoTitle');
    if (videoTitle) videoTitle.textContent = videoDetails.title || 'Unknown';

    const channelName = document.getElementById('channelName');
    if (channelName) channelName.textContent = videoDetails.secondary_info?.owner?.author?.name || 'Unknown';
    if (channelName) channelName.href = videoDetails.secondary_info?.owner?.author?.id ? `/channel/${videoDetails.secondary_info?.owner?.author?.id}` : '#';

    const channelAvatarLink = document.getElementById('channelAvatarLink');
    const channelAvatar = document.getElementById('channelAvatar');
    const channelIdForLink = videoDetails.secondary_info?.owner?.author?.id;

    if (channelAvatarLink && channelIdForLink) {
      channelAvatarLink.href = `/channel/${channelIdForLink}`;
    }

    if (channelAvatar) {
      channelAvatar.src = videoDetails.secondary_info?.owner?.author?.thumbnails?.[0]?.url || '/img/default-avatar.svg';
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
    if (subscriberCount) subscriberCount.textContent = videoDetails.secondary_info?.owner?.subscriber_count?.text || '';

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
    Player.initPlayer(videoId, chapters); // Pass chapters

    // -- Setup Subscribe Button --
    if (videoPlayerSubscribeBtn) {
      videoPlayerSubscribeBtn.dataset.channelId = videoDetails.secondary_info?.owner?.author?.id;
      videoPlayerSubscribeBtn.dataset.channelName = videoDetails.secondary_info?.owner?.author?.name;
      videoPlayerSubscribeBtn.dataset.channelAvatar = videoDetails.secondary_info?.owner?.author?.thumbnails?.[0]?.url || '';
      setupSubscribeButton(videoPlayerSubscribeBtn); // Call the setup function
    }
    // -- End Setup --

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

  const mainContentElement = document.getElementById('content');
  const videoPlayerContainer = document.getElementById('videoPlayer'); // Get player container

  // --- Added Check ---
  // If the player is currently visible, close it first
  if (videoPlayerContainer && !videoPlayerContainer.classList.contains('hidden')) {
    closeVideoPlayer();
  }
  // --- End Added Check ---

  if (mainContentElement) {
    try {
      showLoading();
      const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Search failed: ${response.status}`);
      }
      const data = await response.json();
      displayResults(data, mainContentElement);
    } catch (error) {
      console.error('Search error:', error);
      mainContentElement.innerHTML = `<div class="col-span-full text-center py-10 text-red-600">${error.message || 'Search failed. Please try again.'}</div>`;
      showError(error.message || 'Search failed. Please try again.');
    } finally {
      hideLoading();
    }
  } else {
    window.location.href = `/?query=${encodeURIComponent(query)}`;
  }
}

function displayResults(results, targetElement) {
  targetElement.innerHTML = '';

  if (!results || !results.length) {
    targetElement.innerHTML = '<div class="col-span-full text-center py-10 text-gray-600">No results found</div>';
    return;
  }

  results.forEach(video => {
    const card = createVideoCard(video);
    targetElement.appendChild(card);
  });
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
            ${duration ? `<span class="video-duration absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1.5 py-0.5 rounded">${duration}</span>` : ''}
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
                    <div class="video-meta text-zinc-400 text-xs mt-0.5 flex flex-wrap gap-x-2">
                        ${metaHTML}
                    </div>
                </div>
            </div>
        </div>
        <!-- Add to Playlist Button (Hidden by default, shown on group-hover) -->
        <button class="add-to-playlist-btn absolute top-1 right-1 bg-zinc-800/80 hover:bg-green-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10" title="Add to Playlist">
            <i class="fas fa-plus"></i>
        </button>
    `;

  const addToPlaylistBtn = card.querySelector('.add-to-playlist-btn');
  if (addToPlaylistBtn) {
    addToPlaylistBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.handleAddToPlaylistClick) {
        window.handleAddToPlaylistClick(card.dataset);
      } else {
        console.error("handleAddToPlaylistClick function not found.");
        alert("Add to playlist functionality not available yet.");
      }
    });
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