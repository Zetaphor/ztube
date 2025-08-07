import { showError, showLoading, hideLoading } from './utils.js';

// DOM Elements
const shortsContent = document.getElementById('shortsContent');
const trendingShortsBtn = document.getElementById('trendingShortsBtn');
const subscriptionShortsBtn = document.getElementById('subscriptionShortsBtn');
const shortsLoadingIndicator = document.getElementById('shortsLoadingIndicator');
const shortsErrorMessage = document.getElementById('shortsErrorMessage');
const shortsEmptyState = document.getElementById('shortsEmptyState');

// State
let currentShortsType = 'trending'; // 'trending' or 'subscriptions'
let isLoading = false;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadTrendingShorts(); // Load trending Shorts by default
});

function setupEventListeners() {
  trendingShortsBtn.addEventListener('click', () => {
    if (currentShortsType !== 'trending' && !isLoading) {
      switchToTrending();
    }
  });

  subscriptionShortsBtn.addEventListener('click', () => {
    if (currentShortsType !== 'subscriptions' && !isLoading) {
      switchToSubscriptions();
    }
  });
}

function switchToTrending() {
  currentShortsType = 'trending';
  updateActiveButton();
  clearContent();
  loadTrendingShorts();
}

function switchToSubscriptions() {
  currentShortsType = 'subscriptions';
  updateActiveButton();
  clearContent();
  loadSubscriptionShorts();
}

function updateActiveButton() {
  // Reset button styles
  trendingShortsBtn.className = 'px-4 py-2 bg-zinc-700 text-zinc-200 rounded-lg hover:bg-zinc-600 transition-colors';
  subscriptionShortsBtn.className = 'px-4 py-2 bg-zinc-700 text-zinc-200 rounded-lg hover:bg-zinc-600 transition-colors';

  // Set active button
  if (currentShortsType === 'trending') {
    trendingShortsBtn.className = 'px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors';
  } else {
    subscriptionShortsBtn.className = 'px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors';
  }
}

function clearContent() {
  shortsContent.innerHTML = '';
  hideAllStates();
}

function hideAllStates() {
  shortsLoadingIndicator.classList.add('hidden');
  shortsErrorMessage.classList.add('hidden');
  shortsEmptyState.classList.add('hidden');
}

function showLoadingState() {
  hideAllStates();
  shortsLoadingIndicator.classList.remove('hidden');
  isLoading = true;
}

function hideLoadingState() {
  shortsLoadingIndicator.classList.add('hidden');
  isLoading = false;
}

function showErrorState() {
  hideAllStates();
  shortsErrorMessage.classList.remove('hidden');
}

function showEmptyState() {
  hideAllStates();
  shortsEmptyState.classList.remove('hidden');
}

async function loadTrendingShorts() {
  showLoadingState();

  try {
    const response = await fetch('/api/shorts/trending');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const shorts = await response.json();
    hideLoadingState();

    if (shorts.length === 0) {
      showEmptyState();
    } else {
      displayShorts(shorts);
    }
  } catch (error) {
    console.error('Error loading trending Shorts:', error);
    hideLoadingState();
    showErrorState();
  }
}

async function loadSubscriptionShorts() {
  showLoadingState();

  try {
    const response = await fetch('/api/shorts/subscriptions');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const shorts = await response.json();
    hideLoadingState();

    if (shorts.length === 0) {
      showEmptyState();
    } else {
      displayShorts(shorts);
    }
  } catch (error) {
    console.error('Error loading subscription Shorts:', error);
    hideLoadingState();
    showErrorState();
  }
}

function displayShorts(shorts) {
  shortsContent.innerHTML = '';

  shorts.forEach(short => {
    const shortCard = createShortCard(short);
    shortsContent.appendChild(shortCard);
  });

  // Process cards for watch history if the function exists
  if (typeof window.processCardsForWatchHistory === 'function') {
    const allCards = Array.from(shortsContent.children);
    window.processCardsForWatchHistory(allCards);
  }
}

function createShortCard(short) {
  const card = document.createElement('div');
  card.className = 'short-card group bg-zinc-800 rounded-lg shadow-md overflow-hidden cursor-pointer transition-transform duration-200 hover:scale-105 relative';

  const thumbnail = short.thumbnails?.[0]?.url || '/img/default-video.png';
  const shortTitle = short.title || 'Untitled Short';
  const channelNameText = short.channel?.name || 'Unknown';
  const views = short.viewCount || '';
  const channelId = short.channel?.id;

  // Set up data attributes for consistency with video cards
  card.dataset.videoId = short.id;
  card.dataset.videoTitle = shortTitle;
  card.dataset.channelName = channelNameText;
  card.dataset.thumbnailUrl = thumbnail;
  card.dataset.channelId = channelId;

  // Click handler to play the Short
  card.onclick = () => {
    if (typeof window.loadAndDisplayVideo === 'function') {
      window.loadAndDisplayVideo(short.id, card);
    }
  };

  const verifiedBadge = short.channel?.verified ?
    '<i class="fas fa-check-circle text-green-500 ml-1 text-xs" title="Verified Channel"></i>' :
    '';

  const channelLinkContent = channelId ?
    `<a href="/channel/${channelId}" class="hover:text-green-500 text-xs truncate" onclick="event.stopPropagation();">${channelNameText}${verifiedBadge}</a>` :
    `<span class="text-xs truncate">${channelNameText}${verifiedBadge}</span>`;

  const channelAvatarUrl = short.channel?.avatar?.[0]?.url || '/img/default-avatar.svg';

  card.innerHTML = `
    <div class="short-thumbnail relative">
      <img src="${thumbnail}" alt="${shortTitle} thumbnail" loading="lazy" class="w-full h-48 object-cover">
      <!-- Shorts indicator -->
      <div class="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded flex items-center">
        <i class="fas fa-play mr-1"></i>
        <span>Short</span>
      </div>
      <!-- Thumbnail Hover Icons -->
      <div class="thumbnail-icons absolute top-2 right-2 flex flex-col gap-1 z-10">
        <button class="add-to-playlist-hover-btn thumbnail-icon-btn" title="Add to Playlist">
          <i class="fas fa-plus"></i>
        </button>
        <button class="bookmark-btn thumbnail-icon-btn" title="Add to Watch Later">
          <i class="far fa-bookmark"></i>
        </button>
        <div class="relative">
          <button class="thumbnail-icon-btn more-options-btn" title="More options" onclick="event.stopPropagation(); this.nextElementSibling.classList.toggle('hidden');">
            <i class="fas fa-ellipsis-v"></i>
          </button>
          <div class="absolute right-full top-0 mr-1 bg-zinc-800 rounded-lg shadow-lg border border-zinc-700 hidden min-w-40 z-20 whitespace-nowrap">
            <button class="copy-link-btn w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 rounded-t-lg flex items-center" onclick="event.stopPropagation(); window.copyVideoLink('${short.id}'); this.closest('.absolute').classList.add('hidden');">
              <i class="fas fa-link mr-2"></i>Copy Link
            </button>
            ${channelId ? `<button class="block-channel-btn w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-zinc-700 rounded-b-lg flex items-center" onclick="event.stopPropagation(); window.blockChannelFromVideo('${channelId}', '${channelNameText.replace(/'/g, "\\'")}'); this.closest('.absolute').classList.add('hidden');">
              <i class="fas fa-ban mr-2"></i>Block Channel
            </button>` : ''}
          </div>
        </div>
      </div>
    </div>
    <div class="p-2">
      <h3 class="font-semibold text-zinc-100 text-sm line-clamp-2 mb-1 h-8" title="${shortTitle.replace(/"/g, '&quot;')}">${shortTitle}</h3>
      <div class="flex items-start text-xs text-zinc-400">
        <img src="${channelAvatarUrl}" alt="${channelNameText}" class="w-4 h-4 rounded-full mr-1 flex-shrink-0">
        <div class="flex flex-col">
          ${channelLinkContent}
          ${views ? `<span class="text-xs">${views}</span>` : ''}
        </div>
      </div>
    </div>
  `;

  return card;
}

// Global function for search functionality (if needed)
window.searchShorts = async function (query) {
  if (!query.trim()) return;

  showLoadingState();

  try {
    const response = await fetch(`/api/shorts/search?query=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const shorts = await response.json();
    hideLoadingState();

    if (shorts.length === 0) {
      showEmptyState();
    } else {
      displayShorts(shorts);
    }
  } catch (error) {
    console.error('Error searching Shorts:', error);
    hideLoadingState();
    showErrorState();
  }
};

// Update bookmark icon states (reuse existing functionality)
function updateBookmarkIconState(cardElement) {
  const bookmarkBtn = cardElement.querySelector('.bookmark-btn');
  const bookmarkIcon = bookmarkBtn?.querySelector('i');
  const videoId = cardElement.dataset.videoId;

  if (bookmarkBtn && bookmarkIcon && videoId && typeof window.isVideoInDefaultPlaylist === 'function') {
    try {
      if (window.isVideoInDefaultPlaylist(videoId)) {
        bookmarkIcon.className = 'fas fa-bookmark';
        bookmarkBtn.title = "Remove from Watch Later";
        bookmarkBtn.classList.add('visible');
      } else {
        bookmarkIcon.className = 'far fa-bookmark';
        bookmarkBtn.title = "Add to Watch Later";
        bookmarkBtn.classList.remove('visible');
      }
    } catch (error) {
      console.error(`Error updating bookmark state for ${videoId} in shorts.js:`, error);
      bookmarkIcon.className = 'far fa-bookmark';
      bookmarkBtn.title = "Add to Watch Later";
      bookmarkBtn.classList.remove('visible');
    }
  }
}