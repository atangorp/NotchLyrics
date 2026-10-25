// Frontend Controller for NotchLyrics
(function() {
  const isElectron = Boolean(window.notchLyricsAPI);

  // DOM Elements
  const appContainer = document.getElementById('appContainer');
  const notchBar = document.getElementById('notchBar');
  const activeLyricEl = document.getElementById('activeLyric');
  const timeDisplayEl = document.getElementById('timeDisplay');
  const expandBtn = document.getElementById('expandBtn');
  const sourceIconEl = document.getElementById('sourceIcon');
  const sourceBadgeEl = document.getElementById('sourceBadge');
  const equalizerEl = document.getElementById('equalizer');

  // Expanded Elements
  const trackTitleEl = document.getElementById('trackTitle');
  const trackArtistEl = document.getElementById('trackArtist');
  const syncStatusBadge = document.getElementById('syncStatusBadge');
  const ghostModeBtn = document.getElementById('ghostModeBtn');
  const progressFill = document.getElementById('progressFill');
  const nextLyricEl = document.getElementById('nextLyric');
  const offsetMinusBtn = document.getElementById('offsetMinus');
  const offsetPlusBtn = document.getElementById('offsetPlus');
  const offsetDisplayEl = document.getElementById('offsetDisplay');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const demoBtn = document.getElementById('demoBtn');
  const searchTriggerBtn = document.getElementById('searchTriggerBtn');
  const searchOverlay = document.getElementById('searchOverlay');
  const searchInput = document.getElementById('searchInput');
  const searchSubmitBtn = document.getElementById('searchSubmitBtn');
  const searchCloseBtn = document.getElementById('searchCloseBtn');

  // State
  let isExpanded = false;
  let isGhost = false;
  let currentOffset = 0.0;
  let lastServerState = null;
  let lastLyricText = '';
  let localTimerId = null;

  // Format seconds to mm:ss
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Update Lyric Display with spring animation
  function updateLyricLine(text) {
    if (text === lastLyricText) return;

    activeLyricEl.classList.add('anim-change');
    setTimeout(() => {
      activeLyricEl.textContent = text || '🎵 ...';
      activeLyricEl.classList.remove('anim-change');
      lastLyricText = text;
    }, 120);
  }

  // Process incoming state updates
  function handleStateUpdate(data) {
    lastServerState = data;
    const { track, lyricsInfo, activeLine, nextLine, offset } = data;

    currentOffset = offset || 0.0;
    offsetDisplayEl.textContent = `${currentOffset >= 0 ? '+' : ''}${currentOffset.toFixed(1)}s`;

    // 1. Source & Playing status
    const isPlaying = track.state === 'playing';
    equalizerEl.className = isPlaying ? 'equalizer active' : 'equalizer paused';

    if (track.source === 'spotify') {
      if (sourceBadgeEl) sourceBadgeEl.className = 'source-badge spotify';
      if (sourceIconEl) sourceIconEl.textContent = '🟢';
    } else if (track.source === 'youtube') {
      if (sourceBadgeEl) sourceBadgeEl.className = 'source-badge youtube';
      if (sourceIconEl) sourceIconEl.textContent = '▶️';
    } else {
      if (sourceBadgeEl) sourceBadgeEl.className = 'source-badge';
      if (sourceIconEl) sourceIconEl.textContent = '🎵';
    }

    // 2. Track Info in Expanded Card
    trackTitleEl.textContent = track.title || 'Tidak Ada Judul';
    trackArtistEl.textContent = track.artist || 'Tidak Ada Artis';
    playPauseBtn.textContent = isPlaying ? '⏸' : '▶';

    // 3. Lyrics info
    if (lyricsInfo && lyricsInfo.isSynced) {
      syncStatusBadge.textContent = 'Synced ⚡';
      syncStatusBadge.style.background = 'rgba(168, 85, 247, 0.2)';
      syncStatusBadge.style.color = '#d8b4fe';
    } else if (lyricsInfo && lyricsInfo.hasLyrics) {
      syncStatusBadge.textContent = 'Plain 📝';
      syncStatusBadge.style.background = 'rgba(59, 130, 246, 0.2)';
      syncStatusBadge.style.color = '#93c5fd';
    } else {
      syncStatusBadge.textContent = 'No Lyrics';
      syncStatusBadge.style.background = 'rgba(239, 68, 68, 0.2)';
      syncStatusBadge.style.color = '#fca5a5';
    }

    // 4. Active & Next Lyric
    const lineText = activeLine ? activeLine.text : (track.title ? `🎵 ${track.title} - ${track.artist}` : 'Menunggu lagu...');
    updateLyricLine(lineText);

    nextLyricEl.textContent = nextLine ? nextLine.text : '...';

    // 5. Time & Progress
    timeDisplayEl.textContent = formatTime(track.position);
    if (track.duration > 0) {
      const pct = Math.min(100, Math.max(0, (track.position / track.duration) * 100));
      progressFill.style.width = `${pct}%`;
    }
  }

  // Handle Idle State (no music playing)
  function handleIdle(data) {
    equalizerEl.className = 'equalizer paused';
    if (sourceBadgeEl) sourceBadgeEl.className = 'source-badge';
    if (sourceIconEl) sourceIconEl.textContent = '🎵';
    updateLyricLine(data.message || 'Buka Spotify atau YouTube untuk bernyanyi...');
    trackTitleEl.textContent = 'Tidak Ada Musik';
    trackArtistEl.textContent = 'Putar lagu di Spotify atau YouTube';
    timeDisplayEl.textContent = '00:00';
    progressFill.style.width = '0%';
    nextLyricEl.textContent = '...';
    playPauseBtn.textContent = '▶';
  }

  // Interpolation Loop: updates current position every 100ms between backend polls
  function startInterpolationLoop() {
    setInterval(() => {
      if (!lastServerState || !lastServerState.track || lastServerState.track.state !== 'playing') {
        return;
      }
      const track = lastServerState.track;
      const elapsed = (Date.now() - (lastServerState.timestamp || Date.now())) / 1000;
      const currentPos = track.position + elapsed;

      timeDisplayEl.textContent = formatTime(currentPos);
      if (track.duration > 0) {
        const pct = Math.min(100, Math.max(0, (currentPos / track.duration) * 100));
        progressFill.style.width = `${pct}%`;
      }
    }, 100);
  }

  // Window Expand / Collapse Toggle
  let isPinned = false;

  function toggleExpand(forceState, fromClick = false) {
    if (fromClick) {
      isPinned = (typeof forceState === 'boolean') ? forceState : !isExpanded;
      isExpanded = isPinned;
    } else {
      if (isPinned) return; // Keep pinned if user manually clicked expand
      isExpanded = (typeof forceState === 'boolean') ? forceState : !isExpanded;
    }

    if (isExpanded) {
      appContainer.classList.add('expanded');
      if (isElectron) {
        window.notchLyricsAPI.setWindowSize(520, 175);
      }
    } else {
      appContainer.classList.remove('expanded');
      searchOverlay.classList.add('hidden');
      if (isElectron) {
        window.notchLyricsAPI.setWindowSize(340, 28);
      }
    }
  }

  // Setup Event Listeners
  expandBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleExpand(undefined, true);
  });

  // Hover auto-expand option
  let hoverTimeout = null;
  notchBar.addEventListener('mouseenter', () => {
    hoverTimeout = setTimeout(() => {
      toggleExpand(true, false);
    }, 350);
  });

  notchBar.addEventListener('mouseleave', () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
  });

  appContainer.addEventListener('mouseleave', () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    if (isExpanded && !isPinned && searchOverlay.classList.contains('hidden')) {
      setTimeout(() => {
        if (!appContainer.matches(':hover') && !isPinned) {
          toggleExpand(false, false);
        }
      }, 800);
    }
  });

  // Ghost Mode
  ghostModeBtn.addEventListener('click', async () => {
    if (isElectron) {
      isGhost = !isGhost;
      ghostModeBtn.classList.toggle('active', isGhost);
      ghostModeBtn.textContent = isGhost ? '👻 Active' : '👻 Ghost';
      await window.notchLyricsAPI.setIgnoreMouseEvents(isGhost);
    }
  });

  // Offset adjustment buttons
  offsetMinusBtn.addEventListener('click', () => {
    currentOffset = parseFloat((currentOffset - 0.5).toFixed(1));
    offsetDisplayEl.textContent = `${currentOffset >= 0 ? '+' : ''}${currentOffset.toFixed(1)}s`;
    if (isElectron) window.notchLyricsAPI.setOffset(currentOffset);
  });

  offsetPlusBtn.addEventListener('click', () => {
    currentOffset = parseFloat((currentOffset + 0.5).toFixed(1));
    offsetDisplayEl.textContent = `${currentOffset >= 0 ? '+' : ''}${currentOffset.toFixed(1)}s`;
    if (isElectron) window.notchLyricsAPI.setOffset(currentOffset);
  });

  // Playback buttons
  playPauseBtn.addEventListener('click', () => {
    if (isElectron) window.notchLyricsAPI.playPause();
  });

  prevBtn.addEventListener('click', () => {
    if (isElectron) window.notchLyricsAPI.prevTrack();
  });

  nextBtn.addEventListener('click', () => {
    if (isElectron) window.notchLyricsAPI.nextTrack();
  });

  // Demo Songs rotation
  const demoSongs = [
    { title: 'Someone Like You', artist: 'Adele', duration: 285 },
    { title: 'Backburner', artist: 'NIKI', duration: 236 },
    { title: 'Die With A Smile', artist: 'Bruno Mars, Lady Gaga', duration: 251 },
    { title: 'Cruel Summer', artist: 'Taylor Swift', duration: 178 }
  ];
  let demoIndex = 0;

  demoBtn.addEventListener('click', async () => {
    const song = demoSongs[demoIndex % demoSongs.length];
    demoIndex++;
    if (isElectron) {
      await window.notchLyricsAPI.setManualTrack(song);
    } else {
      // Web preview fallback
      fetch(`/api/manual?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}`);
    }
  });

  // Search feature
  searchTriggerBtn.addEventListener('click', () => {
    searchOverlay.classList.remove('hidden');
    searchInput.focus();
  });

  searchCloseBtn.addEventListener('click', () => {
    searchOverlay.classList.add('hidden');
  });

  searchSubmitBtn.addEventListener('click', async () => {
    const q = searchInput.value.trim();
    if (!q) return;

    if (isElectron) {
      await window.notchLyricsAPI.setManualTrack({ title: q, artist: '', duration: 240 });
    } else {
      fetch(`/api/manual?title=${encodeURIComponent(q)}&artist=`);
    }
    searchOverlay.classList.add('hidden');
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchSubmitBtn.click();
    if (e.key === 'Escape') searchCloseBtn.click();
  });

  // Connect backend
  if (isElectron) {
    window.notchLyricsAPI.onTrackUpdate(handleStateUpdate);
    window.notchLyricsAPI.onIdle(handleIdle);
    startInterpolationLoop();
  } else {
    // Web Preview / HTTP Polling mode
    console.log('Running in browser mode, polling /api/state...');
    setInterval(async () => {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const json = await res.json();
          if (json.idle) {
            handleIdle(json);
          } else {
            handleStateUpdate(json);
          }
        }
      } catch (err) {
        // ignore
      }
    }, 800);
    startInterpolationLoop();
  }

})();
