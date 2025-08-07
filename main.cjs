const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Keep a global reference of the window object to avoid garbage collection
let mainWindow;
let serverProcess;
let pendingUrl = null; // Store URL if app isn't ready yet

// Check if in development mode
const isDev = process.env.ELECTRON_DEV === 'true';

// Helper function to extract YouTube Video ID
function extractVideoId(url) {
  // Handle freetube:// protocol URLs from LibRedirect
  if (url.startsWith('freetube://')) {
    // Remove the freetube:// prefix to get the actual content
    const actualUrl = url.replace('freetube://', '');

    // Check if it's a direct video ID (11 characters alphanumeric)
    const videoIdMatch = actualUrl.match(/^([a-zA-Z0-9_-]{11})$/);
    if (videoIdMatch) {
      return videoIdMatch[1];
    }

    // Otherwise, treat it as a YouTube URL (with or without protocol)
    const fullUrl = actualUrl.startsWith('http') ? actualUrl : `https://${actualUrl}`;

    // Recursively call extractVideoId with the cleaned URL
    return extractVideoId(fullUrl);
  }

  // Regex to capture video ID from various YouTube URL formats
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Handle URLs passed to the application
function handleUrl(url) {
  // Extract video ID from the URL
  const videoId = extractVideoId(url);

  if (videoId) {
    if (mainWindow && mainWindow.webContents) {
      // If window is ready, send video ID directly
      mainWindow.webContents.send('load-video-from-main', videoId);
    } else {
      // Store URL for when window is ready
      pendingUrl = url;
    }
  }
}

// Start the Express server as a separate Node.js process
function startServer() {
  // Determine the correct path to server.js based on environment
  let serverPath;
  if (isDev) {
    // In development, server.js is relative to the project root
    serverPath = path.join(__dirname, 'src', 'server.js');
    console.log(`[Main Process] Starting server in dev mode: ${serverPath}`);
  } else {
    // In production (packaged), server.js is unpacked directly into resources/app.asar.unpacked
    serverPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'server.js'); // Corrected unpacked path
    console.log(`[Main Process] Starting server in prod mode (unpacked): ${serverPath}`);
  }

  // Check if the server file actually exists at the determined path
  if (!fs.existsSync(serverPath)) {
    console.error(`[Main Process] Error: Server file not found at ${serverPath}`);
    // Optionally, show an error dialog to the user
    // dialog.showErrorBox('Error', `Could not find the server file at ${serverPath}`);
    app.quit(); // Exit if the server can't be found
    return;
  }


  // Spawn the server as a child process
  console.log(`[Main Process] Spawning node process with: ${serverPath}`);
  serverProcess = spawn('node', [serverPath], {
    //stdio: 'inherit' // 'inherit' might cause issues in packaged apps, let's try piping
    stdio: ['pipe', 'pipe', 'pipe'] // Pipe stdout, stderr, stdin
  });

  // Log server output for debugging
  serverProcess.stdout.on('data', (data) => {
    console.log(`[Server STDOUT]: ${data}`);
  });
  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server STDERR]: ${data}`);
  });


  serverProcess.on('error', (error) => {
    console.error('[Main Process] Failed to start server process:', error);
    // Show error to user?
  });

  serverProcess.on('close', (code) => {
    console.info(`[Main Process] Server process exited with code ${code}`);
    // Handle unexpected server exit?
    if (code !== 0 && code !== null) {
      console.error(`[Main Process] Server process exited unexpectedly with code ${code}.`);
      // Optionally show error or try to restart
    }
  });
}

// Create the browser window
function createWindow() {
  const iconPath = path.resolve(__dirname, 'public', 'img', 'icon.png');
  console.log(`[Main Process] Using icon path: ${iconPath}`);
  console.log(`[Main Process] Icon file exists: ${fs.existsSync(iconPath)}`);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
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

  // Additional Linux icon setup
  if (process.platform === 'linux') {
    // Force icon update on Linux
    mainWindow.setIcon(iconPath);
  }

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
    mainWindow.loadURL('http://localhost:4420');

    // Open DevTools automatically in development mode
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  }, 1000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle any pending URL that was passed before window was ready
  if (pendingUrl) {
    setTimeout(() => {
      handleUrl(pendingUrl);
      pendingUrl = null;
    }, 4000); // Wait longer for the app to fully load and IPC listener to be set up
  }

  // Set the application menu (optional)
  // You can uncomment and customize this if needed
  // const menu = Menu.buildFromTemplate(menuTemplate);
  // Menu.setApplicationMenu(menu);
}

// Make app single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // Handle second instance (when app is already running and user opens another URL)
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead and handle the URL
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }

    // Handle URL from command line arguments (http or freetube protocol)
    const url = commandLine.find(arg => arg.startsWith('http') || arg.startsWith('freetube://'));
    if (url) {
      handleUrl(url);
    }
  });

  // Handle URLs on macOS
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleUrl(url);
  });

  // Initialize app
  app.whenReady().then(() => {
    // Handle URL from command line arguments on first launch (http or freetube protocol)
    const url = process.argv.find(arg => arg.startsWith('http') || arg.startsWith('freetube://'));
    if (url) {
      pendingUrl = url;
    }

    startServer();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

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