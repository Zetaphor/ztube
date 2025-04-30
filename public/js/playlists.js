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
    card.className = 'bg-zinc-800 rounded-lg shadow p-4 flex flex-col justify-between';
    card.dataset.playlistId = playlist.id;

    const nameInputId = `name-input-${playlist.id}`;
    const descInputId = `desc-input-${playlist.id}`;

    card.innerHTML = `
            <div>
                <h3 class="font-semibold text-lg mb-1 text-zinc-100 overflow-hidden text-ellipsis whitespace-nowrap" title="${playlist.name}">
                   <a href="/playlists/${playlist.id}" class="hover:text-green-400">${playlist.name}</a>
                </h3>
                <p class="text-sm text-zinc-400 mb-3 overflow-hidden text-ellipsis whitespace-nowrap" title="${playlist.description || ''}">${playlist.description || 'No description'}</p>

                <!-- Edit Form (Initially Hidden) -->
                <div class="edit-form hidden mt-2 space-y-2">
                     <input type="text" id="${nameInputId}" value="${escapeHtml(playlist.name)}" class="w-full px-2 py-1 rounded bg-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-green-500">
                     <input type="text" id="${descInputId}" value="${escapeHtml(playlist.description || '')}" placeholder="Description" class="w-full px-2 py-1 rounded bg-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-green-500">
                </div>
            </div>
            <div class="flex justify-end space-x-2 mt-3 pt-3 border-t border-zinc-700">
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
                    <i class="fas fa-trash-alt"></i>
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
    const nameDisplay = card.querySelector('h3 a');
    const descDisplay = card.querySelector('p');

    editBtn.addEventListener('click', () => {
      editForm.classList.remove('hidden');
      nameDisplay.parentElement.classList.add('hidden'); // Hide H3
      descDisplay.classList.add('hidden'); // Hide P
      editBtn.classList.add('hidden');
      deleteBtn.classList.add('hidden'); // Hide delete while editing
      saveBtn.classList.remove('hidden');
      cancelBtn.classList.remove('hidden');
    });

    cancelBtn.addEventListener('click', () => {
      editForm.classList.add('hidden');
      nameDisplay.parentElement.classList.remove('hidden');
      descDisplay.classList.remove('hidden');
      editBtn.classList.remove('hidden');
      deleteBtn.classList.remove('hidden');
      saveBtn.classList.add('hidden');
      cancelBtn.classList.add('hidden');
      // Reset input values to original
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

    deleteBtn.addEventListener('click', async () => {
      if (confirm(`Are you sure you want to delete the playlist "${playlist.name}"? This cannot be undone.`)) {
        await deletePlaylist(playlist.id);
      }
    });
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