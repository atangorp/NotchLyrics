const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * Lyrics Engine powered by LRCLIB API
 * Fast, free, no API keys, community synchronized lyrics.
 */
class LyricsEngine {
  constructor() {
    this.cache = new Map();
    this.cacheDir = path.join(__dirname, '..', '.cache');
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * Helper to perform HTTP GET request
   */
  httpGet(url) {
    return new Promise((resolve, reject) => {
      const headers = {
        'User-Agent': 'NotchLyrics/1.0.0 (https://github.com/fathanorvala/notch-lyrics)'
      };
      https.get(url, { headers }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });
      }).on('error', (err) => {
        resolve(null);
      });
    });
  }

  /**
   * Parse LRC text string into an array of { time: Float, text: String }
   */
  parseLRC(lrcString) {
    if (!lrcString || typeof lrcString !== 'string') return [];

    const lines = lrcString.split('\n');
    const result = [];
    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Extract all timestamps in this line (e.g. [00:12.34][00:45.67] Chorus)
      const matches = [...trimmed.matchAll(timeRegex)];
      if (matches.length > 0) {
        const text = trimmed.replace(timeRegex, '').trim();
        for (const match of matches) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseInt(match[2], 10);
          const msRaw = match[3] || '0';
          const ms = msRaw.length === 2 ? parseInt(msRaw, 10) * 10 : parseInt(msRaw.padEnd(3, '0').slice(0, 3), 10);
          const time = minutes * 60 + seconds + (ms / 1000);

          result.push({ time, text });
        }
      }
    }

    // Sort by timestamp
    result.sort((a, b) => a.time - b.time);
    return result;
  }

  /**
   * Create a cache key from title & artist
   */
  getCacheKey(title, artist) {
    return `${(artist || '').toLowerCase()}_${(title || '').toLowerCase()}`.replace(/[^a-z0-9]/g, '_');
  }

  /**
   * Fetch synced lyrics from LRCLIB
   * @param {string} title
   * @param {string} artist
   * @param {string} query
   */
  async getLyrics({ title, artist, query }) {
    const cacheKey = this.getCacheKey(title, artist);

    // 1. Check in-memory cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // 2. Check disk cache
    const cacheFilePath = path.join(this.cacheDir, `${cacheKey}.json`);
    try {
      if (fs.existsSync(cacheFilePath)) {
        const fileData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
        this.cache.set(cacheKey, fileData);
        return fileData;
      }
    } catch (e) {
      // cache miss
    }

    let lyricData = null;

    // 3. Try direct lookup if artist and title are available
    if (artist && title && artist.toLowerCase() !== 'youtube') {
      const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
      const res = await this.httpGet(url);
      if (res && (res.syncedLyrics || res.plainLyrics)) {
        lyricData = res;
      }
    }

    // 4. Try search if not found or YouTube query
    if (!lyricData) {
      const searchQuery = query || `${artist || ''} ${title || ''}`.trim();
      if (searchQuery) {
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`;
        const searchRes = await this.httpGet(searchUrl);
        if (Array.isArray(searchRes) && searchRes.length > 0) {
          // Find first result with syncedLyrics
          const withSync = searchRes.find(item => item.syncedLyrics);
          lyricData = withSync || searchRes[0];
        }
      }
    }

    if (!lyricData) {
      return {
        hasLyrics: false,
        isSynced: false,
        lines: [],
        plain: ''
      };
    }

    const isSynced = Boolean(lyricData.syncedLyrics);
    const parsedLines = isSynced ? this.parseLRC(lyricData.syncedLyrics) : [];

    const formatted = {
      hasLyrics: true,
      isSynced,
      trackName: lyricData.trackName || title,
      artistName: lyricData.artistName || artist,
      albumName: lyricData.albumName || '',
      duration: lyricData.duration || 0,
      lines: parsedLines,
      plain: lyricData.plainLyrics || ''
    };

    // Save to memory cache
    this.cache.set(cacheKey, formatted);

    // Save to disk cache
    try {
      fs.writeFileSync(cacheFilePath, JSON.stringify(formatted), 'utf8');
    } catch (e) {
      // ignore
    }

    return formatted;
  }
}

module.exports = new LyricsEngine();
