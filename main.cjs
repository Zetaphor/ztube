const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Keep a global reference of the window object to avoid garbage collection
let mainWindow;
let serverProcess;

// Check if in development mode
const isDev = process.env.ELECTRON_DEV === 'true';

// Start the Express server as a separate Node.js process
function startServer() {
  console.log('Starting server process...');

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
    console.log(`Server process exited with code ${code}`);
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
      contextIsolation: true
    }
  });

  mainWindow.setMenuBarVisibility(false);

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
    console.log('Terminating server process...');
    if (process.platform === 'win32') {
      // On Windows, we need to kill the process group
      spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t']);
    } else {
      // On Linux/macOS
      serverProcess.kill();
    }
  }
});