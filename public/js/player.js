import { formatTime } from './utils.js';
import * as SponsorBlock from './sponsorblock.js';

// === State Variables (Module Scope) ===
let ytPlayer = null;
let progressTimer = null;
let videoChapters = [];
let playerResizeObserver = null;
let keydownAttached = false;

// === DOM Element Getters (Private) ===
// These functions help avoid repeated getElementById calls and make dependencies clearer.
const getElement = (id) => document.getElementById(id);
const getPlayerContainer = () => getElement('player');
const getCustomControls = () => getElement('customControls');
const getPlayPauseBtn = () => getElement('playPauseBtn');
const getProgressBar = () => getElement('progressBar');
const getProgress = () => getElement('progress');
const getCurrentTime = () => getElement('currentTime');
const getDuration = () => getElement('duration');
const getVolumeBtn = () => getElement('volumeBtn');
const getVolumeSlider = () => getElement('volumeSlider');
const getVolumeLevel = () => getElement('volumeLevel');
const getPlaybackSpeedBtn = () => getElement('playbackSpeedBtn');
const getSpeedOptions = () => getElement('speedOptions');
const getFullscreenBtn = () => getElement('fullscreenBtn');
const getTheaterModeBtn = () => getElement('theaterModeBtn');
const getChaptersAccordion = () => getElement('chaptersAccordion');
const getChaptersHeader = () => getElement('chaptersHeader');
const getChaptersList = () => getElement('chaptersList');
const getCurrentChapterTitle = () => getElement('currentChapterTitle');
const getChapterToggleIcon = () => getElement('chapterToggleIcon');
const getQualityBtn = () => getElement('qualityBtn');

// === Event Handlers (Private) ===
function onPlayerReady(event) {
  const customControls = getCustomControls();

  // Re-enable controls
  if (customControls) {
    customControls.classList.remove('pointer-events-none', 'opacity-50');
  }

  // Setup Controls and Key Listener
  setupCustomControls(); // Attaches listeners
  if (!keydownAttached) {
    document.addEventListener('keydown', handleKeydown);
    keydownAttached = true;
  }

  // Player is ready actions
  event.target.unMute();
  updateVolumeUI();
  const playPauseBtn = getPlayPauseBtn();
  if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';

  displayChapters(videoChapters); // Use chapters stored in module state
  updatePlaybackProgress();
  startProgressTimer();
  updateVolumeUI();

  // Get initial quality
  if (ytPlayer && typeof ytPlayer.getPlaybackQuality === 'function') {
    const qualityBtn = getQualityBtn();
    const currentQuality = ytPlayer.getPlaybackQuality();
    console.log("Initial quality:", currentQuality);
    updateQualityDisplay(currentQuality, qualityBtn); // Pass qualityBtn
  }

  // Fallback time update
  setTimeout(() => {
    updatePlaybackProgress();
    if (!progressTimer) {
      startProgressTimer();
    }
  }, 1000);

  SponsorBlock.setPlayerInstance(event.target);
}

function onPlayerStateChange(event) {
  const playPauseBtn = getPlayPauseBtn();
  const progress = getProgress();
  const currentTime = getCurrentTime();

  switch (event.data) {
    case YT.PlayerState.PLAYING:
      if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
      updatePlaybackProgress();
      updateVolumeUI();
      startProgressTimer();
      break;
    case YT.PlayerState.PAUSED:
      if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      updatePlaybackProgress();
      stopProgressTimer();
      break;
    case YT.PlayerState.ENDED:
      if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      updatePlaybackProgress();
      stopProgressTimer();
      if (progress) progress.style.width = '0%';
      if (currentTime) currentTime.textContent = formatTime(0);
      updateCurrentChapterUI(0, videoChapters);
      break;
    case YT.PlayerState.BUFFERING:
      if (progressTimer === null) {
        startProgressTimer();
      }
      break;
  }
}

function onPlayerError(event) {
  // Note: We might want to bubble this up or dispatch a custom event
  // For now, just log it. The main app can handle showError.
  SponsorBlock.clearSponsorSegmentsState();
}

function onPlaybackQualityChange(event) {
  console.log("Playback quality changed to:", event.data);
  const qualityBtn = getQualityBtn();
  updateQualityDisplay(event.data, qualityBtn);
}

// === Control Logic Functions (Private) ===
function startProgressTimer() {
  stopProgressTimer();
  if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
    progressTimer = setInterval(updatePlaybackProgress, 250);
  }
}

function stopProgressTimer() {
  if (progressTimer !== null) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function updatePlaybackProgress() {
  const currentTimeEl = getCurrentTime();
  const durationEl = getDuration();
  const progressEl = getProgress();

  if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function' || !currentTimeEl || !durationEl || !progressEl) return;

  try {
    const currentVideoTime = ytPlayer.getCurrentTime() || 0;
    const totalDuration = ytPlayer.getDuration() || 0;

    if (SponsorBlock.checkAndSkipSponsorSegment(currentVideoTime, totalDuration)) {
      const newCurrentTime = ytPlayer.getCurrentTime() || 0; // Re-get after skip
      currentTimeEl.textContent = formatTime(newCurrentTime);
      const progressPercent = totalDuration > 0 ? (newCurrentTime / totalDuration) * 100 : 0;
      progressEl.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`;
      updateCurrentChapterUI(newCurrentTime, videoChapters); // Update chapter based on new time
      return;
    }

    currentTimeEl.textContent = formatTime(currentVideoTime);
    durationEl.textContent = totalDuration > 0 ? formatTime(totalDuration) : 'LIVE';

    const progressPercent = totalDuration > 0 ? (currentVideoTime / totalDuration) * 100 : (ytPlayer.getPlayerState() === YT.PlayerState.ENDED ? 0 : 100);
    progressEl.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`;

    updateCurrentChapterUI(currentVideoTime, videoChapters);

  } catch (error) {
    console.error('Error updating playback progress (Player Module):', error);
    stopProgressTimer(); // Stop timer on error
  }
}

function seek(event) {
  const progressBar = getProgressBar();
  if (!progressBar || !ytPlayer || typeof ytPlayer.getDuration !== 'function') return;

  const rect = progressBar.getBoundingClientRect();
  let pos;
  // Handle both mouse and touch events
  if (event.clientX !== undefined) {
    pos = (event.clientX - rect.left) / rect.width;
  } else if (event.changedTouches && event.changedTouches[0]) {
    pos = (event.changedTouches[0].clientX - rect.left) / rect.width;
  } else {
    return; // Unknown event type
  }

  const durationVal = ytPlayer.getDuration();

  if (durationVal && durationVal > 0) {
    const seekTime = pos * durationVal;
    ytPlayer.seekTo(seekTime, true);
    // Immediately update progress after seeking
    setTimeout(() => {
      updatePlaybackProgress();
      // Restart timer only if video is playing
      if (ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
        startProgressTimer();
      }
    }, 50);
  }
}

function togglePlayPause() {
  if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') return;
  const state = ytPlayer.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    ytPlayer.pauseVideo();
  } else {
    ytPlayer.playVideo();
  }
}

function toggleMute() {
  if (!ytPlayer || typeof ytPlayer.isMuted !== 'function') return;
  if (ytPlayer.isMuted()) {
    ytPlayer.unMute();
  } else {
    ytPlayer.mute();
  }
  setTimeout(updateVolumeUI, 50); // Update UI shortly after action
}

function updateVolume(event) {
  const volumeSlider = getVolumeSlider();
  if (!volumeSlider || !ytPlayer || typeof ytPlayer.setVolume !== 'function') return;

  const rect = volumeSlider.getBoundingClientRect();
  let volumePercent;
  // Handle both mouse and touch events
  if (event.clientX !== undefined) {
    volumePercent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
  } else if (event.changedTouches && event.changedTouches[0]) {
    volumePercent = Math.max(0, Math.min(100, ((event.changedTouches[0].clientX - rect.left) / rect.width) * 100));
  } else {
    return; // Unknown event type
  }


  ytPlayer.setVolume(volumePercent);

  const volumeLevel = getVolumeLevel();
  if (volumeLevel) volumeLevel.style.width = `${volumePercent}%`; // Update slider level UI immediately

  updateVolumeUI(); // Update icon
}

function updateVolumeUI() {
  const volumeBtn = getVolumeBtn();
  const volumeLevel = getVolumeLevel();
  if (!volumeBtn || !volumeLevel || !ytPlayer || typeof ytPlayer.isMuted !== 'function' || typeof ytPlayer.getVolume !== 'function') return;

  const isMuted = ytPlayer.isMuted();
  const volume = ytPlayer.getVolume(); // Volume is 0-100

  // Update icon
  if (isMuted || volume === 0) {
    volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
  } else if (volume < 50) {
    volumeBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
  } else {
    volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
  }

  // Update volume level display (width and color)
  volumeLevel.style.width = isMuted ? '0%' : `${volume}%`; // Set width based on actual volume unless muted
  volumeLevel.style.backgroundColor = isMuted ? '#ef4444' : '#38a169'; // Red if muted, green otherwise
}


function toggleFullscreen() {
  const playerElement = getPlayerContainer(); // Target the player container for fullscreen
  const fullscreenBtn = getFullscreenBtn();
  if (!playerElement || !fullscreenBtn) return;

  if (!document.fullscreenElement) {
    playerElement.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
    });
    fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>'; // Icon for exiting fullscreen
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
      fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>'; // Icon for entering fullscreen
    }
  }
}

// Redefined Theater Mode Function for new layout
function toggleTheaterMode() {
  const videoPlayerDiv = document.getElementById('videoPlayer'); // The main container for player + recommendations
  const mainPlayerContent = document.getElementById('mainPlayerContent');
  const recommendedVideos = document.getElementById('recommendedVideos');
  const theaterModeBtn = getTheaterModeBtn();

  if (!videoPlayerDiv || !mainPlayerContent || !recommendedVideos || !theaterModeBtn) {
    console.warn('Theater mode elements not found.');
    return;
  }

  // Toggle a class on the parent container
  videoPlayerDiv.classList.toggle('theater-mode-active');

  if (videoPlayerDiv.classList.contains('theater-mode-active')) {
    // --- Activate Theater Mode ---
    // Hide recommendations
    recommendedVideos.classList.add('hidden');
    // Make main content wider (CSS will handle this via the parent class)
    mainPlayerContent.classList.remove('md:w-2/3'); // Remove the fractional width constraint
    mainPlayerContent.classList.add('md:w-full'); // Make it full width on medium+ screens
    theaterModeBtn.innerHTML = '<i class="fas fa-compress-alt"></i>'; // Icon for exiting

  } else {
    // --- Deactivate Theater Mode ---
    // Show recommendations
    recommendedVideos.classList.remove('hidden');
    // Restore main content width
    mainPlayerContent.classList.remove('md:w-full');
    mainPlayerContent.classList.add('md:w-2/3'); // Restore default width
    theaterModeBtn.innerHTML = '<i class="fas fa-film"></i>'; // Icon for entering
  }

  // Optional: Trigger resize observer logic if needed, though CSS should handle layout
  // window.dispatchEvent(new Event('resize')); // Could force reflow
}

function updateQualityDisplay(quality, qualityBtn) {
  if (!qualityBtn) return;
  const qualityMap = {
    'hd2160': '4K', 'hd1440': '1440p', 'hd1080': '1080p', 'hd720': '720p',
    'large': '480p', 'medium': '360p', 'small': '240p', 'tiny': '144p',
    'auto': 'Auto',
  };
  qualityBtn.textContent = qualityMap[quality] || quality; // Fallback to raw name
}

// === Keyboard Shortcut Handler (Private) ===
function handleKeydown(event) {
  // const videoPlayer = getVideoPlayerOverlay(); // REMOVED: No longer needed/exists
  const speedOptions = getSpeedOptions();
  const volumeLevel = getVolumeLevel(); // Needed for direct UI update

  // Ignore if player isn't active, input field focused, or speed options shown
  if (!ytPlayer || // REMOVED: !videoPlayer || videoPlayer.classList.contains('hidden') ||
    ['INPUT', 'TEXTAREA'].includes(event.target.tagName) ||
    (speedOptions && !speedOptions.classList.contains('hidden'))) {
    return;
  }

  let preventDefault = false;

  switch (event.key) {
    case ' ': // Space bar
    case 'k': // Play/Pause
      togglePlayPause();
      preventDefault = true;
      break;
    case 'ArrowLeft': // Seek back 5s
    case 'j':
      if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
        const currentTime = ytPlayer.getCurrentTime() || 0;
        ytPlayer.seekTo(Math.max(0, currentTime - 5), true);
        preventDefault = true;
        setTimeout(updatePlaybackProgress, 50); // Update UI quickly
      }
      break;
    case 'ArrowRight': // Seek forward 5s
    case 'l':
      if (ytPlayer && typeof ytPlayer.seekTo === 'function' && typeof ytPlayer.getDuration === 'function') {
        const currentTime = ytPlayer.getCurrentTime() || 0;
        const duration = ytPlayer.getDuration() || 0;
        ytPlayer.seekTo(Math.min(duration, currentTime + 5), true);
        preventDefault = true;
        setTimeout(updatePlaybackProgress, 50); // Update UI quickly
      }
      break;
    case 'ArrowUp': // Increase volume 5%
      if (ytPlayer && typeof ytPlayer.setVolume === 'function' && typeof ytPlayer.getVolume === 'function') {
        const currentVolume = ytPlayer.getVolume();
        const newVolume = Math.min(100, currentVolume + 5);
        ytPlayer.setVolume(newVolume);
        preventDefault = true;
        setTimeout(updateVolumeUI, 50); // Update icon
        if (volumeLevel) volumeLevel.style.width = `${newVolume}%`; // Update slider visually
      }
      break;
    case 'ArrowDown': // Decrease volume 5%
      if (ytPlayer && typeof ytPlayer.setVolume === 'function' && typeof ytPlayer.getVolume === 'function') {
        const currentVolume = ytPlayer.getVolume();
        const newVolume = Math.max(0, currentVolume - 5);
        ytPlayer.setVolume(newVolume);
        preventDefault = true;
        setTimeout(updateVolumeUI, 50); // Update icon
        if (volumeLevel) volumeLevel.style.width = `${newVolume}%`; // Update slider visually
      }
      break;
    case 'm': // Mute/Unmute
      toggleMute();
      preventDefault = true;
      break;
    case 't': // Toggle theater mode
      toggleTheaterMode();
      preventDefault = true;
      break;
    case 'f': // Toggle fullscreen
      toggleFullscreen();
      preventDefault = true;
      break;
    case 'Escape': // Close player (this should be handled by app.js ideally)
      // Dispatch a custom event instead of calling directly?
      document.dispatchEvent(new CustomEvent('closePlayerRequest'));
      preventDefault = true;
      break;
    // Add cases for number keys 0-9 to seek percentage?
    // Add cases for '<' and '>' to change speed?
  }

  if (preventDefault) {
    event.preventDefault();
  }
}

// === Chapter Functions (Private) ===
function displayChapters(chapters) {
  const chaptersAccordion = getChaptersAccordion();
  const chaptersList = getChaptersList();
  const chaptersHeader = getChaptersHeader();
  const progressBar = getProgressBar();
  const chapterToggleIcon = getChapterToggleIcon();

  if (!chaptersAccordion || !chaptersList || !chaptersHeader || !progressBar || !chapterToggleIcon) {
    console.warn("Player Module: Chapter UI elements not found.");
    return;
  }

  clearChapterDisplay(); // Clear previous chapters first

  if (!chapters || chapters.length === 0 || !ytPlayer || typeof ytPlayer.getDuration !== 'function') {
    chaptersAccordion.classList.add('hidden');
    return;
  }

  const duration = ytPlayer.getDuration();
  if (!duration || duration <= 0) {
    chaptersAccordion.classList.add('hidden');
    return;
  }

  console.log(`Player Module: Displaying ${chapters.length} chapters.`);
  chaptersAccordion.classList.remove('hidden');

  const sortedChapters = [...chapters].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

  // Store sorted chapters in module state if needed for updateCurrentChapterUI
  // videoChapters = sortedChapters; // Keep the original order from app.js? Let's assume app.js provides sorted.

  sortedChapters.forEach((chapter, index) => {
    const startTime = chapter.startTimeSeconds;
    const timeStr = formatTime(startTime);

    // Create List Item
    const chapterItem = document.createElement('div');
    chapterItem.className = 'chapter-item flex items-center justify-between p-2 cursor-pointer hover:bg-zinc-700';
    chapterItem.dataset.startTime = startTime;
    chapterItem.innerHTML = `
      <div class="flex items-center overflow-hidden mr-2">
        <span class="chapter-time text-xs text-zinc-400 mr-2 flex-shrink-0">${timeStr}</span>
        <span class="chapter-title text-sm text-zinc-200 truncate">${chapter.title || `Chapter ${index + 1}`}</span>
      </div>
      ${chapter.thumbnailUrl ? `<img src="${chapter.thumbnailUrl}" alt="${chapter.title || ''}" class="w-16 h-9 object-cover rounded ml-auto flex-shrink-0" loading="lazy">` : ''}
    `;
    chapterItem.addEventListener('click', () => {
      if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
        ytPlayer.seekTo(startTime, true);
      }
    });
    chaptersList.appendChild(chapterItem);

    // Create Marker on Progress Bar (skip for time 0)
    if (startTime > 0) {
      const marker = document.createElement('div');
      marker.className = 'chapter-marker';
      const startPercent = (startTime / duration) * 100;
      marker.style.left = `${startPercent}%`;
      marker.title = `Chapter: ${chapter.title || `Chapter ${index + 1}`} (${timeStr})`;
      progressBar.appendChild(marker); // Append behind progress indicator
    }
  });

  // Ensure list is initially hidden and icon is down
  chaptersList.classList.add('hidden');
  chapterToggleIcon.classList.remove('fa-chevron-up');
  chapterToggleIcon.classList.add('fa-chevron-down');
}

function updateCurrentChapterUI(currentTime, chapters) {
  const chaptersList = getChaptersList();
  const currentChapterTitle = getCurrentChapterTitle();
  const chaptersAccordion = getChaptersAccordion();

  // Stop if UI elements are missing or accordion is hidden
  if (!chaptersList || !currentChapterTitle || !chaptersAccordion || chaptersAccordion.classList.contains('hidden')) {
    if (currentChapterTitle) currentChapterTitle.textContent = ''; // Clear title if hidden
    return;
  }

  // Ensure chapters array is valid and not empty
  if (!chapters || chapters.length === 0) {
    currentChapterTitle.textContent = ''; // Clear title if no chapters
    // Clear any active styles from list items if they exist
    chaptersList.querySelectorAll('.chapter-item.active').forEach(item => {
      item.classList.remove('active', 'bg-zinc-600');
    });
    return;
  }

  let activeChapter = null;
  // Find the latest chapter whose start time is <= current time
  // Iterate backwards for efficiency
  for (let i = chapters.length - 1; i >= 0; i--) {
    // Ensure startTimeSeconds exists and is a number before comparing
    if (typeof chapters[i]?.startTimeSeconds === 'number' && currentTime >= chapters[i].startTimeSeconds) {
      activeChapter = chapters[i];
      break;
    }
  }

  // Update the header title
  currentChapterTitle.textContent = activeChapter ? (activeChapter.title || '') : '';

  // Update active class in the list
  const chapterItems = chaptersList.querySelectorAll('.chapter-item');
  chapterItems.forEach(item => {
    // Ensure item has dataset.startTime before parsing
    if (item.dataset.startTime) {
      const itemStartTime = parseFloat(item.dataset.startTime);
      // Check if this item corresponds to the active chapter
      if (activeChapter && typeof activeChapter.startTimeSeconds === 'number' && itemStartTime === activeChapter.startTimeSeconds) {
        if (!item.classList.contains('active')) { // Avoid unnecessary DOM manipulation
          item.classList.add('active', 'bg-zinc-600');
        }
      } else {
        if (item.classList.contains('active')) { // Avoid unnecessary DOM manipulation
          item.classList.remove('active', 'bg-zinc-600');
        }
      }
    }
  });
}


function toggleChaptersAccordion() {
  const chaptersList = getChaptersList();
  const chapterToggleIcon = getChapterToggleIcon();
  if (!chaptersList || !chapterToggleIcon) return;

  const isHidden = chaptersList.classList.toggle('hidden');
  if (isHidden) {
    chapterToggleIcon.classList.remove('fa-chevron-up');
    chapterToggleIcon.classList.add('fa-chevron-down');
  } else {
    chapterToggleIcon.classList.remove('fa-chevron-down');
    chapterToggleIcon.classList.add('fa-chevron-up');
    // Scroll active chapter into view when opening
    const activeItem = chaptersList.querySelector('.chapter-item.active');
    if (activeItem) {
      activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

function clearChapterDisplay() {
  const chaptersAccordion = getChaptersAccordion();
  const chaptersList = getChaptersList();
  const currentChapterTitle = getCurrentChapterTitle();
  const chapterToggleIcon = getChapterToggleIcon();
  const progressBar = getProgressBar();

  if (chaptersAccordion) chaptersAccordion.classList.add('hidden');
  if (chaptersList) chaptersList.innerHTML = '';
  if (currentChapterTitle) currentChapterTitle.textContent = '';
  if (chapterToggleIcon) {
    chapterToggleIcon.classList.remove('fa-chevron-up');
    chapterToggleIcon.classList.add('fa-chevron-down');
  }
  // Remove only chapter markers, not the progress bar itself
  if (progressBar) {
    progressBar.querySelectorAll('.chapter-marker').forEach(marker => marker.remove());
  }
}

// === Setup and Teardown (Exported) ===

/**
 * Sets up custom control event listeners.
 * Assumes ytPlayer is initialized.
 */
function setupCustomControls() {
  if (!ytPlayer) {
    console.error("Player Module: Cannot setup controls, ytPlayer not initialized.");
    return;
  }

  // Get all control elements
  const playPauseBtn = getPlayPauseBtn();
  const progressBar = getProgressBar();
  const volumeBtn = getVolumeBtn();
  const volumeSlider = getVolumeSlider();
  const playbackSpeedBtn = getPlaybackSpeedBtn();
  const speedOptions = getSpeedOptions();
  const fullscreenBtn = getFullscreenBtn();
  const theaterModeBtn = getTheaterModeBtn();
  const chaptersHeader = getChaptersHeader();

  // --- Remove existing listeners first to prevent duplicates ---
  // This is tricky as anonymous functions are used. Consider named handlers or a different approach if duplication becomes an issue.
  // For now, we assume this function is called only once per player instance during onPlayerReady.

  // --- Add Listeners ---
  if (playPauseBtn) playPauseBtn.onclick = togglePlayPause; // Use onclick for simplicity or manage listeners carefully

  if (progressBar) {
    progressBar.onclick = seek;
    progressBar.ontouchend = (e) => { // Use ontouchend for mobile seek
      e.preventDefault(); // Prevent potential ghost clicks
      seek(e);
    };
  }

  if (volumeBtn) volumeBtn.onclick = toggleMute;

  if (volumeSlider) {
    volumeSlider.onclick = updateVolume; // Click seeking for volume
    // Add drag handling for volume slider if needed (more complex)
    volumeSlider.ontouchend = (e) => {
      e.preventDefault();
      updateVolume(e);
    };
  }

  if (playbackSpeedBtn && speedOptions) {
    // Clear previous listeners if any (safer)
    const newSpeedBtn = playbackSpeedBtn.cloneNode(true);
    playbackSpeedBtn.parentNode.replaceChild(newSpeedBtn, playbackSpeedBtn);
    newSpeedBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      speedOptions.classList.toggle('hidden');
    });

    const speedItems = speedOptions.querySelectorAll('[data-speed]');
    speedItems.forEach(item => {
      const newSpeedItem = item.cloneNode(true); // Clone to remove old listeners
      item.parentNode.replaceChild(newSpeedItem, item);
      newSpeedItem.addEventListener('click', () => {
        const speed = parseFloat(newSpeedItem.dataset.speed);
        if (ytPlayer && typeof ytPlayer.setPlaybackRate === 'function') {
          ytPlayer.setPlaybackRate(speed);
          const currentSpeedBtn = getPlaybackSpeedBtn(); // Re-get the button
          if (currentSpeedBtn) {
            currentSpeedBtn.innerHTML = `<i class="fas fa-tachometer-alt"></i> ${speed}x`; // Show speed on button
          } else {
            // Fallback or default icon if button somehow not found
            console.warn("Playback speed button not found after setting speed.");
          }
        }
        speedOptions.classList.add('hidden');
      });
    });

    // Close speed options if clicking outside
    document.addEventListener('click', (event) => {
      const currentSpeedBtn = getPlaybackSpeedBtn(); // Re-get
      if (currentSpeedBtn && !currentSpeedBtn.contains(event.target) && !speedOptions.contains(event.target)) {
        speedOptions.classList.add('hidden');
      }
    }, { capture: true }); // Use capture phase to catch clicks early
  }


  if (fullscreenBtn) fullscreenBtn.onclick = toggleFullscreen;
  if (theaterModeBtn) theaterModeBtn.onclick = toggleTheaterMode;
  if (chaptersHeader) chaptersHeader.onclick = toggleChaptersAccordion;
}

/**
 * Initializes the YouTube player instance.
 * @param {string} videoId - The YouTube video ID.
 * @param {Array} initialChapters - The chapters for this video.
 */
export function initPlayer(videoId, initialChapters = []) {
  const playerContainer = getPlayerContainer();
  // const videoPlayerOverlay = getVideoPlayerOverlay(); // No longer needed for show/hide
  const customControls = getCustomControls();

  // if (!playerContainer || !videoPlayerOverlay) { // Check only for playerContainer
  if (!playerContainer) {
    console.error("Player Module: Player container (#player) not found!");
    return;
  }

  // Destroy existing player and cleanup listeners FIRST
  destroyPlayer(); // Use the dedicated destroy function

  // Clear the player container's HTML
  playerContainer.innerHTML = '';

  // Store chapters
  videoChapters = initialChapters || [];

  // Visually disable controls until ready
  if (customControls) {
    customControls.classList.add('pointer-events-none', 'opacity-50');
  }

  try {
    // Ensure overlay is visible and body scroll is hidden NOW - REMOVED
    // videoPlayerOverlay.classList.remove('hidden');
    // document.body.classList.add('overflow-hidden');

    ytPlayer = new YT.Player('player', { // Use the ID 'player'
      videoId: videoId,
      playerVars: {
        'playsinline': 1, 'controls': 0, 'disablekb': 1, 'rel': 0,
        'modestbranding': 1, 'showinfo': 0, 'iv_load_policy': 3,
        'fs': 0, 'autoplay': 1, 'enablejsapi': 1,
        'origin': window.location.origin,
        'widget_referrer': window.location.href,
        'autohide': 1
      },
      events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange,
        'onError': onPlayerError,
        'onPlaybackQualityChange': onPlaybackQualityChange
      }
    });
  } catch (error) {
    console.error("Player Module: Error creating YT.Player instance:", error);
    // Attempt cleanup even if creation failed
    destroyPlayer();
    // Maybe show an error to the user via app.js?
    document.dispatchEvent(new CustomEvent('playerInitFailed', { detail: error }));
    return; // Stop execution
  }


  // Setup ResizeObserver
  if ('ResizeObserver' in window && !playerResizeObserver) { // Create only if it doesn't exist
    playerResizeObserver = new ResizeObserver(entries => {
      if (!ytPlayer || typeof ytPlayer.setSize !== 'function') return; // Check player exists
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        // Add a minimum size check to avoid issues during initialization/collapse
        if (width >= 100 && height >= 100) {
          // console.log(`ResizeObserver: Setting player size to ${width}x${height}`);
          ytPlayer.setSize(width, height);
        } else {
          // console.warn(`ResizeObserver: Calculated dimensions too small (${width}x${height}). Not resizing.`);
        }
      }
    });
    playerResizeObserver.observe(playerContainer);
  } else if (!('ResizeObserver' in window)) {
    console.warn('Player Module: ResizeObserver not supported.');
  }
}

/**
 * Destroys the YouTube player instance and cleans up associated resources.
 */
export function destroyPlayer() {
  // Stop progress timer
  stopProgressTimer();

  // Disconnect ResizeObserver
  const playerContainer = getPlayerContainer(); // Get container ref before player is destroyed
  if (playerResizeObserver && playerContainer) {
    playerResizeObserver.unobserve(playerContainer);
    // Don't disconnect, reuse the observer instance if possible? No, safer to disconnect.
    playerResizeObserver.disconnect();
    playerResizeObserver = null; // Nullify the reference
  }

  // Destroy YouTube player instance
  if (ytPlayer) {
    if (typeof ytPlayer.destroy === 'function') {
      try {
        ytPlayer.destroy();
      } catch (e) {
        console.error("Player Module: Error destroying YT player:", e);
      }
    } else {
      console.warn("Player Module: ytPlayer.destroy function not found.");
    }
    ytPlayer = null; // Nullify the reference
  }

  // Remove keyboard listener
  if (keydownAttached) {
    document.removeEventListener('keydown', handleKeydown);
    keydownAttached = false;
  }

  // Clear Chapters & Markers
  clearChapterDisplay();
  videoChapters = []; // Reset chapters state

  // Clear SponsorBlock state
  SponsorBlock.clearSponsorSegmentsState();
  SponsorBlock.setPlayerInstance(null); // Clear player instance in SponsorBlock

  // Reset UI elements to default state
  const playPauseBtn = getPlayPauseBtn();
  if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
  const progress = getProgress();
  if (progress) progress.style.width = '0%';
  const currentTime = getCurrentTime();
  if (currentTime) currentTime.textContent = '0:00';
  const duration = getDuration();
  if (duration) duration.textContent = '0:00';
  const qualityBtn = getQualityBtn();
  if (qualityBtn) qualityBtn.textContent = 'Auto';
  const speedBtn = getPlaybackSpeedBtn();
  if (speedBtn) speedBtn.innerHTML = '<i class="fas fa-tachometer-alt"></i> 1x'; // Reset speed display
}

/**
 * Returns the current YouTube player instance.
 * @returns {YT.Player | null}
 */
export function getPlayerInstance() {
  return ytPlayer;
}