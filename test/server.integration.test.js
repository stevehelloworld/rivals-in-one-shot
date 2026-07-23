'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const WebSocket = require('ws');

const port = 21000 + (process.pid % 10000);
let serverProcess;

function waitForMessage(ws, predicate, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for WebSocket message'));
    }, timeoutMs);
    const onMessage = (raw) => {
      const message = JSON.parse(String(raw));
      if (!predicate(message)) return;
      cleanup();
      resolve(message);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      ws.off('message', onMessage);
    };
    ws.on('message', onMessage);
  });
}

async function connect() {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await once(ws, 'open');
  return ws;
}

test.before(async () => {
  serverProcess = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server did not start')), 3000);
    serverProcess.stdout.on('data', (chunk) => {
      if (!String(chunk).includes('RIVALS listening')) return;
      clearTimeout(timeout);
      resolve();
    });
    serverProcess.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited early with ${code}`));
    });
  });
});

test.after(async () => {
  if (!serverProcess || serverProcess.exitCode !== null) return;
  serverProcess.kill('SIGTERM');
  await once(serverProcess, 'exit');
});

test('serves ES modules with a browser-compatible MIME type', async () => {
  const response = await fetch(`http://127.0.0.1:${port}/js/touch-math.mjs`);

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /^text\/javascript/);
  assert.match(await response.text(), /export function clampStick/);
});

test('server owns health, death and score', async () => {
  const host = await connect();
  const guest = await connect();

  const pongPromise = waitForMessage(host, (message) => message.type === 'pong');
  host.send('null');
  host.send(JSON.stringify({ type: 'ping', ts: 123 }));
  assert.equal((await pongPromise).ts, 123);

  const roomPromise = waitForMessage(host, (message) => message.type === 'room');
  host.send(JSON.stringify({ type: 'create' }));
  const room = await roomPromise;
  assert.match(room.code, /^[A-Z0-9]{4}$/);
  assert.equal(room.role, 'host');

  const guestRoomPromise = waitForMessage(guest, (message) => message.type === 'room');
  guest.send(JSON.stringify({ type: 'join', code: room.code }));
  await guestRoomPromise;

  const matchPromise = waitForMessage(guest, (message) => message.type === 'match_start');
  host.send(JSON.stringify({ type: 'match_start' }));
  await matchPromise;

  const roundPromise = waitForMessage(guest, (message) => message.type === 'round_start');
  host.send(JSON.stringify({ type: 'round_start', round: 1 }));
  await roundPromise;

  const firstDamage = waitForMessage(guest, (message) => message.type === 'damage');
  host.send(
    JSON.stringify({
      type: 'shot_fx',
      origin: { x: 0, y: 1, z: 0 },
      muzzle: { x: 0.2, y: 1, z: -0.5 },
      dir: { x: 0, y: 0, z: -1 },
      stopDist: 12,
      color: 0xef4444,
      weaponId: 'ar',
      eventId: 'shot-1',
      impact: true,
    })
  );
  host.send(
    JSON.stringify({
      type: 'damage',
      damage: 12,
      target: 'other',
      head: false,
      weapon: 'ASSAULT RIFLE',
      weaponId: 'ar',
      eventId: 'shot-1',
    })
  );
  assert.equal((await firstDamage).hp, 88);

  const hostResult = waitForMessage(host, (message) => message.type === 'round_result');
  const guestResult = waitForMessage(guest, (message) => message.type === 'round_result');
  host.send(
    JSON.stringify({
      type: 'nade',
      pos: { x: 0, y: 1, z: 0 },
      vel: { x: 0, y: 0, z: -32 },
      damage: 100,
      splash: 7,
      fuse: 4,
      gravity: 0,
      radius: 0.18,
      color: 0xf97316,
      eventId: 'rocket-2',
      impact: true,
      kind: 'rocket',
      weapon: 'RPG',
      weaponId: 'rpg',
    })
  );
  host.send(
    JSON.stringify({
      type: 'damage',
      damage: 100,
      target: 'other',
      head: true,
      weapon: 'RPG',
      weaponId: 'rpg',
      eventId: 'rocket-2',
    })
  );

  assert.deepEqual((await hostResult).score, { you: 1, enemy: 0 });
  assert.deepEqual((await guestResult).score, { you: 0, enemy: 1 });

  host.send(JSON.stringify({ type: 'leave' }));
  guest.send(JSON.stringify({ type: 'leave' }));
  host.close();
  guest.close();
});

test('a disconnected player can resume the same room during the grace period', async () => {
  const host = await connect();
  const guest = await connect();

  const roomPromise = waitForMessage(host, (message) => message.type === 'room');
  host.send(JSON.stringify({ type: 'create' }));
  const room = await roomPromise;

  const guestRoomPromise = waitForMessage(guest, (message) => message.type === 'room');
  guest.send(JSON.stringify({ type: 'join', code: room.code }));
  await guestRoomPromise;

  const reconnecting = waitForMessage(
    guest,
    (message) => message.type === 'peer_reconnecting'
  );
  host.terminate();
  await reconnecting;

  const resumedHost = await connect();
  const resumedPromise = waitForMessage(
    resumedHost,
    (message) => message.type === 'resumed'
  );
  const peerResumedPromise = waitForMessage(
    guest,
    (message) => message.type === 'peer_resumed'
  );
  resumedHost.send(
    JSON.stringify({
      type: 'resume',
      code: room.code,
      role: room.role,
      token: room.token,
    })
  );

  const resumed = await resumedPromise;
  assert.equal(resumed.code, room.code);
  assert.equal(resumed.role, 'host');
  await peerResumedPromise;

  resumedHost.send(JSON.stringify({ type: 'leave' }));
  guest.send(JSON.stringify({ type: 'leave' }));
  resumedHost.close();
  guest.close();
});
