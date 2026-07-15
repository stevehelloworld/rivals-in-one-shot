import * as THREE from 'three';
import { createLoadout } from './weapons.js';

// Easy-mode bot — intentionally weak so players can learn the game
const SPEED = 4.2;
const JUMP = 8;
const GRAVITY = 28;
const RADIUS = 0.4;
const HEIGHT = 1.85;
const SKIN = 0.03;

/**
 * Casual duel bot. Misses often, reacts slowly, deals less pressure.
 * hasLOS(from, to) required so it never wallbangs.
 */
export class Bot {
  constructor(mesh, colliders, hasLOS = null) {
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
    this.accuracy = 0.14; // high spread → many misses
    this.damageScale = 0.55; // soft hits
    this.fireRateMul = 2.4; // shoots much slower
    this.reactDelay = 0.55; // must see player this long before firing
    this.seeTimer = 0;
    this.aimTarget = new THREE.Vector3();
    this.aimSmooth = 3.5; // laggy tracking
    this.name = 'RIVAL';
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

    this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

    this.stateT -= dt;
    if (this.stateT <= 0) {
      this.strafeDir *= Math.random() > 0.3 ? -1 : 1;
      this.stateT = 0.9 + Math.random() * 1.4;
      // Prefer AR; rarely smart loadout swaps
      if (dist < 2.5 && Math.random() > 0.7) this.slot = 2;
      else if (dist > 20) this.slot = 0;
      else this.slot = Math.random() > 0.75 ? 1 : 0;
      // Almost never nades
      if (Math.random() > 0.92 && this.loadout[3].ammo > 0) this.slot = 3;
    }

    const eyeProbe = this.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const chestProbe = playerPos.clone().add(new THREE.Vector3(0, 1.35, 0));
    const seesPlayer =
      playerAlive && (!this.hasLOS || this.hasLOS(eyeProbe, chestProbe));

    if (seesPlayer) this.seeTimer += dt;
    else this.seeTimer = 0;

    // Laggy aim point
    const idealAim = playerPos.clone().add(new THREE.Vector3(0, 1.2, 0));
    this.aimTarget.lerp(idealAim, Math.min(1, this.aimSmooth * dt));

    // Movement — slower, less aggressive peeking
    let mx = 0;
    let mz = 0;
    if (playerAlive) {
      if (!seesPlayer) {
        mx = dir.x * 0.25 + (-dir.z) * this.strafeDir * 0.7;
        mz = dir.z * 0.25 + dir.x * this.strafeDir * 0.7;
      } else if (dist > 16) {
        mx = dir.x * 0.7;
        mz = dir.z * 0.7;
      } else if (dist < 7) {
        // Back off instead of rushing
        mx = -dir.x * 0.5 + (-dir.z) * this.strafeDir * 0.6;
        mz = -dir.z * 0.5 + dir.x * this.strafeDir * 0.6;
      } else {
        mx = (-dir.z) * this.strafeDir * 0.8;
        mz = dir.x * this.strafeDir * 0.8;
      }
    }
    const len = Math.hypot(mx, mz) || 1;
    mx = (mx / len) * SPEED;
    mz = (mz / len) * SPEED;

    this.velocity.x += (mx - this.velocity.x) * Math.min(1, 6 * dt);
    this.velocity.z += (mz - this.velocity.z) * Math.min(1, 6 * dt);

    // Rare jumps
    if (this.onGround && Math.random() < 0.002) {
      this.velocity.y = JUMP;
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

    // Extra miss chance even with LOS
    const willFire = canSee && Math.random() > 0.25;

    const noisyDir = shootDir.clone();
    const spread = this.accuracy * (1 + dist * 0.035);
    noisyDir.x += (Math.random() - 0.5) * spread;
    noisyDir.y += (Math.random() - 0.5) * spread * 0.8;
    noisyDir.z += (Math.random() - 0.5) * spread;
    noisyDir.normalize();

    if (w.type === 'gun' && !w.reloading) {
      if (w.ammo <= 0) {
        w.reloading = true;
        w.reloadT = w.reloadTime * 1.2;
      } else if (
        willFire &&
        now - w.lastShot >= w.fireRate * this.fireRateMul &&
        dist < w.range * 0.85
      ) {
        w.lastShot = now;
        w.ammo--;
        shots.push({
          origin: eye.clone(),
          dir: noisyDir,
          damage: w.damage * this.damageScale,
          headMult: 1.1, // almost no headshot reward for bot
          range: w.range,
          weapon: w.name,
          fromBot: true,
        });
      }
    } else if (w.type === 'melee' && canSee && dist < w.range * 0.85) {
      if (now - w.lastShot >= w.fireRate * 1.5) {
        w.lastShot = now;
        melee = {
          origin: eye.clone(),
          dir: shootDir.clone(),
          damage: w.damage * 0.7,
          range: w.range,
          weapon: w.name,
          fromBot: true,
        };
      }
    } else if (
      w.type === 'utility' &&
      w.cd <= 0 &&
      w.ammo > 0 &&
      dist < 16 &&
      dist > 8 &&
      canSee &&
      Math.random() > 0.7
    ) {
      if (now - w.lastShot >= 1.2) {
        w.lastShot = now;
        w.ammo = 0;
        w.cd = w.cooldown * 1.3;
        const throwDir = shootDir.clone();
        throwDir.y += 0.35;
        throwDir.normalize();
        nades.push({
          pos: eye.clone().add(throwDir.clone().multiplyScalar(0.5)),
          vel: throwDir.multiplyScalar(w.throwSpeed * 0.75),
          damage: w.damage * 0.6,
          splash: w.splash * 0.85,
          fuse: 1.8,
          weapon: w.name,
          fromBot: true,
        });
        this.slot = 0;
      }
    }

    if (this.loadout[3].cd <= 0 && this.loadout[3].ammo < 1) this.loadout[3].ammo = 1;

    return { shots, nades, melee };
  }

  _move(dt) {
    let x = this.position.x + this.velocity.x * dt;
    if (this._hitsWall(x, this.position.y, this.position.z)) {
      x = this.position.x;
      this.velocity.x = 0;
    }
    let z = this.position.z + this.velocity.z * dt;
    if (this._hitsWall(x, this.position.y, z)) {
      z = this.position.z;
      this.velocity.z = 0;
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
