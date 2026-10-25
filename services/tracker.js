const EventEmitter = require('events');
const SpotifyService = require('./spotify');
const YouTubeService = require('./youtube');
const lyricsEngine = require('./lyricsEngine');

/**
 * Media Tracker & Coordinator
 * Periodically polls Spotify & YouTube, retrieves synchronized lyrics, and emits state updates.
 */
class MediaTracker extends EventEmitter {
  constructor() {
    super();
    this.pollInterval = 750; // ms
    this.timer = null;
    this.currentTrack = null;
    this.currentLyrics = null;
    this.offset = 0; // lyric timing offset in seconds (+/- user adjustment)
    this.isManualMode = false;
    this.manualTrack = null;
    this.lastState = null;
  }

  start() {
    if (this.timer) return;
    this.poll();
    this.timer = setInterval(() => this.poll(), this.pollInterval);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setOffset(offsetSeconds) {
    this.offset = offsetSeconds;
    this.emitCurrent();
  }

  /**
   * Set manual track for testing or when user explicitly searches a song
   */
  async setManualTrack(song) {
    this.isManualMode = true;
    this.manualTrack = {
      source: 'manual',
      state: 'playing',
      title: song.title,
      artist: song.artist,
      position: 0,
      duration: song.duration || 240,
      startTime: Date.now()
    };

    const lyrics = await lyricsEngine.getLyrics({
      title: song.title,
      artist: song.artist,
      query: `${song.artist} ${song.title}`
    });

    this.currentTrack = this.manualTrack;
    this.currentLyrics = lyrics;
    this.emitCurrent();
  }

  clearManualMode() {
    this.isManualMode = false;
    this.manualTrack = null;
    this.currentTrack = null;
    this.currentLyrics = null;
    this.poll();
  }

  async poll() {
    // If in manual mode, simulate progress
    if (this.isManualMode && this.manualTrack) {
      if (this.manualTrack.state === 'playing') {
        const elapsed = (Date.now() - this.manualTrack.startTime) / 1000;
        this.manualTrack.position = elapsed;
        if (elapsed > this.manualTrack.duration) {
          this.manualTrack.startTime = Date.now(); // loop
          this.manualTrack.position = 0;
        }
      }
      this.emitCurrent();
      return;
    }

    try {
      // 1. Try Spotify first
      let playback = await SpotifyService.getCurrentPlayback();

      // 2. If Spotify is not playing, try YouTube
      if (!playback || playback.state !== 'playing') {
        const ytPlayback = await YouTubeService.getCurrentPlayback();
        if (ytPlayback) {
          playback = ytPlayback;
        }
      }

      if (!playback) {
        if (this.currentTrack !== null) {
          this.currentTrack = null;
          this.currentLyrics = null;
          this.emit('idle', { message: 'Menunggu musik dari Spotify atau YouTube...' });
        }
        return;
      }

      // Check if song changed
      const trackId = `${playback.source}:${playback.artist}:${playback.title}`;
      const lastTrackId = this.currentTrack ? `${this.currentTrack.source}:${this.currentTrack.artist}:${this.currentTrack.title}` : null;

      if (trackId !== lastTrackId) {
        this.currentTrack = playback;
        this.currentLyrics = null; // reset while loading

        // Fetch lyrics
        const lyrics = await lyricsEngine.getLyrics({
          title: playback.title,
          artist: playback.artist,
          query: playback.query || `${playback.artist} ${playback.title}`
        });

        this.currentLyrics = lyrics;
      } else {
        // Update playback position
        this.currentTrack.position = playback.position;
        this.currentTrack.state = playback.state;
      }

      this.emitCurrent();
    } catch (err) {
      console.error('[MediaTracker] Poll error:', err);
    }
  }

  /**
   * Calculate active and upcoming lyric line based on current position + offset
   */
  emitCurrent() {
    if (!this.currentTrack) return;

    const effectiveTime = Math.max(0, this.currentTrack.position + this.offset);
    let activeIndex = -1;
    let activeLine = null;
    let nextLine = null;

    if (this.currentLyrics && this.currentLyrics.lines && this.currentLyrics.lines.length > 0) {
      const lines = this.currentLyrics.lines;
      for (let i = 0; i < lines.length; i++) {
        if (effectiveTime >= lines[i].time) {
          activeIndex = i;
        } else {
          break;
        }
      }

      if (activeIndex >= 0) {
        activeLine = lines[activeIndex];
        nextLine = (activeIndex + 1 < lines.length) ? lines[activeIndex + 1] : null;
      } else {
        // Song intro before first lyric
        nextLine = lines[0];
      }
    }

    const payload = {
      track: this.currentTrack,
      lyricsInfo: this.currentLyrics ? {
        hasLyrics: this.currentLyrics.hasLyrics,
        isSynced: this.currentLyrics.isSynced,
        plain: this.currentLyrics.plain
      } : null,
      offset: this.offset,
      activeLine,
      nextLine,
      activeIndex,
      totalLines: this.currentLyrics && this.currentLyrics.lines ? this.currentLyrics.lines.length : 0,
      timestamp: Date.now()
    };

    this.lastState = payload;
    this.emit('update', payload);
  }
}

module.exports = new MediaTracker();
