// JavaScript for the Subscriptions page
// Will be populated later.

import { showError, showLoading, hideLoading } from './utils.js';

// Tab elements and content containers
const videosTab = document.getElementById('videosTab');
const shortsTab = document.getElementById('shortsTab');
const videosContent = document.getElementById('subscriptions-videos-content');
const shortsContent = document.getElementById('subscriptions-shorts-content');
const allTabButtons = document.querySelectorAll('.tab-button');
const allTabContents = document.querySelectorAll('.tab-content');

const refreshFeedButton = document.getElementById('refreshFeedButton');
const CACHE_KEY = 'subscriptionsFeedCache';

// --- Lazy Loading Variables ---
const VIDEOS_PER_PAGE = 25; // Number of videos to load per batch
let allFetchedVideos = []; // Store all videos fetched from API or cache
let currentVideoIndex = 0; // Index of the next video to display
let observer = null; // Intersection Observer instance
const sentinelId = 'video-lazy-load-sentinel';
// --- End Lazy Loading Variables ---

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
      console.info(`Loaded ${videos.length} videos from cache.`);
      // Display initially in the videos tab
      allFetchedVideos = videos; // Store cached videos
      currentVideoIndex = 0; // Reset index
      displaySubscriptionVideos(); // Start display process (which now includes lazy loading)
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
    const response = await fetch('/subscriptions/api/feed');
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to fetch subscription feed: ${response.status}`);
    }
    const videos = await response.json();

    // Cache the new data (contains all items for now)
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(videos));
      console.info(`Cached ${videos.length} fetched items.`);
    } catch (e) {
      console.error('Failed to cache subscription data:', e);
      // localStorage.removeItem(CACHE_KEY);
    }

    // Display the newly fetched data (in the Videos tab for now)
    allFetchedVideos = videos; // Store fetched videos
    currentVideoIndex = 0; // Reset index
    displaySubscriptionVideos(); // Start display process

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

// --- Updated to handle lazy loading ---
function displaySubscriptionVideos() {
  if (!videosContent) return;

  // Clear previous content ONLY on the first call or refresh
  if (currentVideoIndex === 0) {
    videosContent.innerHTML = '';
    // Ensure sentinel doesn't exist from previous state
    const existingSentinel = document.getElementById(sentinelId);
    existingSentinel?.remove();
  }

  // TODO: Filter `allFetchedVideos` array here to separate actual videos and shorts once implemented.
  const actualVideos = allFetchedVideos; // Placeholder: Assume all are videos for now

  if (!actualVideos || actualVideos.length === 0) {
    if (currentVideoIndex === 0) { // Only show if it's the initial load and empty
      videosContent.innerHTML = '<p class="col-span-full text-center text-zinc-400 py-10">No videos found in your subscription feeds. Try adding some subscriptions or refreshing!</p>';
    }
    return; // No videos to display or load further
  }

  const nextBatch = actualVideos.slice(currentVideoIndex, currentVideoIndex + VIDEOS_PER_PAGE);

  if (nextBatch.length === 0 && currentVideoIndex === 0) {
    // Handle case where fetch/cache returns empty array initially
    videosContent.innerHTML = '<p class="col-span-full text-center text-zinc-400 py-10">No videos found.</p>';
    return;
  }

  nextBatch.forEach(video => {
    const card = createSubscriptionVideoCard(video);
    videosContent.appendChild(card);
  });

  currentVideoIndex += nextBatch.length;

  // --- Set up or update sentinel for Intersection Observer ---
  setupIntersectionObserver(actualVideos.length);
  // --- End Sentinel Setup ---

  // --- Placeholder for Shorts Display (Remains unchanged for now) ---
  if (shortsContent) {
    const actualShorts = []; // Placeholder: No shorts identified yet
    if (!actualShorts || actualShorts.length === 0) {
      // Only set initial message if shorts tab is active and empty
      if (!shortsContent.classList.contains('hidden')) {
        shortsContent.innerHTML = '<p class="col-span-full text-center text-zinc-400 py-10">No shorts found yet, or filtering is not implemented.</p>';
      }
    } else {
      // Logic to display shorts if/when available
      // shortsContent.innerHTML = ''; // Clear placeholder if displaying
      // actualShorts.forEach(short => { ... });
    }
  }
  // --- End Placeholder ---
}
// --- End Updated Function ---

// --- New function to set up Intersection Observer ---
function setupIntersectionObserver(totalVideos) {
  // Disconnect previous observer if exists
  if (observer) {
    observer.disconnect();
  }

  // Remove old sentinel if exists
  const oldSentinel = document.getElementById(sentinelId);
  oldSentinel?.remove();

  // Only add sentinel and observe if there are more videos to load
  if (currentVideoIndex < totalVideos) {
    const sentinel = document.createElement('div');
    sentinel.id = sentinelId;
    // Add some minimal styling or height if needed for reliable intersection
    sentinel.className = "col-span-full h-10"; // Span across grid, give some height
    videosContent.appendChild(sentinel);

    const options = {
      root: null, // Use the viewport as the root
      rootMargin: '0px',
      threshold: 0.1 // Trigger when 10% of the sentinel is visible
    };

    observer = new IntersectionObserver(handleIntersection, options);
    observer.observe(sentinel);
  }
}

// --- New function called by Intersection Observer ---
function handleIntersection(entries, observerInstance) {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      console.log('Sentinel intersected, loading more videos...');
      // Stop observing the current sentinel before loading more
      // observerInstance.unobserve(entry.target); // Moved sentinel removal to setupIntersectionObserver
      displaySubscriptionVideos(); // Load the next batch
    }
  });
}
// --- End New Observer Functions ---

function createSubscriptionVideoCard(video) {
  // This card generation remains the same for now
  const card = document.createElement('div');
  card.className = 'video-card bg-zinc-800 rounded-lg shadow-md overflow-hidden cursor-pointer transition-transform duration-200 hover:scale-105';

  // Format the published date (optional, basic formatting)
  let publishedDateStr = 'Unknown date';
  try {
    // Attempt to use relative time if available (like from search/channel results)
    // Fallback to basic formatting
    if (video.publishedText) {
      publishedDateStr = video.publishedText; // Use pre-formatted relative string if provided
    } else if (video.published) {
      // Keep basic date formatting as fallback
      publishedDateStr = new Date(video.published).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    }
  } catch (e) {
    // Keep warning, but don't fail card creation
    console.warn(`Could not parse or format date: ${video.published}`);
    publishedDateStr = video.published || 'Invalid Date'; // Show original string if formatting failed
  }

  let publishedText = video.publishedText || 'Unknown date';

  // --- Add view count (matching app.js) ---
  const views = video.viewCount || ''; // Get view count if available, default to empty string
  // --- End add view count ---

  // We don't have duration from the feed
  // Use dataset to store the unformatted date if needed later
  card.dataset.published = video.published;
  // Add view count to dataset as well if needed
  if (views) card.dataset.viewcount = views;
  // Pass the card element itself to loadAndDisplayVideo
  card.onclick = () => window.loadAndDisplayVideo(video.id, card);

  // Basic channel link using channelId
  const channelLink = `/channel/${video.channelId}`;

  // --- Build meta HTML string (matching app.js structure) ---
  let metaHTML = '';
  if (views) {
    metaHTML += `<span>${views}</span>`; // No title attribute
  }
  if (views && publishedText !== 'Unknown date' && publishedText !== 'Invalid Date') {
    metaHTML += '<span class="separator mx-1">•</span>'; // Keep separator consistent with previous edit for now, visually cleaner
    metaHTML += `<span>${publishedText}</span>`; // No title attribute
  } else if (publishedText !== 'Unknown date' && publishedText !== 'Invalid Date') {
    metaHTML += `<span>${publishedText}</span>`; // No title attribute
  }

  // --- End Build meta HTML string ---


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
                    <div class="video-meta text-zinc-400 text-xs mt-0.5 flex flex-wrap gap-x-1">
                         ${metaHTML}
                    </div>
                </div>
            </div>
        </div>
    `;

  return card;
}