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
let vjsPlayer = null;

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

// Initialize video.js player
function initializePlayer() {
  if (vjsPlayer) {
    vjsPlayer.dispose();
  }

  vjsPlayer = videojs('player', {
    preload: 'auto',
    controls: false, // Disable default controls
    fluid: true,
    playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
  });

  // Set up custom controls
  setupCustomControls();
}

function setupCustomControls() {
  if (!vjsPlayer) return;

  // Play/Pause
  playPauseBtn.addEventListener('click', togglePlayPause);
  vjsPlayer.on('play', () => {
    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
  });
  vjsPlayer.on('pause', () => {
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
  });

  // Progress bar
  vjsPlayer.on('timeupdate', updatePlaybackProgress);
  progressBar.addEventListener('click', seek);

  // Set duration once metadata is loaded
  vjsPlayer.one('loadedmetadata', () => {
    const totalDuration = vjsPlayer.duration();
    if (!isNaN(totalDuration) && isFinite(totalDuration)) {
      duration.textContent = formatTime(totalDuration);
    }
  });

  // Volume control
  volumeBtn.addEventListener('click', toggleMute);
  volumeSlider.addEventListener('click', updateVolume);
  vjsPlayer.on('volumechange', () => {
    updateVolumeUI();
  });

  // Playback speed
  const speedItems = speedOptions.querySelectorAll('[data-speed]');
  speedItems.forEach(item => {
    item.addEventListener('click', () => {
      const speed = parseFloat(item.dataset.speed);
      vjsPlayer.playbackRate(speed);
      playbackSpeedBtn.innerHTML = `${speed}x`;
      speedOptions.classList.add('hidden');
    });
  });

  // Fullscreen
  fullscreenBtn.addEventListener('click', toggleFullscreen);
}

function updatePlaybackProgress() {
  const currentVideoTime = vjsPlayer.currentTime();
  const totalDuration = vjsPlayer.duration();

  // Update current time display
  document.getElementById('currentTime').textContent = formatTime(currentVideoTime);

  // Update progress bar width based on current time relative to total duration
  if (!isNaN(currentVideoTime) && !isNaN(totalDuration) && totalDuration > 0) {
    const progressPercent = (currentVideoTime / totalDuration) * 100;
    progress.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`;
  }
}

function seek(event) {
  const rect = progressBar.getBoundingClientRect();
  const pos = (event.clientX - rect.left) / rect.width;
  const totalDuration = vjsPlayer.duration();

  if (!isNaN(totalDuration) && totalDuration > 0) {
    const seekTime = pos * totalDuration;
    vjsPlayer.currentTime(Math.min(totalDuration, Math.max(0, seekTime)));
  }
}

function togglePlayPause() {
  if (vjsPlayer.paused()) {
    vjsPlayer.play();
  } else {
    vjsPlayer.pause();
  }
}

function toggleMute() {
  vjsPlayer.muted(!vjsPlayer.muted());
}

function updateVolume(event) {
  const rect = volumeSlider.getBoundingClientRect();
  const volume = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  vjsPlayer.volume(volume);
  updateVolumeUI();
}

function updateVolumeUI() {
  const volume = vjsPlayer.volume();
  volumeLevel.style.width = `${volume * 100}%`;

  // Update volume icon
  if (vjsPlayer.muted() || volume === 0) {
    volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
  } else if (volume < 0.5) {
    volumeBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
  } else {
    volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
  }
}

function toggleFullscreen() {
  if (vjsPlayer.isFullscreen()) {
    vjsPlayer.exitFullscreen();
    fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
  } else {
    vjsPlayer.requestFullscreen();
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

    // Debug logging
    console.log('Video details response:', videoDetails);
    console.log('Author data:', videoDetails.author);
    console.log('View count:', videoDetails.view_count);
    console.log('Published date:', videoDetails.published);

    // Update video player UI with proper handling of different response formats
    // Title handling
    videoTitle.textContent = typeof videoDetails.title === 'string'
      ? videoDetails.title
      : videoDetails.title?.text || 'Unknown';

    // Channel info
    channelName.textContent = videoDetails.author?.name || 'Unknown';
    channelName.href = `/channel/${videoDetails.author?.id || ''}`;

    // Thumbnail handling with fallbacks
    if (videoDetails.author?.thumbnails && videoDetails.author.thumbnails.length > 0) {
      channelAvatar.src = videoDetails.author.thumbnails[0].url;
    } else {
      channelAvatar.src = '';
    }

    // Additional metadata with safe access
    subscriberCount.textContent = typeof videoDetails.author?.subscriber_count === 'string'
      ? videoDetails.author.subscriber_count
      : videoDetails.author?.subscriber_count?.text || '';

    viewCount.textContent = typeof videoDetails.view_count === 'string'
      ? videoDetails.view_count
      : videoDetails.view_count?.text || '0 views';

    uploadDate.textContent = typeof videoDetails.published === 'string'
      ? videoDetails.published
      : videoDetails.published?.text || '';

    videoDescription.textContent = videoDetails.description || '';

    // Load comments
    await loadComments(videoId);

    // Show video player
    videoPlayer.classList.remove('hidden');

    // Initialize player after the element is visible
    initializePlayer();

    // Set up video stream with selected quality
    await updateVideoQuality(videoId);
  } catch (error) {
    showError('Failed to play video');
    console.error('Playback error:', error);
  } finally {
    hideLoading();
  }
}

async function updateVideoQuality(videoId) {
  const quality = qualitySelect.value;
  const currentTime = vjsPlayer && !isNaN(vjsPlayer.currentTime()) ? vjsPlayer.currentTime() : 0;

  // Update video source
  const videoUrl = `/api/stream/${videoId}?quality=${quality}`;

  vjsPlayer.src({
    src: videoUrl,
    type: 'video/mp4'
  });

  // Load the video
  vjsPlayer.load();

  // If there was a previous position, seek to it
  if (currentTime > 0) {
    vjsPlayer.currentTime(currentTime);
  }

  // Start playback
  vjsPlayer.play().catch(error => {
    console.error('Playback error:', error);
    showError('Failed to play video');
  });
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
  if (vjsPlayer) {
    vjsPlayer.pause();
    vjsPlayer.dispose();
    vjsPlayer = null;
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