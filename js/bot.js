import * as THREE from 'three';
import { createLoadout } from './weapons.js';

const JUMP = 9.2;
const GRAVITY = 28;
const RADIUS = 0.4;
const HEIGHT = 1.85;
const SKIN = 0.03;

/** @typedef {'easy'|'hard'} BotDifficulty */

export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    label: 'EASY',
    speed: 4.4,
    accuracy: 0.13,
    damageScale: 0.58,
    fireRateMul: 2.2,
    reactDelay: 0.5,
    aimSmooth: 4,
    leadScale: 0.02,
    missChance: 0.28,
    jumpPeek: 0.003,
    nadeChance: 0.88, // higher = less nades (needs random > this)
    fistsDist: 2.6,
    fistsChance: 0.72,
    name: 'RIVAL',
  },
  hard: {
    id: 'hard',
    label: 'HARD',
    speed: 7.2,
    accuracy: 0.028,
    damageScale: 0.95,
    fireRateMul: 1.15,
    reactDelay: 0.12,
    aimSmooth: 14,
    leadScale: 0.12,
    missChance: 0.08,
    jumpPeek: 0.012,
    nadeChance: 0.55,
    fistsDist: 3.5,
    fistsChance: 0.35,
    name: 'RIVAL',
  },
};

/**
 * Duel bot with selectable difficulty (easy / hard).
 * Walls block shots via hasLOS callback.
 */
export class Bot {
  constructor(mesh, colliders, hasLOS = null, difficulty = 'hard') {
    this.mesh = mesh;
    this.colliders = colliders;
    this.hasLOS = hasLOS;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.onGround = true;
    this.floorY = 0;
    this.hp = 100;
    this.maxHp = 100;
    this.alive = true;
    this.loadout = createLoadout();
    this.slot = 0;
    this.aim = new THREE.Vector3(0, 0, 1);
    this.stateT = 0;
    this.strafeDir = 1;
    this.seeTimer = 0;
    this.aimTarget = new THREE.Vector3();
    this.lastPlayerPos = new THREE.Vector3();
    this.playerVel = new THREE.Vector3();
    this.setDifficulty(difficulty);
  }

  /** @param {BotDifficulty|string} id */
  setDifficulty(id) {
    const d = DIFFICULTIES[id] || DIFFICULTIES.hard;
    this.difficulty = d.id;
    this.speed = d.speed;
    this.accuracy = d.accuracy;
    this.damageScale = d.damageScale;
    this.fireRateMul = d.fireRateMul;
    this.reactDelay = d.reactDelay;
    this.aimSmooth = d.aimSmooth;
    this.leadScale = d.leadScale;
    this.missChance = d.missChance;
    this.jumpPeek = d.jumpPeek;
    this.nadeChance = d.nadeChance;
    this.fistsDist = d.fistsDist;
    this.fistsChance = d.fistsChance;
    this.name = d.name;
  }

  get weapon() {
    return this.loadout[this.slot];
  }

  spawn(pos) {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.hp = this.maxHp;
    this.alive = true;
    this.loadout = createLoadout();
    this.slot = 0;
    this.stateT = 0;
    this.seeTimer = 0;
    this.aimTarget.copy(pos).add(new THREE.Vector3(0, 1.4, 0));
    this.lastPlayerPos.set(0, 0, 0);
    this.playerVel.set(0, 0, 0);
    this.mesh.visible = true;
    this.mesh.position.set(pos.x, pos.y, pos.z);
  }

  takeDamage(amount) {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    const body = this.mesh.userData.body;
    if (body) {
      body.material.emissive = new THREE.Color(0xffffff);
      body.material.emissiveIntensity = 0.8;
      setTimeout(() => {
        body.material.emissiveIntensity = 0;
      }, 60);
    }
    // When hurt, briefly strafe harder
    if (amount > 10) this.strafeDir *= -1;
    if (this.hp <= 0) {
      this.alive = false;
      this.mesh.visible = false;
      return true;
    }
    return false;
  }

  update(dt, now, playerPos, playerAlive) {
    const shots = [];
    let melee = null;
    const nades = [];

    if (!this.alive) return { shots, nades, melee };

    // Estimate player velocity for lead aim
    if (this.lastPlayerPos.lengthSq() > 0.01) {
      const raw = playerPos.clone().sub(this.lastPlayerPos).multiplyScalar(1 / Math.max(dt, 0.001));
      this.playerVel.lerp(raw, Math.min(1, 8 * dt));
    }
    this.lastPlayerPos.copy(playerPos);

    for (const w of this.loadout) {
      if (w.cd > 0) w.cd = Math.max(0, w.cd - dt);
      if (w.reloading) {
        w.reloadT -= dt;
        if (w.reloadT <= 0) {
          w.reloading = false;
          w.ammo = w.magSize;
        }
      }
    }

    const toPlayer = playerPos.clone().sub(this.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    const dir = dist > 0.1 ? toPlayer.normalize() : new THREE.Vector3(0, 0, 1);
    const grenadeSlot = this.loadout.findIndex((item) => item.id === 'grenade');
    const rpgSlot = this.loadout.findIndex((item) => item.id === 'rpg');

    this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

    this.stateT -= dt;
    if (this.stateT <= 0) {
      this.strafeDir *= Math.random() > 0.25 ? -1 : 1;
      this.stateT =
        this.difficulty === 'easy'
          ? 0.85 + Math.random() * 1.2
          : 0.45 + Math.random() * 0.7;
      // Smart loadout by range
      if (dist < this.fistsDist && Math.random() > this.fistsChance) this.slot = 2;
      else if (
        rpgSlot >= 0 &&
        dist > 8 &&
        dist < 25 &&
        this.loadout[rpgSlot].ammo > 0 &&
        !this.loadout[rpgSlot].reloading &&
        Math.random() > (this.difficulty === 'easy' ? 0.94 : 0.82)
      ) {
        this.slot = rpgSlot;
      } else if (
        grenadeSlot >= 0 &&
        dist > 6 &&
        dist < 18 &&
        this.loadout[grenadeSlot].ammo > 0 &&
        this.loadout[grenadeSlot].cd <= 0 &&
        Math.random() > this.nadeChance
      ) {
        this.slot = grenadeSlot;
      } else if (dist > 22) this.slot = 0;
      else this.slot = Math.random() > (this.difficulty === 'easy' ? 0.75 : 0.4) ? 0 : 1;
    }

    const eyeProbe = this.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const chestProbe = playerPos.clone().add(new THREE.Vector3(0, 1.35, 0));
    const seesPlayer =
      playerAlive && (!this.hasLOS || this.hasLOS(eyeProbe, chestProbe));

    if (seesPlayer) this.seeTimer += dt;
    else this.seeTimer = Math.max(0, this.seeTimer - dt * 2);

    // Lead aim: chest + velocity prediction (harder = more lead)
    const lead = this.playerVel
      .clone()
      .multiplyScalar(this.leadScale + dist * this.leadScale * 0.03);
    const headChance = this.difficulty === 'hard' ? 0.82 : 0.96;
    const idealAim = playerPos
      .clone()
      .add(new THREE.Vector3(0, 1.35 + (Math.random() > headChance ? 0.35 : 0), 0))
      .add(lead);
    this.aimTarget.lerp(idealAim, Math.min(1, this.aimSmooth * dt));

    // Movement by difficulty
    let mx = 0;
    let mz = 0;
    const push = this.difficulty === 'hard' ? 0.75 : 0.3;
    const flank = this.difficulty === 'hard' ? 1.1 : 0.7;
    if (playerAlive) {
      if (!seesPlayer) {
        mx = dir.x * push + (-dir.z) * this.strafeDir * flank;
        mz = dir.z * push + dir.x * this.strafeDir * flank;
      } else if (dist > 14) {
        mx = dir.x * (this.difficulty === 'hard' ? 1 : 0.65);
        mz = dir.z * (this.difficulty === 'hard' ? 1 : 0.65);
      } else if (dist < 4.5) {
        if (this.difficulty === 'easy') {
          // Back off
          mx = -dir.x * 0.45 + (-dir.z) * this.strafeDir * 0.6;
          mz = -dir.z * 0.45 + dir.x * this.strafeDir * 0.6;
        } else {
          mx = dir.x * 0.25 + (-dir.z) * this.strafeDir * 1.15;
          mz = dir.z * 0.25 + dir.x * this.strafeDir * 1.15;
        }
      } else {
        mx = dir.x * 0.15 + (-dir.z) * this.strafeDir;
        mz = dir.z * 0.15 + dir.x * this.strafeDir;
      }
    }
    const len = Math.hypot(mx, mz) || 1;
    mx = (mx / len) * this.speed;
    mz = (mz / len) * this.speed;

    const accel = this.difficulty === 'hard' ? 14 : 7;
    this.velocity.x += (mx - this.velocity.x) * Math.min(1, accel * dt);
    this.velocity.z += (mz - this.velocity.z) * Math.min(1, accel * dt);

    // Jump peeks
    if (this.onGround && seesPlayer && Math.random() < this.jumpPeek) {
      this.velocity.y = JUMP;
      this.onGround = false;
    } else if (this.onGround && !seesPlayer && Math.random() < this.jumpPeek * 0.5) {
      this.velocity.y = JUMP * 0.9;
      this.onGround = false;
    }

    this.velocity.y -= GRAVITY * dt;
    this._move(dt);
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);

    if (!playerAlive) return { shots, nades, melee };

    const w = this.weapon;
    const eye = this.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const shootDir = this.aimTarget.clone().sub(eye).normalize();

    const canSee = seesPlayer && this.seeTimer >= this.reactDelay;
    const willFire =
      canSee &&
      (this.seeTimer > this.reactDelay + 0.15 || Math.random() > this.missChance);

    const noisyDir = shootDir.clone();
    // More spread while moving / close panic
    const moveSpread =
      (Math.hypot(this.velocity.x, this.velocity.z) > 4 ? 1.35 : 1) *
      (dist < 5 ? 1.2 : 1);
    const spread = this.accuracy * moveSpread * (1 + dist * 0.012);
    noisyDir.x += (Math.random() - 0.5) * spread;
    noisyDir.y += (Math.random() - 0.5) * spread * 0.7;
    noisyDir.z += (Math.random() - 0.5) * spread;
    noisyDir.normalize();

    if (w.type === 'gun' && !w.reloading) {
      if (w.ammo <= 0) {
        w.reloading = true;
        w.reloadT = w.reloadTime * 0.95;
      } else if (
        willFire &&
        now - w.lastShot >= w.fireRate * this.fireRateMul &&
        dist < w.range
      ) {
        w.lastShot = now;
        w.ammo--;
        shots.push({
          origin: eye.clone(),
          dir: noisyDir,
          damage: w.damage * this.damageScale,
          headMult: w.headMult ?? 1.25,
          range: w.range,
          weapon: w.name,
          fromBot: true,
        });
      }
    } else if (w.type === 'melee' && canSee && dist < w.range + 0.35) {
      if (now - w.lastShot >= w.fireRate * 0.95) {
        w.lastShot = now;
        melee = {
          origin: eye.clone(),
          dir: shootDir.clone(),
          damage: w.damage * 0.95,
          range: w.range + 0.35,
          weapon: w.name,
          fromBot: true,
        };
      }
    } else if (w.type === 'launcher' && !w.reloading) {
      if (w.ammo <= 0) {
        w.reloading = true;
        w.reloadT = w.reloadTime;
      } else if (willFire && now - w.lastShot >= w.fireRate && dist < 28) {
        w.lastShot = now;
        w.ammo--;
        const rocketDir = shootDir.clone();
        rocketDir.x += (Math.random() - 0.5) * this.accuracy * 0.35;
        rocketDir.y += (Math.random() - 0.5) * this.accuracy * 0.2;
        rocketDir.z += (Math.random() - 0.5) * this.accuracy * 0.35;
        rocketDir.normalize();
        nades.push({
          pos: eye.clone().add(rocketDir.clone().multiplyScalar(0.7)),
          vel: rocketDir.multiplyScalar(w.projectileSpeed * 0.92),
          damage: w.damage * (this.difficulty === 'easy' ? 0.68 : 0.82),
          splash: w.splash,
          fuse: w.fuse,
          weapon: w.name,
          kind: 'rocket',
          gravity: 0,
          impact: true,
          radius: 0.18,
          color: 0xf97316,
          fromBot: true,
        });
        this.slot = 0;
      }
    } else if (
      w.type === 'utility' &&
      w.cd <= 0 &&
      w.ammo > 0 &&
      dist < 20 &&
      dist > 5
    ) {
      if (now - w.lastShot >= 0.4 && (canSee || dist < 12)) {
        w.lastShot = now;
        w.ammo = 0;
        w.cd = w.cooldown * 0.9;
        const throwDir = shootDir.clone();
        throwDir.y += 0.22 + dist * 0.008;
        throwDir.normalize();
        nades.push({
          pos: eye.clone().add(throwDir.clone().multiplyScalar(0.5)),
          vel: throwDir.multiplyScalar(w.throwSpeed * 0.95),
          damage: w.damage * 0.9,
          splash: w.splash,
          fuse: 1.45,
          weapon: w.name,
          kind: 'grenade',
          gravity: 18,
          impact: false,
          radius: 0.15,
          color: 0x4ade80,
          fromBot: true,
        });
        this.slot = 0;
      }
    }

    const grenade = this.loadout[grenadeSlot];
    if (grenade && grenade.cd <= 0 && grenade.ammo < 1) grenade.ammo = 1;

    return { shots, nades, melee };
  }

  _move(dt) {
    let x = this.position.x + this.velocity.x * dt;
    if (this._hitsWall(x, this.position.y, this.position.z)) {
      x = this.position.x;
      this.velocity.x = 0;
      this.strafeDir *= -1;
    }
    let z = this.position.z + this.velocity.z * dt;
    if (this._hitsWall(x, this.position.y, z)) {
      z = this.position.z;
      this.velocity.z = 0;
      this.strafeDir *= -1;
    }
    let y = this.position.y + this.velocity.y * dt;
    const floor = this._findFloor(x, z, y);
    if (this.velocity.y <= 0 && y <= floor + SKIN) {
      y = floor + SKIN;
      this.velocity.y = 0;
      this.onGround = true;
      this.floorY = floor;
    } else {
      this.onGround = false;
    }
    if (y < SKIN) {
      y = SKIN;
      this.velocity.y = 0;
      this.onGround = true;
    }
    this.position.set(x, y, z);
  }

  _hitsWall(x, y, z) {
    const feet = Math.max(y, this.floorY) + SKIN * 2;
    const box = new THREE.Box3(
      new THREE.Vector3(x - RADIUS, feet, z - RADIUS),
      new THREE.Vector3(x + RADIUS, y + HEIGHT, z + RADIUS)
    );
    for (const c of this.colliders) {
      if (c.max.y <= feet + 0.05) continue;
      if (box.intersectsBox(c)) return true;
    }
    return false;
  }

  _findFloor(x, z, y) {
    let best = 0;
    const mid = y + HEIGHT * 0.5;
    for (const c of this.colliders) {
      if (
        x + RADIUS <= c.min.x || x - RADIUS >= c.max.x ||
        z + RADIUS <= c.min.z || z - RADIUS >= c.max.z
      ) continue;
      const top = c.max.y;
      if (top <= mid && top >= y - 1.2 && top > best) best = top;
    }
    return best;
  }

  getHitboxes() {
    const p = this.position;
    return {
      body: new THREE.Box3(
        new THREE.Vector3(p.x - 0.4, p.y, p.z - 0.4),
        new THREE.Vector3(p.x + 0.4, p.y + 1.55, p.z + 0.4)
      ),
      head: new THREE.Box3(
        new THREE.Vector3(p.x - 0.28, p.y + 1.55, p.z - 0.28),
        new THREE.Vector3(p.x + 0.28, p.y + 2.1, p.z + 0.28)
      ),
    };
  }
}
