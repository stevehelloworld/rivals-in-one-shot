import * as THREE from 'three';
import { createLoadout } from './weapons.js';

// Competitive bot — challenging but not aimbot
const SPEED = 7.2;
const JUMP = 9.2;
const GRAVITY = 28;
const RADIUS = 0.4;
const HEIGHT = 1.85;
const SKIN = 0.03;

/**
 * Hard duel bot: tracks well, peeks, full-ish damage, smart loadout.
 * Still misses under pressure; walls block shots via hasLOS.
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
    // Tuned for HARD (was easy: 0.14 / 0.55 / 2.4 / 0.55)
    this.accuracy = 0.028; // tight spread
    this.damageScale = 0.95; // nearly full damage
    this.fireRateMul = 1.15; // slightly slower than player
    this.reactDelay = 0.12; // quick peek → shoot
    this.seeTimer = 0;
    this.aimTarget = new THREE.Vector3();
    this.aimSmooth = 14; // snappy tracking
    this.lastPlayerPos = new THREE.Vector3();
    this.playerVel = new THREE.Vector3();
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

    this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

    this.stateT -= dt;
    if (this.stateT <= 0) {
      this.strafeDir *= Math.random() > 0.25 ? -1 : 1;
      this.stateT = 0.45 + Math.random() * 0.7;
      // Smart loadout by range
      if (dist < 3.5 && Math.random() > 0.35) this.slot = 2; // fists
      else if (
        dist > 6 &&
        dist < 18 &&
        this.loadout[3].ammo > 0 &&
        this.loadout[3].cd <= 0 &&
        Math.random() > 0.55
      ) {
        this.slot = 3; // nade
      } else if (dist > 22) this.slot = 0; // AR long
      else this.slot = Math.random() > 0.4 ? 0 : 1; // AR / HG mid
    }

    const eyeProbe = this.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const chestProbe = playerPos.clone().add(new THREE.Vector3(0, 1.35, 0));
    const seesPlayer =
      playerAlive && (!this.hasLOS || this.hasLOS(eyeProbe, chestProbe));

    if (seesPlayer) this.seeTimer += dt;
    else this.seeTimer = Math.max(0, this.seeTimer - dt * 2);

    // Lead aim: chest + slight velocity prediction
    const lead = this.playerVel.clone().multiplyScalar(0.12 + dist * 0.004);
    const idealAim = playerPos
      .clone()
      .add(new THREE.Vector3(0, 1.35 + (Math.random() > 0.82 ? 0.35 : 0), 0)) // occasional head height
      .add(lead);
    this.aimTarget.lerp(idealAim, Math.min(1, this.aimSmooth * dt));

    // Aggressive movement
    let mx = 0;
    let mz = 0;
    if (playerAlive) {
      if (!seesPlayer) {
        // Push to break cover / flank
        mx = dir.x * 0.75 + (-dir.z) * this.strafeDir * 1.1;
        mz = dir.z * 0.75 + dir.x * this.strafeDir * 1.1;
      } else if (dist > 14) {
        mx = dir.x;
        mz = dir.z;
      } else if (dist < 4.5) {
        // Close: circle + pressure
        mx = dir.x * 0.25 + (-dir.z) * this.strafeDir * 1.15;
        mz = dir.z * 0.25 + dir.x * this.strafeDir * 1.15;
      } else {
        // Mid: AD strafe while shooting
        mx = dir.x * 0.2 + (-dir.z) * this.strafeDir;
        mz = dir.z * 0.2 + dir.x * this.strafeDir;
      }
    }
    const len = Math.hypot(mx, mz) || 1;
    mx = (mx / len) * SPEED;
    mz = (mz / len) * SPEED;

    this.velocity.x += (mx - this.velocity.x) * Math.min(1, 14 * dt);
    this.velocity.z += (mz - this.velocity.z) * Math.min(1, 14 * dt);

    // Jump peeks / jiggle
    if (this.onGround && seesPlayer && Math.random() < 0.012) {
      this.velocity.y = JUMP;
      this.onGround = false;
    } else if (this.onGround && !seesPlayer && Math.random() < 0.006) {
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
    // Rare hesitation when first spotting
    const willFire = canSee && (this.seeTimer > 0.35 || Math.random() > 0.08);

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
