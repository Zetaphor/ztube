// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const content = document.getElementById('content');
const videoPlayer = document.getElementById('videoPlayer');
const player = document.getElementById('player');
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

let currentVideoId = null;
let commentsNextPage = null;

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

// Functions
async function performSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  try {
    showLoading();
    const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
    const results = await response.json();
    displayResults(results);
  } catch (error) {
    showError('Failed to perform search');
    console.error('Search error:', error);
  } finally {
    hideLoading();
  }
}

function displayResults(results) {
  content.innerHTML = '';

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

    // Set up video stream with selected quality
    await updateVideoQuality(videoId);

    // Show video player
    videoPlayer.classList.remove('hidden');
  } catch (error) {
    showError('Failed to play video');
    console.error('Playback error:', error);
  } finally {
    hideLoading();
  }
}

async function updateVideoQuality(videoId) {
  const quality = qualitySelect.value;
  const currentTime = player.currentTime;

  // Update video source
  player.src = `/api/stream/${videoId}?quality=${quality}`;

  // Restore playback position
  player.currentTime = currentTime;
  player.play().catch(error => {
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
  player.pause();
  player.src = '';
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