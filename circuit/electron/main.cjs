const { app, BrowserWindow } = require('electron');
const path = require('path');

// macOS traffic light button positioning
const HEADER_HEIGHT = 60;
const TRAFFIC_LIGHTS_HEIGHT = 14;
const TRAFFIC_LIGHTS_MARGIN = 20;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    ...(process.platform === 'darwin' && {
      trafficLightPosition: {
        x: TRAFFIC_LIGHTS_MARGIN,
        y: (HEADER_HEIGHT - TRAFFIC_LIGHTS_HEIGHT) / 2
      }
    }),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Load from Vite dev server in development, or built files in production
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
