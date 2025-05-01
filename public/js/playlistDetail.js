import { showError, showLoading, hideLoading } from './utils.js';

// DOM Elements
const loadingIndicator = document.getElementById('loadingIndicator');
const errorDisplay = document.getElementById('errorDisplay');
const playlistDetailContainer = document.getElementById('playlistDetailContainer');
const playlistNameEl = document.getElementById('playlistName');
const playlistDescriptionEl = document.getElementById('playlistDescription');
const videoCountEl = document.getElementById('videoCount');
const playlistVideoList = document.getElementById('playlistVideoList');
const sortOptions = document.getElementById('sortOptions');
const playlistIdInput = document.getElementById('playlistId'); // Hidden input

// State
let playlistId = null;
let originalVideoData = []; // Store the original fetched video data
let currentVideoData = []; // Store the currently displayed/sorted video data

// --- Helper Functions ---

function showDetailLoading() {
  loadingIndicator.classList.remove('hidden');
  playlistDetailContainer.classList.add('hidden');
  errorDisplay.classList.add('hidden');
}

function hideDetailLoading() {
  loadingIndicator.classList.add('hidden');
}

function showDetailError(message) {
  errorDisplay.textContent = message;
  errorDisplay.classList.remove('hidden');
  playlistDetailContainer.classList.add('hidden'); // Hide details on error
}

// === Helper to Update Watch Indicator State (Copied from app.js) ===
function updateWatchIndicator(cardElement) {
  const videoId = cardElement.dataset.videoId;
  const thumbnailDiv = cardElement.querySelector('.video-thumbnail');

  if (!thumbnailDiv || !videoId) return;

  // Remove existing indicators first
  thumbnailDiv.querySelector('.watched-overlay')?.remove();
  thumbnailDiv.querySelector('.watched-progress-bar')?.remove();

  // Ensure watchHistoryProgress exists on window
  if (window.watchHistoryProgress && window.watchHistoryProgress.has(videoId)) {
    const historyData = window.watchHistoryProgress.get(videoId);
    const watchedSeconds = historyData.watchedSeconds || 0;
    // Get duration from the card dataset if available, otherwise from history data
    const durationSeconds = parseFloat(cardElement.dataset.durationSeconds) || historyData.durationSeconds || 0;

    if (durationSeconds > 0 && watchedSeconds > 0) {
      // Add Overlay
      const overlay = document.createElement('div');
      overlay.className = 'watched-overlay';
      thumbnailDiv.appendChild(overlay);

      // Add Progress Bar
      const progressBarContainer = document.createElement('div');
      progressBarContainer.className = 'watched-progress-bar';
      const progressBarInner = document.createElement('div');
      progressBarInner.className = 'watched-progress-bar-inner';

      // Calculate progress, ensuring it's between 0 and 100
      let progressPercent = (watchedSeconds / durationSeconds) * 100;
      progressPercent = Math.min(100, Math.max(0, progressPercent));
      // Consider a video fully watched if > 95% watched
      if (progressPercent > 95) progressPercent = 100;

      progressBarInner.style.width = `${progressPercent}%`;

      progressBarContainer.appendChild(progressBarInner);
      thumbnailDiv.appendChild(progressBarContainer);
    }
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

// --- Core Logic ---

async function loadPlaylistDetails() {
  if (!playlistIdInput || !playlistIdInput.value) {
    showDetailError('Error: Playlist ID not found.');
    console.error('Playlist ID input element not found or has no value.');
    return;
  }
  playlistId = playlistIdInput.value;

  showDetailLoading();

  try {
    const response = await fetch(`/api/playlists/${playlistId}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Playlist not found.');
      }
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to load playlist details: ${response.status}`);
    }
    const playlistData = await response.json();

    // Update header info
    playlistNameEl.textContent = playlistData.name || 'Unnamed Playlist';
    document.title = `ZTube - ${playlistData.name || 'Playlist'}`; // Update page title
    playlistDescriptionEl.textContent = playlistData.description || 'No description.';

    // Store and display videos
    originalVideoData = playlistData.videos || [];
    sortAndDisplayVideos(); // Initial display using default sort

    playlistDetailContainer.classList.remove('hidden');

  } catch (error) {
    console.error('Error loading playlist details:', error);
    showDetailError(`Error: ${error.message}`);
  } finally {
    hideDetailLoading();
  }
}

function sortAndDisplayVideos() {
  const sortBy = sortOptions.value;
  currentVideoData = [...originalVideoData]; // Work with a copy

  switch (sortBy) {
    case 'added_desc':
      currentVideoData.sort((a, b) => b.added_at - a.added_at);
      break;
    case 'added_asc':
      currentVideoData.sort((a, b) => a.added_at - b.added_at);
      break;
    case 'title_asc':
      currentVideoData.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      break;
    case 'title_desc':
      currentVideoData.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
      break;
    case 'channel_asc':
      currentVideoData.sort((a, b) => (a.channel_name || '').localeCompare(b.channel_name || ''));
      break;
    case 'channel_desc':
      currentVideoData.sort((a, b) => (b.channel_name || '').localeCompare(a.channel_name || ''));
      break;
    case 'default':
    default:
      // Use the order fetched from the API (based on sort_order, then added_at)
      currentVideoData = [...originalVideoData];
      break;
  }

  displayVideos(currentVideoData);
}

function displayVideos(videos) {
  playlistVideoList.innerHTML = ''; // Clear current list
  videoCountEl.textContent = `${videos.length} video${videos.length !== 1 ? 's' : ''}`;

  if (videos.length === 0) {
    playlistVideoList.innerHTML = '<p class="col-span-full text-center text-zinc-400">This playlist is empty.</p>';
    return;
  }

  videos.forEach((video, index) => {
    const card = createPlaylistVideoCard(video, index);
    playlistVideoList.appendChild(card);
  });

  // Trigger UI update after displaying videos
  document.dispatchEvent(new Event('uiNeedsPlaylistWatchUpdate'));
}

function createPlaylistVideoCard(video, index) {
  const card = document.createElement('div');
  card.className = 'video-card bg-zinc-800 rounded-lg shadow-md overflow-hidden relative group'; // Add group for remove button hover
  card.dataset.videoId = video.video_id;
  // Add duration seconds if available in the video object (needs API update)
  // Assuming playlist endpoint now returns duration_seconds
  card.dataset.durationSeconds = video.duration_seconds || 0;

  const thumbnail = video.thumbnail_url || '/img/default-video.png';
  // Duration text (optional, if API provides it)
  const channelNameText = video.channel_name || 'Unknown Channel';
  // We don't have channel ID here, so link is omitted for simplicity
  // const channelId = video.channel?.id;
  const addedDate = video.added_at ? new Date(video.added_at * 1000).toLocaleDateString() : 'Unknown date';

  card.innerHTML = `
        <div class="video-thumbnail relative cursor-pointer" onclick="window.loadAndDisplayVideo('${video.video_id}', this.closest('.video-card'))">
            <img src="${thumbnail}" alt="${escapeHtml(video.title) || 'Video thumbnail'}" loading="lazy" class="w-full h-full object-cover aspect-video">
            <!-- ${duration ? `<span class="video-duration absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1.5 py-0.5 rounded">${duration}</span>` : ''} -->
        </div>
        <div class="p-3">
            <h3 class="font-semibold text-zinc-100 line-clamp-2 mb-1 text-sm h-10 cursor-pointer hover:text-green-400" title="${escapeHtml(video.title)}" onclick="window.loadAndDisplayVideo('${video.video_id}', this.closest('.video-card'))">${escapeHtml(video.title) || 'Untitled'}</h3>
             <div class="flex items-center mt-1">
                <!-- No avatar available from playlist table -->
                <div class="flex-1 min-w-0">
                    <div class="flex items-center text-zinc-300 text-xs">
                       <span class="truncate" title="${escapeHtml(channelNameText)}">${escapeHtml(channelNameText)}</span>
                    </div>
                    <div class="video-meta text-zinc-400 text-xs mt-0.5 flex flex-wrap gap-x-2">
                        <span>Added: ${addedDate}</span>
                    </div>
                </div>
            </div>
        </div>
        <button class="remove-video-btn absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-150" title="Remove from Playlist">
            <i class="fas fa-times"></i>
        </button>
    `;

  // Apply watch indicator immediately if history is already loaded
  if (window.watchHistoryLoaded) {
    updateWatchIndicator(card);
  }

  // Add hover effect to show remove button
  card.addEventListener('mouseenter', () => card.classList.add('group'));
  card.addEventListener('mouseleave', () => card.classList.remove('group'));

  // Add listener for the remove button
  const removeBtn = card.querySelector('.remove-video-btn');
  removeBtn.addEventListener('click', async (e) => {
    e.stopPropagation(); // Prevent card click (playing video)
    if (confirm(`Are you sure you want to remove "${video.title || 'this video'}" from the playlist?`)) {
      await removeVideoFromPlaylist(video.video_id);
    }
  });

  return card;
}

async function removeVideoFromPlaylist(videoIdToRemove) {
  showDetailLoading(); // Use main loading indicator

  try {
    const response = await fetch(`/api/playlists/${playlistId}/videos/${videoIdToRemove}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to remove video: ${response.status}`);
    }

    console.log(`Video ${videoIdToRemove} removed from playlist ${playlistId}`);

    // Remove video from local state and re-render
    originalVideoData = originalVideoData.filter(v => v.video_id !== videoIdToRemove);
    sortAndDisplayVideos(); // Re-sort and display the updated list
    playlistDetailContainer.classList.remove('hidden'); // Ensure container is visible

  } catch (error) {
    console.error('Error removing video from playlist:', error);
    showDetailError(`Error removing video: ${error.message}`);
    // Keep the detail container hidden if it was already hidden by error
    if (!playlistDetailContainer.classList.contains('hidden')) {
      playlistDetailContainer.classList.remove('hidden');
    }
  } finally {
    hideDetailLoading();
  }
}

// --- Helper to update all playlist cards ---
function updateAllPlaylistWatchIndicators() {
  const container = document.getElementById('playlistVideoList');
  if (!container) return;
  const cards = container.querySelectorAll('.video-card');
  console.log(`[PlaylistDetail] Found ${cards.length} cards to update watch status.`);
  cards.forEach(card => {
    if (card.dataset.videoId) {
      updateWatchIndicator(card);
    }
  });
}

// --- Initial Load & Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  loadPlaylistDetails();

  if (sortOptions) {
    sortOptions.addEventListener('change', sortAndDisplayVideos);
  }

  // Listen for watch history loaded event
  document.addEventListener('watchHistoryLoaded', () => {
    console.log("[PlaylistDetail] Received watchHistoryLoaded event. Updating watch indicators.");
    updateAllPlaylistWatchIndicators();
  });

  // Listen for event to update indicators after display
  document.addEventListener('uiNeedsPlaylistWatchUpdate', () => {
    if (window.watchHistoryLoaded) {
      updateAllPlaylistWatchIndicators();
    }
  });
});