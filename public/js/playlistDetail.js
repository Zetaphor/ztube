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
}

function createPlaylistVideoCard(video, index) {
  const card = document.createElement('div');
  card.className = 'video-card bg-zinc-800 rounded-lg shadow-md overflow-hidden relative'; // Add relative for button positioning
  card.dataset.videoId = video.video_id;

  const thumbnail = video.thumbnail_url || '/img/default-video.png';
  // We don't have duration from the playlist table, maybe fetch later or omit?
  // const duration = video.duration || '';
  const channelNameText = video.channel_name || 'Unknown Channel';
  // We don't have channel ID here, so link is omitted for simplicity
  // const channelId = video.channel?.id;
  const addedDate = video.added_at ? new Date(video.added_at * 1000).toLocaleDateString() : 'Unknown date';

  card.innerHTML = `
        <div class="video-thumbnail relative cursor-pointer" onclick="window.loadAndDisplayVideo('${video.video_id}', this.closest('.video-card'))">
            <img src="${thumbnail}" alt="${escapeHtml(video.title) || 'Video thumbnail'}" loading="lazy" class="w-full h-full object-cover aspect-video">
            <!-- ${duration ? `<span class="video-duration absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1.5 py-0.5 rounded">${duration}</span>` : ''} -->
             <!-- Watch History Overlay -->
            <div class="watch-history-overlay absolute inset-0 bg-black/60 hidden group-hover:opacity-0 transition-opacity duration-200"></div>
            <!-- Watch History Progress Bar -->
            <div class="watch-history-progress absolute bottom-0 left-0 right-0 h-1 bg-red-600 hidden">
                <div class="watch-history-progress-bar h-full bg-red-700"></div>
            </div>
            <!-- Thumbnail Hover Icons -->
            <div class="thumbnail-icons absolute top-1 right-1 flex flex-row gap-1.5 z-10">
                <button class="remove-history-btn thumbnail-icon-btn hidden" title="Remove from History">
                    <i class="fas fa-trash-alt"></i>
                </button>
                <!-- Add other icons like playlist/bookmark if needed later -->
            </div>
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

// --- Initial Load & Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  loadPlaylistDetails();

  if (sortOptions) {
    sortOptions.addEventListener('change', sortAndDisplayVideos);
  }
});