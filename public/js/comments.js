import { showError } from './utils.js';

// === State Variables (Module Scope) ===
let commentsNextPage = null;
let currentVideoId = null; // Keep track of the video ID for loading more
let commentsListElement = null;
let loadMoreButtonElement = null;

// === DOM Element Getters (Private) ===
const getCommentsList = () => commentsListElement || document.getElementById('commentsList');
const getLoadMoreButton = () => loadMoreButtonElement || document.getElementById('loadMoreComments');

// === Private Functions ===

function createCommentElement(comment) {
  const div = document.createElement('div');
  div.className = 'comment-item flex space-x-3 py-2'; // Added padding

  const avatar = comment.author?.thumbnails?.[0]?.url || '/img/default-avatar.svg'; // Default avatar
  const authorName = comment.author?.name || 'Unknown';
  const authorId = comment.author?.id;

  // Handle rich text content safely
  let contentHTML = '';
  if (typeof comment.content === 'string') {
    contentHTML = comment.content.replace(/\n/g, '<br>'); // Basic newline handling
  } else if (Array.isArray(comment.content)) {
    // Attempt to handle simple rich text (links)
    contentHTML = comment.content.map(segment => {
      if (typeof segment === 'string') {
        return segment.replace(/\n/g, '<br>');
      } else if (segment.url) {
        // Sanitize URL slightly - very basic check
        const safeUrl = segment.url.startsWith('http://') || segment.url.startsWith('https://') ? segment.url : '#';
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${(segment.text || '').replace(/\n/g, '<br>')}</a>`;
      } else {
        return (segment.text || '').replace(/\n/g, '<br>');
      }
    }).join('');
  } else if (typeof comment.content === 'object' && comment.content?.text) {
    contentHTML = comment.content.text.replace(/\n/g, '<br>');
  } else {
    contentHTML = '';
  }

  const publishedTime = comment.published || '';
  const likeCount = comment.like_count || '0'; // Default to '0'

  // Author link or span
  const authorLink = authorId
    ? `<a href="/channel/${authorId}" class="font-medium text-zinc-100 hover:text-green-500 mr-2">${authorName}</a>`
    : `<span class="font-medium text-zinc-100 mr-2">${authorName}</span>`;

  div.innerHTML = `
      <img src="${avatar}" alt="${authorName} avatar" class="w-10 h-10 rounded-full flex-shrink-0" loading="lazy">
      <div class="flex-1 min-w-0">
        <div class="flex items-center mb-1 flex-wrap">
          ${authorLink}
          <span class="text-zinc-400 text-sm whitespace-nowrap">${publishedTime}</span>
        </div>
        <p class="text-zinc-200 text-sm break-words">${contentHTML}</p>
        <div class="flex items-center mt-2 text-zinc-400 text-sm space-x-4">
          <button class="flex items-center hover:text-zinc-300">
            <i class="far fa-thumbs-up mr-1"></i>
            <span>${likeCount}</span>
          </button>
        </div>
      </div>
    `;

  return div;
}


async function fetchAndDisplayComments(videoId, continuation = null) {
  const commentsList = getCommentsList();
  const loadMoreComments = getLoadMoreButton();

  if (!commentsList || !loadMoreComments) {
    console.error("Comments Module: Comments list or load more button element not found.");
    return;
  }

  // Store video ID if it's a new load
  if (!continuation) {
    currentVideoId = videoId;
  }

  // Ensure we are using the correct video ID for continuation
  if (continuation && !currentVideoId) {
    console.error("Comments Module: Cannot load more comments without a currentVideoId.");
    return;
  }
  const targetVideoId = continuation ? currentVideoId : videoId;

  try {
    const url = continuation
      ? `/api/comments/${targetVideoId}?continuation=${continuation}`
      : `/api/comments/${targetVideoId}`;

    // Indicate loading state on the button
    const originalButtonText = loadMoreComments.textContent;
    loadMoreComments.textContent = 'Loading...';
    loadMoreComments.disabled = true;

    const response = await fetch(url);
    const data = await response.json();

    // Check status *after* trying to parse JSON, as error details might be in the body
    if (!response.ok) {
      throw new Error(data.error || `Failed to fetch comments: ${response.status}`);
    }

    // Restore button state immediately after fetch, before processing
    loadMoreComments.textContent = originalButtonText; // Restore original text
    loadMoreComments.disabled = false;

    if (!data || !data.comments || data.comments.length === 0) {
      console.warn('Comments Module: No comment data or empty comments received:', data);
      // Don't clear existing comments if it was a continuation request and no new comments came
      if (!continuation) {
        commentsList.innerHTML = '<div class="text-center py-4 text-gray-500">No comments yet.</div>';
      }
      loadMoreComments.style.display = 'none'; // Hide button if no more comments
      commentsNextPage = null;
      return; // Exit function, not an error technically
    }

    if (!continuation) {
      commentsList.innerHTML = ''; // Clear only on first load
    }

    data.comments.forEach(comment => {
      const commentElement = createCommentElement(comment);
      commentsList.appendChild(commentElement);
    });

    commentsNextPage = data.continuation;
    loadMoreComments.style.display = data.continuation ? 'block' : 'none';

  } catch (error) {
    console.error('Comments Module: Failed to load comments:', error);
    // Restore button state on error
    const button = getLoadMoreButton(); // Re-fetch in case it was replaced
    if (button) {
      button.textContent = 'Load More Comments'; // Or original text if stored
      button.disabled = false;
      button.style.display = 'none'; // Hide button on error
    }

    // Append error message instead of replacing content if it's a continuation
    if (!continuation && commentsList) {
      commentsList.innerHTML = `<div class="text-center py-4 text-red-500">Failed to load comments: ${error.message}</div>`;
    } else {
      // Optionally show error near the button or log it globally
      showError(`Failed to load more comments: ${error.message}`);
    }
    commentsNextPage = null; // Reset continuation on error
  }
}

// === Exported Functions ===

/**
 * Initializes the comments section for a given video ID.
 * Fetches the first batch of comments and sets up the 'load more' listener.
 * @param {string} videoId - The YouTube video ID.
 */
export function initComments(videoId) {
  // Store references to the DOM elements
  commentsListElement = getCommentsList(); // Use getter which falls back to getElementById
  loadMoreButtonElement = getLoadMoreButton();

  if (!commentsListElement || !loadMoreButtonElement) {
    console.error("Comments Module: Cannot initialize. Comments list or load more button not found in the DOM.");
    return;
  }

  // Clear previous state and UI
  clearComments(); // Use the internal clear function

  // Fetch initial comments
  fetchAndDisplayComments(videoId); // No continuation token initially

  // Setup listener for the load more button
  // Remove potential old listener before adding a new one
  loadMoreButtonElement.replaceWith(loadMoreButtonElement.cloneNode(true));
  // Get the new button reference after cloning
  loadMoreButtonElement = getLoadMoreButton(); // Re-assign the potentially new element
  if (loadMoreButtonElement) {
    loadMoreButtonElement.addEventListener('click', () => {
      if (commentsNextPage) {
        fetchAndDisplayComments(currentVideoId, commentsNextPage); // Use stored videoId and next page token
      } else {
      }
    });
  } else {
  }
}

/**
 * Clears the comments list UI and resets module state.
 */
export function clearComments() {
  const commentsList = getCommentsList();
  const loadMoreComments = getLoadMoreButton();

  if (commentsList) {
    commentsList.innerHTML = ''; // Clear the list content
  }
  if (loadMoreComments) {
    loadMoreComments.style.display = 'none'; // Hide the button
    loadMoreComments.disabled = false; // Re-enable
    loadMoreComments.textContent = 'Load More Comments'; // Reset text
    // Remove listener? Cloning in initComments should handle this.
  }

  // Reset internal state
  commentsNextPage = null;
  currentVideoId = null;
  // Reset element references if desired, or let initComments re-fetch them
  // commentsListElement = null;
  // loadMoreButtonElement = null;
}