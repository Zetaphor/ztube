// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const content = document.getElementById('content');
const videoPlayer = document.getElementById('videoPlayer');
const closePlayer = document.getElementById('closePlayer');
const videoTitle = document.getElementById('videoTitle');
const channelAvatar = document.getElementById('channelAvatar');
const channelName = document.getElementById('channelName');
const videoDescription = document.getElementById('videoDescription');
const qualitySelect = document.getElementById('qualitySelect');
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

let currentVideoId = null;
let commentsNextPage = null;
let ytPlayer = null;

// Event Listeners
searchButton.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') performSearch();
});
closePlayer.addEventListener('click', closeVideoPlayer);
qualitySelect.addEventListener('change', () => {
  if (currentVideoId) {
    updateVideoQuality(currentVideoId);
  }
});

// Initialize YouTube player
function onYouTubeIframeAPIReady() {
  // Player will be initialized when a video is selected
}

function initializePlayer(videoId) {
  if (ytPlayer) {
    ytPlayer.destroy();
  }

  ytPlayer = new YT.Player('player', {
    height: '390',
    width: '640',
    videoId: videoId,
    playerVars: {
      'playsinline': 1,
      'controls': 0,
      'disablekb': 1,
      'rel': 0,
      'modestbranding': 1,
      'showinfo': 0,
      'iv_load_policy': 3,
      'fs': 0 // Disable fullscreen button since we have our own
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });

  // Set up custom controls
  setupCustomControls();
}

function onPlayerReady(event) {
  // Player is ready
  updateVolumeUI();
  updatePlaybackProgress();
}

function onPlayerStateChange(event) {
  switch (event.data) {
    case YT.PlayerState.PLAYING:
      playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
      startProgressTimer();
      break;
    case YT.PlayerState.PAUSED:
      playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      stopProgressTimer();
      break;
    case YT.PlayerState.ENDED:
      playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      stopProgressTimer();
      break;
  }
}

let progressTimer = null;

function startProgressTimer() {
  stopProgressTimer();
  progressTimer = setInterval(updatePlaybackProgress, 1000);
}

function stopProgressTimer() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function setupCustomControls() {
  if (!ytPlayer) return;

  // Play/Pause
  playPauseBtn.addEventListener('click', togglePlayPause);

  // Progress bar
  progressBar.addEventListener('click', seek);

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

  // Fullscreen
  fullscreenBtn.addEventListener('click', toggleFullscreen);
}

function updatePlaybackProgress() {
  if (!ytPlayer || !ytPlayer.getCurrentTime) return;

  const currentVideoTime = ytPlayer.getCurrentTime();
  const totalDuration = ytPlayer.getDuration();

  // Update current time display
  currentTime.textContent = formatTime(currentVideoTime);
  duration.textContent = formatTime(totalDuration);

  // Update progress bar width
  if (!isNaN(currentVideoTime) && !isNaN(totalDuration) && totalDuration > 0) {
    const progressPercent = (currentVideoTime / totalDuration) * 100;
    progress.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`;
  }
}

function seek(event) {
  if (!ytPlayer || !ytPlayer.getDuration) return;

  const rect = progressBar.getBoundingClientRect();
  const pos = (event.clientX - rect.left) / rect.width;
  const duration = ytPlayer.getDuration();

  if (!isNaN(duration) && duration > 0) {
    const seekTime = pos * duration;
    ytPlayer.seekTo(seekTime, true);
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
  updateVolumeUI();
}

function updateVolume(event) {
  if (!ytPlayer) return;

  const rect = volumeSlider.getBoundingClientRect();
  const volume = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  ytPlayer.setVolume(volume * 100);
  updateVolumeUI();
}

function updateVolumeUI() {
  if (!ytPlayer) return;

  const isMuted = ytPlayer.isMuted();
  const volume = ytPlayer.getVolume() / 100;

  volumeLevel.style.width = `${volume * 100}%`;

  if (isMuted || volume === 0) {
    volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
  } else if (volume < 0.5) {
    volumeBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
  } else {
    volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
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

function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  card.className = 'video-card bg-white rounded-lg shadow-md overflow-hidden cursor-pointer';
  card.onclick = () => playVideo(video.id);

  // Get thumbnail URL
  const thumbnail = video.thumbnails?.[0]?.url || '';

  // Get duration (already formatted from server)
  const duration = video.duration || '0:00';

  // Get view count (already formatted from server)
  const views = video.viewCount || '0 views';

  // Get upload date
  const uploadedAt = video.uploadedAt || 'Unknown date';

  // Get channel name with verified badge if applicable
  const channelName = video.channel?.name || 'Unknown';
  const verifiedBadge = video.channel?.verified ?
    '<i class="fas fa-check-circle text-blue-500 ml-1" title="Verified Channel"></i>' :
    '';

  card.innerHTML = `
        <div class="video-thumbnail">
            <img src="${thumbnail}" alt="${video.title}" loading="lazy">
            <span class="video-duration">${duration}</span>
        </div>
        <div class="p-4">
            <h3 class="font-semibold text-gray-800 line-clamp-2">${video.title || 'Untitled'}</h3>
            <div class="video-meta mt-2">
                <span class="flex items-center">${channelName}${verifiedBadge}</span>
                <span>${views}</span>
                <span>${uploadedAt}</span>
            </div>
        </div>
    `;

  return card;
}

async function playVideo(videoId) {
  try {
    showLoading();
    currentVideoId = videoId;

    // Get video details
    const detailsResponse = await fetch(`/api/video/${videoId}`);
    const videoDetails = await detailsResponse.json();

    // Update video info UI
    videoTitle.textContent = videoDetails.title || 'Unknown';
    channelName.textContent = videoDetails.author?.name || 'Unknown';
    channelName.href = `/channel/${videoDetails.author?.id || ''}`;

    if (videoDetails.author?.thumbnails && videoDetails.author.thumbnails.length > 0) {
      channelAvatar.src = videoDetails.author.thumbnails[0].url;
    } else {
      channelAvatar.src = '';
    }

    subscriberCount.textContent = videoDetails.author?.subscriber_count || '';
    viewCount.textContent = videoDetails.view_count || '0 views';
    uploadDate.textContent = videoDetails.published || '';
    videoDescription.textContent = videoDetails.description || '';

    // Load comments
    await loadComments(videoId);

    // Show video player
    videoPlayer.classList.remove('hidden');

    // Initialize YouTube player
    initializePlayer(videoId);

  } catch (error) {
    showError('Failed to play video');
    console.error('Playback error:', error);
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
        <a href="#" class="font-medium mr-2">${authorName}</a>
        <span class="text-gray-500 text-sm">${publishedTime}</span>
      </div>
      <p class="text-gray-800">${content}</p>
      <div class="flex items-center mt-2 text-gray-500 text-sm">
        <button class="flex items-center hover:text-gray-700">
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
  if (ytPlayer) {
    ytPlayer.destroy();
    ytPlayer = null;
  }
  videoPlayer.classList.add('hidden');
  currentVideoId = null;
  commentsNextPage = null;
  commentsList.innerHTML = '';
  loadMoreComments.style.display = 'none';
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