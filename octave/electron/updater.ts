/**
 * Auto-Updater Module for Octave
 *
 * Handles automatic update checks, downloads, and installation.
 * Uses electron-updater for seamless background updates.
 */

const { autoUpdater } = require('electron-updater');
const { app, ipcMain } = require('electron');

/**
 * Update state tracked throughout the lifecycle
 */
let updateState = {
  checking: false,
  available: false,
  downloaded: false,
  error: null,
  progress: null,
  version: null
};

/**
 * Initialize auto-updater with production-safe configuration
 */
function initializeAutoUpdater(mainWindow) {
  console.log('[updater] Initializing auto-updater...');

  // Configure auto-updater
  autoUpdater.autoDownload = false; // Manual download control for better UX
  autoUpdater.autoInstallOnAppQuit = true; // Install when user quits

  // Only check for updates in production builds
  if (!app.isPackaged) {
    console.log('[updater] Running in development mode - updates disabled');
    return;
  }

  // ===== Event Handlers =====

  /**
   * Fired when checking for updates begins
   */
  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Checking for updates...');
    updateState.checking = true;
    sendStatusToWindow(mainWindow, 'checking-for-update');
  });

  /**
   * Fired when an update is available
   */
  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Update available:', info.version);
    updateState.checking = false;
    updateState.available = true;
    updateState.version = info.version;
    sendStatusToWindow(mainWindow, 'update-available', { version: info.version });
  });

  /**
   * Fired when no update is available
   */
  autoUpdater.on('update-not-available', (info) => {
    console.log('[updater] No update available. Current version:', info.version);
    updateState.checking = false;
    updateState.available = false;
    sendStatusToWindow(mainWindow, 'update-not-available');
  });

  /**
   * Fired when there's an error during update process
   */
  autoUpdater.on('error', (error) => {
    console.error('[updater] Error during update:', error);
    updateState.checking = false;
    updateState.error = error.message;
    sendStatusToWindow(mainWindow, 'update-error', { error: error.message });
  });

  /**
   * Fired during download progress
   */
  autoUpdater.on('download-progress', (progressObj) => {
    const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
    console.log('[updater]', logMessage);

    updateState.progress = {
      percent: Math.round(progressObj.percent),
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond
    };

    sendStatusToWindow(mainWindow, 'download-progress', updateState.progress);
  });

  /**
   * Fired when update has been downloaded and is ready to install
   */
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] Update downloaded. Version:', info.version);
    updateState.downloaded = true;
    updateState.version = info.version;
    sendStatusToWindow(mainWindow, 'update-downloaded', { version: info.version });
  });

  // ===== IPC Handlers =====

  /**
   * Check for updates on demand (called from renderer)
   */
  ipcMain.handle('updater:check', async () => {
    if (!app.isPackaged) {
      return { error: 'Updates only available in production builds' };
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result.updateInfo };
    } catch (error) {
      console.error('[updater] Check failed:', error);
      return { error: error.message };
    }
  });

  /**
   * Download the available update
   */
  ipcMain.handle('updater:download', async () => {
    if (!updateState.available) {
      return { error: 'No update available' };
    }

    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      console.error('[updater] Download failed:', error);
      return { error: error.message };
    }
  });

  /**
   * Install the downloaded update and restart app
   */
  ipcMain.handle('updater:install', async () => {
    if (!updateState.downloaded) {
      return { error: 'No update downloaded' };
    }

    // This will quit the app and install the update
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return { success: true };
  });

  /**
   * Get current update state
   */
  ipcMain.handle('updater:get-state', async () => {
    return updateState;
  });

  // ===== Auto-check on startup =====

  /**
   * Check for updates 5 seconds after app is ready
   * Delay prevents interfering with app initialization
   */
  setTimeout(() => {
    if (app.isPackaged) {
      console.log('[updater] Running automatic update check...');
      autoUpdater.checkForUpdates().catch(err => {
        console.error('[updater] Auto-check failed:', err);
      });
    }
  }, 5000);
}

/**
 * Send update status to renderer process
 */
function sendStatusToWindow(mainWindow, event, data = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', {
      event,
      data,
      state: updateState
    });
  }
}

module.exports = {
  initializeAutoUpdater
};
