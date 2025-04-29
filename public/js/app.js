// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const content = document.getElementById('content');
const videoPlayer = document.getElementById('videoPlayer');
const playerContainer = document.getElementById('player');
const videoAreaContainer = document.getElementById('videoAreaContainer');
const customControls = document.getElementById('customControls');
const closePlayer = document.getElementById('closePlayer');
const videoTitle = document.getElementById('videoTitle');
const channelAvatar = document.getElementById('channelAvatar');
const channelName = document.getElementById('channelName');
const videoDescription = document.getElementById('videoDescription');
// const qualitySelect = document.getElementById('qualitySelect'); // Removed - Element missing in HTML
const subscriberCount = document.getElementById('subscriberCount');
const viewCount = document.getElementById('viewCount');
const uploadDate = document.getElementById('uploadDate');
const commentsList = document.getElementById('commentsList');
const loadMoreComments = document.getElementById('loadMoreComments');

// Chapter elements
const chaptersAccordion = document.getElementById('chaptersAccordion');
const chaptersHeader = document.getElementById('chaptersHeader');
const currentChapterTitle = document.getElementById('currentChapterTitle');
const chapterToggleIcon = document.getElementById('chapterToggleIcon');
const chaptersList = document.getElementById('chaptersList');

// Custom controls elements
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
const qualityBtn = document.getElementById('qualityBtn'); // Keep: Quality Button

// Global variables / State
let currentVideoId = null;
let commentsNextPage = null;
let ytPlayer = null;
let progressTimer = null;
let sponsorSegments = [];
let videoChapters = [];
let playerResizeObserver = null; // Add ResizeObserver state
let keydownHandler = null; // Store the handler reference

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
searchButton.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') performSearch();
});
closePlayer.addEventListener('click', closeVideoPlayer);

// Initialize YouTube player
function onYouTubeIframeAPIReady() {
  // Player will be initialized when a video is selected
}

function initializePlayer(videoId) {
  if (ytPlayer) {
    ytPlayer.destroy();
  }
  // Disconnect previous observer if it exists
  if (playerResizeObserver && playerContainer) {
    playerResizeObserver.unobserve(playerContainer);
    playerResizeObserver.disconnect();
    playerResizeObserver = null;
  }

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
      'mute': 1, // Initially mute (required for autoplay in most browsers)
      'enablejsapi': 1, // Enable JS API
      'origin': window.location.origin, // Set origin for security
      'widget_referrer': window.location.href, // Set referrer
      'autohide': 1, // Hide YouTube controls
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange,
      'onError': onPlayerError,
      'onPlaybackQualityChange': onPlaybackQualityChange // New: Add quality change listener
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange,
      'onError': onPlayerError,
      'onPlaybackQualityChange': onPlaybackQualityChange // New: Add quality change listener
    }
  });

  // Set up custom controls
  setupCustomControls();

  // Set up ResizeObserver AFTER player is created
  if ('ResizeObserver' in window) {
    playerResizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (ytPlayer && typeof ytPlayer.setSize === 'function') {
          const { width, height } = entry.contentRect;
          // Only resize if dimensions are valid and player exists
          if (width >= 200 && height >= 200) {
            ytPlayer.setSize(width, height);
          } else {
            console.warn(`ResizeObserver: Calculated dimensions too small (${width}x${height}). Not resizing.`);
          }
        }
      }
    });
    // Observe the container div the player iframe lives in
    if (playerContainer) {
      playerResizeObserver.observe(playerContainer);
    }
  } else {
    console.warn('ResizeObserver not supported. Player resizing might be suboptimal.');
    // Fallback? Maybe call setSize initially in onPlayerReady?
  }

  // Add keyboard listener only after player is ready and video is playing
  document.addEventListener('keydown', handleKeydown);
}

function onPlayerReady(event) {
  // Player is ready
  event.target.playVideo(); // Ensure video starts playing
  event.target.unMute(); // Unmute after autoplay starts
  updateVolumeUI();
  playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>'; // Update the play button to show pause

  // Attempt to display markers now that player is ready
  displaySponsorSegments();

  // Display chapters if available
  displayChapters(videoChapters); // Pass stored chapters

  // Initial update of time display, progress, and current chapter
  updatePlaybackProgress();

  // Start progress timer to continuously update
  startProgressTimer();

  // Update volume UI
  updateVolumeUI();

  // Get and display initial quality
  if (ytPlayer && typeof ytPlayer.getPlaybackQuality === 'function') {
    const currentQuality = ytPlayer.getPlaybackQuality();
    console.log("Initial quality:", currentQuality);
    updateQualityDisplay(currentQuality);
  }

  // Add a fallback to ensure time updates work
  // This helps with possible initialization timing issues
  setTimeout(() => {
    updatePlaybackProgress();
    if (!progressTimer) {
      startProgressTimer();
    }
  }, 1000);
}

function onPlayerStateChange(event) {
  // First update the play/pause button
  switch (event.data) {
    case YT.PlayerState.PLAYING:
      playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
      // Update immediately when playing starts
      updatePlaybackProgress();
      updateVolumeUI();
      // Then start the timer
      startProgressTimer();
      break;
    case YT.PlayerState.PAUSED:
      playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      // Update immediately when paused
      updatePlaybackProgress();
      // Then stop the timer
      stopProgressTimer();
      break;
    case YT.PlayerState.ENDED:
      playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      // Update immediately when ended
      updatePlaybackProgress();
      // Then stop the timer
      stopProgressTimer();
      // Reset progress to 0% visually on end
      progress.style.width = '0%';
      currentTime.textContent = formatTime(0);
      // Optionally reset chapter display
      updateCurrentChapterUI(0, videoChapters);
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

  // Play/Pause
  playPauseBtn.addEventListener('click', togglePlayPause);

  // Progress bar - add both click and touch support
  progressBar.addEventListener('click', seek);
  progressBar.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (e.changedTouches && e.changedTouches[0]) {
      const touchEvent = {
        clientX: e.changedTouches[0].clientX,
        clientY: e.changedTouches[0].clientY
      };
      seek(touchEvent);
    }
  });

  // Volume control
  volumeBtn.addEventListener('click', toggleMute);
  volumeSlider.addEventListener('click', updateVolume);

  // Playback speed
  const speedItems = speedOptions.querySelectorAll('[data-speed]');
  speedItems.forEach(item => {
    item.addEventListener('click', () => {
      const speed = parseFloat(item.dataset.speed);
      ytPlayer.setPlaybackRate(speed);
      playbackSpeedBtn.innerHTML = `${speed}x`;
      speedOptions.classList.add('hidden');
    });
  });

  // Playback speed - Toggle menu visibility on button click
  playbackSpeedBtn.addEventListener('click', (event) => {
    event.stopPropagation(); // Prevent this click from immediately closing the menu via the document listener
    speedOptions.classList.toggle('hidden');
  });

  // Close speed options if clicking outside
  document.addEventListener('click', (event) => {
    if (!playbackSpeedBtn.contains(event.target) && !speedOptions.contains(event.target)) {
      speedOptions.classList.add('hidden');
    }
  });

  // Fullscreen
  fullscreenBtn.addEventListener('click', toggleFullscreen);

  // Theater Mode
  theaterModeBtn.addEventListener('click', toggleTheaterMode);

  // Chapters Accordion Toggle
  chaptersHeader.addEventListener('click', toggleChaptersAccordion);
}

function updatePlaybackProgress() {
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
    currentTime.textContent = formatTime(currentVideoTime);

    // Update duration display - handle live streams where duration might be 0
    if (totalDuration > 0) {
      duration.textContent = formatTime(totalDuration);
    } else {
      // For live events or when duration is not available
      duration.textContent = 'LIVE';
    }

    // Update progress bar width
    if (!isNaN(currentVideoTime) && !isNaN(totalDuration) && totalDuration > 0) {
      const progressPercent = (currentVideoTime / totalDuration) * 100;
      progress.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`;
    } else {
      // For live streams, show progress at current position
      progress.style.width = '100%';
    }

    // Update current chapter UI
    updateCurrentChapterUI(currentVideoTime, videoChapters);

  } catch (error) {
    console.error('Error updating playback progress:', error);
  }
}

function seek(event) {
  if (!ytPlayer || typeof ytPlayer.getDuration !== 'function') return;

  const rect = progressBar.getBoundingClientRect();
  const pos = (event.clientX - rect.left) / rect.width;
  const duration = ytPlayer.getDuration();

  // Check if duration is valid
  if (duration && duration > 0) {
    const seekTime = pos * duration;
    ytPlayer.seekTo(seekTime, true);

    // Force immediate UI update for better user experience
    setTimeout(() => {
      updatePlaybackProgress();
      // Ensure timer is running
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
  if (!ytPlayer) return;

  if (ytPlayer.isMuted()) {
    ytPlayer.unMute();
  } else {
    ytPlayer.mute();
  }

  setTimeout(updateVolumeUI, 50);
}

function updateVolume(event) {
  if (!ytPlayer) return;

  const rect = volumeSlider.getBoundingClientRect();
  // Calculate the new volume based on click position
  const volume = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));

  // Set the player volume
  ytPlayer.setVolume(volume * 100);

  // Directly update the slider level UI
  volumeLevel.style.width = `${volume * 100}%`;

  // Update the icon (based on the new volume and mute state)
  updateVolumeUI();
}

function updateVolumeUI() {
  if (!ytPlayer) return;

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

  // Update volume level color based on mute state
  if (isMuted) {
    volumeLevel.style.backgroundColor = '#ef4444'; // Tailwind red-500
  } else {
    volumeLevel.style.backgroundColor = '#38a169'; // Tailwind green-600 (original color)
  }
}

function toggleFullscreen() {
  const playerElement = document.getElementById('player');
  if (!playerElement) return;

  if (document.fullscreenElement) {
    document.exitFullscreen();
    fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
  } else {
    playerElement.requestFullscreen();
    fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
  }
}

function toggleTheaterMode() {
  videoPlayer.classList.toggle('theater-mode');

  // Update button icon based on state
  if (videoPlayer.classList.contains('theater-mode')) {
    theaterModeBtn.innerHTML = '<i class="fas fa-compress-alt"></i>'; // Icon for exiting theater mode
  } else {
    theaterModeBtn.innerHTML = '<i class="fas fa-film"></i>'; // Original icon
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

  try {
    showLoading();
    const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    displayResults(data);
  } catch (error) {
    console.error('Search error:', error);
    content.innerHTML = '<div class="col-span-full text-center py-10 text-red-600">Search failed. Please try again.</div>';
  } finally {
    hideLoading();
  }
}

function displayResults(results) {
  content.innerHTML = '';

  if (!results || !results.length) {
    content.innerHTML = '<div class="col-span-full text-center py-10 text-gray-600">No results found</div>';
    return;
  }

  results.forEach(video => {
    const card = createVideoCard(video);
    content.appendChild(card);
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

async function playVideo(videoId, videoCardElement, channelAvatarUrlFromCard) {
  try {
    showLoading();
    currentVideoId = videoId;
    document.body.classList.add('overflow-hidden');

    // --- Get and display date from card immediately ---
    const uploadedDateFromCard = videoCardElement.dataset.uploadedat;
    if (uploadedDateFromCard) {
      uploadDate.textContent = uploadedDateFromCard;
    }

    // --- Set avatar immediately from card data ---
    if (channelAvatarUrlFromCard) {
      channelAvatar.src = channelAvatarUrlFromCard; // Use the passed URL
    } else {
      channelAvatar.src = '/img/default-avatar.svg'; // Fallback if not passed
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

    // Update video info UI
    videoTitle.textContent = videoDetails.title || 'Unknown';
    // Set channel name text content directly
    channelName.textContent = videoDetails.author?.name || 'Unknown';
    // Set the href attribute for the channel link
    channelName.href = videoDetails.author?.id ? `/channel/${videoDetails.author.id}` : '#'; // Link to channel page or '#' if no ID

    subscriberCount.textContent = videoDetails.author?.subscriber_count || '';
    viewCount.textContent = videoDetails.view_count || '0 views';
    videoDescription.textContent = videoDetails.description || '';

    // Update upload date ONLY if not set from card (or if details are more accurate)
    if (!uploadedDateFromCard && videoDetails.published) {
      uploadDate.textContent = videoDetails.published;
    }

    // Load comments
    await loadComments(videoId);

    // Show video player
    videoPlayer.classList.remove('hidden');

    // Fetch SponsorBlock data
    fetchSponsorBlockSegments(videoId);

    // Initialize YouTube player (now chapters are stored, onPlayerReady can use them)
    initializePlayer(videoId);

  } catch (error) {
    showError(`Failed to play video: ${error.message}`);
    console.error('Playback error:', error);
    // Clean up if loading fails
    closeVideoPlayer();
  } finally {
    hideLoading();
  }
}

async function loadComments(videoId, continuation = null) {
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
loadMoreComments.addEventListener('click', () => {
  if (currentVideoId && commentsNextPage) {
    loadComments(currentVideoId, commentsNextPage);
  }
});

function closeVideoPlayer() {
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
  videoPlayer.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  currentVideoId = null;
  commentsNextPage = null;
  commentsList.innerHTML = '';
  loadMoreComments.style.display = 'none';
  clearSponsorMarkers();
  clearChapters(); // Clear chapters UI
  videoChapters = []; // Clear stored chapters
  if (qualityBtn) qualityBtn.textContent = 'Auto'; // Reset quality button

  // Remove keyboard listener when closing
  document.removeEventListener('keydown', handleKeydown);
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
  // Ensure elements exist before proceeding
  if (!chaptersAccordion || !chaptersList || !chaptersHeader || !progressBar) { // Added progressBar check
    console.warn("Chapter UI elements or progress bar not found. Cannot display chapters.");
    return;
  }

  clearChapters(); // Clear previous chapters and markers first

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
  // Ensure elements exist
  if (!chaptersList || !currentChapterTitle || !chaptersAccordion || chaptersAccordion.classList.contains('hidden')) {
    return; // Don't update if chapters aren't displayed or elements are missing
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
  if (chaptersAccordion) chaptersAccordion.classList.add('hidden');
  if (chaptersList) chaptersList.innerHTML = ''; // Clear list content
  if (currentChapterTitle) currentChapterTitle.textContent = ''; // Clear header title
  if (chapterToggleIcon) { // Reset icon
    chapterToggleIcon.classList.remove('fa-chevron-up');
    chapterToggleIcon.classList.add('fa-chevron-down');
  }
  // Also remove chapter markers from the progress bar
  if (progressBar) {
    const existingMarkers = progressBar.querySelectorAll('.chapter-marker');
    existingMarkers.forEach(marker => marker.remove());
  }
}

// --- Keyboard Shortcuts ---

function handleKeydown(event) {
  // Ignore if player isn't active or if typing in an input/textarea
  // Also ignore if speed options are open
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
  updateQualityDisplay(event.data);
}

// New: Update the quality button display
function updateQualityDisplay(quality) {
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