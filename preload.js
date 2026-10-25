const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notchLyricsAPI', {
  // Event listeners
  onTrackUpdate: (callback) => ipcRenderer.on('tracker-update', (event, data) => callback(data)),
  onIdle: (callback) => ipcRenderer.on('tracker-idle', (event, data) => callback(data)),

  // Controls
  playPause: () => ipcRenderer.invoke('player-playpause'),
  nextTrack: () => ipcRenderer.invoke('player-next'),
  prevTrack: () => ipcRenderer.invoke('player-prev'),
  setOffset: (offset) => ipcRenderer.invoke('set-offset', offset),

  // Window actions
  setWindowSize: (width, height) => ipcRenderer.invoke('set-window-size', { width, height }),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.invoke('set-ignore-mouse', ignore),
  setPositionMode: (mode) => ipcRenderer.invoke('set-position-mode', mode),
  closeApp: () => ipcRenderer.invoke('close-app'),

  // Manual / Demo Mode
  setManualTrack: (song) => ipcRenderer.invoke('set-manual-track', song),
  clearManualMode: () => ipcRenderer.invoke('clear-manual-mode'),
  searchSong: (query) => ipcRenderer.invoke('search-song', query)
});
