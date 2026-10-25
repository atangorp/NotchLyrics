const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const tracker = require('./services/tracker');
const SpotifyService = require('./services/spotify');
const lyricsEngine = require('./services/lyricsEngine');

let mainWindow = null;
let tray = null;
let isGhostMode = false;

// 340px notch body + 24px concave ears = 364px width (Exact match to MacBook Notch, flat zero shadow)
const COMPACT_WIDTH = 364;
const COMPACT_HEIGHT = 36;
const EXPANDED_WIDTH = 484;
const EXPANDED_HEIGHT = 160;

function createNotchWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.bounds;

  // Perfectly centered horizontally over the MacBook camera notch at y = 0
  const initialX = Math.round((screenWidth - COMPACT_WIDTH) / 2);
  const initialY = 0;

  mainWindow = new BrowserWindow({
    width: COMPACT_WIDTH,
    height: COMPACT_HEIGHT,
    x: initialX,
    y: initialY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false, // ZERO SHADOW on window
    type: 'panel', // NSPanel sits flush over macOS top bezel
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

  tracker.on('update', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tracker-update', data);
    }
  });

  tracker.on('idle', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tracker-idle', data);
    }
  });

  tracker.start();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function updateWindowSize(isExpanded) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.bounds;

  const targetWidth = isExpanded ? EXPANDED_WIDTH : COMPACT_WIDTH;
  const targetHeight = isExpanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT;
  const x = Math.round((screenWidth - targetWidth) / 2);

  mainWindow.setBounds({ x, y: 0, width: targetWidth, height: targetHeight });
}

function createTray() {
  // Use Zoomed/Cropped Forvala logo as native macOS Template Image
  const trayIconPath = path.join(__dirname, 'assets', 'trayTemplate.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(trayIconPath);
    if (!icon.isEmpty()) {
      icon.setTemplateImage(true);
    } else {
      icon = nativeImage.createFromNamedImage('NSStatusAvailable');
    }
  } catch (e) {
    icon = nativeImage.createFromNamedImage('NSStatusAvailable');
  }

  tray = new Tray(icon);
  tray.setToolTip('NotchVala');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'NotchVala v1.0',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Ghost Mode (Klik Tembus Pandang)',
      type: 'checkbox',
      checked: isGhostMode,
      click: (item) => toggleGhostMode(item.checked)
    },
    { type: 'separator' },
    {
      label: 'Demo: NIKI - Backburner',
      click: () => tracker.setManualTrack({ title: 'Backburner', artist: 'NIKI', duration: 236 })
    },
    {
      label: 'Demo: Adele - Someone Like You',
      click: () => tracker.setManualTrack({ title: 'Someone Like You', artist: 'Adele', duration: 285 })
    },
    {
      label: 'Deteksi Otomatis (Spotify / YouTube)',
      click: () => tracker.clearManualMode()
    },
    { type: 'separator' },
    {
      label: 'Keluar dari NotchVala',
      role: 'quit'
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function toggleGhostMode(enabled) {
  isGhostMode = enabled;
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(isGhostMode, { forward: true });
  }
}

// IPC Handlers
ipcMain.handle('set-window-size', (event, { width, height }) => {
  const isExpanded = height > COMPACT_HEIGHT;
  updateWindowSize(isExpanded);
  return true;
});

ipcMain.handle('set-ignore-mouse', (event, ignore) => {
  toggleGhostMode(ignore);
  return isGhostMode;
});

ipcMain.handle('player-playpause', async () => {
  return SpotifyService.playPause();
});

ipcMain.handle('player-next', async () => {
  return SpotifyService.next();
});

ipcMain.handle('player-prev', async () => {
  return SpotifyService.previous();
});

ipcMain.handle('set-offset', (event, offset) => {
  tracker.setOffset(offset);
  return offset;
});

ipcMain.handle('set-manual-track', async (event, song) => {
  await tracker.setManualTrack(song);
  return true;
});

ipcMain.handle('clear-manual-mode', () => {
  tracker.clearManualMode();
  return true;
});

ipcMain.handle('close-app', () => {
  app.quit();
});

app.whenReady().then(() => {
  if (app.dock) {
    app.dock.hide();
  }

  createNotchWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createNotchWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
