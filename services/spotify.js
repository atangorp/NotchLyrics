const { exec } = require('child_process');

/**
 * Spotify macOS Service via AppleScript
 * Queries the native Spotify Desktop client for current track, playback state, and position.
 */
class SpotifyService {
  /**
   * Execute AppleScript string asynchronously
   */
  static runScript(script) {
    return new Promise((resolve) => {
      exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err, stdout) => {
        if (err) return resolve(null);
        resolve(stdout.trim());
      });
    });
  }

  /**
   * Get current track and playback info from Spotify
   * @returns {Promise<Object|null>}
   */
  static async getCurrentPlayback() {
    const script = `
tell application "System Events"
    if exists (process "Spotify") then
        tell application "Spotify"
            try
                set pState to player state as string
                if pState is "playing" or pState is "paused" then
                    set trkName to name of current track
                    set trkArtist to artist of current track
                    set trkAlbum to album of current track
                    set trkDuration to (duration of current track) / 1000.0
                    set trkPos to player position
                    set trkArt to artwork url of current track
                    return pState & "|||" & trkName & "|||" & trkArtist & "|||" & trkAlbum & "|||" & trkPos & "|||" & trkDuration & "|||" & trkArt
                else
                    return "stopped"
                end if
            on error
                return "error"
            end try
        end tell
    else
        return "not_running"
    end if
end tell
    `;

    const raw = await this.runScript(script);
    if (!raw || raw === 'not_running' || raw === 'stopped' || raw === 'error') {
      return null;
    }

    const parts = raw.split('|||');
    if (parts.length < 5) return null;

    const [state, title, artist, album, positionStr, durationStr, artwork] = parts;
    const position = parseFloat(positionStr) || 0;
    const duration = parseFloat(durationStr) || 0;

    return {
      source: 'spotify',
      state: state.toLowerCase(),
      title: title.trim(),
      artist: artist.trim(),
      album: (album || '').trim(),
      position,
      duration,
      artwork: (artwork && artwork !== 'missing value') ? artwork : null,
      timestamp: Date.now()
    };
  }

  static async playPause() {
    return this.runScript('tell application "Spotify" to playpause');
  }

  static async next() {
    return this.runScript('tell application "Spotify" to next track');
  }

  static async previous() {
    return this.runScript('tell application "Spotify" to previous track');
  }

  static async seek(seconds) {
    return this.runScript(`tell application "Spotify" to set player position to (player position + (${seconds}))`);
  }
}

module.exports = SpotifyService;
