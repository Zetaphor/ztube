/**
 * Handles the "Add to Playlist" functionality including modal display and API calls.
 */
import { showError, showLoading, hideLoading } from './utils.js';

// --- Modal Elements ---
let modalElement = null;
let modalContentElement = null;
let currentVideoDetails = null; // Store details of the video being added

// --- Default Playlist State ---
let defaultPlaylistId = null;
let defaultPlaylistVideoIds = new Set();
let defaultPlaylistInfoLoaded = false;
let defaultPlaylistLoadPromise = null;

// --- Expose flag globally ---
window.defaultPlaylistInfoLoaded = false;

// --- Create Modal Structure (once) ---
function ensureModalExists() {
  if (modalElement) return; // Already created

  modalElement = document.createElement('div');
  modalElement.id = 'addToPlaylistModal';
  modalElement.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 hidden'; // Initially hidden
  modalElement.innerHTML = `
        <div class="bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-md relative">
            <button id="closeAddToPlaylistModal" class="absolute top-2 right-3 text-zinc-400 hover:text-white text-xl">&times;</button>
            <h3 class="text-lg font-semibold text-zinc-100 mb-4">Add to Playlist</h3>
            <div id="addToPlaylistModalContent" class="space-y-3 max-h-60 overflow-y-auto mb-4 pr-2">
                <!-- Playlist options will be loaded here -->
                <p class="text-zinc-400">Loading playlists...</p>
            </div>
            <div class="border-t border-zinc-700 pt-4">
                <p class="text-zinc-200 mb-2 text-sm font-medium">Create New Playlist:</p>
                <div class="flex space-x-2">
                     <input type="text" id="modalNewPlaylistName" placeholder="Playlist Name" class="flex-grow px-3 py-1.5 rounded bg-zinc-700 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-green-500 text-sm">
                     <button id="modalCreateAndAddPlaylistBtn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-3 rounded transition duration-150 text-sm">
                        <i class="fas fa-plus mr-1"></i> Create & Add
                    </button>
                </div>
                <p id="modalErrorDisplay" class="text-red-500 text-xs mt-2"></p>
            </div>
        </div>
    `;
  document.body.appendChild(modalElement);

  modalContentElement = modalElement.querySelector('#addToPlaylistModalContent');

  // Add event listeners for modal controls
  modalElement.querySelector('#closeAddToPlaylistModal').addEventListener('click', closeModal);
  modalElement.querySelector('#modalCreateAndAddPlaylistBtn').addEventListener('click', handleCreateAndAddPlaylist);

  // Close modal if clicking outside the content area
  modalElement.addEventListener('click', (event) => {
    if (event.target === modalElement) {
      closeModal();
    }
  });
}

// --- Fetch Default Playlist Info ---
async function fetchAndStoreDefaultPlaylistInfo() {
  if (defaultPlaylistInfoLoaded) return; // Already loaded
  if (defaultPlaylistLoadPromise) return defaultPlaylistLoadPromise; // Loading in progress

  console.log("Attempting to fetch default playlist info...");

  defaultPlaylistLoadPromise = (async () => {
    try {
      // 1. Find the default playlist ID
      const playlistsResponse = await fetch('/api/playlists');
      if (!playlistsResponse.ok) throw new Error('Failed to fetch playlists');
      const playlists = await playlistsResponse.json();
      const defaultPlaylist = playlists.find(p => p.is_default);

      if (defaultPlaylist) {
        defaultPlaylistId = defaultPlaylist.id;
        console.log(`Default playlist ID found: ${defaultPlaylistId}`);

        // 2. Fetch the contents (videos) of the default playlist
        const detailsResponse = await fetch(`/api/playlists/${defaultPlaylistId}`);
        if (!detailsResponse.ok) throw new Error(`Failed to fetch details for playlist ${defaultPlaylistId}`);
        const playlistDetails = await detailsResponse.json();

        console.log(`Playlist details:`, playlistDetails.videos);

        defaultPlaylistVideoIds = new Set(playlistDetails.videos.map(v => v.video_id));
        console.log(`Loaded ${defaultPlaylistVideoIds.size} video IDs from default playlist.`);
        defaultPlaylistInfoLoaded = true;
        window.defaultPlaylistInfoLoaded = true; // Update global flag
        document.dispatchEvent(new CustomEvent('defaultPlaylistLoaded')); // Notify listeners
      } else {
        console.warn("No default playlist found.");
        // Keep defaultPlaylistId null and set as loaded
        defaultPlaylistInfoLoaded = true;
        window.defaultPlaylistInfoLoaded = true; // Update global flag
        document.dispatchEvent(new CustomEvent('defaultPlaylistLoaded')); // Notify listeners
      }
    } catch (error) {
      console.error("Error fetching default playlist info:", error);
      // Consider setting loaded to true even on error to prevent retries?
      // Or maybe allow retry on next modal open? For now, mark as loaded.
      defaultPlaylistInfoLoaded = true; // Prevent hammering API on errors
      window.defaultPlaylistInfoLoaded = true; // Update global flag
      document.dispatchEvent(new CustomEvent('defaultPlaylistLoaded')); // Notify listeners even on error
    } finally {
      defaultPlaylistLoadPromise = null; // Clear promise regardless of outcome
    }
  })();

  return defaultPlaylistLoadPromise;
}

// --- Public Functions for Default Playlist ---

/**
 * Checks if a video is currently in the stored default playlist list.
 * Ensure fetchAndStoreDefaultPlaylistInfo has resolved before relying on this heavily for UI state.
 * @param {string} videoId
 * @returns {boolean}
 */
function isVideoInDefaultPlaylist(videoId) {
  if (!defaultPlaylistInfoLoaded) {
    console.warn("isVideoInDefaultPlaylist called before default playlist info loaded.");
    return false; // Return false if not loaded yet
  }
  return defaultPlaylistId !== null && defaultPlaylistVideoIds.has(videoId);
}

/**
 * Adds or removes a video from the default playlist.
 * @param {object} videoData - Must contain videoId, videoTitle, channelName, thumbnailUrl
 * @returns {Promise<boolean>} - Resolves to true if the video is now IN the playlist, false otherwise.
 */
async function toggleVideoInDefaultPlaylist(videoData) {
  await fetchAndStoreDefaultPlaylistInfo(); // Ensure info is loaded

  if (defaultPlaylistId === null) {
    throw new Error("No default playlist is configured.");
  }

  const { videoId } = videoData;
  if (!videoId) { // Added check for videoId early
    console.error("toggleVideoInDefaultPlaylist called with invalid videoData:", videoData);
    throw new Error("Invalid video data provided for toggle.");
  }
  const currentlyInPlaylist = defaultPlaylistVideoIds.has(videoId);

  try {
    if (currentlyInPlaylist) {
      // --- Remove Video ---
      const removeResponse = await fetch(`/api/playlists/${defaultPlaylistId}/videos/${videoId}`, {
        method: 'DELETE',
      });
      if (!removeResponse.ok) {
        const errorData = await removeResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to remove video: ${removeResponse.status}`);
      }
      defaultPlaylistVideoIds.delete(videoId);
      console.log(`Video ${videoId} removed from default playlist ${defaultPlaylistId}`);
      return false; // Video is now NOT in the playlist
    } else {
      // --- Add Video ---
      await addVideoToApi(defaultPlaylistId, videoData); // Use existing helper
      defaultPlaylistVideoIds.add(videoId);
      console.log(`Video ${videoId} added to default playlist ${defaultPlaylistId}`);
      return true; // Video is now IN the playlist
    }
  } catch (error) {
    console.error(`Error toggling video ${videoId} in default playlist:`, error);
    // Re-throw the error to be handled by the caller (e.g., update UI state)
    throw error;
  }
}

// --- Modal Control ---
function openModal(videoDetails) {
  ensureModalExists();
  currentVideoDetails = videoDetails; // Store the video details for use in API calls
  if (!currentVideoDetails || !currentVideoDetails.videoId) {
    console.error("AddToPlaylist: Missing video details or videoId");
    showError("Cannot add video: Missing video details.");
    return;
  }

  // Clear previous state
  modalContentElement.innerHTML = '<p class="text-zinc-400">Loading playlists...</p>';
  const errorDisplay = modalElement.querySelector('#modalErrorDisplay');
  if (errorDisplay) errorDisplay.textContent = '';
  const nameInput = modalElement.querySelector('#modalNewPlaylistName');
  if (nameInput) nameInput.value = '';

  modalElement.classList.remove('hidden');
  loadPlaylistsIntoModal();
  fetchAndStoreDefaultPlaylistInfo(); // Ensure default info is fetched when modal opens
}

function closeModal() {
  if (modalElement) {
    modalElement.classList.add('hidden');
  }
  currentVideoDetails = null; // Clear stored video details
}

// --- Load Playlists into Modal ---
async function loadPlaylistsIntoModal() {
  if (!modalContentElement) return;

  try {
    const response = await fetch('/api/playlists');
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to load playlists: ${response.status}`);
    }
    const playlists = await response.json();

    modalContentElement.innerHTML = ''; // Clear loading message

    if (!playlists || playlists.length === 0) {
      modalContentElement.innerHTML = '<p class="text-zinc-400 text-sm">No playlists yet. Create one below.</p>';
    } else {
      playlists.forEach(playlist => {
        const playlistItem = document.createElement('button');
        playlistItem.className = 'w-full text-left px-3 py-2 rounded bg-zinc-700 hover:bg-green-700 text-zinc-100 text-sm transition-colors duration-150';
        playlistItem.textContent = playlist.name;
        playlistItem.dataset.playlistId = playlist.id;
        playlistItem.addEventListener('click', () => handlePlaylistSelection(playlist.id, playlist.name));
        modalContentElement.appendChild(playlistItem);
      });
    }

  } catch (error) {
    console.error('Error loading playlists into modal:', error);
    modalContentElement.innerHTML = `<p class="text-red-500 text-sm">Error loading playlists: ${error.message}</p>`;
  }
}

// --- Handle Playlist Selection & Creation ---
async function handlePlaylistSelection(playlistId, playlistName) {
  if (!currentVideoDetails || !currentVideoDetails.videoId) {
    console.error("Cannot add video: Missing video details.");
    closeModal();
    showError("Failed to add video: Missing information.");
    return;
  }

  showLoading(); // Use global loading indicator
  try {
    await addVideoToApi(playlistId, currentVideoDetails);
    console.log(`Video ${currentVideoDetails.videoId} added to playlist ${playlistId} (${playlistName})`);
    closeModal();
  } catch (error) {
    console.error(`Error adding video to playlist ${playlistId}:`, error);
    showError(`Failed to add video to "${playlistName}": ${error.message}`);
    // Keep modal open on error?
  } finally {
    hideLoading();
  }
}

async function handleCreateAndAddPlaylist() {
  const nameInput = modalElement.querySelector('#modalNewPlaylistName');
  const errorDisplay = modalElement.querySelector('#modalErrorDisplay');
  const createButton = modalElement.querySelector('#modalCreateAndAddPlaylistBtn');
  const newName = nameInput.value.trim();

  if (!newName) {
    errorDisplay.textContent = 'Playlist name cannot be empty.';
    return;
  }
  if (!currentVideoDetails || !currentVideoDetails.videoId) {
    errorDisplay.textContent = 'Error: No video selected.';
    console.error("Cannot create/add: Missing video details.");
    return;
  }

  errorDisplay.textContent = '';
  createButton.disabled = true;
  createButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Creating...';

  try {
    // 1. Create the new playlist
    const createResponse = await fetch('/api/playlists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newName, description: '' }), // No description field in modal for now
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      throw new Error(errorData.error || `Failed to create playlist: ${createResponse.status}`);
    }
    const newPlaylist = await createResponse.json();
    console.log('New playlist created:', newPlaylist);

    // 2. Add the current video to the newly created playlist
    await addVideoToApi(newPlaylist.id, currentVideoDetails);

    closeModal();

  } catch (error) {
    console.error('Error creating and adding playlist:', error);
    errorDisplay.textContent = `Error: ${error.message}`;
  } finally {
    createButton.disabled = false;
    createButton.innerHTML = '<i class="fas fa-plus mr-1"></i> Create & Add';
  }
}

// --- API Call Helper ---
async function addVideoToApi(playlistId, videoData) {
  // Ensure all required fields are present
  const { videoId, videoTitle, channelName, thumbnailUrl } = videoData;
  if (!videoId || !videoTitle || !channelName || !thumbnailUrl) {
    console.error('Missing data for addVideoToApi:', videoData);
    throw new Error('Incomplete video information provided.');
  }

  const response = await fetch(`/api/playlists/${playlistId}/videos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      videoId: videoId,
      title: videoTitle,
      channelName: channelName,
      thumbnailUrl: thumbnailUrl,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Failed to add video: ${response.status}`);
  }
  // No need to return JSON content for success usually
}

// --- Export Global Function --- (Attaching to window for now)
window.handleAddToPlaylistClick = openModal;
// --- Export Default Playlist Functions ---
window.isVideoInDefaultPlaylist = isVideoInDefaultPlaylist;
window.toggleVideoInDefaultPlaylist = toggleVideoInDefaultPlaylist;

// --- Initial Fetch ---
// Start loading default playlist info when the script loads
fetchAndStoreDefaultPlaylistInfo();

console.log('addToPlaylist.js loaded');