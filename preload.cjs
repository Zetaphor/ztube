const { contextBridge } = require('electron');

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