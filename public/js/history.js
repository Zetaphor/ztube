import { showError, showLoading, hideLoading } from './utils.js';

const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const sortSelect = document.getElementById('sortSelect');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const loadMoreContainer = document.getElementById('loadMoreContainer');
const errorDisplay = document.getElementById('errorDisplay');



let currentPage = 1;
const itemsPerPage = 20;
let allHistory = [];
let filteredHistory = [];

// Function to fetch and display watch history
async function loadHistory(reset = false) {
  if (reset) {
    currentPage = 1;
    allHistory = [];
    historyList.innerHTML = '';
  }

  showLoading();
  errorDisplay.classList.add('hidden');

  try {
    const response = await fetch(`/api/watch-history?page=${currentPage}&limit=${itemsPerPage}&sort=${sortSelect.value}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to load history: ${response.status}`);
    }

    const data = await response.json();
    const newHistory = data.history || [];

    if (reset) {
      allHistory = newHistory;
    } else {
      allHistory = [...allHistory, ...newHistory];
    }

    displayHistory(newHistory, reset);

    // Handle load more button visibility
    if (newHistory.length < itemsPerPage) {
      loadMoreContainer.classList.add('hidden');
    } else {
      loadMoreContainer.classList.remove('hidden');
    }

  } catch (error) {
    console.error('Error loading history:', error);
    showError(`Error loading history: ${error.message}`, errorDisplay);
  } finally {
    hideLoading();
  }
}

// Function to display history entries in the UI
function displayHistory(historyEntries, reset = false) {
  if (reset) {
    historyList.innerHTML = '';
  }

  if (!historyEntries || historyEntries.length === 0) {
    if (reset) {
      historyList.innerHTML = '<p class="text-center text-zinc-400 py-8">No watch history found.</p>';
    }
    return;
  }

  historyEntries.forEach(entry => {
    const historyItem = document.createElement('div');
    historyItem.className = 'bg-zinc-800 rounded-lg shadow p-4 flex items-start space-x-4 hover:bg-zinc-700/50 transition-colors duration-150';

    // Calculate progress percentage
    const progressPercent = entry.duration_seconds && entry.watched_seconds
      ? Math.min((entry.watched_seconds / entry.duration_seconds) * 100, 100)
      : 0;

    // Format duration and watched time
    const totalDuration = formatDuration(entry.duration_seconds);
    const watchedDuration = formatDuration(entry.watched_seconds);
    const watchedDate = formatDate(entry.watched_at);

    historyItem.innerHTML = `
      <div class="flex-shrink-0">
        <div class="relative">
          <img src="${escapeHtml(entry.thumbnail_url || '/img/default-video.png')}"
               alt="${escapeHtml(entry.title)}"
               class="w-32 h-18 object-cover rounded cursor-pointer"
               onclick="playVideo('${escapeHtml(entry.video_id)}', ${entry.watched_seconds || 0})">
          ${progressPercent > 5 ? `
            <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 h-1">
              <div class="bg-red-600 h-full" style="width: ${progressPercent}%"></div>
            </div>
          ` : ''}
          ${totalDuration ? `
            <div class="absolute bottom-1 right-1 bg-black bg-opacity-80 text-white text-xs px-1 rounded">
              ${totalDuration}
            </div>
          ` : ''}
        </div>
      </div>

      <div class="flex-grow min-w-0">
        <h3 class="font-semibold text-lg mb-1 text-zinc-100 cursor-pointer hover:text-green-400 transition-colors"
            onclick="playVideo('${escapeHtml(entry.video_id)}', ${entry.watched_seconds || 0})"
            title="${escapeHtml(entry.title)}">
          ${escapeHtml(entry.title)}
        </h3>

        <p class="text-sm text-zinc-400 mb-1">${escapeHtml(entry.channel_name || 'Unknown Channel')}</p>

        <div class="flex items-center text-xs text-zinc-500 space-x-4">
          <span><i class="fas fa-clock mr-1"></i>Watched ${watchedDate}</span>
          ${entry.watched_seconds && entry.duration_seconds ? `
            <span><i class="fas fa-play mr-1"></i>Watched ${watchedDuration} of ${totalDuration}</span>
          ` : ''}
        </div>
      </div>

      <div class="flex-shrink-0 flex items-start space-x-2">
        <button class="text-zinc-400 hover:text-green-500 text-sm"
                onclick="resumeVideo('${escapeHtml(entry.video_id)}', ${entry.watched_seconds || 0})"
                title="Resume watching">
          <i class="fas fa-play"></i>
        </button>
        ${entry.channel_id ? `<button class="text-zinc-400 hover:text-red-500 text-sm"
                onclick="blockChannelFromHistory('${entry.channel_id}', '${escapeHtml(entry.channel_name || 'Unknown Channel')}')"
                title="Block channel">
          <i class="fas fa-ban"></i>
        </button>` : ''}
        <button class="text-zinc-400 hover:text-red-500 text-sm"
                onclick="removeHistoryEntry('${entry.id}')"
                title="Remove from history">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    historyList.appendChild(historyItem);
  });
}

// Function to play a video (integrate with existing video player)
function playVideo(videoId, startTime = 0) {
  // Use the global loadAndDisplayVideo function to play the video in the current page
  if (typeof window.loadAndDisplayVideo === 'function') {
    window.loadAndDisplayVideo(videoId, null, false);
  } else {
    console.error('loadAndDisplayVideo function not available');
  }
}

// Function to resume a video from where it was left off
function resumeVideo(videoId, startTime = 0) {
  playVideo(videoId, startTime);
}

// Function to remove a single history entry
async function removeHistoryEntry(entryId) {
  if (!confirm('Remove this video from your watch history?')) {
    return;
  }

  try {
    const response = await fetch(`/api/watch-history/${entryId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to remove history entry: ${response.status}`);
    }

    // Reload the current page of history
    await loadHistory(true);

  } catch (error) {
    console.error('Error removing history entry:', error);
    showError(`Error removing history entry: ${error.message}`, errorDisplay);
  }
}

// Function to clear all history
async function clearAllHistory() {
  if (!confirm('Are you sure you want to clear your entire watch history? This cannot be undone.')) {
    return;
  }

  showLoading();
  errorDisplay.classList.add('hidden');

  try {
    const response = await fetch('/api/watch-history/clear', {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to clear history: ${response.status}`);
    }

    // Clear the display
    historyList.innerHTML = '<p class="text-center text-zinc-400 py-8">No watch history found.</p>';
    loadMoreContainer.classList.add('hidden');
    allHistory = [];

  } catch (error) {
    console.error('Error clearing history:', error);
    showError(`Error clearing history: ${error.message}`, errorDisplay);
  } finally {
    hideLoading();
  }
}

// Function to format duration in seconds to HH:MM:SS or MM:SS
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

// Function to format date
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// Simple HTML escaping function
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Make functions globally accessible for onclick handlers
window.playVideo = playVideo;
window.resumeVideo = resumeVideo;
window.removeHistoryEntry = removeHistoryEntry;

// Function to block a channel from history
async function blockChannelFromHistory(channelId, channelName) {
  try {
    const response = await fetch('/api/hidden/channels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channelId: channelId,
        name: channelName
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    showSuccessMessage(`"${channelName}" has been blocked`);

    // Reload history to remove blocked channel's videos
    loadHistory(true);

  } catch (error) {
    console.error('Error blocking channel:', error);
    showErrorMessage(`Failed to block "${channelName}"`);
  }
}

window.blockChannelFromHistory = blockChannelFromHistory;



// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  loadHistory(true);


  clearHistoryBtn.addEventListener('click', clearAllHistory);

  sortSelect.addEventListener('change', () => {
    loadHistory(true);
  });

  loadMoreBtn.addEventListener('click', () => {
    currentPage++;
    loadHistory(false);
  });
});