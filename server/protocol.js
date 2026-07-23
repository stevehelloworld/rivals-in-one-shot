'use strict';

const WEAPON_NAMES = new Set([
  'ASSAULT RIFLE',
  'HANDGUN',
  'FISTS',
  'GRENADE',
  'RPG',
  'UNKNOWN',
]);

const WEAPON_IDS = new Set(['ar', 'handgun', 'fists', 'grenade', 'rpg']);
const RELAY_TYPES = new Set([
  'state',
  'shot_fx',
  'melee',
  'nade',
  'damage',
  'match_start',
  'round_start',
  'rematch',
]);

function finite(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

function integer(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function vector(value, limit = 1000) {
  if (!value || typeof value !== 'object') return null;
  const x = finite(value.x, -limit, limit);
  const y = finite(value.y, -limit, limit);
  const z = finite(value.z, -limit, limit);
  return x === null || y === null || z === null ? null : { x, y, z };
}

function weaponName(value) {
  return WEAPON_NAMES.has(value) ? value : 'UNKNOWN';
}

function weaponId(value) {
  return WEAPON_IDS.has(value) ? value : 'ar';
}

function eventId(value) {
  if (typeof value !== 'string') return null;
  return /^[a-z0-9_-]{1,40}$/i.test(value) ? value : null;
}

function sanitizeRelayMessage(msg) {
  if (!msg || typeof msg !== 'object' || !RELAY_TYPES.has(msg.type)) return null;

  switch (msg.type) {
    case 'state': {
      const x = finite(msg.x, -1000, 1000);
      const y = finite(msg.y, -1000, 1000);
      const z = finite(msg.z, -1000, 1000);
      const yaw = finite(msg.yaw, -Math.PI * 4, Math.PI * 4);
      const slot = integer(msg.slot, 0, 4);
      if ([x, y, z, yaw, slot].some((v) => v === null)) return null;
      return { type: 'state', x, y, z, yaw, slot };
    }
    case 'shot_fx': {
      const origin = vector(msg.origin);
      const muzzle = vector(msg.muzzle);
      const dir = vector(msg.dir, 2);
      const stopDist = finite(msg.stopDist, 0, 200);
      const color = integer(msg.color, 0, 0xffffff);
      const id = eventId(msg.eventId);
      if (!origin || !muzzle || !dir || stopDist === null || color === null || !id) return null;
      return {
        type: 'shot_fx',
        origin,
        muzzle,
        dir,
        stopDist,
        color,
        eventId: id,
        weaponId: weaponId(msg.weaponId),
        impact: Boolean(msg.impact),
      };
    }
    case 'melee': {
      const id = eventId(msg.eventId);
      if (!id) return null;
      return {
        type: 'melee',
        eventId: id,
        weapon: weaponName(msg.weapon),
        weaponId: weaponId(msg.weaponId),
      };
    }
    case 'nade': {
      const pos = vector(msg.pos);
      const vel = vector(msg.vel, 250);
      const damage = finite(msg.damage, 0, 150);
      const splash = finite(msg.splash, 0.1, 20);
      const fuse = finite(msg.fuse, 0.05, 10);
      const gravity = finite(msg.gravity, 0, 50);
      const radius = finite(msg.radius, 0.02, 2);
      const color = integer(msg.color, 0, 0xffffff);
      const id = eventId(msg.eventId);
      if (
        !pos ||
        !vel ||
        damage === null ||
        splash === null ||
        fuse === null ||
        gravity === null ||
        radius === null ||
        color === null ||
        !id
      ) {
        return null;
      }
      return {
        type: 'nade',
        pos,
        vel,
        damage,
        splash,
        fuse,
        gravity,
        radius,
        color,
        eventId: id,
        impact: Boolean(msg.impact),
        kind: msg.kind === 'rocket' ? 'rocket' : 'grenade',
        weapon: weaponName(msg.weapon),
        weaponId: weaponId(msg.weaponId),
      };
    }
    case 'damage': {
      const damage = finite(msg.damage, 0.1, 150);
      const id = eventId(msg.eventId);
      if (damage === null || !id) return null;
      return {
        type: 'damage',
        damage,
        eventId: id,
        target: msg.target === 'self' ? 'self' : 'other',
        head: Boolean(msg.head),
        weapon: weaponName(msg.weapon),
        weaponId: weaponId(msg.weaponId),
      };
    }
    case 'round_start': {
      const round = integer(msg.round, 1, 99);
      return round === null ? null : { type: 'round_start', round };
    }
    case 'match_start':
    case 'rematch':
      return { type: msg.type };
    default:
      return null;
  }
}

module.exports = {
  RELAY_TYPES,
  sanitizeRelayMessage,
};
