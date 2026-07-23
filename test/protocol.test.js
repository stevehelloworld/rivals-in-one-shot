'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeRelayMessage } = require('../server/protocol');

test('accepts and strips a valid state packet', () => {
  assert.deepEqual(
    sanitizeRelayMessage({
      type: 'state',
      x: 1,
      y: 2,
      z: 3,
      yaw: 0.5,
      slot: 4,
      hp: 999,
      alive: false,
      injected: '<script>',
    }),
    {
      type: 'state',
      x: 1,
      y: 2,
      z: 3,
      yaw: 0.5,
      slot: 4,
    }
  );
});

test('rejects unknown and malformed packets', () => {
  assert.equal(sanitizeRelayMessage({ type: 'admin', score: 99 }), null);
  assert.equal(
    sanitizeRelayMessage({
      type: 'shot_fx',
      origin: { x: 0, y: 0, z: 0 },
      muzzle: { x: 0, y: 0, z: 0 },
      dir: { x: Number.NaN, y: 0, z: 1 },
      stopDist: 40,
      color: 0xffffff,
      eventId: 'shot-1',
    }),
    null
  );
  assert.equal(
    sanitizeRelayMessage({
      type: 'damage',
      damage: 9999,
      eventId: 'shot-1',
    }),
    null
  );
});

test('normalizes untrusted weapon fields', () => {
  assert.deepEqual(
    sanitizeRelayMessage({
      type: 'damage',
      damage: 12,
      eventId: 'shot-abc',
      target: 'other',
      head: true,
      weapon: '<img src=x onerror=alert(1)>',
      weaponId: 'hacked',
    }),
    {
      type: 'damage',
      damage: 12,
      eventId: 'shot-abc',
      target: 'other',
      head: true,
      weapon: 'UNKNOWN',
      weaponId: 'ar',
    }
  );
});

test('accepts bounded projectile data', () => {
  const packet = sanitizeRelayMessage({
    type: 'nade',
    pos: { x: 0, y: 1, z: 2 },
    vel: { x: 0, y: 0, z: -32 },
    damage: 100,
    splash: 7,
    fuse: 4,
    gravity: 0,
    radius: 0.18,
    color: 0xf97316,
    eventId: 'rocket-1',
    impact: true,
    kind: 'rocket',
    weapon: 'RPG',
    weaponId: 'rpg',
  });
  assert.equal(packet.type, 'nade');
  assert.equal(packet.kind, 'rocket');
  assert.equal(packet.weaponId, 'rpg');
});
