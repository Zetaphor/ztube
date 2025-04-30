const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Keep a global reference of the window object to avoid garbage collection
let mainWindow;
let serverProcess;

// Check if in development mode
const isDev = process.env.ELECTRON_DEV === 'true';

// Helper function to extract YouTube Video ID
function extractVideoId(url) {
  // Regex to capture video ID from various YouTube URL formats
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Start the Express server as a separate Node.js process
function startServer() {

  // Use the correct path to the server file
  const serverPath = path.join(__dirname, 'src', 'server.js');

  // Spawn the server as a child process
  serverProcess = spawn('node', [serverPath], {
    stdio: 'inherit'
  });

  serverProcess.on('error', (error) => {
    console.error('Failed to start server process:', error);
  });

  serverProcess.on('close', (code) => {
    console.info(`Server process exited with code ${code}`);
  });
}

// Create the browser window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'public', 'img', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      // Security setting - restrict navigation potentially initiated by the embed
      // webSecurity: true // Ensure this is true (default)
    }
  });

  mainWindow.setMenuBarVisibility(false);

  // --- Replace 'new-window' listener with setWindowOpenHandler ---
  mainWindow.webContents.setWindowOpenHandler(({ url, disposition, features, frameName, referrer, postBody }) => {
    console.info(`[Main Process] setWindowOpenHandler intercepted request for URL: ${url}`);
    console.info(`[Main Process] Disposition: ${disposition}`); // Log disposition (e.g., 'new-window', 'foreground-tab')

    const videoId = extractVideoId(url);

    if (videoId) {
      console.info(`[Main Process] Detected YouTube video link. ID: ${videoId}. Denying new window and sending IPC.`);
      // Send video ID to the renderer process to load it internally
      mainWindow.webContents.send('load-video-from-main', videoId);
      // Deny Electron from creating a new window
      return { action: 'deny' };
    } else {
      console.info('[Main Process] URL is not a YouTube video link. Opening externally.');
      // For all other links, open in the default browser
      try {
        shell.openExternal(url);
        console.info(`[Main Process] Called shell.openExternal for: ${url}`);
      } catch (e) {
        console.error(`[Main Process] Error calling shell.openExternal for ${url}:`, e);
      }
      // Deny Electron from creating a new window as we handled it externally
      return { action: 'deny' };
    }

    // Default fallback (shouldn't be reached with the logic above, but good practice)
    // return { action: 'allow' }; // Or deny if you want to block everything else
  });
  // --- End setWindowOpenHandler ---

  // Wait a bit for the server to start before loading the app
  setTimeout(() => {
    // Load the app from the local server
    mainWindow.loadURL('http://localhost:3000');

    // Open DevTools automatically in development mode
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  }, 1000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set the application menu (optional)
  // You can uncomment and customize this if needed
  // const menu = Menu.buildFromTemplate(menuTemplate);
  // Menu.setApplicationMenu(menu);
}

// Initialize app
app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up the server process when the app is quitting
app.on('quit', () => {
  if (serverProcess) {
    if (process.platform === 'win32') {
      // On Windows, we need to kill the process group
      spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t']);
    } else {
      // On Linux/macOS
      serverProcess.kill();
    }
  }
});