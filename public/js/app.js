// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const content = document.getElementById('content');

// Remove definitions for elements inside the player overlay
/*
const videoPlayer = document.getElementById('videoPlayer');
const playerContainer = document.getElementById('player');
const videoAreaContainer = document.getElementById('videoAreaContainer');
const customControls = document.getElementById('customControls');
const closePlayer = document.getElementById('closePlayer'); // Keep this? No, get it inside closeVideoPlayer
const videoTitle = document.getElementById('videoTitle');
const channelAvatar = document.getElementById('channelAvatar');
const channelName = document.getElementById('channelName');
const videoDescription = document.getElementById('videoDescription');
const subscriberCount = document.getElementById('subscriberCount');
const viewCount = document.getElementById('viewCount');
const uploadDate = document.getElementById('uploadDate');
const commentsList = document.getElementById('commentsList');
const loadMoreComments = document.getElementById('loadMoreComments');
const chaptersAccordion = document.getElementById('chaptersAccordion');
const chaptersHeader = document.getElementById('chaptersHeader');
const currentChapterTitle = document.getElementById('currentChapterTitle');
const chapterToggleIcon = document.getElementById('chapterToggleIcon');
const chaptersList = document.getElementById('chaptersList');
const playPauseBtn = document.getElementById('playPauseBtn');
const progressBar = document.getElementById('progressBar');
const progress = document.getElementById('progress');
const currentTime = document.getElementById('currentTime');
const duration = document.getElementById('duration');
const volumeBtn = document.getElementById('volumeBtn');
const volumeSlider = document.getElementById('volumeSlider');
const volumeLevel = document.getElementById('volumeLevel');
const playbackSpeedBtn = document.getElementById('playbackSpeedBtn');
const speedOptions = document.getElementById('speedOptions');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const theaterModeBtn = document.getElementById('theaterModeBtn');
const qualityBtn = document.getElementById('qualityBtn');
*/

// Global variables / State
let currentVideoId = null;
let commentsNextPage = null;
let ytPlayer = null;
let progressTimer = null;
let sponsorSegments = [];
let videoChapters = [];
let playerResizeObserver = null; // Add ResizeObserver state
let keydownHandler = null; // Store the handler reference
let keydownAttached = false; // Track if the listener is attached

// === DEFINE GLOBAL FUNCTION EARLY ===
// Make videoCardElement optional and default to null
window.loadAndDisplayVideo = async function (videoId, videoCardElement = null) {
  // Get player overlay elements dynamically
  const videoPlayer = document.getElementById('videoPlayer');
  const channelAvatar = document.getElementById('channelAvatar');
  const uploadDate = document.getElementById('uploadDate');
  const videoTitle = document.getElementById('videoTitle');
  const channelName = document.getElementById('channelName');
  const subscriberCount = document.getElementById('subscriberCount');
  const viewCount = document.getElementById('viewCount');
  const videoDescription = document.getElementById('videoDescription');
  const commentsList = document.getElementById('commentsList'); // Needed for loadComments
  const loadMoreComments = document.getElementById('loadMoreComments'); // Needed for loadComments

  if (!videoPlayer) {
    console.error('Video player element not found!');
    return;
  }

  try {
    showLoading();
    currentVideoId = videoId;
    document.body.classList.add('overflow-hidden');

    // --- Get and display date from card immediately (check if card exists) ---
    const uploadedDateFromCard = videoCardElement?.dataset?.uploadedat;
    if (uploadedDateFromCard && uploadDate) {
      uploadDate.textContent = uploadedDateFromCard;
    } else if (uploadDate) {
      // Clear or set default if no card info
      uploadDate.textContent = '';
    }

    // --- Get avatar from card if available (check if card exists) ---
    const channelAvatarElement = videoCardElement?.querySelector('img[alt*="avatar"]');
    const channelAvatarUrlFromCard = channelAvatarElement?.src;
    if (channelAvatar && channelAvatarUrlFromCard && (channelAvatarUrlFromCard.startsWith('http') || channelAvatarUrlFromCard.startsWith('/'))) {
      channelAvatar.src = channelAvatarUrlFromCard;
    } else if (channelAvatar) {
      channelAvatar.src = '/img/default-avatar.svg'; // Fallback
    }
    // --- End immediate avatar display ---

    // Get video details
    const detailsResponse = await fetch(`/api/video/${videoId}`);
    if (!detailsResponse.ok) {
      const errorData = await detailsResponse.json();
      throw new Error(errorData.error || `Failed to fetch video details: ${detailsResponse.status}`);
    }
    const videoDetails = await detailsResponse.json();

    // Store chapters globally for this video
    videoChapters = videoDetails.chapters || [];

    // Update video info UI (with null checks for elements)
    if (videoTitle) videoTitle.textContent = videoDetails.title || 'Unknown';
    if (channelName) channelName.textContent = videoDetails.author?.name || 'Unknown';
    if (channelName) channelName.href = videoDetails.author?.id ? `/channel/${videoDetails.author.id}` : '#';

    // Update avatar if details provide a better one (or if no card info was used)
    if (channelAvatar && (!channelAvatarUrlFromCard || videoDetails.author?.thumbnails?.[0]?.url)) {
      channelAvatar.src = videoDetails.author?.thumbnails?.[0]?.url || '/img/default-avatar.svg';
    }

    if (subscriberCount) subscriberCount.textContent = videoDetails.author?.subscriber_count || '';
    if (viewCount) viewCount.textContent = videoDetails.view_count || '0 views';
    if (videoDescription) videoDescription.textContent = videoDetails.description || '';

    // Update upload date only if needed (with null check and if not set from card)
    if (!uploadedDateFromCard && videoDetails.published && uploadDate) {
      uploadDate.textContent = videoDetails.published;
    } else if (!uploadedDateFromCard && uploadDate) {
      uploadDate.textContent = 'Unknown date'; // Set fallback if no info
    }

    // Load comments (passing the dynamically fetched elements)
    await loadComments(videoId, null, commentsList, loadMoreComments);

    // Fetch and display recommended videos
    fetchRecommendedVideos(videoId);

    // Show video player
    videoPlayer.classList.remove('hidden');

    // Fetch SponsorBlock data
    fetchSponsorBlockSegments(videoId);

    // Initialize YouTube player
    initializePlayer(videoId);

    // Setup comments listener after player is ready
    setupLoadMoreCommentsListener(); // Ensure this is called

  } catch (error) {
    showError(`Failed to play video: ${error.message}`);
    console.error('Playback error:', error);
    // Clean up if loading fails
    closeVideoPlayer(); // Ensure player closes on error
  } finally {
    hideLoading();
  }
}
console.log("app.js: window.loadAndDisplayVideo defined", typeof window.loadAndDisplayVideo);
// Define colors for different segment types
const segmentColors = {
  sponsor: 'rgba(239, 68, 68, 0.6)', // Red
  selfpromo: 'rgba(34, 197, 94, 0.6)', // Green
  interaction: 'rgba(59, 130, 246, 0.6)', // Blue
  intro: 'rgba(168, 85, 247, 0.6)', // Purple
  outro: 'rgba(168, 85, 247, 0.6)', // Purple (same as intro)
  preview: 'rgba(245, 158, 11, 0.6)', // Amber
  music_offtopic: 'rgba(234, 179, 8, 0.6)', // Yellow
  poi_highlight: 'rgba(234, 179, 8, 0.6)', // Yellow (Same as music_offtopic now)
  filler: 'rgba(107, 114, 128, 0.5)', // Gray
  // Add other categories if needed
};

// Event Listeners
// Check if elements exist before adding listeners
if (searchButton) {
  searchButton.addEventListener('click', performSearch);
}
if (searchInput) {
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });
}
if (closePlayer) {
  closePlayer.addEventListener('click', closeVideoPlayer);
}

// Initialize YouTube player
function onYouTubeIframeAPIReady() {
  // Player will be initialized when a video is selected
}

function initializePlayer(videoId) {
  const playerContainer = document.getElementById('player');
  const videoPlayerOverlay = document.getElementById('videoPlayer');
  const customControls = document.getElementById('customControls'); // Get controls container

  if (!playerContainer || !videoPlayerOverlay) {
    console.error("Player container (#player) or overlay (#videoPlayer) element not found!");
    return;
  }

  // Ensure the overlay container is visible
  console.log("initializePlayer: Ensuring #videoPlayer overlay is visible.");
  videoPlayerOverlay.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');

  // --- Destroy old player and cleanup listeners ---
  if (ytPlayer) {
    console.log("initializePlayer: Destroying previous player instance.");
    ytPlayer.destroy();
    ytPlayer = null;
  }
  if (playerResizeObserver && playerContainer) {
    console.log("initializePlayer: Disconnecting previous ResizeObserver.");
    playerResizeObserver.unobserve(playerContainer);
    playerResizeObserver.disconnect();
    playerResizeObserver = null;
  }
  // Remove keyboard listener if it was attached
  if (keydownAttached) {
    console.log("initializePlayer: Removing previous keydown listener.");
    document.removeEventListener('keydown', handleKeydown);
    keydownAttached = false;
  }
  // --- End destroy and cleanup ---

  // --- Clear the player container ---
  console.log("initializePlayer: Clearing inner HTML of #player container.");
  playerContainer.innerHTML = ''; // The container now only has the ID 'player'

  // --- Disable controls visually/functionally until ready ---
  if (customControls) {
    console.log("initializePlayer: Temporarily disabling custom controls.");
    customControls.classList.add('pointer-events-none', 'opacity-50');
  }

  console.log(`initializePlayer: Creating new YT.Player for videoId: ${videoId}`);
  // *** Use the ID string 'player' ***
  ytPlayer = new YT.Player('player', {
    videoId: videoId,
    playerVars: {
      'playsinline': 1,
      'controls': 0,
      'disablekb': 1,
      'rel': 0,
      'modestbranding': 1,
      'showinfo': 0,
      'iv_load_policy': 3,
      'fs': 0, // Disable fullscreen button since we have our own
      'autoplay': 1, // Enable autoplay
      // 'mute': 1, // Let's try unmuted autoplay first now
      'enablejsapi': 1, // Enable JS API
      'origin': window.location.origin, // Set origin for security
      'widget_referrer': window.location.href, // Set referrer
      'autohide': 1 // Hide YouTube controls
      // Note: 'onReady', 'onStateChange', etc. are passed in the 'events' object now
    },
    events: {
      'onReady': onPlayerReady, // This will re-enable controls/listeners
      'onStateChange': onPlayerStateChange,
      'onError': onPlayerError,
      'onPlaybackQualityChange': onPlaybackQualityChange
    }
  });

  // Do NOT setup controls or listeners here anymore

  // Set up ResizeObserver AFTER player object is created
  if ('ResizeObserver' in window) {
    console.log("initializePlayer: Setting up new ResizeObserver.");
    playerResizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (ytPlayer && typeof ytPlayer.setSize === 'function') {
          const { width, height } = entry.contentRect;
          // Only resize if dimensions are valid and player exists
          if (width > 0 && height > 0) { // Check > 0 instead of >= 200 initially
            console.log(`ResizeObserver: Setting player size to ${width}x${height}`);
            ytPlayer.setSize(width, height);
          } else {
            // This log might still appear initially, but hopefully size updates later
            console.warn(`ResizeObserver: Calculated dimensions invalid (${width}x${height}). Not resizing yet.`);
          }
        }
      }
    });
    playerResizeObserver.observe(playerContainer);
  } else {
    console.warn('ResizeObserver not supported.');
  }
}

function onPlayerReady(event) {
  console.log("onPlayerReady: Player is ready. Setting up controls and listeners.");
  const playPauseBtn = document.getElementById('playPauseBtn');
  const customControls = document.getElementById('customControls'); // Get controls container

  // --- Re-enable controls ---
  if (customControls) {
    console.log("onPlayerReady: Re-enabling custom controls.");
    customControls.classList.remove('pointer-events-none', 'opacity-50');
  }

  // --- Setup Controls and Key Listener NOW ---
  setupCustomControls(); // Re-attach listeners inside this function
  if (!keydownAttached) {
    console.log("onPlayerReady: Attaching keydown listener.");
    document.addEventListener('keydown', handleKeydown);
    keydownAttached = true;
  }

  // Player is ready actions
  event.target.unMute(); // Unmute after autoplay likely worked
  updateVolumeUI();
  if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';

  displaySponsorSegments();
  displayChapters(videoChapters);
  updatePlaybackProgress();
  startProgressTimer();
  updateVolumeUI();

  // Get initial quality
  if (ytPlayer && typeof ytPlayer.getPlaybackQuality === 'function') {
    const qualityBtn = document.getElementById('qualityBtn'); // Get qualityBtn here
    const currentQuality = ytPlayer.getPlaybackQuality();
    console.log("Initial quality:", currentQuality);
    updateQualityDisplay(currentQuality, qualityBtn); // Pass qualityBtn
  }

  // Fallback time update
  setTimeout(() => {
    updatePlaybackProgress(); // Assumes this gets elements dynamically
    if (!progressTimer) {
      startProgressTimer();
    }
  }, 1000);
}

function onPlayerStateChange(event) {
  // Get elements dynamically
  const playPauseBtn = document.getElementById('playPauseBtn');
  const progress = document.getElementById('progress');
  const currentTime = document.getElementById('currentTime');

  // First update the play/pause button
  switch (event.data) {
    case YT.PlayerState.PLAYING:
      if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
      // Update immediately when playing starts
      updatePlaybackProgress(); // Assumes dynamic elements
      updateVolumeUI(); // Assumes dynamic elements
      // Then start the timer
      startProgressTimer();
      break;
    case YT.PlayerState.PAUSED:
      if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      // Update immediately when paused
      updatePlaybackProgress(); // Assumes dynamic elements
      // Then stop the timer
      stopProgressTimer();
      break;
    case YT.PlayerState.ENDED:
      if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      // Update immediately when ended
      updatePlaybackProgress(); // Assumes dynamic elements
      // Then stop the timer
      stopProgressTimer();
      // Reset progress to 0% visually on end
      if (progress) progress.style.width = '0%';
      if (currentTime) currentTime.textContent = formatTime(0);
      // Optionally reset chapter display
      updateCurrentChapterUI(0, videoChapters); // Assumes dynamic elements
      break;
    case YT.PlayerState.BUFFERING:
      // For buffering, keep the timer running if it's not already
      if (progressTimer === null) {
        startProgressTimer();
      }
      break;
  }
}

function startProgressTimer() {
  // First stop any existing timer
  stopProgressTimer();

  // Only start timer if player is initialized and ready
  if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
    // Update more frequently for smoother time display
    progressTimer = setInterval(updatePlaybackProgress, 250);
  }
}

function stopProgressTimer() {
  // Only try to clear if the timer exists
  if (progressTimer !== null) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function setupCustomControls() {
  if (!ytPlayer) return;

  // Get elements dynamically
  const playPauseBtn = document.getElementById('playPauseBtn');
  const progressBar = document.getElementById('progressBar');
  const volumeBtn = document.getElementById('volumeBtn');
  const volumeSlider = document.getElementById('volumeSlider');
  const playbackSpeedBtn = document.getElementById('playbackSpeedBtn');
  const speedOptions = document.getElementById('speedOptions');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const theaterModeBtn = document.getElementById('theaterModeBtn');
  const chaptersHeader = document.getElementById('chaptersHeader');

  // Play/Pause
  if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);

  // Progress bar
  if (progressBar) {
    progressBar.addEventListener('click', seek);
    progressBar.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (e.changedTouches && e.changedTouches[0]) {
        const touchEvent = {
          clientX: e.changedTouches[0].clientX,
          clientY: e.changedTouches[0].clientY
        };
        seek(touchEvent); // Pass the event, seek will get progressBar again
      }
    });
  }

  // Volume control
  if (volumeBtn) volumeBtn.addEventListener('click', toggleMute);
  if (volumeSlider) volumeSlider.addEventListener('click', updateVolume);

  // Playback speed
  if (speedOptions) {
    const speedItems = speedOptions.querySelectorAll('[data-speed]');
    speedItems.forEach(item => {
      item.addEventListener('click', () => {
        const speed = parseFloat(item.dataset.speed);
        if (ytPlayer) ytPlayer.setPlaybackRate(speed);
        if (playbackSpeedBtn) playbackSpeedBtn.innerHTML = `${speed}x`;
        speedOptions.classList.add('hidden');
      });
    });
  }

  if (playbackSpeedBtn && speedOptions) {
    playbackSpeedBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      speedOptions.classList.toggle('hidden');
    });

    // Close speed options if clicking outside
    document.addEventListener('click', (event) => {
      if (!playbackSpeedBtn.contains(event.target) && !speedOptions.contains(event.target)) {
        speedOptions.classList.add('hidden');
      }
    });
  }

  // Fullscreen
  if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);

  // Theater Mode
  if (theaterModeBtn) theaterModeBtn.addEventListener('click', toggleTheaterMode);

  // Chapters Accordion Toggle
  if (chaptersHeader) chaptersHeader.addEventListener('click', toggleChaptersAccordion);
}

function updatePlaybackProgress() {
  // Get elements dynamically
  const currentTime = document.getElementById('currentTime');
  const duration = document.getElementById('duration');
  const progress = document.getElementById('progress');

  if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;

  try {
    const currentVideoTime = ytPlayer.getCurrentTime() || 0;
    const totalDuration = ytPlayer.getDuration() || 0;

    // --- SponsorBlock Skip Logic ---
    if (sponsorSegments && sponsorSegments.length > 0 && totalDuration > 0) {
      const sponsorCategory = 'sponsor'; // Category to skip
      for (const segment of sponsorSegments) {
        if (segment.category === sponsorCategory) {
          const startTime = segment.segment[0];
          const endTime = segment.segment[1];
          // Check if current time is within a sponsor segment (add a small buffer to prevent loops)
          if (currentVideoTime >= startTime && currentVideoTime < endTime - 0.1) {
            console.log(`SponsorBlock: Skipping segment from ${formatTime(startTime)} to ${formatTime(endTime)}`);
            ytPlayer.seekTo(endTime, true);
            // Update UI immediately after skipping
            currentTime.textContent = formatTime(endTime);
            const progressPercent = (endTime / totalDuration) * 100;
            progress.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`;
            return; // Exit early after skipping
          }
        }
      }
    }
    // --- End SponsorBlock Skip Logic ---

    // Update current time display
    if (currentTime) currentTime.textContent = formatTime(currentVideoTime);

    // Update duration display
    if (totalDuration > 0) {
      if (duration) duration.textContent = formatTime(totalDuration);
    } else {
      if (duration) duration.textContent = 'LIVE';
    }

    // Update progress bar width
    if (progress && !isNaN(currentVideoTime) && !isNaN(totalDuration) && totalDuration > 0) {
      const progressPercent = (currentVideoTime / totalDuration) * 100;
      progress.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`;
    } else if (progress) {
      progress.style.width = '100%';
    }

    // Update current chapter UI
    updateCurrentChapterUI(currentVideoTime, videoChapters); // Assumes dynamic elements

  } catch (error) {
    console.error('Error updating playback progress:', error);
  }
}

function seek(event) {
  // Get progressBar dynamically
  const progressBar = document.getElementById('progressBar');
  if (!progressBar || !ytPlayer || typeof ytPlayer.getDuration !== 'function') return;

  const rect = progressBar.getBoundingClientRect();
  const pos = (event.clientX - rect.left) / rect.width;
  const durationVal = ytPlayer.getDuration(); // Use different var name

  if (durationVal && durationVal > 0) {
    const seekTime = pos * durationVal;
    ytPlayer.seekTo(seekTime, true);
    setTimeout(() => {
      updatePlaybackProgress(); // Assumes dynamic elements
      if (progressTimer === null) {
        startProgressTimer();
      }
    }, 50);
  }
}

function togglePlayPause() {
  if (!ytPlayer) return;

  const state = ytPlayer.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    ytPlayer.pauseVideo();
  } else {
    ytPlayer.playVideo();
  }
}

function toggleMute() {
  // Get volumeBtn dynamically
  const volumeBtn = document.getElementById('volumeBtn');
  if (!ytPlayer) return;

  if (ytPlayer.isMuted()) {
    ytPlayer.unMute();
  } else {
    ytPlayer.mute();
  }

  setTimeout(updateVolumeUI, 50); // updateVolumeUI needs fixing
}

function updateVolume(event) {
  // Get volumeSlider dynamically
  const volumeSlider = document.getElementById('volumeSlider');
  if (!volumeSlider || !ytPlayer) return;

  const rect = volumeSlider.getBoundingClientRect();
  const volume = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));

  ytPlayer.setVolume(volume * 100);

  // Update slider level UI dynamically
  const volumeLevel = document.getElementById('volumeLevel');
  if (volumeLevel) volumeLevel.style.width = `${volume * 100}%`;

  updateVolumeUI(); // Needs fixing
}

function updateVolumeUI() {
  // Get elements dynamically
  const volumeBtn = document.getElementById('volumeBtn');
  const volumeLevel = document.getElementById('volumeLevel');
  if (!volumeBtn || !volumeLevel || !ytPlayer) return;

  const isMuted = ytPlayer.isMuted();
  const volume = ytPlayer.getVolume() / 100;

  // Update icon
  if (isMuted || volume === 0) {
    volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
  } else if (volume < 0.5) {
    volumeBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
  } else {
    volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
  }

  // Update volume level color
  volumeLevel.style.backgroundColor = isMuted ? '#ef4444' : '#38a169';
}

function toggleFullscreen() {
  // Get elements dynamically
  const playerElement = document.getElementById('player'); // This is the container
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  if (!playerElement || !fullscreenBtn) return;

  if (document.fullscreenElement) {
    document.exitFullscreen();
    fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
  } else {
    playerElement.requestFullscreen(); // Request fullscreen on the container
    fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
  }
}

function toggleTheaterMode() {
  // Get elements dynamically
  const videoPlayer = document.getElementById('videoPlayer');
  const theaterModeBtn = document.getElementById('theaterModeBtn');
  if (!videoPlayer || !theaterModeBtn) return;

  videoPlayer.classList.toggle('theater-mode');

  if (videoPlayer.classList.contains('theater-mode')) {
    theaterModeBtn.innerHTML = '<i class="fas fa-compress-alt"></i>';
  } else {
    theaterModeBtn.innerHTML = '<i class="fas fa-film"></i>';
  }
}

function formatTime(seconds) {
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

// Search Functions
async function performSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  // Check if we are on the main page (has #content)
  const mainContentElement = document.getElementById('content');

  if (mainContentElement) {
    // We are on the index page, perform search and display results here
    try {
      showLoading();
      const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
      const data = await response.json();
      displayResults(data, mainContentElement); // Pass the content element
    } catch (error) {
      console.error('Search error:', error);
      // Use mainContentElement here as well
      mainContentElement.innerHTML = '<div class="col-span-full text-center py-10 text-red-600">Search failed. Please try again.</div>';
    } finally {
      hideLoading();
    }
  } else {
    // Not on the index page (e.g., channel page), redirect to index with query
    console.log('Redirecting to index page for search...');
    window.location.href = `/?query=${encodeURIComponent(query)}`;
  }
}

function displayResults(results, targetElement) {
  targetElement.innerHTML = ''; // Use the passed element

  if (!results || !results.length) {
    targetElement.innerHTML = '<div class="col-span-full text-center py-10 text-gray-600">No results found</div>'; // Use the passed element
    return;
  }

  results.forEach(video => {
    const card = createVideoCard(video);
    targetElement.appendChild(card); // Use the passed element
  });
}

function createVideoCard(video) {
  const card = document.createElement('div');
  card.className = 'video-card bg-zinc-800 rounded-lg shadow-md overflow-hidden cursor-pointer';

  // Get thumbnail URL
  const thumbnail = video.thumbnails?.[0]?.url || '/img/default-video.png';

  // Get channel avatar URL
  const channelAvatarUrl = video.channel?.avatar?.[0]?.url || '/img/default-avatar.svg';

  // Get duration (already formatted from server)
  const duration = video.duration || '0:00';

  // Get view count (already formatted from server)
  const views = video.viewCount || '0 views';

  // Get upload date
  const uploadedAt = video.uploadedAt || 'Unknown date';

  // Add data attribute
  card.dataset.uploadedat = uploadedAt;

  // Update onclick to pass the card element AND the avatar URL
  card.onclick = () => playVideo(video.id, card, channelAvatarUrl);

  // Get channel name with verified badge if applicable
  const channelNameText = video.channel?.name || 'Unknown'; // Use Text for display
  const channelId = video.channel?.id; // Get channel ID
  const verifiedBadge = video.channel?.verified ?
    '<i class="fas fa-check-circle text-green-500 ml-1 text-xs" title="Verified Channel"></i>' :
    '';

  // Construct channel link if ID exists
  const channelLinkContent = channelId ?
    `<a href="/channel/${channelId}" class="hover:text-green-500 truncate" onclick="event.stopPropagation();">${channelNameText}${verifiedBadge}</a>` :
    `<span class="truncate">${channelNameText}${verifiedBadge}</span>`; // Non-clickable if no ID

  card.innerHTML = `
        <div class="video-thumbnail">
            <img src="${thumbnail}" alt="${video.title}" loading="lazy" class="w-full h-full object-cover">
            <span class="video-duration">${duration}</span>
        </div>
        <div class="p-3">
            <h3 class="font-semibold text-zinc-100 line-clamp-2 mb-2 text-sm">${video.title || 'Untitled'}</h3>
            <div class="flex items-center mt-1">
                <img src="${channelAvatarUrl}" alt="${channelNameText}" class="w-8 h-8 rounded-full mr-2 flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center text-zinc-300 text-xs">
                      ${channelLinkContent}
                    </div>
                    <div class="video-meta text-zinc-400 text-xs mt-0.5">
                        <span>${views}</span>
                        <span>${uploadedAt}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

  return card;
}

// Existing function now calls the new global one
async function playVideo(videoId, videoCardElement) {
  window.loadAndDisplayVideo(videoId, videoCardElement);
}

async function loadComments(videoId, continuation = null, commentsList, loadMoreComments) { // Accept elements as args
  // Check if elements were passed
  if (!commentsList || !loadMoreComments) {
    console.error("Comments list or load more button element not provided to loadComments");
    return;
  }
  try {
    const url = continuation
      ? `/api/comments/${videoId}?continuation=${continuation}`
      : `/api/comments/${videoId}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data || !data.comments) {
      console.error('Invalid comment data received:', data);
      return;
    }

    if (!continuation) {
      commentsList.innerHTML = ''; // Clear existing comments if this is the first load
    }

    // Add new comments
    data.comments.forEach(comment => {
      const commentElement = createCommentElement(comment);
      commentsList.appendChild(commentElement);
    });

    // Update next page token and show/hide load more button
    commentsNextPage = data.continuation;
    loadMoreComments.style.display = data.continuation ? 'block' : 'none';

    sponsorSegments = []; // Clear segments
    clearSponsorMarkers(); // Clear visual markers
  } catch (error) {
    console.error('Failed to load comments:', error);
    commentsList.innerHTML = '<div class="text-center py-4 text-gray-500">Failed to load comments</div>';
    loadMoreComments.style.display = 'none';
  }
}

function createCommentElement(comment) {
  const div = document.createElement('div');
  div.className = 'flex space-x-3';

  // Use safe property access with fallbacks for all values
  const avatar = comment.author?.thumbnails?.[0]?.url || '';
  const authorName = comment.author?.name || 'Unknown';

  // Handle different content formats from the API
  const content = typeof comment.content === 'string'
    ? comment.content
    : typeof comment.content === 'object' && comment.content?.text
      ? comment.content.text
      : '';

  const publishedTime = comment.published || '';
  const likeCount = comment.like_count || '0';

  div.innerHTML = `
    <img src="${avatar}" alt="${authorName}" class="w-10 h-10 rounded-full">
    <div class="flex-1">
      <div class="flex items-center mb-1">
        <a href="#" class="font-medium text-zinc-100 hover:text-green-500 mr-2">${authorName}</a>
        <span class="text-zinc-400 text-sm">${publishedTime}</span>
      </div>
      <p class="text-zinc-200">${content}</p>
      <div class="flex items-center mt-2 text-zinc-400 text-sm">
        <button class="flex items-center hover:text-zinc-300">
          <i class="fas fa-thumbs-up mr-1"></i>
          <span>${likeCount}</span>
        </button>
      </div>
    </div>
  `;

  return div;
}

// Add event listener for load more comments button
// This needs to be added dynamically when the button is present
// Maybe call this from loadAndDisplayVideo?
function setupLoadMoreCommentsListener() {
  const loadMoreCommentsBtn = document.getElementById('loadMoreComments');
  const commentsListEl = document.getElementById('commentsList');
  if (loadMoreCommentsBtn && commentsListEl) {
    loadMoreCommentsBtn.addEventListener('click', () => {
      if (currentVideoId && commentsNextPage) {
        loadComments(currentVideoId, commentsNextPage, commentsListEl, loadMoreCommentsBtn);
      }
    });
  }
}

function closeVideoPlayer() {
  // Get elements dynamically
  const videoPlayer = document.getElementById('videoPlayer');
  const playerContainer = document.getElementById('player'); // Needed for observer
  const commentsList = document.getElementById('commentsList');
  const loadMoreComments = document.getElementById('loadMoreComments');
  const qualityBtn = document.getElementById('qualityBtn');
  const recommendedContainer = document.getElementById('recommendedVideos')?.querySelector('.space-y-3'); // Get rec container

  // Disconnect observer when closing player
  if (playerResizeObserver && playerContainer) {
    playerResizeObserver.unobserve(playerContainer);
    playerResizeObserver.disconnect();
    playerResizeObserver = null;
  }

  if (ytPlayer) {
    ytPlayer.destroy();
    ytPlayer = null;
  }
  if (videoPlayer) videoPlayer.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  currentVideoId = null;
  commentsNextPage = null;
  if (commentsList) commentsList.innerHTML = '';
  if (loadMoreComments) loadMoreComments.style.display = 'none';
  clearSponsorMarkers(); // Assumes this gets its element dynamically or doesn't need one
  clearChapters(); // Assumes this gets its elements dynamically
  videoChapters = [];
  if (qualityBtn) qualityBtn.textContent = 'Auto';
  if (recommendedContainer) recommendedContainer.innerHTML = ''; // Clear recommendations

  // Remove keyboard listener if attached
  if (keydownAttached) {
    console.log("closeVideoPlayer: Removing keydown listener.");
    document.removeEventListener('keydown', handleKeydown);
    keydownAttached = false;
  }
}

// Utility Functions
function formatDuration(seconds) {
  if (!seconds) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${padZero(minutes)}:${padZero(secs)}`;
  }
  return `${minutes}:${padZero(secs)}`;
}

function padZero(num) {
  return num.toString().padStart(2, '0');
}

function formatViews(views) {
  if (!views) return '0 views';

  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M views`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K views`;
  }
  return `${views} views`;
}

function showLoading() {
  const loader = document.createElement('div');
  loader.className = 'loading';
  loader.id = 'loader';
  document.body.appendChild(loader);
}

function hideLoading() {
  const loader = document.getElementById('loader');
  if (loader) loader.remove();
}

function showError(message) {
  const error = document.createElement('div');
  error.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg';
  error.textContent = message;
  document.body.appendChild(error);
  setTimeout(() => error.remove(), 3000);
}

// Add player error handling
function onPlayerError(event) {
  console.error('YouTube player error:', event.data);
  showError('Video playback error. Please try again.');
}

// --- SponsorBlock Fetch Function ---

async function fetchSponsorBlockSegments(videoId) {
  try {
    // Request more categories
    const categories = ["sponsor", "selfpromo", "interaction", "intro", "outro", "preview", "music_offtopic", "poi_highlight", "filler"];
    const apiUrl = `https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=${JSON.stringify(categories)}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      // Don't throw an error, just log it. SB might not have data.
      console.log(`SponsorBlock: No segments found or API error for ${videoId} (${response.status})`);
      sponsorSegments = [];
      clearSponsorMarkers(); // Clear any old markers
      return;
    }
    sponsorSegments = await response.json();
    console.log(`SponsorBlock: ${sponsorSegments.length} segments found for ${videoId}`);
  } catch (error) {
    console.error('Failed to fetch SponsorBlock segments:', error);
    sponsorSegments = [];
    clearSponsorMarkers(); // Clear any old markers
  }
}

function displaySponsorSegments() {
  const markersContainer = document.getElementById('segmentMarkers');
  if (!markersContainer || !ytPlayer || typeof ytPlayer.getDuration !== 'function') return;

  const duration = ytPlayer.getDuration();
  if (!duration || duration <= 0) {
    console.log("SponsorBlock Display: Cannot display markers, invalid duration:", duration);
    return;
  }

  clearSponsorMarkers(); // Clear existing markers first

  if (sponsorSegments && sponsorSegments.length > 0) {
    sponsorSegments.forEach(segment => {
      const startTime = segment.segment[0];
      const endTime = segment.segment[1];
      const category = segment.category;

      const startPercent = (startTime / duration) * 100;
      const widthPercent = ((endTime - startTime) / duration) * 100;

      const marker = document.createElement('div');
      marker.className = 'segment-marker';
      marker.style.left = `${startPercent}%`;
      marker.style.width = `${widthPercent}%`;
      marker.style.backgroundColor = segmentColors[category] || segmentColors['filler']; // Use filler as default
      marker.title = `${category}: ${formatTime(startTime)} - ${formatTime(endTime)}`;

      markersContainer.appendChild(marker);
    });
    console.log(`SponsorBlock Display: Added ${sponsorSegments.length} segment markers.`);
  } else {
    console.log("SponsorBlock Display: No segments to display.");
  }
}

function clearSponsorMarkers() {
  const markersContainer = document.getElementById('segmentMarkers');
  if (markersContainer) {
    markersContainer.innerHTML = ''; // Remove all child elements
  }
}

function displayChapters(chapters) {
  const chaptersAccordion = document.getElementById('chaptersAccordion');
  const chaptersList = document.getElementById('chaptersList');
  const chaptersHeader = document.getElementById('chaptersHeader');
  const progressBar = document.getElementById('progressBar'); // Get progress bar here
  const chapterToggleIcon = document.getElementById('chapterToggleIcon'); // Get toggle icon

  if (!chaptersAccordion || !chaptersList || !chaptersHeader || !progressBar || !chapterToggleIcon) {
    console.warn("Chapter UI elements not found. Cannot display chapters.");
    return;
  }

  clearChapters(); // Assumes dynamic elements

  if (!chapters || chapters.length === 0 || !ytPlayer || typeof ytPlayer.getDuration !== 'function') {
    console.log("No chapters available or player not ready for this video.");
    chaptersAccordion.classList.add('hidden');
    return;
  }

  const duration = ytPlayer.getDuration();
  if (!duration || duration <= 0) {
    console.warn("Cannot display chapter markers, invalid video duration:", duration);
    chaptersAccordion.classList.add('hidden');
    return;
  }

  console.log(`Displaying ${chapters.length} chapters.`);
  chaptersAccordion.classList.remove('hidden'); // Show the accordion

  // Sort chapters just in case they aren't already
  const sortedChapters = chapters.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

  sortedChapters.forEach((chapter, index) => {
    const startTime = chapter.startTimeSeconds;

    // --- Create Chapter List Item ---
    const chapterItem = document.createElement('div');
    chapterItem.className = 'chapter-item flex items-center justify-between p-2 cursor-pointer hover:bg-zinc-700';
    chapterItem.dataset.startTime = startTime;

    const timeStr = formatTime(startTime);
    chapterItem.innerHTML = `
      <div class="flex items-center">
        <span class="chapter-time text-xs text-zinc-400 mr-2">${timeStr}</span>
        <span class="chapter-title text-sm text-zinc-200">${chapter.title || `Chapter ${index + 1}`}</span>
      </div>
      ${chapter.thumbnailUrl ? `<img src="${chapter.thumbnailUrl}" alt="${chapter.title}" class="w-16 h-9 object-cover rounded ml-2">` : ''}
    `;

    chapterItem.addEventListener('click', () => {
      if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
        ytPlayer.seekTo(startTime, true);
      }
    });
    chaptersList.appendChild(chapterItem);
    // --- End Chapter List Item ---

    // --- Create Chapter Marker on Progress Bar ---
    // Skip marker for the very first chapter (start time 0)
    if (startTime > 0) {
      const marker = document.createElement('div');
      marker.className = 'chapter-marker'; // Add class for styling and clearing
      const startPercent = (startTime / duration) * 100;
      marker.style.left = `${startPercent}%`;
      marker.title = `Chapter: ${chapter.title || `Chapter ${index + 1}`} (${timeStr})`; // Add tooltip
      // Append directly to progressBar, but behind the progress indicator
      progressBar.appendChild(marker);
    }
    // --- End Chapter Marker ---
  });

  // Initially hide the list and set the icon
  chaptersList.classList.add('hidden');
  chapterToggleIcon.classList.remove('fa-chevron-up');
  chapterToggleIcon.classList.add('fa-chevron-down');
}

function updateCurrentChapterUI(currentTime, chapters) {
  const chaptersList = document.getElementById('chaptersList');
  const currentChapterTitle = document.getElementById('currentChapterTitle');
  const chaptersAccordion = document.getElementById('chaptersAccordion');

  if (!chaptersList || !currentChapterTitle || !chaptersAccordion || chaptersAccordion.classList.contains('hidden')) {
    return;
  }

  if (!chapters || chapters.length === 0) {
    currentChapterTitle.textContent = ''; // Clear title if no chapters
    return;
  }

  let activeChapter = null;
  // Find the latest chapter whose start time is less than or equal to the current time
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (currentTime >= chapters[i].startTimeSeconds) {
      activeChapter = chapters[i];
      break;
    }
  }

  // Update the header title
  currentChapterTitle.textContent = activeChapter ? activeChapter.title : '';

  // Update active class in the list
  const chapterItems = chaptersList.querySelectorAll('.chapter-item');
  chapterItems.forEach(item => {
    const itemStartTime = parseFloat(item.dataset.startTime);
    if (activeChapter && itemStartTime === activeChapter.startTimeSeconds) {
      item.classList.add('active', 'bg-zinc-600'); // Add active styles
    } else {
      item.classList.remove('active', 'bg-zinc-600'); // Remove active styles
    }
  });
}

function toggleChaptersAccordion() {
  const chaptersList = document.getElementById('chaptersList');
  const chapterToggleIcon = document.getElementById('chapterToggleIcon');
  if (!chaptersList || !chapterToggleIcon) return;

  const isHidden = chaptersList.classList.toggle('hidden');
  if (isHidden) {
    chapterToggleIcon.classList.remove('fa-chevron-up');
    chapterToggleIcon.classList.add('fa-chevron-down');
  } else {
    chapterToggleIcon.classList.remove('fa-chevron-down');
    chapterToggleIcon.classList.add('fa-chevron-up');
    // Scroll the active chapter into view when opening
    const activeItem = chaptersList.querySelector('.chapter-item.active');
    if (activeItem) {
      activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

function clearChapters() {
  const chaptersAccordion = document.getElementById('chaptersAccordion');
  const chaptersList = document.getElementById('chaptersList');
  const currentChapterTitle = document.getElementById('currentChapterTitle');
  const chapterToggleIcon = document.getElementById('chapterToggleIcon');
  const progressBar = document.getElementById('progressBar');

  if (chaptersAccordion) chaptersAccordion.classList.add('hidden');
  if (chaptersList) chaptersList.innerHTML = '';
  if (currentChapterTitle) currentChapterTitle.textContent = '';
  if (chapterToggleIcon) {
    chapterToggleIcon.classList.remove('fa-chevron-up');
    chapterToggleIcon.classList.add('fa-chevron-down');
  }
  if (progressBar) {
    const existingMarkers = progressBar.querySelectorAll('.chapter-marker');
    existingMarkers.forEach(marker => marker.remove());
  }
}

// --- Keyboard Shortcuts ---

function handleKeydown(event) {
  const videoPlayer = document.getElementById('videoPlayer'); // Get this dynamically
  const speedOptions = document.getElementById('speedOptions'); // And this
  const volumeLevel = document.getElementById('volumeLevel'); // And this

  if (!ytPlayer || !videoPlayer || videoPlayer.classList.contains('hidden') ||
    ['INPUT', 'TEXTAREA'].includes(event.target.tagName) ||
    (speedOptions && !speedOptions.classList.contains('hidden'))) {
    return;
  }

  // Prevent default only for keys we handle explicitly
  let preventDefault = false;

  switch (event.key) {
    case ' ': // Space bar
      togglePlayPause();
      preventDefault = true;
      break;
    case 'ArrowLeft':
      if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
        const currentTime = ytPlayer.getCurrentTime() || 0;
        ytPlayer.seekTo(Math.max(0, currentTime - 5), true); // Seek back 5s
        preventDefault = true;
        // Optional: Force UI update sooner
        setTimeout(updatePlaybackProgress, 50);
      }
      break;
    case 'ArrowRight':
      if (ytPlayer && typeof ytPlayer.seekTo === 'function' && typeof ytPlayer.getDuration === 'function') {
        const currentTime = ytPlayer.getCurrentTime() || 0;
        const duration = ytPlayer.getDuration() || 0;
        ytPlayer.seekTo(Math.min(duration, currentTime + 5), true); // Seek forward 5s
        preventDefault = true;
        // Optional: Force UI update sooner
        setTimeout(updatePlaybackProgress, 50);
      }
      break;
    case 'ArrowUp':
      if (ytPlayer && typeof ytPlayer.setVolume === 'function' && typeof ytPlayer.getVolume === 'function') {
        const currentVolume = ytPlayer.getVolume();
        ytPlayer.setVolume(Math.min(100, currentVolume + 5)); // Increase volume by 5
        preventDefault = true;
        // Update UI immediately
        setTimeout(updateVolumeUI, 50);
        // Also update the slider position
        const newVolume = ytPlayer.getVolume() / 100;
        volumeLevel.style.width = `${newVolume * 100}%`;
      }
      break;
    case 'ArrowDown':
      if (ytPlayer && typeof ytPlayer.setVolume === 'function' && typeof ytPlayer.getVolume === 'function') {
        const currentVolume = ytPlayer.getVolume();
        ytPlayer.setVolume(Math.max(0, currentVolume - 5)); // Decrease volume by 5
        preventDefault = true;
        // Update UI immediately
        setTimeout(updateVolumeUI, 50);
        // Also update the slider position
        const newVolume = ytPlayer.getVolume() / 100;
        volumeLevel.style.width = `${newVolume * 100}%`;
      }
      break;
    case 't':
    case 'T':
      toggleTheaterMode();
      preventDefault = true;
      break;
    case 'f':
    case 'F':
      toggleFullscreen();
      preventDefault = true;
      break;
    case 'Escape':
      closeVideoPlayer();
      preventDefault = true; // Prevent any potential browser default for Escape
      break;
    // Add case for 'm' (mute/unmute) if desired
  }

  if (preventDefault) {
    event.preventDefault();
  }
}

// Keep: Handle actual quality change event from YouTube
function onPlaybackQualityChange(event) {
  console.log("Playback quality changed to:", event.data);
  const qualityBtn = document.getElementById('qualityBtn'); // Get button dynamically
  updateQualityDisplay(event.data, qualityBtn);
}

// New: Update the quality button display
function updateQualityDisplay(quality, qualityBtn) { // Accept button as arg
  if (!qualityBtn) return;
  // Map technical quality names to user-friendly labels
  const qualityMap = {
    'hd2160': '4K',
    'hd1440': '1440p',
    'hd1080': '1080p',
    'hd720': '720p',
    'large': '480p',
    'medium': '360p',
    'small': '240p',
    'tiny': '144p',
    'auto': 'Auto', // Keep 'auto' as is
    // Add others if necessary based on API response
  };
  qualityBtn.textContent = qualityMap[quality] || quality; // Fallback to raw quality name
}

// === Recommended Videos Functions ===
async function fetchRecommendedVideos(videoId) {
  const recommendedContainer = document.getElementById('recommendedVideos')?.querySelector('.space-y-3'); // Target the inner container
  if (!recommendedContainer) {
    console.error("Recommended videos container element not found!");
    return;
  }

  recommendedContainer.innerHTML = '<p class="text-zinc-400 text-sm">Loading recommendations...</p>'; // Show loading state

  try {
    const response = await fetch(`/api/video/${videoId}/recommendations`);
    if (!response.ok) {
      throw new Error(`Failed to fetch recommendations: ${response.status}`);
    }
    const recommendations = await response.json();
    displayRecommendedVideos(recommendations);
  } catch (error) {
    console.error('Failed to fetch or display recommendations:', error);
    recommendedContainer.innerHTML = '<p class="text-red-500 text-sm">Failed to load recommendations.</p>';
  }
}

function displayRecommendedVideos(videos) {
  const recommendedContainer = document.getElementById('recommendedVideos')?.querySelector('.space-y-3'); // Target the inner container
  if (!recommendedContainer) return;

  recommendedContainer.innerHTML = ''; // Clear loading/error message

  if (!videos || videos.length === 0) {
    recommendedContainer.innerHTML = '<p class="text-zinc-400 text-sm">No recommendations found.</p>';
    return;
  }

  videos.forEach(video => {
    const card = createRecommendedVideoCard(video);
    recommendedContainer.appendChild(card);
  });
}

function createRecommendedVideoCard(video) {
  const card = document.createElement('div');
  card.className = 'recommended-video-card'; // Use the new CSS class

  // Get thumbnail URL (prefer smaller ones if available)
  const thumbnail = video.thumbnails?.[0]?.url || '/img/default-video.png';

  // Get duration
  const duration = video.duration || '';

  // Get view count
  const views = video.viewCount || '';

  // Get upload date
  const uploadedAt = video.uploadedAt || '';

  // Get channel name and ID
  const channelNameText = video.channel?.name || 'Unknown';
  const channelId = video.channel?.id;

  // Make card clickable to load the video (pass null for element, as it's a recommendation card)
  card.onclick = () => window.loadAndDisplayVideo(video.id, null);

  card.innerHTML = `
    <div class="recommended-thumbnail">
      <img src="${thumbnail}" alt="${video.title}" loading="lazy" class="w-full h-auto object-cover rounded-md">
      ${duration ? `<span class="recommended-duration">${duration}</span>` : ''}
    </div>
    <div class="recommended-details">
      <h4 class="recommended-title">${video.title || 'Untitled'}</h4>
      <div class="recommended-channel">
        ${channelId ? `<a href="/channel/${channelId}" class="hover:text-green-500" onclick="event.stopPropagation();">${channelNameText}</a>` : `<span>${channelNameText}</span>`}
      </div>
      <div class="recommended-meta">
        ${views ? `<span>${views}</span>` : ''}
        ${uploadedAt ? `<span>${uploadedAt}</span>` : ''}
      </div>
    </div>
  `;

  return card;
}
// === End Recommended Videos Functions ===

document.addEventListener('DOMContentLoaded', () => {
  // Check for search query in URL on page load (specifically for index page)
  const urlParams = new URLSearchParams(window.location.search);
  const queryParam = urlParams.get('query');
  const searchInput = document.getElementById('searchInput'); // Get it here
  const content = document.getElementById('content'); // Check if we are on index

  if (queryParam && searchInput && content) {
    console.log('Found query parameter, performing search:', queryParam);
    searchInput.value = queryParam; // Populate the search bar
    performSearch(); // Trigger the search automatically
  }

  // --- Add IPC Listener ---
  if (window.electronAPI && typeof window.electronAPI.onVideoLoadRequest === 'function') {
    console.log('app.js: Setting up IPC listener for video load requests.');
    window.electronAPI.onVideoLoadRequest((videoId) => {
      console.log(`app.js: IPC Listener CALLBACK triggered with videoId: ${videoId}`);
      if (videoId && typeof videoId === 'string') {
        // Call the global function to load the video
        // Pass null for videoCardElement as it's not available here
        console.log(`app.js: Calling window.loadAndDisplayVideo with ID: ${videoId}`);
        try {
          window.loadAndDisplayVideo(videoId, null);
          console.log(`app.js: Successfully called window.loadAndDisplayVideo for ID: ${videoId}`);
        } catch (error) {
          console.error(`app.js: Error calling window.loadAndDisplayVideo for ID ${videoId}:`, error);
        }
      } else {
        console.error('app.js: Received invalid video ID via IPC:', videoId);
      }
    });
  } else {
    console.warn('app.js: electronAPI or onVideoLoadRequest not found. IPC listener not set up.');
  }
  // --- End IPC Listener ---

  // Add other initializations if needed
  console.log('DOM Loaded. app.js initialized.');
  console.log('Checking window.loadAndDisplayVideo on DOMContentLoaded:', typeof window.loadAndDisplayVideo);

});