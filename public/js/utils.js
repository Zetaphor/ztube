export function showError(message) {
  const error = document.createElement('div');
  error.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg';
  error.textContent = message;
  document.body.appendChild(error);
  setTimeout(() => error.remove(), 3000);
}

export function showLoading() {
  const loader = document.createElement('div');
  loader.className = 'loading';
  loader.id = 'loader';
  document.body.appendChild(loader);
}

export function hideLoading() {
  const loader = document.getElementById('loader');
  if (loader) loader.remove();
}

export function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';

  // Handle hours for longer videos
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function copyVideoLink(videoId) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  if (navigator.clipboard && window.isSecureContext) {
    // Use the modern clipboard API
    navigator.clipboard.writeText(videoUrl).then(() => {
      showCopySuccessMessage();
    }).catch(err => {
      console.error('Failed to copy video link:', err);
      fallbackCopyTextToClipboard(videoUrl);
    });
  } else {
    // Fallback for older browsers or non-HTTPS contexts
    fallbackCopyTextToClipboard(videoUrl);
  }
}

function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;

  // Avoid scrolling to bottom
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showCopySuccessMessage();
    } else {
      console.error('Fallback: Copy command was unsuccessful');
    }
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
  }

  document.body.removeChild(textArea);
}

function showCopySuccessMessage() {
  const message = document.createElement('div');
  message.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
  message.innerHTML = '<i class="fas fa-check mr-2"></i>YouTube link copied to clipboard!';
  document.body.appendChild(message);
  setTimeout(() => message.remove(), 2000);
}

// Block channel functionality
export async function blockChannel(channelId, channelName) {
  if (!channelId || !channelName) {
    console.error('Missing channelId or channelName for blocking');
    return;
  }

  const confirmMsg = `Are you sure you want to block "${channelName}"?\n\nBlocked channels will not appear in your feeds, search results, or recommendations.`;
  if (!confirm(confirmMsg)) {
    return;
  }

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

    showBlockSuccessMessage(channelName);

    // Remove all video cards from this channel from the current page
    removeChannelVideosFromPage(channelId);

  } catch (error) {
    console.error('Error blocking channel:', error);
    showError(`Failed to block "${channelName}"`);
  }
}

// Remove all videos from a specific channel from the current page
function removeChannelVideosFromPage(channelId) {
  const videoCards = document.querySelectorAll('.video-card');
  videoCards.forEach(card => {
    // Check if this card belongs to the blocked channel
    const cardChannelId = card.dataset.channelId;
    if (cardChannelId === channelId) {
      // Add fade out animation
      card.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';

      // Remove after animation
      setTimeout(() => {
        card.remove();
      }, 300);
    }
  });
}

function showBlockSuccessMessage(channelName) {
  const message = document.createElement('div');
  message.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
  message.innerHTML = `<i class="fas fa-ban mr-2"></i>"${channelName}" has been blocked`;
  document.body.appendChild(message);
  setTimeout(() => message.remove(), 3000);
}