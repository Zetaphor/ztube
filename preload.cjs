const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Expose a function to set up the listener in the renderer
  onVideoLoadRequest: (callback) => {
    // Set up the listener for 'load-video-from-main'
    ipcRenderer.on('load-video-from-main', (_event, videoId) => {
      console.log('preload.cjs: Received load-video-from-main IPC message with ID:', videoId);
      // Execute the callback provided by the renderer process
      callback(videoId);
    });

    // Optional: Return a function to clean up the listener if needed
    // return () => ipcRenderer.removeAllListeners('load-video-from-main');
  }
  // You can add other APIs here if needed
});

console.log('preload.cjs: electronAPI exposed');

window.addEventListener('DOMContentLoaded', () => {
  // You can expose Node.js APIs to the renderer process here if needed
  // For example:
  // contextBridge.exposeInMainWorld('electronAPI', { ... })

  console.log('Preload script has loaded successfully');

  // You can also manipulate the DOM here if needed
  const appInfo = document.createElement('div');
  appInfo.style.display = 'none';
  appInfo.id = 'electron-app-info';
  appInfo.textContent = 'Running in Electron';
  document.body.appendChild(appInfo);
});