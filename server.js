/**
 * RIVALS online duel server
 * Serves static files + WebSocket rooms on one port.
 *
 * Local:  npm start  →  http://localhost:8770
 * Railway: binds 0.0.0.0 + process.env.PORT
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

// Railway / Render / Fly inject PORT — must listen on 0.0.0.0
const PORT = Number(process.env.PORT || process.env.RAILWAY_PORT || 8770);
const HOST = '0.0.0.0';
const ROOT = path.resolve(__dirname);

console.log('[boot] node', process.version);
console.log('[boot] PORT=', PORT, 'HOST=', HOST);
console.log('[boot] ROOT=', ROOT);
console.log('[boot] files=', {
  index: fs.existsSync(path.join(ROOT, 'index.html')),
  main: fs.existsSync(path.join(ROOT, 'js', 'main.js')),
  package: fs.existsSync(path.join(ROOT, 'package.json')),
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': status === 200 ? 'public, max-age=0, must-revalidate' : 'no-store',
  });
  res.end(body);
}

function sendFile(res, filePath) {
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      send(res, 404, 'Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        send(res, 500, 'Server error');
        return;
      }
      send(res, 200, data, type);
    });
  });
}

/** Resolve URL path under ROOT (never treat as absolute OS path). */
function resolvePublicPath(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0] || '/');
  if (p === '/' || p === '') p = '/index.html';
  // Remove leading slashes so path.resolve(ROOT, ...) stays under ROOT
  const relative = p.replace(/^\/+/, '');
  const resolved = path.resolve(ROOT, relative);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (resolved !== ROOT && !resolved.startsWith(rootWithSep)) {
    return null;
  }
  return resolved;
}

const server = http.createServer((req, res) => {
  // CORS / health for platform probes
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const urlPath = req.url || '/';

  if (urlPath === '/health' || urlPath === '/healthz') {
    send(res, 200, JSON.stringify({ ok: true, service: 'rivals' }), 'application/json');
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method not allowed');
    return;
  }

  const filePath = resolvePublicPath(urlPath);
  if (!filePath) {
    send(res, 403, 'Forbidden');
    return;
  }
  sendFile(res, filePath);
});

const wss = new WebSocketServer({ server });

/** @type {Map<string, { host: import('ws').WebSocket|null, guest: import('ws').WebSocket|null }>} */
const rooms = new Map();

function codeGen() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) c += chars[(Math.random() * chars.length) | 0];
  return c;
}

function sendWs(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function otherOf(room, ws) {
  if (room.host === ws) return room.guest;
  if (room.guest === ws) return room.host;
  return null;
}

function cleanup(ws) {
  const code = ws.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  if (!room) return;
  const peer = otherOf(room, ws);
  if (room.host === ws) room.host = null;
  if (room.guest === ws) room.guest = null;
  sendWs(peer, { type: 'peer_left' });
  if (!room.host && !room.guest) rooms.delete(code);
  ws.roomCode = null;
  ws.role = null;
}

wss.on('connection', (ws) => {
  ws.roomCode = null;
  ws.role = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (msg.type === 'create') {
      cleanup(ws);
      let code;
      do {
        code = codeGen();
      } while (rooms.has(code));
      rooms.set(code, { host: ws, guest: null });
      ws.roomCode = code;
      ws.role = 'host';
      sendWs(ws, { type: 'room', code, role: 'host' });
      return;
    }

    if (msg.type === 'join') {
      const code = String(msg.code || '')
        .trim()
        .toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        sendWs(ws, { type: 'error', message: 'Room not found' });
        return;
      }
      if (room.guest) {
        sendWs(ws, { type: 'error', message: 'Room full' });
        return;
      }
      if (room.host === ws) {
        sendWs(ws, { type: 'error', message: 'Already in room' });
        return;
      }
      cleanup(ws);
      room.guest = ws;
      ws.roomCode = code;
      ws.role = 'guest';
      sendWs(ws, { type: 'room', code, role: 'guest' });
      sendWs(room.host, { type: 'peer_joined' });
      sendWs(ws, { type: 'peer_joined' });
      return;
    }

    if (msg.type === 'leave') {
      cleanup(ws);
      return;
    }

    if (!ws.roomCode) return;
    const room = rooms.get(ws.roomCode);
    if (!room) return;
    const peer = otherOf(room, ws);
    if (!peer) return;

    const out = { ...msg, from: ws.role };
    sendWs(peer, out);
  });

  ws.on('close', () => cleanup(ws));
  ws.on('error', () => cleanup(ws));
});

server.listen(PORT, HOST, () => {
  console.log(`RIVALS listening on http://${HOST}:${PORT}`);
  console.log(`ROOT=${ROOT}`);
  console.log(`Health: /health  |  Online rooms via WebSocket`);
});

// Fail fast if listen errors (e.g. bad PORT)
server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});
