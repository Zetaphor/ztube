import { showError, showLoading, hideLoading } from './utils.js';

// DOM Elements
const subscriptionsFileInput = document.getElementById('subscriptionsFileInput');
const selectSubscriptionsFileBtn = document.getElementById('selectSubscriptionsFileBtn');
const selectedSubscriptionsFile = document.getElementById('selectedSubscriptionsFile');
const uploadSubscriptionsBtn = document.getElementById('uploadSubscriptionsBtn');
const subscriptionsImportProgress = document.getElementById('subscriptionsImportProgress');
const subscriptionsProgressBar = document.getElementById('subscriptionsProgressBar');
const subscriptionsProgressText = document.getElementById('subscriptionsProgressText');

const playlistsFileInput = document.getElementById('playlistsFileInput');
const selectPlaylistsFileBtn = document.getElementById('selectPlaylistsFileBtn');
const selectedPlaylistsFile = document.getElementById('selectedPlaylistsFile');
const uploadPlaylistsBtn = document.getElementById('uploadPlaylistsBtn');
const playlistsImportProgress = document.getElementById('playlistsImportProgress');
const playlistsProgressBar = document.getElementById('playlistsProgressBar');
const playlistsProgressText = document.getElementById('playlistsProgressText');

const historyFileInput = document.getElementById('historyFileInput');
const selectHistoryFileBtn = document.getElementById('selectHistoryFileBtn');
const selectedHistoryFile = document.getElementById('selectedHistoryFile');
const uploadHistoryBtn = document.getElementById('uploadHistoryBtn');
const historyImportProgress = document.getElementById('historyImportProgress');
const historyProgressBar = document.getElementById('historyProgressBar');
const historyProgressText = document.getElementById('historyProgressText');

// Utility function to show success message
function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
  successDiv.textContent = message;
  document.body.appendChild(successDiv);
  setTimeout(() => successDiv.remove(), 5000);
}

// Generic file import handler with real upload progress
async function handleFileImport(config) {
  const {
    file,
    endpoint,
    fieldName,
    progressElement,
    progressBar,
    progressText,
    uploadBtn,
    selectBtn,
    fileDisplayElement,
    fileInput,
    successMessage,
    queryParams = {} // Support for query parameters
  } = config;

  if (!file) {
    showError('Please select a file first.');
    return;
  }

  // Show progress
  progressElement.classList.remove('hidden');
  uploadBtn.disabled = true;
  selectBtn.disabled = true;
  progressBar.style.width = '0%';
  progressText.textContent = 'Uploading...';

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append(fieldName, file);

    // Build URL with query parameters
    const url = new URL(endpoint, window.location.origin);
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });

    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        progressBar.style.width = `${percentComplete}%`;
        progressText.textContent = `Uploading... ${Math.round(percentComplete)}%`;
      }
    });

    // Handle upload completion
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        progressBar.style.width = '100%';
        progressText.textContent = 'Processing...';

        try {
          const result = JSON.parse(xhr.responseText);

          // Success
          progressText.textContent = 'Import completed successfully!';
          setTimeout(() => {
            progressElement.classList.add('hidden');
            // Reset form
            fileInput.value = '';
            fileDisplayElement.textContent = '';
            uploadBtn.disabled = true;
            selectBtn.disabled = false;
          }, 2000);

          showSuccess(result.message || successMessage);
          resolve(result);
        } catch (parseError) {
          const errorMsg = 'Failed to parse server response';
          progressText.textContent = 'Import failed';
          showError(`Import failed: ${errorMsg}`);
          reject(new Error(errorMsg));
        }
      } else {
        try {
          const result = JSON.parse(xhr.responseText);
          const errorMsg = result.error || `Server returned status ${xhr.status}`;
          progressText.textContent = 'Import failed';
          showError(`Import failed: ${errorMsg}`);
          reject(new Error(errorMsg));
        } catch (parseError) {
          const errorMsg = `Server returned status ${xhr.status}`;
          progressText.textContent = 'Import failed';
          showError(`Import failed: ${errorMsg}`);
          reject(new Error(errorMsg));
        }
      }

      // Hide progress after delay
      setTimeout(() => {
        progressElement.classList.add('hidden');
        uploadBtn.disabled = false;
        selectBtn.disabled = false;
        progressBar.style.width = '0%';
      }, 3000);
    });

    // Handle upload errors
    xhr.addEventListener('error', () => {
      const errorMsg = 'Network error occurred during upload';
      console.error('Upload error:', errorMsg);
      progressText.textContent = 'Upload failed';
      showError(`Upload failed: ${errorMsg}`);

      setTimeout(() => {
        progressElement.classList.add('hidden');
        uploadBtn.disabled = false;
        selectBtn.disabled = false;
        progressBar.style.width = '0%';
      }, 3000);

      reject(new Error(errorMsg));
    });

    // Handle upload abort
    xhr.addEventListener('abort', () => {
      const errorMsg = 'Upload was cancelled';
      progressText.textContent = 'Upload cancelled';
      showError(errorMsg);

      setTimeout(() => {
        progressElement.classList.add('hidden');
        uploadBtn.disabled = false;
        selectBtn.disabled = false;
        progressBar.style.width = '0%';
      }, 3000);

      reject(new Error(errorMsg));
    });

    // Start the upload
    xhr.open('POST', url.toString());
    xhr.send(formData);
  });
}

// Subscriptions Import Functionality
function setupSubscriptionsImport() {
  selectSubscriptionsFileBtn.addEventListener('click', () => {
    subscriptionsFileInput.click();
  });

  subscriptionsFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      selectedSubscriptionsFile.textContent = file.name;
      uploadSubscriptionsBtn.disabled = false;
    } else {
      selectedSubscriptionsFile.textContent = '';
      uploadSubscriptionsBtn.disabled = true;
    }
  });

  uploadSubscriptionsBtn.addEventListener('click', async () => {
    const file = subscriptionsFileInput.files[0];
    const skipAvatars = document.getElementById('skipAvatarsCheckbox').checked;

    await handleFileImport({
      file,
      endpoint: '/api/subscriptions/import',
      fieldName: 'subscriptionsCsv',
      progressElement: subscriptionsImportProgress,
      progressBar: subscriptionsProgressBar,
      progressText: subscriptionsProgressText,
      uploadBtn: uploadSubscriptionsBtn,
      selectBtn: selectSubscriptionsFileBtn,
      fileDisplayElement: selectedSubscriptionsFile,
      fileInput: subscriptionsFileInput,
      successMessage: 'Subscriptions imported successfully!',
      queryParams: { skipAvatars: skipAvatars.toString() }
    });
  });
}

// Playlists Import Functionality
function setupPlaylistsImport() {
  selectPlaylistsFileBtn.addEventListener('click', () => {
    playlistsFileInput.click();
  });

  playlistsFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      selectedPlaylistsFile.textContent = file.name;
      uploadPlaylistsBtn.disabled = false;
    } else {
      selectedPlaylistsFile.textContent = '';
      uploadPlaylistsBtn.disabled = true;
    }
  });

  uploadPlaylistsBtn.addEventListener('click', async () => {
    const file = playlistsFileInput.files[0];
    await handleFileImport({
      file,
      endpoint: '/api/playlists/import',
      fieldName: 'playlistsFile',
      progressElement: playlistsImportProgress,
      progressBar: playlistsProgressBar,
      progressText: playlistsProgressText,
      uploadBtn: uploadPlaylistsBtn,
      selectBtn: selectPlaylistsFileBtn,
      fileDisplayElement: selectedPlaylistsFile,
      fileInput: playlistsFileInput,
      successMessage: 'Playlists imported successfully!'
    });
  });
}

// History Import Functionality
function setupHistoryImport() {
  selectHistoryFileBtn.addEventListener('click', () => {
    historyFileInput.click();
  });

  historyFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      selectedHistoryFile.textContent = file.name;
      uploadHistoryBtn.disabled = false;
    } else {
      selectedHistoryFile.textContent = '';
      uploadHistoryBtn.disabled = true;
    }
  });

  uploadHistoryBtn.addEventListener('click', async () => {
    const file = historyFileInput.files[0];
    await handleFileImport({
      file,
      endpoint: '/api/watch-history/import',
      fieldName: 'historyFile',
      progressElement: historyImportProgress,
      progressBar: historyProgressBar,
      progressText: historyProgressText,
      uploadBtn: uploadHistoryBtn,
      selectBtn: selectHistoryFileBtn,
      fileDisplayElement: selectedHistoryFile,
      fileInput: historyFileInput,
      successMessage: 'Watch history imported successfully!'
    });
  });
}

// Initialize all import functionality
document.addEventListener('DOMContentLoaded', () => {
  setupSubscriptionsImport();
  setupPlaylistsImport();
  setupHistoryImport();
});