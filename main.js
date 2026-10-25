const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const tracker = require('./services/tracker');
const SpotifyService = require('./services/spotify');
const lyricsEngine = require('./services/lyricsEngine');

let mainWindow = null;
let tray = null;
let isGhostMode = false;
let currentPositionMode = 'notch'; // 'notch' | 'floating' | 'bottom'

const COMPACT_WIDTH = 580;
const COMPACT_HEIGHT = 44;
const EXPANDED_WIDTH = 620;
const EXPANDED_HEIGHT = 175;

function createNotchWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.bounds;

  // Snug right below or inside the MacBook notch bezel
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
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Keep floating on top of full-screen spaces on macOS
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

  // Tracker events forwarded to renderer
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

  if (currentPositionMode === 'notch') {
    const x = Math.round((screenWidth - targetWidth) / 2);
    mainWindow.setBounds({ x, y: 0, width: targetWidth, height: targetHeight });
  } else {
    const bounds = mainWindow.getBounds();
    mainWindow.setSize(targetWidth, targetHeight);
  }
}

function createTray() {
  // Simple 16x16 tray icon
  const icon = nativeImage.createFromNamedImage('NSStatusAvailable');
  tray = new Tray(icon);
  tray.setToolTip('NotchLyrics - Real-time Sing-along Lyrics');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '🎵 NotchLyrics v1.0',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Position: Notch (Top Center)',
      type: 'radio',
      checked: currentPositionMode === 'notch',
      click: () => setPosition('notch')
    },
    {
      label: 'Position: Floating Pill (Draggable)',
      type: 'radio',
      checked: currentPositionMode === 'floating',
      click: () => setPosition('floating')
    },
    {
      label: 'Position: Bottom Center',
      type: 'radio',
      checked: currentPositionMode === 'bottom',
      click: () => setPosition('bottom')
    },
    { type: 'separator' },
    {
      label: 'Ghost Mode (Click-Through)',
      type: 'checkbox',
      checked: isGhostMode,
      click: (item) => toggleGhostMode(item.checked)
    },
    { type: 'separator' },
    {
      label: 'Demo: Adele - Someone Like You',
      click: () => tracker.setManualTrack({ title: 'Someone Like You', artist: 'Adele', duration: 285 })
    },
    {
      label: 'Demo: NIKI - Backburner',
      click: () => tracker.setManualTrack({ title: 'Backburner', artist: 'NIKI', duration: 236 })
    },
    {
      label: 'Demo: Bruno Mars & Lady Gaga - Die With A Smile',
      click: () => tracker.setManualTrack({ title: 'Die With A Smile', artist: 'Bruno Mars, Lady Gaga', duration: 251 })
    },
    {
      label: 'Auto Detect (Spotify / YouTube)',
      click: () => tracker.clearManualMode()
    },
    { type: 'separator' },
    {
      label: 'Quit NotchLyrics',
      role: 'quit'
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function setPosition(mode) {
  currentPositionMode = mode;
  if (!mainWindow) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
  const currentBounds = mainWindow.getBounds();

  if (mode === 'notch') {
    const x = Math.round((screenWidth - currentBounds.width) / 2);
    mainWindow.setBounds({ x, y: 0, width: currentBounds.width, height: currentBounds.height });
  } else if (mode === 'bottom') {
    const x = Math.round((screenWidth - currentBounds.width) / 2);
    const y = screenHeight - currentBounds.height - 40;
    mainWindow.setBounds({ x, y, width: currentBounds.width, height: currentBounds.height });
  }
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

ipcMain.handle('set-position-mode', (event, mode) => {
  setPosition(mode);
  return currentPositionMode;
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

ipcMain.handle('search-song', async (event, query) => {
  return lyricsEngine.getLyrics({ title: query, artist: '', query });
});

ipcMain.handle('close-app', () => {
  app.quit();
});

// App Lifecycle
app.whenReady().then(() => {
  // Hide from Dock for clean background accessory look
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
