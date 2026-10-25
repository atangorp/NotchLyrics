// NotchVala Frontend Controller
(function() {
  const isElectron = Boolean(window.notchLyricsAPI);

  // DOM Elements
  const appContainer = document.getElementById('appContainer');
  const notchBar = document.getElementById('notchBar');
  const activeLyricEl = document.getElementById('activeLyric');
  const timeDisplayEl = document.getElementById('timeDisplay');
  const expandBtn = document.getElementById('expandBtn');
  const equalizerEl = document.getElementById('equalizer');

  // Expanded Elements
  const albumArt = document.getElementById('albumArt');
  const trackTitle = document.getElementById('trackTitle');
  const trackArtist = document.getElementById('trackArtist');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const progressFill = document.getElementById('progressFill');
  const nextLyricEl = document.getElementById('nextLyric');
  const offsetMinus = document.getElementById('offsetMinus');
  const offsetPlus = document.getElementById('offsetPlus');
  const offsetDisplay = document.getElementById('offsetDisplay');
  const ghostModeBtn = document.getElementById('ghostModeBtn');

  // State
  let isExpanded = false;
  let isPinned = false;
  let isGhost = false;
  let currentOffset = 0.0;
  let lastServerState = null;
  let lastLyricText = '';

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function updateLyricLine(text) {
    if (text === lastLyricText) return;
    activeLyricEl.classList.add('anim-change');
    setTimeout(() => {
      activeLyricEl.textContent = text || '...';
      activeLyricEl.classList.remove('anim-change');
      lastLyricText = text;
    }, 120);
  }

  function handleStateUpdate(data) {
    lastServerState = data;
    const { track, activeLine, nextLine, offset } = data;

    currentOffset = offset || 0.0;
    if (offsetDisplay) {
      offsetDisplay.textContent = `${currentOffset >= 0 ? '+' : ''}${currentOffset.toFixed(1)}s`;
    }

    const isPlaying = track.state === 'playing';
    if (equalizerEl) {
      equalizerEl.className = isPlaying ? 'equalizer active' : 'equalizer paused';
    }

    if (playIcon && pauseIcon) {
      if (isPlaying) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
      } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
      }
    }

    // Artwork
    if (albumArt) {
      if (track.artwork && track.artwork !== 'missing value') {
        albumArt.src = track.artwork;
      } else {
        albumArt.src = '../assets/forvala-logo.png';
      }
    }

    // Meta
    if (trackTitle) trackTitle.textContent = track.title || 'Tidak Ada Lagu';
    if (trackArtist) trackArtist.textContent = track.artist || 'Putar lagu di Spotify atau YouTube';

    // Active & Next lyric
    const lineText = activeLine ? activeLine.text : (track.title ? `${track.title} – ${track.artist}` : 'Menunggu musik...');
    updateLyricLine(lineText);

    if (nextLyricEl) nextLyricEl.textContent = nextLine ? nextLine.text : '...';

    // Time & Progress
    if (timeDisplayEl) timeDisplayEl.textContent = formatTime(track.position);
    if (progressFill && track.duration > 0) {
      const pct = Math.min(100, Math.max(0, (track.position / track.duration) * 100));
      progressFill.style.width = `${pct}%`;
    }
  }

  function handleIdle(data) {
    if (equalizerEl) equalizerEl.className = 'equalizer paused';
    updateLyricLine(data.message || 'Buka Spotify atau YouTube...');
    if (trackTitle) trackTitle.textContent = 'Tidak Ada Musik';
    if (trackArtist) trackArtist.textContent = 'Putar lagu di Spotify atau YouTube';
    if (timeDisplayEl) timeDisplayEl.textContent = '0:00';
    if (progressFill) progressFill.style.width = '0%';
    if (nextLyricEl) nextLyricEl.textContent = '...';
    if (playIcon && pauseIcon) {
      playIcon.classList.remove('hidden');
      pauseIcon.classList.add('hidden');
    }
    if (albumArt) albumArt.src = '../assets/forvala-logo.png';
  }

  function startInterpolationLoop() {
    setInterval(() => {
      if (!lastServerState || !lastServerState.track || lastServerState.track.state !== 'playing') {
        return;
      }
      const track = lastServerState.track;
      const elapsed = (Date.now() - (lastServerState.timestamp || Date.now())) / 1000;
      const currentPos = track.position + elapsed;

      if (timeDisplayEl) timeDisplayEl.textContent = formatTime(currentPos);
      if (progressFill && track.duration > 0) {
        const pct = Math.min(100, Math.max(0, (currentPos / track.duration) * 100));
        progressFill.style.width = `${pct}%`;
      }
    }, 100);
  }

  function toggleExpand(forceState, fromClick = false) {
    if (fromClick) {
      isPinned = (typeof forceState === 'boolean') ? forceState : !isExpanded;
      isExpanded = isPinned;
    } else {
      if (isPinned) return;
      isExpanded = (typeof forceState === 'boolean') ? forceState : !isExpanded;
    }

    if (isExpanded) {
      appContainer.classList.add('expanded');
      if (isElectron) {
        window.notchLyricsAPI.setWindowSize(480, 160);
      }
    } else {
      appContainer.classList.remove('expanded');
      if (isElectron) {
        window.notchLyricsAPI.setWindowSize(330, 28);
      }
    }
  }

  // Event Listeners
  if (expandBtn) {
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleExpand(undefined, true);
    });
  }

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
    if (isExpanded && !isPinned) {
      setTimeout(() => {
        if (!appContainer.matches(':hover') && !isPinned) {
          toggleExpand(false, false);
        }
      }, 700);
    }
  });

  if (ghostModeBtn) {
    ghostModeBtn.addEventListener('click', async () => {
      if (isElectron) {
        isGhost = !isGhost;
        ghostModeBtn.classList.toggle('active', isGhost);
        await window.notchLyricsAPI.setIgnoreMouseEvents(isGhost);
      }
    });
  }

  if (offsetMinus) {
    offsetMinus.addEventListener('click', () => {
      currentOffset = parseFloat((currentOffset - 0.5).toFixed(1));
      if (offsetDisplay) offsetDisplay.textContent = `${currentOffset >= 0 ? '+' : ''}${currentOffset.toFixed(1)}s`;
      if (isElectron) window.notchLyricsAPI.setOffset(currentOffset);
    });
  }

  if (offsetPlus) {
    offsetPlus.addEventListener('click', () => {
      currentOffset = parseFloat((currentOffset + 0.5).toFixed(1));
      if (offsetDisplay) offsetDisplay.textContent = `${currentOffset >= 0 ? '+' : ''}${currentOffset.toFixed(1)}s`;
      if (isElectron) window.notchLyricsAPI.setOffset(currentOffset);
    });
  }

  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
      if (isElectron) window.notchLyricsAPI.playPause();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (isElectron) window.notchLyricsAPI.prevTrack();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (isElectron) window.notchLyricsAPI.nextTrack();
    });
  }

  // Connect Backend
  if (isElectron) {
    window.notchLyricsAPI.onTrackUpdate(handleStateUpdate);
    window.notchLyricsAPI.onIdle(handleIdle);
    startInterpolationLoop();
  } else {
    // Browser preview polling
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
      } catch (err) {}
    }, 800);
    startInterpolationLoop();
  }

})();
