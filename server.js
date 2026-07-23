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
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { sanitizeRelayMessage } = require('./server/protocol');

// Railway / Render / Fly inject PORT — must listen on 0.0.0.0
const PORT = Number(process.env.PORT || process.env.RAILWAY_PORT || 8770);
const HOST = '0.0.0.0';
const ROOT = path.resolve(__dirname);
const BUILD =
  process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 12) ||
  process.env.GIT_COMMIT_SHA?.slice(0, 12) ||
  'mobile-controls-2026-07-23';
const RECONNECT_GRACE_MS = 15_000;
const MAX_MESSAGES_PER_SECOND = 120;

console.log('[boot] node', process.version);
console.log('[boot] PORT=', PORT, 'HOST=', HOST);
console.log('[boot] ROOT=', ROOT);
console.log('[boot] BUILD=', BUILD);
console.log('[boot] files=', {
  index: fs.existsSync(path.join(ROOT, 'index.html')),
  main: fs.existsSync(path.join(ROOT, 'js', 'main.js')),
  package: fs.existsSync(path.join(ROOT, 'package.json')),
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
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

function send(res, status, body, type = 'text/plain; charset=utf-8', headOnly = false) {
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': status === 200 ? 'public, max-age=0, must-revalidate' : 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  res.end(headOnly ? undefined : body);
}

function sendFile(res, filePath, headOnly = false) {
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
      send(res, 200, data, type, headOnly);
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
    send(
      res,
      200,
      JSON.stringify({ ok: true, service: 'rivals', build: BUILD }),
      'application/json',
      req.method === 'HEAD'
    );
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
  sendFile(res, filePath, req.method === 'HEAD');
});

const allowedOrigins = new Set(
  String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);

const wss = new WebSocketServer({
  server,
  maxPayload: 16 * 1024,
  verifyClient: ({ origin, req }, done) => {
    if (!origin) {
      done(true);
      return;
    }
    if (allowedOrigins.size > 0) {
      done(allowedOrigins.has(origin), allowedOrigins.has(origin) ? 101 : 403);
      return;
    }
    try {
      const originUrl = new URL(origin);
      const requestHost = String(req.headers.host || '').split(':')[0];
      done(originUrl.hostname === requestHost, originUrl.hostname === requestHost ? 101 : 403);
    } catch {
      done(false, 403);
    }
  },
});

/**
 * @typedef {{
 *   host: import('ws').WebSocket|null,
 *   guest: import('ws').WebSocket|null,
 *   hostToken: string|null,
 *   guestToken: string|null,
 *   hostTimer: NodeJS.Timeout|null,
 *   guestTimer: NodeJS.Timeout|null,
 *   hp: {host: number, guest: number},
 *   score: {host: number, guest: number},
 *   events: {host: Map<string, object>, guest: Map<string, object>},
 *   round: number,
 *   state: 'waiting'|'playing'|'round_end'
 * }} Room
 */
/** @type {Map<string, Room>} */
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

function otherRole(role) {
  return role === 'host' ? 'guest' : 'host';
}

function otherOf(room, ws) {
  if (room.host === ws) return room.guest;
  if (room.guest === ws) return room.host;
  return null;
}

function makeToken() {
  return crypto.randomBytes(18).toString('base64url');
}

function scoreFor(room, role) {
  const other = otherRole(role);
  return { you: room.score[role], enemy: room.score[other] };
}

function deleteRoomIfEmpty(code, room) {
  if (!room.host && !room.guest && !room.hostToken && !room.guestToken) {
    rooms.delete(code);
  }
}

function expireDisconnectedRole(code, room, role) {
  if (room[role]) return;
  room[`${role}Token`] = null;
  room[`${role}Timer`] = null;
  sendWs(room[otherRole(role)], { type: 'peer_left' });
  deleteRoomIfEmpty(code, room);
}

function cleanup(ws, immediate = false) {
  const code = ws.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  if (!room) return;
  const role = ws.role;
  if (role !== 'host' && role !== 'guest') return;
  if (room[role] !== ws) return;
  const peer = otherOf(room, ws);
  room[role] = null;
  const timerKey = `${role}Timer`;
  if (room[timerKey]) clearTimeout(room[timerKey]);
  if (immediate) {
    room[`${role}Token`] = null;
    room[timerKey] = null;
    sendWs(peer, { type: 'peer_left' });
    deleteRoomIfEmpty(code, room);
  } else {
    sendWs(peer, { type: 'peer_reconnecting' });
    room[timerKey] = setTimeout(
      () => expireDisconnectedRole(code, room, role),
      RECONNECT_GRACE_MS
    );
  }
  ws.roomCode = null;
  ws.role = null;
}

function resumeRoom(ws, msg) {
  const code = String(msg.code || '').trim().toUpperCase();
  const role = msg.role === 'host' ? 'host' : msg.role === 'guest' ? 'guest' : null;
  const token = typeof msg.token === 'string' ? msg.token : '';
  const room = rooms.get(code);
  if (!room || !role || room[role] || room[`${role}Token`] !== token) {
    sendWs(ws, { type: 'resume_failed' });
    return false;
  }
  const timerKey = `${role}Timer`;
  if (room[timerKey]) clearTimeout(room[timerKey]);
  room[timerKey] = null;
  room[role] = ws;
  ws.roomCode = code;
  ws.role = role;
  sendWs(ws, {
    type: 'resumed',
    code,
    role,
    token,
    round: room.round,
    state: room.state,
    hp: room.hp[role],
    score: scoreFor(room, role),
    peerReady: Boolean(room[otherRole(role)]),
  });
  sendWs(room[otherRole(role)], { type: 'peer_resumed' });
  return true;
}

function finishRound(room, targetRole, weapon) {
  if (room.state !== 'playing') return;
  room.state = 'round_end';
  const winnerRole = otherRole(targetRole);
  room.score[winnerRole]++;
  for (const role of ['host', 'guest']) {
    sendWs(room[role], {
      type: 'round_result',
      winner: role === winnerRole ? 'self' : 'other',
      weapon,
      score: scoreFor(room, role),
    });
  }
}

const MAX_EVENT_DAMAGE = {
  ar: 15,
  handgun: 27,
  fists: 30,
  grenade: 75,
  rpg: 100,
};

function pruneEvents(events, now = Date.now()) {
  for (const [id, event] of events) {
    if (event.expiresAt <= now) events.delete(id);
  }
}

function rememberCombatEvent(room, role, msg) {
  const events = room.events[role];
  const now = Date.now();
  pruneEvents(events, now);
  const projectile = msg.type === 'nade';
  events.set(msg.eventId, {
    weaponId: msg.weaponId,
    projectile,
    expiresAt: now + (projectile ? 10_000 : 1500),
    targets: new Set(),
  });
  while (events.size > 128) {
    events.delete(events.keys().next().value);
  }
}

function validateDamageEvent(room, ws, msg) {
  const events = room.events[ws.role];
  pruneEvents(events);
  const event = events.get(msg.eventId);
  if (!event || event.weaponId !== msg.weaponId) return false;
  if (msg.target === 'self' && !event.projectile) return false;
  if (event.targets.has(msg.target)) return false;
  const maxDamage = MAX_EVENT_DAMAGE[msg.weaponId] || 0;
  if (msg.damage > maxDamage + 0.01) return false;
  event.targets.add(msg.target);
  if (!event.projectile || event.targets.size >= 2) events.delete(msg.eventId);
  return true;
}

function applyDamage(room, ws, msg) {
  if (room.state !== 'playing') return;
  if (!validateDamageEvent(room, ws, msg)) {
    sendWs(ws, { type: 'error', message: 'Rejected damage event' });
    return;
  }
  const targetRole = msg.target === 'self' ? ws.role : otherRole(ws.role);
  const target = room[targetRole];
  if (!target || room.hp[targetRole] <= 0) return;
  const damage = Math.min(room.hp[targetRole], msg.damage);
  room.hp[targetRole] = Math.max(0, room.hp[targetRole] - damage);
  const dead = room.hp[targetRole] === 0;
  sendWs(target, {
    type: 'damage',
    damage,
    hp: room.hp[targetRole],
    dead,
    head: msg.head,
    weapon: msg.weapon,
    weaponId: msg.weaponId,
    eventId: msg.eventId,
  });
  sendWs(ws, {
    type: 'damage_ack',
    damage,
    hp: room.hp[targetRole],
    dead,
    target: msg.target,
    head: msg.head,
    weapon: msg.weapon,
    weaponId: msg.weaponId,
    eventId: msg.eventId,
  });
  if (dead) finishRound(room, targetRole, msg.weapon);
}

wss.on('connection', (ws) => {
  ws.roomCode = null;
  ws.role = null;
  ws.isAlive = true;
  ws.rateWindowAt = Date.now();
  ws.rateCount = 0;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    const now = Date.now();
    if (now - ws.rateWindowAt >= 1000) {
      ws.rateWindowAt = now;
      ws.rateCount = 0;
    }
    ws.rateCount++;
    if (ws.rateCount > MAX_MESSAGES_PER_SECOND) {
      ws.close(1008, 'Rate limit exceeded');
      return;
    }

    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return;

    if (msg.type === 'ping') {
      const ts = Number.isFinite(msg.ts) ? msg.ts : 0;
      sendWs(ws, { type: 'pong', ts });
      return;
    }

    if (msg.type === 'resume') {
      resumeRoom(ws, msg);
      return;
    }

    if (msg.type === 'create') {
      cleanup(ws, true);
      let code;
      do {
        code = codeGen();
      } while (rooms.has(code));
      const token = makeToken();
      rooms.set(code, {
        host: ws,
        guest: null,
        hostToken: token,
        guestToken: null,
        hostTimer: null,
        guestTimer: null,
        hp: { host: 100, guest: 100 },
        score: { host: 0, guest: 0 },
        events: { host: new Map(), guest: new Map() },
        round: 0,
        state: 'waiting',
      });
      ws.roomCode = code;
      ws.role = 'host';
      sendWs(ws, { type: 'room', code, role: 'host', token });
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
      if (room.guest || room.guestToken) {
        sendWs(ws, { type: 'error', message: 'Room full' });
        return;
      }
      if (room.host === ws) {
        sendWs(ws, { type: 'error', message: 'Already in room' });
        return;
      }
      cleanup(ws, true);
      const token = makeToken();
      room.guest = ws;
      room.guestToken = token;
      ws.roomCode = code;
      ws.role = 'guest';
      sendWs(ws, { type: 'room', code, role: 'guest', token });
      sendWs(room.host, { type: 'peer_joined' });
      sendWs(ws, { type: 'peer_joined' });
      return;
    }

    if (msg.type === 'leave') {
      cleanup(ws, true);
      return;
    }

    if (!ws.roomCode) return;
    const room = rooms.get(ws.roomCode);
    if (!room) return;
    const peer = otherOf(room, ws);
    if (!peer) return;

    const out = sanitizeRelayMessage(msg);
    if (!out) {
      sendWs(ws, { type: 'error', message: 'Invalid game packet' });
      return;
    }

    if (out.type === 'match_start' || out.type === 'rematch') {
      if (ws.role !== 'host') return;
      room.score.host = 0;
      room.score.guest = 0;
      room.hp.host = 100;
      room.hp.guest = 100;
      room.round = 0;
      room.state = 'waiting';
      room.events.host.clear();
      room.events.guest.clear();
      sendWs(peer, { ...out, from: ws.role });
      return;
    }

    if (out.type === 'round_start') {
      if (ws.role !== 'host') return;
      room.round = out.round;
      room.hp.host = 100;
      room.hp.guest = 100;
      room.state = 'playing';
      room.events.host.clear();
      room.events.guest.clear();
      sendWs(peer, {
        ...out,
        score: scoreFor(room, 'host'),
        from: ws.role,
      });
      return;
    }

    if (out.type === 'damage') {
      applyDamage(room, ws, out);
      return;
    }

    if (out.type === 'state') {
      out.hp = room.hp[ws.role];
      out.alive = room.hp[ws.role] > 0;
    }
    if (out.type === 'shot_fx' || out.type === 'melee' || out.type === 'nade') {
      rememberCombatEvent(room, ws.role, out);
    }
    sendWs(peer, { ...out, from: ws.role });
  });

  ws.on('close', () => cleanup(ws));
  ws.on('error', () => cleanup(ws));
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);
heartbeat.unref();

wss.on('close', () => clearInterval(heartbeat));

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
