// JavaScript for the Subscriptions page
// Will be populated later.

import { showError, showLoading, hideLoading } from './utils.js';

console.log("Subscriptions page JS loaded.");

// Tab elements and content containers
const videosTab = document.getElementById('videosTab');
const shortsTab = document.getElementById('shortsTab');
const videosContent = document.getElementById('subscriptions-videos-content');
const shortsContent = document.getElementById('subscriptions-shorts-content');
const allTabButtons = document.querySelectorAll('.tab-button');
const allTabContents = document.querySelectorAll('.tab-content');

const refreshFeedButton = document.getElementById('refreshFeedButton');
const CACHE_KEY = 'subscriptionsFeedCache';

document.addEventListener('DOMContentLoaded', () => {
  // Add Tab Listeners
  videosTab?.addEventListener('click', () => switchTab('videos'));
  shortsTab?.addEventListener('click', () => switchTab('shorts'));

  // Try loading from cache first
  const cachedData = localStorage.getItem(CACHE_KEY);
  let shouldFetch = true;

  if (cachedData) {
    try {
      const videos = JSON.parse(cachedData);
      console.log(`Loaded ${videos.length} videos from cache.`);
      // Display initially in the videos tab
      displaySubscriptionVideos(videos);
      shouldFetch = false; // Don't fetch immediately if cache is loaded
    } catch (e) {
      console.error('Failed to parse cached subscription data:', e);
      localStorage.removeItem(CACHE_KEY); // Clear invalid cache
    }
  }

  if (shouldFetch) {
    // Fetch immediately if no valid cache
    loadSubscriptionFeed(true);
  }

  // Add listener for the refresh button
  if (refreshFeedButton) {
    refreshFeedButton.addEventListener('click', () => loadSubscriptionFeed(true));
  }
});

function switchTab(targetTab) {
  console.log(`Switching to tab: ${targetTab}`);
  allTabButtons.forEach(button => {
    if (button.dataset.tab === targetTab) {
      button.classList.remove('border-transparent', 'text-zinc-400', 'hover:text-zinc-200', 'hover:border-zinc-300');
      button.classList.add('border-green-500', 'text-green-500');
      button.setAttribute('aria-current', 'page');
    } else {
      button.classList.remove('border-green-500', 'text-green-500');
      button.classList.add('border-transparent', 'text-zinc-400', 'hover:text-zinc-200', 'hover:border-zinc-300');
      button.removeAttribute('aria-current');
    }
  });

  allTabContents.forEach(content => {
    if (content.id.includes(targetTab)) {
      content.classList.remove('hidden');
    } else {
      content.classList.add('hidden');
    }
  });
}

async function loadSubscriptionFeed(forceFetch = false) {
  // Parameter forceFetch is now used to signal explicit refresh or initial load without cache
  if (!videosContent) { // Check for the specific video container
    console.error('Subscriptions video content container not found');
    return;
  }

  console.log(`Loading subscription feed. Force fetch: ${forceFetch}`);
  showLoading();
  // Keep existing content while loading on refresh, clear only if initial load without cache
  if (forceFetch && !localStorage.getItem(CACHE_KEY)) {
    videosContent.innerHTML = '<p class="col-span-full text-center text-zinc-500 py-8">Loading videos...</p>';
    // Also potentially clear/reset shorts tab if needed
    if (shortsContent) {
      shortsContent.innerHTML = '<p class="col-span-full text-center text-zinc-500 py-8">Shorts content not yet implemented.</p>';
    }
  }

  try {
    const response = await fetch('/api/subscriptions/feed');
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to fetch subscription feed: ${response.status}`);
    }
    const videos = await response.json();

    // Cache the new data (contains all items for now)
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(videos));
      console.log(`Cached ${videos.length} fetched items.`);
    } catch (e) {
      console.error('Failed to cache subscription data:', e);
      // localStorage.removeItem(CACHE_KEY);
    }

    // Display the newly fetched data (in the Videos tab for now)
    displaySubscriptionVideos(videos);

  } catch (error) {
    console.error('Failed to load subscription feed:', error);
    // Show error inline only if we didn't have cached data displayed
    if (!localStorage.getItem(CACHE_KEY)) {
      videosContent.innerHTML = `<p class="col-span-full text-center text-red-500 py-10">Error loading subscription feed: ${error.message}</p>`;
    }
    // Always show toast error
    showError(`Error loading subscription feed: ${error.message}`);
  } finally {
    hideLoading();
  }
}

function displaySubscriptionVideos(videos) {
  // This function now specifically targets the videosContent container
  if (!videosContent) return;

  videosContent.innerHTML = ''; // Clear previous content (whether loading message or old cache)

  // TODO: Filter `videos` array here to separate actual videos and shorts once a reliable method is found.
  // For now, display all items as videos.
  const actualVideos = videos; // Placeholder: Assume all are videos
  // const shorts = videos.filter(v => isShort(v)); // Future filtering logic

  if (!actualVideos || actualVideos.length === 0) {
    videosContent.innerHTML = '<p class="col-span-full text-center text-zinc-400 py-10">No videos found in your subscription feeds. Try adding some subscriptions or refreshing!</p>';
    // We could potentially display shorts even if no videos found, if filtering worked
  } else {
    actualVideos.forEach(video => {
      const card = createSubscriptionVideoCard(video); // Use the same card for now
      videosContent.appendChild(card);
    });
  }

  // --- Placeholder for Shorts Display ---
  if (shortsContent) {
    const actualShorts = []; // Placeholder: No shorts identified yet
    if (!actualShorts || actualShorts.length === 0) {
      shortsContent.innerHTML = '<p class="col-span-full text-center text-zinc-400 py-10">No shorts found yet, or filtering is not implemented.</p>';
    } else {
      shortsContent.innerHTML = ''; // Clear placeholder
      // actualShorts.forEach(short => {
      //     const shortCard = createSubscriptionShortCard(short); // Need a different card style for shorts
      //     shortsContent.appendChild(shortCard);
      // });
    }
  }
  // --- End Placeholder ---
}

function createSubscriptionVideoCard(video) {
  // This card generation remains the same for now
  const card = document.createElement('div');
  card.className = 'video-card bg-zinc-800 rounded-lg shadow-md overflow-hidden cursor-pointer transition-transform duration-200 hover:scale-105';

  // Format the published date (optional, basic formatting)
  let publishedDateStr = 'Unknown date';
  try {
    publishedDateStr = new Date(video.published).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  } catch (e) {
    console.warn(`Could not parse date: ${video.published}`);
  }

  // We don't have duration or view count from the feed
  // Use dataset to store the unformatted date if needed later
  card.dataset.published = video.published;

  card.onclick = () => window.loadAndDisplayVideo(video.id, card);

  // Basic channel link using channelId
  const channelLink = `/channel/${video.channelId}`;

  card.innerHTML = `
        <div class="video-thumbnail relative">
            <img src="${video.thumbnailUrl || '/img/default-video.png'}" alt="${video.title || 'Video thumbnail'}" loading="lazy" class="w-full h-full object-cover aspect-video">
            <!-- No duration available -->
        </div>
        <div class="p-3">
            <h3 class="font-semibold text-zinc-100 line-clamp-2 mb-2 text-sm h-10" title="${video.title || 'Untitled'}">${video.title || 'Untitled'}</h3>
            <div class="flex items-center mt-1">
                <!-- No avatar available, just link the name -->
                <div class="flex-1 min-w-0">
                    <a href="${channelLink}" class="hover:text-green-500 truncate text-zinc-300 text-xs" onclick="event.stopPropagation();" title="${video.channelName || 'Unknown Channel'}">
                      ${video.channelName || 'Unknown Channel'}
                      <!-- No verified badge available -->
                    </a>
                    <div class="video-meta text-zinc-400 text-xs mt-0.5 flex flex-wrap gap-x-2">
                         <span>${publishedDateStr}</span>
                         <!-- No views available -->
                    </div>
                </div>
            </div>
        </div>
    `;

  return card;
}