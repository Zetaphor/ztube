import { showError, showLoading, hideLoading } from './utils.js';

const playlistList = document.getElementById('playlistList');
const newPlaylistNameInput = document.getElementById('newPlaylistName');
const newPlaylistDescriptionInput = document.getElementById('newPlaylistDescription');
const createPlaylistBtn = document.getElementById('createPlaylistBtn');
const errorDisplay = document.getElementById('errorDisplay');

// Function to fetch and display playlists
async function loadPlaylists() {
  showLoading();
  errorDisplay.classList.add('hidden');
  try {
    const response = await fetch('/api/playlists');
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to load playlists: ${response.status}`);
    }
    const playlists = await response.json();
    displayPlaylists(playlists);
  } catch (error) {
    console.error('Error loading playlists:', error);
    showError(`Error loading playlists: ${error.message}`, errorDisplay);
  } finally {
    hideLoading();
  }
}

// Function to display playlists in the UI
function displayPlaylists(playlists) {
  playlistList.innerHTML = ''; // Clear current list
  if (!playlists || playlists.length === 0) {
    playlistList.innerHTML = '<p class="col-span-full text-center text-zinc-400">No playlists found. Create one above!</p>';
    return;
  }

  playlists.forEach(playlist => {
    const card = document.createElement('div');
    card.className = 'bg-zinc-800 rounded-lg shadow p-4 flex flex-col justify-between min-h-[10rem]';
    card.dataset.playlistId = playlist.id;
    card.dataset.isDefault = playlist.is_default; // Store default status

    const nameInputId = `name-input-${playlist.id}`;
    const descInputId = `desc-input-${playlist.id}`;

    // --- Thumbnail Grid Logic ---
    let thumbnailGridHTML = '';
    const thumbnails = playlist.thumbnails || [];
    const validThumbnails = thumbnails.slice(0, 4); // Max 4 thumbnails
    if (validThumbnails.length > 0) {
      // Determine grid columns: 1 for 1 thumb, 2 for 2-4 thumbs
      const gridCols = validThumbnails.length === 1 ? 'grid-cols-1' : 'grid-cols-2';
      // Use aspect-square for single thumbnail, aspect-video for multiple
      const aspectClass = validThumbnails.length === 1 ? 'aspect-square' : 'aspect-video';
      thumbnailGridHTML = `
        <div class="thumbnail-grid grid ${gridCols} gap-1 my-3">
          ${validThumbnails.map(thumbUrl => `
            <div class="rounded overflow-hidden ${aspectClass} bg-zinc-700">
                <img src="${escapeHtml(thumbUrl)}" alt="Playlist thumbnail" class="w-full h-full object-cover" loading="lazy">
            </div>
          `).join('')}
        </div>
      `;
    }
    // --- End Thumbnail Grid Logic ---

    const videoCountText = `${playlist.video_count || 0} video${playlist.video_count !== 1 ? 's' : ''}`;

    card.innerHTML = `
            <a href="/playlists/${playlist.id}" class="block hover:bg-zinc-700/50 rounded-t-lg -m-4 p-4 mb-2 transition-colors duration-150">
                <h3 class="font-semibold text-lg mb-1 text-zinc-100 overflow-hidden text-ellipsis whitespace-nowrap flex items-center" title="${escapeHtml(playlist.name)}">
                   ${escapeHtml(playlist.name)}
                   <span class="default-indicator text-xs text-yellow-400 ml-auto"></span>
                </h3>
                <p class="text-sm text-zinc-400 mb-1 overflow-hidden text-ellipsis whitespace-nowrap" title="${escapeHtml(playlist.description || '')}">${escapeHtml(playlist.description || 'No description')}</p>
                <p class="text-xs text-zinc-500 mb-2">${videoCountText}</p>

                ${thumbnailGridHTML}
            </a>
            <div class="edit-form hidden mt-2 space-y-2 px-4 pb-4">
                 <input type="text" id="${nameInputId}" value="${escapeHtml(playlist.name)}" class="w-full px-2 py-1 rounded bg-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-green-500">
                 <input type="text" id="${descInputId}" value="${escapeHtml(playlist.description || '')}" placeholder="Description" class="w-full px-2 py-1 rounded bg-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-green-500">
            </div>
            <div class="flex justify-end space-x-2 mt-auto pt-3 border-t border-zinc-700 px-4 pb-3">
                <button class="set-default-btn text-zinc-400 hover:text-yellow-500 text-sm hidden" title="Set as Default Playlist">
                    <i class="fas fa-star"></i>
                </button>
                <button class="edit-btn text-zinc-400 hover:text-green-500 text-sm" title="Edit Playlist">
                    <i class="fas fa-pencil-alt"></i>
                </button>
                <button class="save-btn text-zinc-400 hover:text-green-500 text-sm hidden" title="Save Changes">
                    <i class="fas fa-save"></i>
                </button>
                 <button class="cancel-btn text-zinc-400 hover:text-yellow-500 text-sm hidden" title="Cancel Edit">
                    <i class="fas fa-times"></i>
                </button>
                <button class="delete-btn text-zinc-400 hover:text-red-500 text-sm" title="Delete Playlist">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    playlistList.appendChild(card);

    // Add event listeners for buttons within this card
    const editBtn = card.querySelector('.edit-btn');
    const saveBtn = card.querySelector('.save-btn');
    const cancelBtn = card.querySelector('.cancel-btn');
    const deleteBtn = card.querySelector('.delete-btn');
    const editForm = card.querySelector('.edit-form');
    const clickableArea = card.querySelector('a');
    const descDisplay = card.querySelector('p:nth-of-type(1)');
    const videoCountDisplay = card.querySelector('p:nth-of-type(2)');
    const thumbnailGridContainer = card.querySelector('.thumbnail-grid');
    const defaultIndicator = card.querySelector('.default-indicator');
    const setDefaultBtn = card.querySelector('.set-default-btn');

    // --- Default Playlist Logic ---
    if (playlist.is_default) {
      defaultIndicator.innerHTML = '<i class="fas fa-star mr-1" title="Default Playlist"></i> Default';
      deleteBtn.classList.add('hidden'); // Hide delete for default
      if (setDefaultBtn.classList.contains('hidden')) {
        editBtn.classList.add('mr-auto');
      }
    } else {
      setDefaultBtn.classList.remove('hidden'); // Show set default button
      setDefaultBtn.addEventListener('click', async () => {
        await setDefaultPlaylist(playlist.id);
      });
    }
    // --- End Default Playlist Logic ---

    editBtn.addEventListener('click', () => {
      editForm.classList.remove('hidden');
      clickableArea.classList.add('hidden');
      editBtn.classList.add('hidden');
      deleteBtn.classList.add('hidden');
      setDefaultBtn.classList.add('hidden');
      saveBtn.classList.remove('hidden');
      cancelBtn.classList.remove('hidden');
    });

    cancelBtn.addEventListener('click', () => {
      editForm.classList.add('hidden');
      clickableArea.classList.remove('hidden');
      editBtn.classList.remove('hidden');
      if (!playlist.is_default) {
        deleteBtn.classList.remove('hidden');
        setDefaultBtn.classList.remove('hidden');
      } else {
        editBtn.classList.add('mr-auto');
      }
      saveBtn.classList.add('hidden');
      cancelBtn.classList.add('hidden');
      document.getElementById(nameInputId).value = playlist.name;
      document.getElementById(descInputId).value = playlist.description || '';
    });

    saveBtn.addEventListener('click', async () => {
      const newName = document.getElementById(nameInputId).value.trim();
      const newDescription = document.getElementById(descInputId).value.trim();
      if (!newName) {
        showError('Playlist name cannot be empty.', errorDisplay);
        return;
      }
      await updatePlaylist(playlist.id, newName, newDescription);
    });

    if (!playlist.is_default) {
      deleteBtn.addEventListener('click', async () => {
        if (confirm(`Are you sure you want to delete the playlist "${escapeHtml(playlist.name)}"? This cannot be undone.`)) {
          await deletePlaylist(playlist.id);
        }
      });
    }
  });
}

// Function to create a new playlist
async function createPlaylist() {
  const name = newPlaylistNameInput.value.trim();
  const description = newPlaylistDescriptionInput.value.trim();

  if (!name) {
    showError('Playlist name is required.', errorDisplay);
    return;
  }

  showLoading();
  createPlaylistBtn.disabled = true;
  errorDisplay.classList.add('hidden');

  try {
    const response = await fetch('/api/playlists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, description }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to create playlist: ${response.status}`);
    }

    // Clear input fields and reload list
    newPlaylistNameInput.value = '';
    newPlaylistDescriptionInput.value = '';
    await loadPlaylists(); // Reload to show the new playlist

  } catch (error) {
    console.error('Error creating playlist:', error);
    showError(`Error creating playlist: ${error.message}`, errorDisplay);
  } finally {
    hideLoading();
    createPlaylistBtn.disabled = false;
  }
}

// Function to delete a playlist
async function deletePlaylist(playlistId) {
  showLoading();
  errorDisplay.classList.add('hidden');
  try {
    const response = await fetch(`/api/playlists/${playlistId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to delete playlist: ${response.status}`);
    }
    console.log(`Playlist ${playlistId} deleted`);
    await loadPlaylists(); // Reload list
  } catch (error) {
    console.error(`Error deleting playlist ${playlistId}:`, error);
    showError(`Error deleting playlist: ${error.message}`, errorDisplay);
  } finally {
    hideLoading();
  }
}

// Function to update a playlist
async function updatePlaylist(playlistId, name, description) {
  showLoading();
  errorDisplay.classList.add('hidden');
  try {
    const response = await fetch(`/api/playlists/${playlistId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, description }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to update playlist: ${response.status}`);
    }
    console.log(`Playlist ${playlistId} updated`);
    await loadPlaylists(); // Reload list to show changes and exit edit mode
  } catch (error) {
    console.error(`Error updating playlist ${playlistId}:`, error);
    showError(`Error updating playlist: ${error.message}`, errorDisplay);
    // Optionally revert UI changes or keep edit mode open on failure?
    // For simplicity, we reload, which exits edit mode.
  } finally {
    hideLoading();
  }
}

// Function to set a playlist as default
async function setDefaultPlaylist(playlistId) {
  showLoading();
  errorDisplay.classList.add('hidden');
  try {
    const response = await fetch(`/api/playlists/${playlistId}/default`, {
      method: 'PUT',
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to set default playlist: ${response.status}`);
    }
    console.log(`Playlist ${playlistId} set as default`);
    await loadPlaylists(); // Reload list to show changes
  } catch (error) {
    console.error(`Error setting playlist ${playlistId} as default:`, error);
    showError(`Error setting default playlist: ${error.message}`, errorDisplay);
  } finally {
    hideLoading();
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

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  loadPlaylists();

  if (createPlaylistBtn) {
    createPlaylistBtn.addEventListener('click', createPlaylist);
  }
  // Allow creating playlist with Enter key in name input
  if (newPlaylistNameInput) {
    newPlaylistNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        createPlaylist();
      }
    });
  }
});