const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const tracker = require('./services/tracker');
const SpotifyService = require('./services/spotify');
const lyricsEngine = require('./services/lyricsEngine');

const PORT = 3939;

// Start tracker
tracker.start();

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API Endpoints
  if (pathname === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (tracker.lastState) {
      res.end(JSON.stringify(tracker.lastState));
    } else {
      res.end(JSON.stringify({ idle: true, message: 'Menunggu musik dari Spotify atau YouTube...' }));
    }
    return;
  }

  if (pathname === '/api/manual') {
    const { title, artist } = parsedUrl.query;
    await tracker.setManualTrack({
      title: title || 'Someone Like You',
      artist: artist || 'Adele',
      duration: 285
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/clear-manual') {
    tracker.clearManualMode();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/offset') {
    const offset = parseFloat(parsedUrl.query.val) || 0;
    tracker.setOffset(offset);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ offset }));
    return;
  }

  if (pathname === '/api/playpause') {
    await SpotifyService.playPause();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // Static File Serving
  let filePath = path.join(__dirname, 'ui', pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🎵 NotchLyrics Web Preview running at: http://localhost:${PORT}`);
});
