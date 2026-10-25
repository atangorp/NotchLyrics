const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const tracker = require('./services/tracker');
const SpotifyService = require('./services/spotify');
const lyricsEngine = require('./services/lyricsEngine');

let mainWindow = null;
let tray = null;
let isGhostMode = false;
let currentPositionMode = 'menubar'; // 'menubar' | 'undernotch'

// Refined compact capsule (330px width fits cleanly inside menu bar without overlapping Help)
const COMPACT_WIDTH = 330;
const COMPACT_HEIGHT = 28;
const EXPANDED_WIDTH = 480;
const EXPANDED_HEIGHT = 160;

function getOptimalX(targetWidth) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.bounds;
  const centeredX = Math.round((screenWidth - targetWidth) / 2);

  // On 13-14" Macs, place it comfortably past the Help menu (x >= 615)
  if (screenWidth <= 1500) {
    return Math.max(centeredX, 615);
  }
  return centeredX;
}

function createNotchWindow() {
  const initialX = getOptimalX(COMPACT_WIDTH);
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
    hasShadow: false,
    type: 'panel', // NSPanel allows sitting directly inside macOS top menu bar
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

  const targetWidth = isExpanded ? EXPANDED_WIDTH : COMPACT_WIDTH;
  const targetHeight = isExpanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT;
  const x = getOptimalX(targetWidth);
  const y = (currentPositionMode === 'undernotch') ? 36 : 0;

  mainWindow.setBounds({ x, y, width: targetWidth, height: targetHeight });
}

function createTray() {
  // Use Forvala logo as native macOS Template Image (replaces the green circle!)
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
      label: 'Posisi: Bar Menu Paling Atas',
      type: 'radio',
      checked: currentPositionMode === 'menubar',
      click: () => setPosition('menubar')
    },
    {
      label: 'Posisi: Di Bawah Notch',
      type: 'radio',
      checked: currentPositionMode === 'undernotch',
      click: () => setPosition('undernotch')
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

function setPosition(mode) {
  currentPositionMode = mode;
  if (!mainWindow) return;

  const currentBounds = mainWindow.getBounds();
  const x = getOptimalX(currentBounds.width);
  const y = (mode === 'undernotch') ? 36 : 0;

  mainWindow.setBounds({ x, y, width: currentBounds.width, height: currentBounds.height });
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
