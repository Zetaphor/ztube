const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Expose a function to set up the listener in the renderer
  onVideoLoadRequest: (callback) => {
    // Set up the listener for 'load-video-from-main'
    ipcRenderer.on('load-video-from-main', (_event, videoId) => {
      console.info('preload.cjs: Received load-video-from-main IPC message with ID:', videoId);
      // Execute the callback provided by the renderer process
      callback(videoId);
    });
  }
});