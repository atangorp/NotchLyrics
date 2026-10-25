const { exec } = require('child_process');

/**
 * YouTube Browser Service
 * Inspects active YouTube tabs across macOS browsers (Google Chrome, Brave, Safari, Arc, Edge)
 */
class YouTubeService {
  static runScript(script) {
    return new Promise((resolve) => {
      exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err, stdout) => {
        if (err) return resolve(null);
        resolve(stdout.trim());
      });
    });
  }

  /**
   * Cleans YouTube video title into { artist, title, rawTitle }
   */
  static cleanTitle(raw) {
    if (!raw) return { artist: '', title: '', query: '' };

    let cleaned = raw
      .replace(/\s*-\s*YouTube\s*$/i, '')
      .replace(/^\s*\(\d+\)\s*/, '') // Remove "(1) " unread notifications in title
      .trim();

    // Remove video fluff words
    cleaned = cleaned
      .replace(/\s*\[[^\]]*(official|video|audio|lyric|mv|4k|hd|visualizer|remix|version)[^\]]*\]/gi, '')
      .replace(/\s*\([^)]*(official|video|audio|lyric|mv|4k|hd|visualizer|remix|version)[^)]*\)/gi, '')
      .replace(/\s*(Official\s*Music\s*Video|Official\s*Audio|Official\s*Video|Lyric\s*Video|Visualizer|Color\s*Coded\s*Lyrics)\s*/gi, '')
      .replace(/["“”]/g, '')
      .trim();

    let artist = '';
    let title = cleaned;

    if (cleaned.includes(' - ')) {
      const parts = cleaned.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    } else if (cleaned.includes(' : ')) {
      const parts = cleaned.split(' : ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' : ').trim();
    } else if (cleaned.includes(' | ')) {
      const parts = cleaned.split(' | ');
      title = parts[0].trim();
      artist = parts[1].trim();
    }

    return {
      artist,
      title,
      query: `${artist} ${title}`.trim() || cleaned,
      rawTitle: raw
    };
  }

  /**
   * Find playing YouTube tab across browsers
   */
  static async getCurrentPlayback() {
    // Check Chrome / Brave / Arc / Edge
    const script = `
tell application "System Events"
    set foundInfo to "NONE"
    
    -- Check Google Chrome
    if exists (process "Google Chrome") then
        tell application "Google Chrome"
            repeat with w in windows
                repeat with t in tabs of w
                    set tabUrl to URL of t
                    if tabUrl contains "youtube.com/watch" then
                        set tabTitle to title of t
                        -- Try getting currentTime if allowed, otherwise 0
                        set vidTime to "0"
                        try
                            set vidTime to (execute t javascript "document.querySelector('video') ? document.querySelector('video').currentTime : 0") as string
                        end try
                        set isPaused to "false"
                        try
                            set isPaused to (execute t javascript "document.querySelector('video') ? document.querySelector('video').paused : false") as string
                        end try
                        return "FOUND|||" & tabTitle & "|||" & tabUrl & "|||" & vidTime & "|||" & isPaused
                    end if
                end repeat
            end repeat
        end tell
    end if

    -- Check Brave Browser
    if exists (process "Brave Browser") then
        tell application "Brave Browser"
            repeat with w in windows
                repeat with t in tabs of w
                    set tabUrl to URL of t
                    if tabUrl contains "youtube.com/watch" then
                        set tabTitle to title of t
                        return "FOUND|||" & tabTitle & "|||" & tabUrl & "|||0|||false"
                    end if
                end repeat
            end repeat
        end tell
    end if

    -- Check Safari
    if exists (process "Safari") then
        tell application "Safari"
            repeat with w in windows
                repeat with t in tabs of w
                    set tabUrl to URL of t
                    if tabUrl contains "youtube.com/watch" then
                        set tabTitle to name of t
                        return "FOUND|||" & tabTitle & "|||" & tabUrl & "|||0|||false"
                    end if
                end repeat
            end repeat
        end tell
    end if

    return "NONE"
end tell
    `;

    const raw = await this.runScript(script);
    if (!raw || !raw.startsWith('FOUND|||')) {
      return null;
    }

    const [, rawTitle, url, timeStr, isPausedStr] = raw.split('|||');
    const cleaned = this.cleanTitle(rawTitle);
    const position = parseFloat(timeStr) || 0;
    const isPaused = isPausedStr === 'true';

    return {
      source: 'youtube',
      state: isPaused ? 'paused' : 'playing',
      title: cleaned.title || rawTitle,
      artist: cleaned.artist || 'YouTube',
      query: cleaned.query,
      rawTitle,
      url,
      position,
      duration: 0,
      timestamp: Date.now()
    };
  }
}

module.exports = YouTubeService;
