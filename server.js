/**
 * RIVALS online duel server
 * Serves static files + WebSocket rooms on one port.
 *
 *   npm install
 *   npm start
 *   open http://localhost:8770
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8770;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ROOT, safe);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
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

function send(ws, msg) {
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
  send(peer, { type: 'peer_left' });
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
      send(ws, { type: 'room', code, role: 'host' });
      return;
    }

    if (msg.type === 'join') {
      const code = String(msg.code || '')
        .trim()
        .toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        send(ws, { type: 'error', message: 'Room not found' });
        return;
      }
      if (room.guest) {
        send(ws, { type: 'error', message: 'Room full' });
        return;
      }
      if (room.host === ws) {
        send(ws, { type: 'error', message: 'Already in room' });
        return;
      }
      cleanup(ws);
      room.guest = ws;
      ws.roomCode = code;
      ws.role = 'guest';
      send(ws, { type: 'room', code, role: 'guest' });
      send(room.host, { type: 'peer_joined' });
      send(ws, { type: 'peer_joined' });
      return;
    }

    if (msg.type === 'leave') {
      cleanup(ws);
      return;
    }

    // Relay gameplay messages to peer
    if (!ws.roomCode) return;
    const room = rooms.get(ws.roomCode);
    if (!room) return;
    const peer = otherOf(room, ws);
    if (!peer) return;

    // Tag sender role for authority checks on clients
    const out = { ...msg, from: ws.role };
    send(peer, out);
  });

  ws.on('close', () => cleanup(ws));
});

server.listen(PORT, () => {
  console.log(`\n  RIVALS server  →  http://localhost:${PORT}`);
  console.log(`  Online duels   →  create / join room codes\n`);
});
