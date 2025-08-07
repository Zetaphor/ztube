// DOM Elements
const blockedChannelsList = document.getElementById('blockedChannelsList');
const noBlockedChannels = document.getElementById('noBlockedChannels');


// State
let blockedChannels = [];

// Initialize settings page
document.addEventListener('DOMContentLoaded', async () => {
  await loadBlockedChannels();
  await loadSettings();
  setupEventListeners();
});

// Load blocked channels
async function loadBlockedChannels() {
  try {
    const response = await fetch('/api/hidden/channels');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    blockedChannels = await response.json();
    displayBlockedChannels();
  } catch (error) {
    console.error('Error loading blocked channels:', error);
    showError('Failed to load blocked channels');
  }
}

// Display blocked channels
function displayBlockedChannels() {
  // Clear existing content
  blockedChannelsList.innerHTML = '';

  if (blockedChannels.length === 0) {
    blockedChannelsList.appendChild(noBlockedChannels);
    return;
  }

  // Create a container for the channel list with proper spacing
  const listContainer = document.createElement('div');
  listContainer.className = 'space-y-1 p-2';

  blockedChannels.forEach(channel => {
    const channelElement = createBlockedChannelElement(channel);
    listContainer.appendChild(channelElement);
  });

  blockedChannelsList.appendChild(listContainer);
}

// Create blocked channel element
function createBlockedChannelElement(channel) {
  const element = document.createElement('div');
  element.className = 'flex items-center justify-between bg-zinc-700 rounded-md p-2 hover:bg-zinc-600 transition-colors';

  const blockedDate = new Date(channel.hidden_at * 1000).toLocaleDateString();

  element.innerHTML = `
    <div class="flex items-center space-x-2 min-w-0 flex-1">
      <i class="fas fa-user-circle text-zinc-400 text-lg flex-shrink-0"></i>
      <div class="min-w-0 flex-1">
        <div class="text-zinc-200 text-sm font-medium truncate">${escapeHtml(channel.name)}</div>
        <div class="text-zinc-400 text-xs">Blocked ${blockedDate}</div>
      </div>
    </div>
    <button
      class="unblock-btn bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs transition-colors flex-shrink-0"
      data-channel-id="${escapeHtml(channel.channel_id)}"
      title="Unblock channel"
    >
      <i class="fas fa-times mr-1"></i>
      Unblock
    </button>
  `;

  // Add unblock event listener
  const unblockBtn = element.querySelector('.unblock-btn');
  unblockBtn.addEventListener('click', () => unblockChannel(channel.channel_id, channel.name));

  return element;
}

// Unblock a channel
async function unblockChannel(channelId, channelName) {
  if (!confirm(`Are you sure you want to unblock "${channelName}"?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/hidden/channels/${encodeURIComponent(channelId)}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Remove from local array
    blockedChannels = blockedChannels.filter(channel => channel.channel_id !== channelId);
    displayBlockedChannels();

    showSuccess(`"${channelName}" has been unblocked`);
  } catch (error) {
    console.error('Error unblocking channel:', error);
    showError(`Failed to unblock "${channelName}"`);
  }
}

// Load settings from API
async function loadSettings() {
  try {
    const response = await fetch('/api/settings');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const settings = await response.json();

    // Settings loaded successfully
    console.log('Settings loaded:', settings);
  } catch (error) {
    console.error('Error loading settings:', error);
    showError('Failed to load settings');
  }
}

// Save a setting
async function saveSetting(key, value) {
  try {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ key, value })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log(`Setting ${key} saved as ${value}`);
  } catch (error) {
    console.error('Error saving setting:', error);
    showError(`Failed to save ${key} setting`);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Event listeners for general settings will be added here as they are implemented
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showSuccess(message) {
  showNotification(message, 'success');
}

function showError(message) {
  showNotification(message, 'error');
}

function showNotification(message, type) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 transform translate-x-full`;

  if (type === 'success') {
    notification.classList.add('bg-green-600', 'text-white');
    notification.innerHTML = `<i class="fas fa-check-circle mr-2"></i>${message}`;
  } else {
    notification.classList.add('bg-red-600', 'text-white');
    notification.innerHTML = `<i class="fas fa-exclamation-triangle mr-2"></i>${message}`;
  }

  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.classList.remove('translate-x-full');
  }, 100);

  // Remove after delay
  setTimeout(() => {
    notification.classList.add('translate-x-full');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// Export functions for use in other scripts
window.settingsAPI = {
  unblockChannel,
  loadBlockedChannels
};