const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const tracker = require('./services/tracker');
const SpotifyService = require('./services/spotify');
const lyricsEngine = require('./services/lyricsEngine');

let mainWindow = null;
let tray = null;
let isGhostMode = false;
let currentPositionMode = 'menubar'; // 'menubar' | 'undernotch' | 'floating' | 'bottom'

// More compact width so it doesn't overlap Help/Window menu items on MacBook Air
const COMPACT_WIDTH = 340;
const COMPACT_HEIGHT = 28;
 // Fits inside macOS top menu bar (~28-32px)
const EXPANDED_WIDTH = 560;
const EXPANDED_HEIGHT = 175;


function getOptimalX(targetWidth) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.bounds;
  const centeredX = Math.round((screenWidth - targetWidth) / 2);
  if (screenWidth <= 1500) {
    return Math.max(centeredX, 610);
  }
  return centeredX;
}

function createNotchWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.bounds;

  // Centered cleanly in the empty space of the top menu bar
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
    type: 'panel', // NSPanel allows floating directly inside the macOS top menu bar
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Keep floating on top of all spaces & menu bar
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

  if (currentPositionMode === 'menubar') {
    const x = getOptimalX(targetWidth);
    mainWindow.setBounds({ x, y: 0, width: targetWidth, height: targetHeight });
  } else if (currentPositionMode === 'undernotch') {
    const x = getOptimalX(targetWidth);
    mainWindow.setBounds({ x, y: 36, width: targetWidth, height: targetHeight });
  } else {
    mainWindow.setSize(targetWidth, targetHeight);
  }
}

function createTray() {
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
      label: 'Posisi: Bar Menu Paling Atas (Rata Menu Bar)',
      type: 'radio',
      checked: currentPositionMode === 'menubar',
      click: () => setPosition('menubar')
    },
    {
      label: 'Posisi: Di Bawah Notch (Standar)',
      type: 'radio',
      checked: currentPositionMode === 'undernotch',
      click: () => setPosition('undernotch')
    },
    {
      label: 'Posisi: Bebas Geser (Draggable)',
      type: 'radio',
      checked: currentPositionMode === 'floating',
      click: () => setPosition('floating')
    },
    {
      label: 'Posisi: Bawah Layar',
      type: 'radio',
      checked: currentPositionMode === 'bottom',
      click: () => setPosition('bottom')
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
      label: 'Demo: Adele - Someone Like You',
      click: () => tracker.setManualTrack({ title: 'Someone Like You', artist: 'Adele', duration: 285 })
    },
    {
      label: 'Demo: NIKI - Backburner',
      click: () => tracker.setManualTrack({ title: 'Backburner', artist: 'NIKI', duration: 236 })
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

  if (mode === 'menubar') {
    const x = getOptimalX(currentBounds.width);
    mainWindow.setBounds({ x, y: 0, width: currentBounds.width, height: currentBounds.height });
  } else if (mode === 'undernotch') {
    const x = getOptimalX(currentBounds.width);
    mainWindow.setBounds({ x, y: 36, width: currentBounds.width, height: currentBounds.height });
  } else if (mode === 'bottom') {
    const x = getOptimalX(currentBounds.width);
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
