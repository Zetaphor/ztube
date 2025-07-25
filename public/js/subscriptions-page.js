// JavaScript for the Subscriptions page
// Will be populated later.

import { showError, showLoading, hideLoading } from './utils.js';

// === Helper to Update Bookmark Icon State ===
function updateBookmarkIconState(cardElement) {
  const bookmarkBtn = cardElement.querySelector('.bookmark-btn');
  const bookmarkIcon = bookmarkBtn?.querySelector('i');
  const videoId = cardElement.dataset.videoId;

  if (bookmarkBtn && bookmarkIcon && videoId && typeof window.isVideoInDefaultPlaylist === 'function') {
    try {
      if (window.isVideoInDefaultPlaylist(videoId)) {
        bookmarkIcon.className = 'fas fa-bookmark'; // Solid bookmark
        bookmarkBtn.title = "Remove from Watch Later";
        bookmarkBtn.classList.add('visible'); // Make visible
      } else {
        bookmarkIcon.className = 'far fa-bookmark'; // Empty bookmark
        bookmarkBtn.title = "Add to Watch Later";
        bookmarkBtn.classList.remove('visible'); // Ensure hidden/default state
      }
    } catch (error) {
      console.error(`Error updating bookmark state for ${videoId} in subscriptions-page.js:`, error);
      // Keep default state on error
      bookmarkIcon.className = 'far fa-bookmark';
      bookmarkBtn.title = "Add to Watch Later";
      bookmarkBtn.classList.remove('visible');
    }
  }
}

// Tab elements and content containers
const videosTab = document.getElementById('videosTab');
const shortsTab = document.getElementById('shortsTab');
const videosContent = document.getElementById('subscriptions-videos-content');
const shortsContent = document.getElementById('subscriptions-shorts-content');
const allTabButtons = document.querySelectorAll('.tab-button');
const allTabContents = document.querySelectorAll('.tab-content');

const refreshFeedButton = document.getElementById('refreshFeedButton');
const CACHE_KEY = 'subscriptionsFeedCache';
const CACHE_EXPIRY_MINUTES = 30; // 30 minutes

// --- Lazy Loading Variables ---
const VIDEOS_PER_PAGE = 25; // Number of videos to load per batch
let allFetchedVideos = []; // Store all videos fetched from API or cache
let currentVideoIndex = 0; // Index of the next video to display
let observer = null; // Intersection Observer instance
const sentinelId = 'video-lazy-load-sentinel';
// --- End Lazy Loading Variables ---

document.addEventListener('DOMContentLoaded', () => {
  // --- Setup Event Listeners Early ---
  const updateAllSubscriptionBookmarkIcons = () => {
    // Target only cards within the subscription videos container
    const cards = videosContent?.querySelectorAll('.video-card') || [];
    console.log(`[Subscriptions] Found ${cards.length} cards to update bookmark status.`);
    cards.forEach(card => {
      if (card.dataset.videoId) {
        updateBookmarkIconState(card);
      }
    });
    // TODO: Update shorts cards if/when implemented
  };

  // Listen for the event dispatched when default playlist info is loaded
  document.addEventListener('defaultPlaylistLoaded', () => {
    console.log("[Subscriptions] Received defaultPlaylistLoaded event. Updating icons.");
    updateAllSubscriptionBookmarkIcons();
  });

  // Listen for a custom event that signals UI might need an update
  document.addEventListener('uiNeedsBookmarkUpdate', () => {
    console.log("[Subscriptions] Received uiNeedsBookmarkUpdate event. Updating icons.");
    // Check if data is ready before updating
    if (window.defaultPlaylistInfoLoaded) {
      updateAllSubscriptionBookmarkIcons();
    } else {
      console.log("[Subscriptions] Default playlist info not yet loaded, skipping immediate update.");
    }
  });
  // --- End Event Listener Setup ---

  // Add Tab Listeners
  videosTab?.addEventListener('click', () => switchTab('videos'));
  shortsTab?.addEventListener('click', () => switchTab('shorts'));

  // Try loading from cache first
  const cachedDataString = localStorage.getItem(CACHE_KEY);
  let shouldFetch = true; // Assume we need to fetch by default
  let cacheIsStale = false;

  if (cachedDataString) {
    try {
      const cachedItem = JSON.parse(cachedDataString);
      if (cachedItem && cachedItem.data && cachedItem.timestamp) {
        const cacheAgeMinutes = (Date.now() - cachedItem.timestamp) / (1000 * 60);
        console.info(`Cache found, age: ${cacheAgeMinutes.toFixed(1)} minutes.`);

        if (cacheAgeMinutes <= CACHE_EXPIRY_MINUTES) {
          // Cache is valid and not expired
          console.info(`Loaded ${cachedItem.data.length} videos from valid cache.`);
          allFetchedVideos = cachedItem.data; // Store cached videos

          // ---> Clear app.js cache for these specific IDs before processing <---
          const cachedVideoIds = allFetchedVideos.map(v => v.id).filter(Boolean);
          if (window.clearWatchHistoryCacheForIds) {
            window.clearWatchHistoryCacheForIds(cachedVideoIds);
          } else {
            console.warn('clearWatchHistoryCacheForIds function not found on window');
          }
          // ---> End Cache Clearing <---

          currentVideoIndex = 0; // Reset index
          displaySubscriptionVideos(); // Start display process
          shouldFetch = false; // Don't fetch immediately if valid cache is loaded
        } else {
          // Cache exists but is stale
          console.info(`Cache is stale (older than ${CACHE_EXPIRY_MINUTES} minutes). Displaying stale data and fetching fresh.`);
          allFetchedVideos = cachedItem.data; // Still display stale data
          currentVideoIndex = 0;
          displaySubscriptionVideos();
          shouldFetch = true; // Mark for fetching fresh data
          cacheIsStale = true; // Flag that we are fetching due to stale cache
        }
      } else {
        // Invalid cache structure
        console.warn('Invalid cache structure found. Clearing cache.');
        localStorage.removeItem(CACHE_KEY);
      }
    } catch (e) {
      console.error('Failed to parse cached subscription data:', e);
      localStorage.removeItem(CACHE_KEY); // Clear invalid cache
    }
  } else {
    console.info('No cache found.');
  }

  if (shouldFetch) {
    // Fetch immediately if no valid cache or if cache was stale
    loadSubscriptionFeed(true, cacheIsStale); // Pass stale flag
  }

  // Add listener for the refresh button
  if (refreshFeedButton) {
    refreshFeedButton.addEventListener('click', () => loadSubscriptionFeed(true, false)); // Explicit refresh is not due to stale cache
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

async function loadSubscriptionFeed(forceFetch = false, dueToStaleCache = false) {
  // Parameter forceFetch signals explicit refresh or initial load without cache
  // Parameter dueToStaleCache indicates if fetch is triggered by stale cache
  if (!videosContent) { // Check for the specific video container
    console.error('Subscriptions video content container not found');
    return;
  }

  // Only show full "Loading..." overlay if it's an initial load without any cache
  // or an explicit refresh *not* caused by stale cache (where we already displayed old data)
  if (forceFetch && !localStorage.getItem(CACHE_KEY) && !dueToStaleCache) {
    videosContent.innerHTML = '<p class="col-span-full text-center text-zinc-500 py-8">Loading videos...</p>';
    // Also potentially clear/reset shorts tab if needed
    if (shortsContent) {
      shortsContent.innerHTML = '<p class="col-span-full text-center text-zinc-500 py-8">Shorts content not yet implemented.</p>';
    }
  }

  // Always show the small loading indicator at the top
  showLoading();

  try {
    const response = await fetch('/api/subscriptions/feed');
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to fetch subscription feed: ${response.status}`);
    }
    const videos = await response.json();

    // Cache the new data with timestamp
    try {
      const itemToCache = {
        data: videos,
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(itemToCache));
      console.info(`Cached ${videos.length} fetched items with timestamp.`);
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
    // Show error inline only if we didn't have any data displayed (initial load failed)
    if (!allFetchedVideos || allFetchedVideos.length === 0) {
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

  // Process the newly added batch of cards for watch history
  const newlyAddedCards = Array.from(videosContent.children).slice(-nextBatch.length);
  if (window.processCardsForWatchHistory) {
    window.processCardsForWatchHistory(newlyAddedCards);
  } else {
    console.warn('processCardsForWatchHistory function not found on window');
  }

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
  card.className = 'video-card group bg-zinc-800 rounded-lg shadow-md overflow-hidden cursor-pointer transition-transform duration-200 hover:scale-105 relative';

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
            <!-- Watch History Overlay -->
            <div class="watch-history-overlay absolute inset-0 bg-black/60 hidden group-hover:opacity-0 transition-opacity duration-200"></div>
            <!-- Watch History Progress Bar -->
            <div class="watch-history-progress absolute bottom-0 left-0 right-0 h-1 bg-zinc-600 hidden">
                <div class="watch-history-progress-bar h-full bg-green-600"></div>
            </div>
             <!-- Thumbnail Hover Icons -->
            <div class="thumbnail-icons absolute top-1 right-1 flex flex-row gap-1.5 z-10">
                 <button class="remove-history-btn thumbnail-icon-btn hidden hover:bg-red-600" title="Remove from History">
                     <i class="fas fa-eye-slash"></i>
                 </button>
                 <button class="add-to-playlist-hover-btn thumbnail-icon-btn" title="Add to Playlist">
                     <i class="fas fa-plus"></i>
                 </button>
                 <button class="bookmark-btn thumbnail-icon-btn" title="Add to Watch Later">
                     <i class="far fa-bookmark"></i> <!-- Default empty state -->
                 </button>
            </div>
            <!-- End Thumbnail Hover Icons -->
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

  // --- Add Listeners for Hover Icons (Copied from app.js) ---
  const bookmarkBtn = card.querySelector('.bookmark-btn');
  const addToPlaylistBtn = card.querySelector('.add-to-playlist-hover-btn');
  const bookmarkIcon = bookmarkBtn?.querySelector('i');

  // Need videoId, videoTitle, channelName, thumbnailUrl in dataset
  card.dataset.videoId = video.id;
  card.dataset.videoTitle = video.title || 'Untitled';
  card.dataset.channelName = video.channelName || 'Unknown Channel';
  card.dataset.thumbnailUrl = video.thumbnailUrl || '/img/default-video.png';

  if (bookmarkBtn && bookmarkIcon && window.toggleVideoInDefaultPlaylist) {
    // Set initial icon state and visibility
    if (window.isVideoInDefaultPlaylist && window.isVideoInDefaultPlaylist(card.dataset.videoId)) {
      bookmarkIcon.className = 'fas fa-bookmark'; // Solid bookmark
      bookmarkBtn.title = "Remove from Watch Later";
      bookmarkBtn.classList.add('visible'); // Make visible
    } else {
      bookmarkIcon.className = 'far fa-bookmark'; // Ensure default classes
      bookmarkBtn.title = "Add to Watch Later";
      bookmarkBtn.classList.remove('visible'); // Ensure hidden
    }

    bookmarkBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const currentIconClass = bookmarkIcon.className;
      const wasVisible = bookmarkBtn.classList.contains('visible');
      bookmarkIcon.className = 'fas fa-spinner fa-spin'; // Show loading
      bookmarkBtn.disabled = true;
      bookmarkBtn.classList.add('visible'); // Keep visible during load

      try {
        const isInPlaylist = await window.toggleVideoInDefaultPlaylist(card.dataset);
        if (isInPlaylist) {
          bookmarkIcon.className = 'fas fa-bookmark'; // Solid bookmark
          bookmarkBtn.title = "Remove from Watch Later";
          bookmarkBtn.classList.add('visible');
        } else {
          bookmarkIcon.className = 'far fa-bookmark';
          bookmarkBtn.title = "Add to Watch Later";
          bookmarkBtn.classList.remove('visible');
        }
      } catch (error) {
        showError(`Failed to update Watch Later: ${error.message}`);
        bookmarkIcon.className = currentIconClass; // Revert icon on error
        if (wasVisible) bookmarkBtn.classList.add('visible'); else bookmarkBtn.classList.remove('visible'); // Revert visibility
      } finally {
        bookmarkBtn.disabled = false;
      }
    });
  }

  if (addToPlaylistBtn && window.handleAddToPlaylistClick) {
    addToPlaylistBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.handleAddToPlaylistClick(card.dataset);
    });
  }
  // --- End Hover Icon Listeners ---

  return card;
}