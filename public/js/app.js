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
// qualitySelect.addEventListener('change', () => {
//   if (currentVideoId) {
//     updateVideoQuality(currentVideoId);
//   }
// });

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
      'autohide': 1 // Hide YouTube controls
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange,
      'onError': onPlayerError
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
          console.log(`ResizeObserver detected size: ${width}x${height}`);
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
    console.log("Volume UI: Muted, setting color to red"); // DEBUG
    volumeLevel.style.backgroundColor = '#ef4444'; // Tailwind red-500
  } else {
    console.log("Volume UI: Unmuted, setting color to green"); // DEBUG
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

  // NO NEED to manually resize here - ResizeObserver handles it
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
  const channelName = video.channel?.name || 'Unknown';
  const verifiedBadge = video.channel?.verified ?
    '<i class="fas fa-check-circle text-green-500 ml-1 text-xs" title="Verified Channel"></i>' :
    '';

  card.innerHTML = `
        <div class="video-thumbnail">
            <img src="${thumbnail}" alt="${video.title}" loading="lazy" class="w-full h-full object-cover">
            <span class="video-duration">${duration}</span>
        </div>
        <div class="p-3">
            <h3 class="font-semibold text-zinc-100 line-clamp-2 mb-2 text-sm">${video.title || 'Untitled'}</h3>
            <div class="flex items-center mt-1">
                <img src="${channelAvatarUrl}" alt="${channelName}" class="w-8 h-8 rounded-full mr-2 flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center text-zinc-300 text-xs truncate">
                      ${channelName}${verifiedBadge}
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
    console.log("Avatar URL from card:", channelAvatarUrlFromCard); // Log received URL
    if (channelAvatarUrlFromCard) {
      channelAvatar.src = channelAvatarUrlFromCard; // Use the passed URL
      console.log("Set channelAvatar.src to (from card):", channelAvatar.src); // Log what was set
    } else {
      channelAvatar.src = '/img/default-avatar.svg'; // Fallback if not passed
      console.log("Set channelAvatar.src to (default fallback):", channelAvatar.src); // Log fallback set
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
    channelName.textContent = videoDetails.author?.name || 'Unknown';
    channelName.href = `/channel/${videoDetails.author?.id || ''}`;

    // Optionally, update avatar *again* if details API provides a (potentially better) one
    // This overrides the one from the card if the details API has one.
    const avatarFromDetails = videoDetails.author?.thumbnails?.[0]?.url;
    console.log("Avatar URL from details API:", avatarFromDetails); // Log details API URL
    /* REMOVED THIS BLOCK
    if (avatarFromDetails) {
      channelAvatar.src = avatarFromDetails;
      console.log("Updated channelAvatar.src to (from details API):", channelAvatar.src); // Log update
    }
    */
    // else keep the one from the card or the default

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
  // Implementation of displaySponsorSegments function
}

function clearSponsorMarkers() {
  // Implementation of clearSponsorMarkers function
}

function displayChapters(chapters) {
  // Implementation of displayChapters function
}

function updateCurrentChapterUI(currentTime, chapters) {
  // Implementation of updateCurrentChapterUI function
}

function toggleChaptersAccordion() {
  // Implementation of toggleChaptersAccordion function
}

function clearChapters() {
  // Implementation of clearChapters function
}

// --- Keyboard Shortcuts ---

function handleKeydown(event) {
  // Ignore if player isn't active or if typing in an input/textarea
  if (!ytPlayer || !videoPlayer || videoPlayer.classList.contains('hidden') || ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
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
    // Add cases for 'm' (mute/unmute), 'f' (fullscreen), 't' (theater mode) if desired
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