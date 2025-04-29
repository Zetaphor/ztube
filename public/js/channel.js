// DOM Elements
const channelContent = document.getElementById('channelContent');
const tabsContainer = document.querySelector('nav[aria-label="Tabs"]');
const tabs = tabsContainer ? Array.from(tabsContainer.querySelectorAll('a')) : [];

// State
let currentChannelId = null;
let currentContentType = 'videos'; // Default to videos
let isLoading = false;
let videosContinuation = null;

// --- Utility Functions (Copied from app.js - consider refactoring to shared file later) ---

function createVideoCard(video) {
  const card = document.createElement('div');
  // Add a class to distinguish channel video cards if needed, or reuse existing style
  card.className = 'video-card bg-zinc-800 rounded-lg shadow-md overflow-hidden cursor-pointer';

  const thumbnail = video.thumbnails?.[0]?.url || '/img/default-video.png';
  const channelAvatarUrl = video.channel?.avatar?.[0]?.url || '/img/default-avatar.svg';
  const duration = video.duration || '0:00';
  const views = video.viewCount || '0 views';
  const uploadedAt = video.uploadedAt || 'Unknown date';

  card.dataset.videoId = video.id;
  card.dataset.uploadedat = uploadedAt;

  // When clicking a video card on the channel page, call the global loadAndDisplayVideo
  card.onclick = () => {
    console.log(`Channel page: Requesting video play: ${video.id}`);
    if (typeof window.loadAndDisplayVideo === 'function') {
      window.loadAndDisplayVideo(video.id, card); // Pass the video ID and the card element
    } else {
      console.error('loadAndDisplayVideo function not found. Ensure app.js is loaded correctly.');
      // Fallback or error display?
      // Maybe redirect: window.location.href = `/?videoId=${video.id}`;
    }
  };

  const channelNameText = video.channel?.name || 'Unknown';
  const channelId = video.channel?.id;
  const verifiedBadge = video.channel?.verified ?
    '<i class="fas fa-check-circle text-green-500 ml-1 text-xs" title="Verified Channel"></i>' :
    '';

  // Channel link isn't strictly needed *inside* the card on the channel page itself,
  // but keeping it for consistency with the original function doesn't hurt.
  const channelLinkContent = channelId ?
    `<a href="/channel/${channelId}" class="hover:text-green-500 truncate" onclick="event.stopPropagation();">${channelNameText}${verifiedBadge}</a>` :
    `<span class="truncate">${channelNameText}${verifiedBadge}</span>`;

  card.innerHTML = `
        <div class="video-thumbnail">
            <img src="${thumbnail}" alt="${video.title}" loading="lazy" class="w-full h-full object-cover">
            <span class="video-duration">${duration}</span>
        </div>
        <div class="p-3">
            <h3 class="font-semibold text-zinc-100 line-clamp-2 mb-2 text-sm">${video.title || 'Untitled'}</h3>
            <div class="flex items-center mt-1">
                <!-- Hide avatar/channel name inside the card when on channel page -->
                <!--
                <img src="${channelAvatarUrl}" alt="${channelNameText}" class="w-8 h-8 rounded-full mr-2 flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center text-zinc-300 text-xs">
                      ${channelLinkContent}
                    </div>
                </div>
                -->
                <div class="video-meta text-zinc-400 text-xs mt-0.5 w-full">
                     <span title="${views}">${views}</span>
                     <span title="${uploadedAt}">${uploadedAt}</span>
                 </div>
            </div>
        </div>
    `;
  return card;
}

// --- Channel Page Specific Functions ---

function showLoadingIndicator() {
  channelContent.innerHTML = '<p class="col-span-full text-center text-zinc-500 py-8">Loading content...</p>';
}

function displayError(message) {
  channelContent.innerHTML = `<p class="col-span-full text-center text-red-500 py-8">${message}</p>`;
}

async function fetchChannelContent(channelId, contentType, continuation = null) {
  if (isLoading) return;
  isLoading = true;

  // Show loading indicator only on initial load for a content type
  if (!continuation) {
    showLoadingIndicator();
  }

  // TODO: Add Load More button and handle its display

  try {
    let apiUrl = `/api/channel/${channelId}/${contentType}`;
    if (continuation) {
      apiUrl += `?continuation=${encodeURIComponent(continuation)}`;
    }

    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to fetch ${contentType}`);
    }
    const data = await response.json();

    // Clear loading indicator or previous content only on initial load
    if (!continuation) {
      channelContent.innerHTML = '';
    }

    // --- Render Videos ---
    if (contentType === 'videos' && data.videos) {
      if (data.videos.length === 0 && !continuation) {
        channelContent.innerHTML = '<p class="col-span-full text-center text-zinc-500 py-8">No videos found.</p>';
      } else {
        data.videos.forEach(video => {
          const card = createVideoCard(video);
          channelContent.appendChild(card);
        });
      }
      videosContinuation = data.continuation; // Store continuation for videos
    }
    // --- TODO: Add rendering for playlists, about, etc. ---
    else if (contentType === 'playlists') {
      channelContent.innerHTML = '<p class="col-span-full text-center text-zinc-500 py-8">Playlist loading not implemented yet.</p>';
      // Render playlist cards...
    }
    else if (contentType === 'about') {
      channelContent.innerHTML = '<p class="col-span-full text-center text-zinc-500 py-8">About section loading not implemented yet.</p>';
      // Render about info...
    }

    // TODO: Show/Hide Load More button based on `data.continuation`

  } catch (error) {
    console.error(`Error fetching ${contentType}:`, error);
    // Don't clear content if it was a continuation load error
    if (!continuation) {
      displayError(`Failed to load ${contentType}. Please try again.`);
    }
  } finally {
    isLoading = false;
  }
}

function handleTabClick(event) {
  event.preventDefault();
  if (isLoading) return;

  const clickedTab = event.currentTarget;
  const contentType = clickedTab.getAttribute('data-content-type');

  if (!contentType || contentType === currentContentType) return;

  // Update state
  currentContentType = contentType;
  videosContinuation = null; // Reset continuation when switching tabs
  // Reset other continuations (playlists, etc.) when implemented

  // Update tab appearance
  tabs.forEach(tab => {
    tab.classList.remove('border-green-500', 'text-green-500');
    tab.classList.add('border-transparent', 'text-zinc-400', 'hover:text-zinc-200', 'hover:border-zinc-300');
    tab.removeAttribute('aria-current');
  });
  clickedTab.classList.add('border-green-500', 'text-green-500');
  clickedTab.classList.remove('border-transparent', 'text-zinc-400', 'hover:text-zinc-200', 'hover:border-zinc-300');
  clickedTab.setAttribute('aria-current', 'page');

  // Fetch content for the new tab
  fetchChannelContent(currentChannelId, currentContentType);
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
  // Extract channel ID from the global channelData object set in EJS
  if (typeof channelData !== 'undefined' && channelData.id) {
    currentChannelId = channelData.id;
    console.log('Channel JS Initialized for ID:', currentChannelId);
    console.log('Channel JS: Checking window.loadAndDisplayVideo on DOMContentLoaded:', typeof window.loadAndDisplayVideo);

    // Add data attributes and event listeners to tabs
    tabs.forEach(tab => {
      // Simple text-based content type mapping
      const text = tab.textContent.trim().toLowerCase();
      if (text === 'videos' || text === 'playlists' || text === 'about') {
        tab.setAttribute('data-content-type', text);
        tab.addEventListener('click', handleTabClick);
      }
    });

    // Initial content load (default tab is 'videos')
    const initialTab = tabsContainer?.querySelector('a[aria-current="page"]');
    const initialContentType = initialTab?.getAttribute('data-content-type') || 'videos';
    currentContentType = initialContentType;
    fetchChannelContent(currentChannelId, currentContentType);

  } else {
    console.error('Channel ID not found in channelData.');
    displayError('Could not identify the channel to load content.');
  }

  // TODO: Add infinite scroll or load more button listener
});