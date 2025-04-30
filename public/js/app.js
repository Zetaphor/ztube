import { showError, showLoading, hideLoading, formatTime } from './utils.js';
import * as SponsorBlock from './sponsorblock.js';
import * as Player from './player.js';
import * as Recommended from './recommended.js';
import * as Comments from './comments.js';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const content = document.getElementById('content');
const closePlayerBtn = document.getElementById('closePlayer');

// Global variables / State (App Level)
let currentVideoId = null;

// === DEFINE GLOBAL FUNCTION EARLY ===
// Make videoCardElement optional and default to null
window.loadAndDisplayVideo = async function (videoId, videoCardElement = null) {
  console.log(`app.js: window.loadAndDisplayVideo called for ${videoId}`);
  const videoPlayerContainer = document.getElementById('videoPlayer'); // Get the main player container
  const mainIndexContentGrid = document.getElementById('content'); // Grid on index page
  const mainChannelPageContentContainer = document.querySelector('#main-content > main'); // The <main> tag on channel page

  if (!videoPlayerContainer) {
    showError('Video player container not found.');
    return;
  }

  try {
    showLoading();
    currentVideoId = videoId;

    // Hide main content grid/container and show player container
    if (mainIndexContentGrid) {
      mainIndexContentGrid.classList.add('hidden');
    } else if (mainChannelPageContentContainer) {
      // Hide the entire <main> element on the channel page
      mainChannelPageContentContainer.classList.add('hidden');
    }
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

    // --- DEBUGGING LOGS (PART 1) ---
    // console.log("Video Details Received:", JSON.stringify(videoDetails, null, 2));
    // console.log("Attempting to access avatar URL:", videoDetails?.secondary_info?.owner?.author?.thumbnails?.[0]?.url);
    // --- END DEBUGGING LOGS (PART 1) ---

    const chapters = videoDetails.chapters || []; // Keep chapters data here

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

    // --- DEBUGGING LOGS (PART 2) ---
    // console.log("Channel Avatar DOM Element:", channelAvatar);
    // --- END DEBUGGING LOGS (PART 2) ---
    if (channelAvatar) {
      channelAvatar.src = videoDetails.secondary_info?.owner?.author?.thumbnails?.[0]?.url || '/img/default-avatar.svg';
      // --- DEBUGGING LOGS (PART 3) ---
      // console.log("Set channelAvatar.src to:", channelAvatar.src);
      // --- END DEBUGGING LOGS (PART 3) ---
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

// Listener for player init failed event
document.addEventListener('playerInitFailed', (event) => {
  console.error("app.js: Received playerInitFailed event", event.detail);
  showError('Failed to initialize video player. Please try again.');
  closeVideoPlayer(); // Ensure cleanup
});

// Initialize YouTube player API (Required by YT library)
// This function needs to be global for the YouTube API callback
window.onYouTubeIframeAPIReady = function () {
  console.log("app.js: YouTube Iframe API Ready.");
}

// --- App Level Functions --- (Search, Comments, Recommendations, etc.)

// Search Functions
async function performSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  const mainContentElement = document.getElementById('content');

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
  card.className = 'video-card bg-zinc-800 rounded-lg shadow-md overflow-hidden cursor-pointer transition-transform duration-200 hover:scale-105';

  const thumbnail = video.thumbnails?.[0]?.url || '/img/default-video.png';
  const duration = video.duration || '';
  const views = video.viewCount || '';
  const uploadedAt = video.uploadedAt || '';

  card.dataset.uploadedat = uploadedAt;

  card.onclick = () => window.loadAndDisplayVideo(video.id, card);

  const channelNameText = video.channel?.name || 'Unknown';
  const channelId = video.channel?.id;
  const verifiedBadge = video.channel?.verified ?
    '<i class="fas fa-check-circle text-green-500 ml-1 text-xs" title="Verified Channel"></i>' :
    '';

  const channelLinkContent = channelId ?
    `<a href="/channel/${channelId}" class="hover:text-green-500 truncate" onclick="event.stopPropagation();">${channelNameText}${verifiedBadge}</a>` :
    `<span class="truncate">${channelNameText}${verifiedBadge}</span>`;

  const channelAvatarUrl = video.channel?.avatar?.[0]?.url || '/img/default-avatar.svg';

  // Build meta HTML string separately
  let metaHTML = '';
  if (views) {
    metaHTML += `<span>${views}</span>`;
  }
  if (views && uploadedAt) {
    metaHTML += '<span class="separator">•</span>'; // Add separator if both exist
  }
  if (uploadedAt) {
    metaHTML += `<span>${uploadedAt}</span>`;
  }

  card.innerHTML = `
        <div class="video-thumbnail relative">
            <img src="${thumbnail}" alt="${video.title || 'Video thumbnail'}" loading="lazy" class="w-full h-full object-cover aspect-video">
            ${duration ? `<span class="video-duration absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1.5 py-0.5 rounded">${duration}</span>` : ''}
        </div>
        <div class="p-3">
            <h3 class="font-semibold text-zinc-100 line-clamp-2 mb-2 text-sm h-10">${video.title || 'Untitled'}</h3>
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
    `;

  return card;
}

// This function remains as it calls the global one
async function playVideo(videoId, videoCardElement) {
  window.loadAndDisplayVideo(videoId, videoCardElement);
}

// App-level function to handle closing the player
function closeVideoPlayer() {
  console.log("app.js: closeVideoPlayer called");
  const videoPlayerContainer = document.getElementById('videoPlayer'); // Get the main player container
  const mainIndexContentGrid = document.getElementById('content'); // Grid on index page
  const mainChannelPageContentContainer = document.querySelector('#main-content > main'); // The <main> tag on channel page

  Player.destroyPlayer(); // Call the player module's destroy function

  // Hide player container and show main content grid/container
  if (videoPlayerContainer) videoPlayerContainer.classList.add('hidden');

  if (mainIndexContentGrid) {
    mainIndexContentGrid.classList.remove('hidden');
  } else if (mainChannelPageContentContainer) {
    // Show the <main> element again on the channel page
    mainChannelPageContentContainer.classList.remove('hidden');
  }

  // Clear app-specific state related to the video
  currentVideoId = null;
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
    console.log('Found query parameter, performing search:', queryParam);
    searchInput.value = queryParam;
    performSearch();
  }

  // Add IPC Listener (Remains in app.js)
  if (window.electronAPI && typeof window.electronAPI.onVideoLoadRequest === 'function') {
    window.electronAPI.onVideoLoadRequest((videoId) => {
      console.log(`app.js: IPC Listener CALLBACK triggered with videoId: ${videoId}`);
      if (videoId && typeof videoId === 'string') {
        console.log(`app.js: Calling window.loadAndDisplayVideo via IPC with ID: ${videoId}`);
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