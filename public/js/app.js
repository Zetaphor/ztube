import { showError, showLoading, hideLoading, formatTime } from './utils.js';
import * as SponsorBlock from './sponsorblock.js';
import * as Player from './player.js'; // Import the new player module
import * as Recommended from './recommended.js'; // Import the recommended module

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const content = document.getElementById('content');
const closePlayerBtn = document.getElementById('closePlayer'); // Get close button once

// Global variables / State (App Level)
let currentVideoId = null;
let commentsNextPage = null;
// Removed player-specific state: ytPlayer, progressTimer, videoChapters, playerResizeObserver, keydownHandler, keydownAttached

// === DEFINE GLOBAL FUNCTION EARLY ===
// Make videoCardElement optional and default to null
window.loadAndDisplayVideo = async function (videoId, videoCardElement = null) {
  // Removed getElementById('videoPlayer') check, Player module handles it
  console.log(`app.js: window.loadAndDisplayVideo called for ${videoId}`);

  try {
    showLoading();
    currentVideoId = videoId;
    // Removed document.body.classList.add('overflow-hidden'); Player module handles it

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
        uploadDateForDetails.innerHTML = `${relativeDate} <span class="text-zinc-500">(${absoluteDate})</span>`;
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

    // Load comments (Remains in app.js)
    const commentsList = document.getElementById('commentsList');
    const loadMoreComments = document.getElementById('loadMoreComments');
    if (commentsList && loadMoreComments) {
      await loadComments(videoId, null, commentsList, loadMoreComments);
    }

    // Fetch and display recommended videos (Uses Recommended module)
    Recommended.fetchRecommendedVideos(videoId);

    // Fetch SponsorBlock data (Remains in app.js, player module will use it)
    SponsorBlock.fetchSponsorBlockSegments(videoId);

    // Initialize YouTube player using the Player module
    console.log("app.js: Calling Player.initPlayer");
    Player.initPlayer(videoId, chapters); // Pass chapters
    console.log("app.js: Returned from Player.initPlayer");

    // Setup comments listener after player is ready (Remains in app.js)
    setupLoadMoreCommentsListener();

  } catch (error) {
    showError(`Failed to play video: ${error.message}`);
    console.error('Playback error (app.js):', error);
    closeVideoPlayer(); // Ensure cleanup on error
  } finally {
    hideLoading();
  }
}
console.log("app.js: window.loadAndDisplayVideo defined", typeof window.loadAndDisplayVideo);

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
  // The Player module will create YT.Player instances on demand
  // So, this function doesn't need to do anything specific anymore.
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
    console.log('Redirecting to index page for search...');
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
  console.log("Creating video card for:", video); // Log the received video object
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

// Comments Functions
async function loadComments(videoId, continuation = null, commentsList, loadMoreComments) {
  if (!commentsList || !loadMoreComments) {
    console.error("Comments list or load more button element not provided to loadComments");
    return;
  }
  try {
    const url = continuation
      ? `/api/comments/${videoId}?continuation=${continuation}`
      : `/api/comments/${videoId}`;

    // Indicate loading state on the button
    const originalButtonText = loadMoreComments.textContent;
    loadMoreComments.textContent = 'Loading...';
    loadMoreComments.disabled = true;

    const response = await fetch(url);
    const data = await response.json();

    loadMoreComments.textContent = originalButtonText;
    loadMoreComments.disabled = false;

    if (!response.ok) {
      throw new Error(data.error || `Failed to fetch comments: ${response.status}`);
    }

    if (!data || !data.comments) {
      console.warn('No comment data or empty comments received:', data);
      // Don't clear existing comments if it was a continuation request
      if (!continuation) {
        commentsList.innerHTML = '<div class="text-center py-4 text-gray-500">No comments yet.</div>';
      }
      loadMoreComments.style.display = 'none'; // Hide button if no more comments
      commentsNextPage = null;
      return; // Exit function, not an error technically
    }

    if (!continuation) {
      commentsList.innerHTML = ''; // Clear only on first load
    }

    data.comments.forEach(comment => {
      const commentElement = createCommentElement(comment);
      commentsList.appendChild(commentElement);
    });

    commentsNextPage = data.continuation;
    loadMoreComments.style.display = data.continuation ? 'block' : 'none';

    // Removed SponsorBlock call here, not relevant to comments

  } catch (error) {
    console.error('Failed to load comments:', error);
    // Append error message instead of replacing content if it's a continuation
    if (!continuation) {
      commentsList.innerHTML = `<div class="text-center py-4 text-red-500">Failed to load comments: ${error.message}</div>`;
    } else {
      // Optionally show error near the button or log it
      showError(`Failed to load more comments: ${error.message}`);
    }
    loadMoreComments.style.display = 'none'; // Hide button on error
    // Restore button state on error
    if (loadMoreComments.disabled) {
      loadMoreComments.textContent = 'Load More Comments';
      loadMoreComments.disabled = false;
    }
  }
}

function createCommentElement(comment) {
  const div = document.createElement('div');
  div.className = 'comment-item flex space-x-3 py-2'; // Added padding

  const avatar = comment.author?.thumbnails?.[0]?.url || '/img/default-avatar.svg'; // Default avatar
  const authorName = comment.author?.name || 'Unknown';
  const authorId = comment.author?.id;

  // Handle rich text content safely
  let contentHTML = '';
  if (typeof comment.content === 'string') {
    contentHTML = comment.content.replace(/\n/g, '<br>'); // Basic newline handling
  } else if (Array.isArray(comment.content)) {
    // Attempt to handle simple rich text (links)
    contentHTML = comment.content.map(segment => {
      if (typeof segment === 'string') {
        return segment.replace(/\n/g, '<br>');
      } else if (segment.url) {
        return `<a href="${segment.url}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${segment.text.replace(/\n/g, '<br>')}</a>`;
      } else {
        return (segment.text || '').replace(/\n/g, '<br>');
      }
    }).join('');
  } else if (typeof comment.content === 'object' && comment.content?.text) {
    contentHTML = comment.content.text.replace(/\n/g, '<br>');
  } else {
    contentHTML = '';
  }

  const publishedTime = comment.published || '';
  const likeCount = comment.like_count || '0'; // Default to '0'

  // Author link or span
  const authorLink = authorId
    ? `<a href="/channel/${authorId}" class="font-medium text-zinc-100 hover:text-green-500 mr-2">${authorName}</a>`
    : `<span class="font-medium text-zinc-100 mr-2">${authorName}</span>`;

  div.innerHTML = `
    <img src="${avatar}" alt="${authorName} avatar" class="w-10 h-10 rounded-full flex-shrink-0" loading="lazy">
    <div class="flex-1 min-w-0">
      <div class="flex items-center mb-1 flex-wrap">
        ${authorLink}
        <span class="text-zinc-400 text-sm whitespace-nowrap">${publishedTime}</span>
      </div>
      <p class="text-zinc-200 text-sm break-words">${contentHTML}</p>
      <div class="flex items-center mt-2 text-zinc-400 text-sm space-x-4">
        <button class="flex items-center hover:text-zinc-300">
          <i class="far fa-thumbs-up mr-1"></i>
          <span>${likeCount}</span>
        </button>
         <button class="flex items-center hover:text-zinc-300">
          <i class="far fa-thumbs-down mr-1"></i>
        </button>
        <button class="hover:text-zinc-300 text-xs font-semibold">REPLY</button>
      </div>
    </div>
  `;

  return div;
}

function setupLoadMoreCommentsListener() {
  const loadMoreCommentsBtn = document.getElementById('loadMoreComments');
  const commentsListEl = document.getElementById('commentsList');
  if (loadMoreCommentsBtn && commentsListEl) {
    // Remove potential old listener before adding
    loadMoreCommentsBtn.replaceWith(loadMoreCommentsBtn.cloneNode(true));
    // Get the new button reference
    const newLoadMoreBtn = document.getElementById('loadMoreComments');
    if (newLoadMoreBtn) {
      newLoadMoreBtn.addEventListener('click', () => {
        if (currentVideoId && commentsNextPage) {
          loadComments(currentVideoId, commentsNextPage, commentsListEl, newLoadMoreBtn);
        }
      });
    }
  }
}

// App-level function to handle closing the player
function closeVideoPlayer() {
  console.log("app.js: closeVideoPlayer called");
  Player.destroyPlayer(); // Call the player module's destroy function

  // Clear app-specific state related to the video
  currentVideoId = null;
  commentsNextPage = null;

  // Clear UI elements managed by app.js
  const commentsList = document.getElementById('commentsList');
  if (commentsList) commentsList.innerHTML = '';
  const loadMoreComments = document.getElementById('loadMoreComments');
  if (loadMoreComments) loadMoreComments.style.display = 'none';

  // Clear recommended videos using the module function
  Recommended.clearRecommendedVideos();

  // SponsorBlock state is cleared within Player.destroyPlayer now

  // Video info fields will be overwritten when the next video loads.
  // Optionally clear them explicitly if desired:
  // document.getElementById('videoTitle').textContent = '';
  // document.getElementById('channelName').textContent = '';
  // etc.
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
    console.log('app.js: Setting up IPC listener for video load requests.');
    window.electronAPI.onVideoLoadRequest((videoId) => {
      console.log(`app.js: IPC Listener CALLBACK triggered with videoId: ${videoId}`);
      if (videoId && typeof videoId === 'string') {
        console.log(`app.js: Calling window.loadAndDisplayVideo via IPC with ID: ${videoId}`);
        try {
          // Call the global function, passing null for the element
          window.loadAndDisplayVideo(videoId, null);
          console.log(`app.js: Successfully called window.loadAndDisplayVideo for ID: ${videoId} via IPC`);
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

  console.log('DOM Loaded. app.js initialized.');
  console.log('Checking window.loadAndDisplayVideo on DOMContentLoaded:', typeof window.loadAndDisplayVideo);
});