const { autoUpdater } = require('electron-updater');
const { app, ipcMain } = require('electron');

// Update state tracking
const updateState = {
  checking: false,
  available: false,
  downloading: false,
  downloaded: false,
  error: null,
  version: null,
  progress: null,
};

function sendStatusToWindow(mainWindow, event, data = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', {
      event,
      state: updateState,
      ...data,
    });
  }
}

function initializeAutoUpdater(mainWindow) {
  console.log('[updater] Initializing auto-updater...');

  // Configure auto-updater
  autoUpdater.autoDownload = false; // Manual download control
  autoUpdater.autoInstallOnAppQuit = true; // Auto-install when app quits

  // Event: Checking for updates
  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Checking for updates...');
    updateState.checking = true;
    updateState.error = null;
    sendStatusToWindow(mainWindow, 'checking-for-update');
  });

  // Event: Update available
  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Update available:', info.version);
    updateState.checking = false;
    updateState.available = true;
    updateState.version = info.version;
    sendStatusToWindow(mainWindow, 'update-available', { version: info.version });
  });

  // Event: Update not available
  autoUpdater.on('update-not-available', (info) => {
    console.log('[updater] Update not available. Current version:', info.version);
    updateState.checking = false;
    updateState.available = false;
    sendStatusToWindow(mainWindow, 'update-not-available');
  });

  // Event: Download progress
  autoUpdater.on('download-progress', (progressObj) => {
    console.log('[updater] Download progress:', progressObj.percent.toFixed(2) + '%');
    updateState.progress = {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond,
    };
    sendStatusToWindow(mainWindow, 'download-progress', { progress: updateState.progress });
  });

  // Event: Update downloaded
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] Update downloaded:', info.version);
    updateState.downloading = false;
    updateState.downloaded = true;
    updateState.version = info.version;
    sendStatusToWindow(mainWindow, 'update-downloaded', { version: info.version });
  });

  // Event: Error
  autoUpdater.on('error', (error) => {
    console.error('[updater] Error:', error);
    updateState.checking = false;
    updateState.downloading = false;
    updateState.error = error.message;
    sendStatusToWindow(mainWindow, 'error', { error: error.message });
  });

  // IPC: Check for updates
  ipcMain.handle('updater:check', async () => {
    try {
      console.log('[updater] Manual check for updates triggered');
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo };
    } catch (error) {
      console.error('[updater] Check failed:', error);
      return { success: false, error: error.message };
    }
  });

  // IPC: Download update
  ipcMain.handle('updater:download', async () => {
    try {
      console.log('[updater] Starting download...');
      updateState.downloading = true;
      updateState.progress = null;
      sendStatusToWindow(mainWindow, 'download-started');

      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      console.error('[updater] Download failed:', error);
      updateState.downloading = false;
      return { success: false, error: error.message };
    }
  });

  // IPC: Install update (quit and install)
  ipcMain.handle('updater:install', async () => {
    try {
      console.log('[updater] Installing update and restarting...');
      autoUpdater.quitAndInstall(false, true);
      return { success: true };
    } catch (error) {
      console.error('[updater] Install failed:', error);
      return { success: false, error: error.message };
    }
  });

  // IPC: Get current update state
  ipcMain.handle('updater:get-state', async () => {
    return updateState;
  });

  // Auto-check for updates on app start (5 seconds delay)
  setTimeout(() => {
    if (app.isPackaged) {
      console.log('[updater] Auto-checking for updates...');
      autoUpdater.checkForUpdates().catch((error) => {
        console.error('[updater] Auto-check failed:', error);
      });
    } else {
      console.log('[updater] Skipping auto-check in development mode');
    }
  }, 5000);

  console.log('[updater] Auto-updater initialized successfully');
}

module.exports = { initializeAutoUpdater };
