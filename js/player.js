import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createLoadout } from './weapons.js';
import { setViewmodelWeapon } from './map.js';

const WALK = 7;
const SPRINT = 11;
const SLIDE_SPEED = 14;
const JUMP = 9.5;
const GRAVITY = 28;
const HEIGHT = 1.7;
const RADIUS = 0.35;
const EYE = 1.55;
const SKIN = 0.03;

export class Player {
  constructor(camera, domElement, colliders, viewmodel) {
    this.camera = camera;
    this.colliders = colliders;
    this.viewmodel = viewmodel;
    this.controls = new PointerLockControls(camera, domElement);

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.onGround = true;
    this.floorY = 0;
    this.hp = 100;
    this.maxHp = 100;
    this.alive = true;
    this.sliding = false;
    this.slideT = 0;
    this.sprinting = false;
    this.airJumps = 0; // fists double jump charges
    this.usedAirJump = false;
    this.yaw = 0;
    this.pitch = 0;

    this.loadout = createLoadout();
    this.slot = 0;
    this.shooting = false;
    this.fireQueued = false;
    this.jumpQueued = false;
    this.slideQueued = false;
    this.recoilKick = 0;
    this.weaponKick = 0;
    this.muzzleFlashT = 0;
    this.reloadRequested = false;
    this._frameEvents = null;
    this.touchActive = false;
    this.touchMove = { x: 0, y: 0 };
    this._lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');

    this.keys = {
      f: false, b: false, l: false, r: false,
      jump: false, sprint: false, crouch: false,
    };

    this._bind();
    setViewmodelWeapon(viewmodel, this.weapon.id);
  }

  get weapon() {
    return this.loadout[this.slot];
  }

  get isLocked() {
    return this.controls.isLocked || this.touchActive;
  }

  lock() {
    this.controls.lock();
  }

  unlock() {
    this.touchActive = false;
    this.setTouchMove(0, 0);
    this.cancelFire();
    this.controls.unlock();
  }

  setTouchActive(active) {
    this.touchActive = Boolean(active);
    if (!this.touchActive) {
      this.setTouchMove(0, 0);
      this.keys.jump = false;
      this.keys.crouch = false;
      this.jumpQueued = false;
      this.slideQueued = false;
      this.cancelFire();
    }
  }

  setTouchMove(x, y) {
    this.touchMove.x = THREE.MathUtils.clamp(Number(x) || 0, -1, 1);
    this.touchMove.y = THREE.MathUtils.clamp(Number(y) || 0, -1, 1);
  }

  applyTouchLook(deltaX, deltaY, sensitivity = 1) {
    if (!this.touchActive || !this.alive) return;
    const scale = 0.0024 * THREE.MathUtils.clamp(sensitivity, 0.25, 2);
    this._lookEuler.setFromQuaternion(this.camera.quaternion);
    this._lookEuler.y -= deltaX * scale;
    this._lookEuler.x -= deltaY * scale;
    this._lookEuler.x = THREE.MathUtils.clamp(
      this._lookEuler.x,
      -Math.PI / 2 + 0.04,
      Math.PI / 2 - 0.04
    );
    this._lookEuler.z = 0;
    this.camera.quaternion.setFromEuler(this._lookEuler);
  }

  requestReload() {
    if (this.alive) this.reloadRequested = true;
  }

  requestJump() {
    if (this.alive) this.jumpQueued = true;
  }

  requestSlide() {
    if (this.alive) this.slideQueued = true;
  }

  pressFire() {
    if (!this.alive) return;
    this.shooting = true;
    this.fireQueued = true;
  }

  releaseFire() {
    this.shooting = false;
  }

  cancelFire() {
    this.shooting = false;
    this.fireQueued = false;
  }

  cycleWeapon() {
    if (!this.alive) return;
    this.switchSlot((this.slot + 1) % this.loadout.length);
  }

  _bind() {
    const set = (e, d) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': this.keys.f = d; break;
        case 'KeyS': case 'ArrowDown': this.keys.b = d; break;
        case 'KeyA': case 'ArrowLeft': this.keys.l = d; break;
        case 'KeyD': case 'ArrowRight': this.keys.r = d; break;
        case 'Space': this.keys.jump = d; if (d) e.preventDefault(); break;
        case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = d; break;
        case 'KeyC': case 'ControlLeft': this.keys.crouch = d; break;
        case 'KeyR':
          if (d && !e.repeat && this.controls.isLocked && this.alive) {
            this.reloadRequested = true;
            e.preventDefault();
          }
          break;
        case 'Digit1': if (d) this.switchSlot(0); break;
        case 'Digit2': if (d) this.switchSlot(1); break;
        case 'Digit3': if (d) this.switchSlot(2); break;
        case 'Digit4': case 'KeyG': if (d) this.switchSlot(3); break;
        case 'Digit5': if (d) this.switchSlot(4); break;
      }
    };
    document.addEventListener('keydown', (e) => set(e, true));
    document.addEventListener('keyup', (e) => set(e, false));
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.controls.isLocked) this.pressFire();
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.releaseFire();
    });
  }

  switchSlot(i) {
    if (i < 0 || i >= this.loadout.length || !this.alive) return;
    if (this.weapon.reloading) {
      this.weapon.reloading = false;
      this.weapon.reloadT = 0;
    }
    this.slot = i;
    this.fireQueued = false;
    this.reloadRequested = false;
    this._hideMuzzleFlash();
    setViewmodelWeapon(this.viewmodel, this.weapon.id);
    // RIVALS-style: equipping fists mid-air enables one double jump
    if (this.weapon.doubleJump && !this.onGround && !this.usedAirJump) {
      this.airJumps = 1;
    }
  }

  spawn(pos) {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.hp = this.maxHp;
    this.alive = true;
    this.onGround = true;
    this.floorY = pos.y;
    this.sliding = false;
    this.airJumps = 0;
    this.usedAirJump = false;
    this.loadout = createLoadout();
    this.slot = 0;
    this.cancelFire();
    this.jumpQueued = false;
    this.slideQueued = false;
    this.reloadRequested = false;
    this.weaponKick = 0;
    this.muzzleFlashT = 0;
    this._hideMuzzleFlash();
    setViewmodelWeapon(this.viewmodel, this.weapon.id);
    this.camera.position.set(pos.x, pos.y + EYE, pos.z);
    // Face mid
    this.camera.lookAt(0, 1.5, 0);
  }

  takeDamage(amount) {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.alive = false;
      this.velocity.set(0, 0, 0);
      return true; // dead
    }
    return false;
  }

  update(dt, now, callbacks) {
    if (!this.isLocked || !this.alive) {
      return { shots: [], nades: [], melee: null, events: [] };
    }

    const events = [];
    this._frameEvents = events;

    // Weapon timers
    for (const w of this.loadout) {
      if (w.cd > 0) w.cd = Math.max(0, w.cd - dt);
      if (w.reloading) {
        w.reloadT -= dt;
        if (w.reloadT <= 0) {
          w.reloading = false;
          w.ammo = w.magSize;
          events.push({ type: 'reload_complete', weaponId: w.id });
        }
      }
    }

    // R is an edge-triggered manual reload, so holding it cannot restart the
    // animation. Automatic empty-mag reload still uses the same helper.
    if (this.reloadRequested) {
      this.reloadRequested = false;
      this._startReload(this.weapon);
    }

    // Movement
    this.direction.set(this.touchMove.x, 0, this.touchMove.y);
    if (this.keys.f) this.direction.z -= 1;
    if (this.keys.b) this.direction.z += 1;
    if (this.keys.l) this.direction.x -= 1;
    if (this.keys.r) this.direction.x += 1;
    const moveStrength = Math.min(1, this.direction.length());
    if (this.direction.lengthSq() > 0) this.direction.normalize();

    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(this.camera.quaternion);
    const yaw = euler.y;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const mx = this.direction.x * cos + this.direction.z * sin;
    const mz = -this.direction.x * sin + this.direction.z * cos;

    // Slide: sprint + crouch while moving
    const moving = moveStrength > 0.02;
    const touchSprint = this.touchActive && moveStrength > 0.78;
    this.sprinting =
      (this.keys.sprint || touchSprint) && moving && this.onGround && !this.sliding;

    if (
      (this.keys.crouch || this.slideQueued) &&
      this.sprinting &&
      !this.sliding &&
      this.onGround
    ) {
      this.sliding = true;
      this.slideT = 0.55;
      this.velocity.x = mx * SLIDE_SPEED;
      this.velocity.z = mz * SLIDE_SPEED;
    }
    this.slideQueued = false;

    if (this.sliding) {
      this.slideT -= dt;
      this.velocity.x *= 1 - 2.2 * dt;
      this.velocity.z *= 1 - 2.2 * dt;
      if (this.slideT <= 0 || !this.onGround) this.sliding = false;
    } else {
      const analogScale = this.touchActive ? THREE.MathUtils.lerp(0.38, 1, moveStrength) : 1;
      const speed = (this.sprinting ? SPRINT : WALK) * analogScale;
      const accel = this.onGround ? 45 : 12;
      this.velocity.x += (mx * speed - this.velocity.x) * Math.min(1, accel * dt);
      this.velocity.z += (mz * speed - this.velocity.z) * Math.min(1, accel * dt);
    }

    // Jump + fists double jump
    if (this.keys.jump || this.jumpQueued) {
      if (this.onGround) {
        this.velocity.y = JUMP;
        this.onGround = false;
        this.usedAirJump = false;
        this.airJumps = this.weapon.doubleJump ? 1 : 0;
        this.keys.jump = false;
        this.sliding = false;
      } else if (this.airJumps > 0 && this.weapon.doubleJump) {
        this.velocity.y = JUMP * 0.92;
        this.airJumps = 0;
        this.usedAirJump = true;
        this.keys.jump = false;
        callbacks?.onDoubleJump?.();
      }
    }
    this.jumpQueued = false;

    this.velocity.y -= GRAVITY * dt;
    this._move(dt);

    // Decay weapon motion before processing this frame's shot.
    this.recoilKick = Math.max(0, this.recoilKick - dt * 8);
    this.weaponKick = Math.max(0, this.weaponKick - dt * 12);

    // Combat
    const shots = [];
    let melee = null;
    const nades = [];

    const w = this.weapon;
    if ((this.shooting || this.fireQueued) && !w.reloading) {
      if (w.type === 'gun') {
        const can = now - w.lastShot >= w.fireRate && w.ammo > 0;
        if (can) {
          w.lastShot = now;
          w.ammo--;
          this.recoilKick = Math.min(0.08, this.recoilKick + w.recoil);
          this.weaponKick = 1;
          this._showMuzzleFlash();
          shots.push(this._fireGun(w));
          if (!w.auto) this.shooting = false;
          if (w.ammo <= 0) {
            this._startReload(w);
          }
        } else if (w.ammo <= 0 && !w.reloading) {
          this._startReload(w);
        }
      } else if (w.type === 'melee') {
        if (now - w.lastShot >= w.fireRate) {
          w.lastShot = now;
          melee = this._melee(w);
          this.shooting = false;
          this._punchAnim = 0.2;
        }
      } else if (w.type === 'launcher') {
        const can = now - w.lastShot >= w.fireRate && w.ammo > 0;
        if (can) {
          w.lastShot = now;
          w.ammo--;
          this.recoilKick = Math.min(0.1, this.recoilKick + w.recoil);
          this.weaponKick = 1;
          this._showMuzzleFlash();
          nades.push(this._fireRocket(w));
          this.shooting = false;
          if (w.ammo <= 0) {
            this._startReload(w);
          }
        } else if (w.ammo <= 0 && !w.reloading) {
          this._startReload(w);
        }
      } else if (w.type === 'utility') {
        if (w.cd <= 0 && w.ammo > 0 && now - w.lastShot >= w.fireRate) {
          w.lastShot = now;
          w.ammo = 0;
          w.cd = w.cooldown;
          nades.push(this._throwNade(w));
          this.shooting = false;
          // auto switch back to AR after throw
          setTimeout(() => {
            if (this.slot === 3) this.switchSlot(0);
          }, 300);
        }
        this.shooting = false;
      }
    }

    // Recharge grenade
    const grenade = this.loadout.find((item) => item.id === 'grenade');
    if (grenade && grenade.cd <= 0 && grenade.ammo < 1) {
      grenade.ammo = 1;
    }

    // Apply firing/reload motion in the same frame as the input.
    this._updateViewmodel(dt, now);

    this.fireQueued = false;
    this._frameEvents = null;
    return { shots, nades, melee, events };
  }

  _fireGun(w) {
    const origin = this.camera.position.clone();
    const muzzle = this._muzzleWorldPosition(w.id);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    // Spread
    const spread = this.sprinting || this.sliding ? w.spread * 2.2 : w.spread;
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread + this.recoilKick * 0.5;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();
    return {
      origin,
      muzzle,
      dir,
      damage: w.damage,
      headMult: w.headMult,
      range: w.range,
      weapon: w.name,
      weaponId: w.id,
    };
  }

  _melee(w) {
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return {
      origin,
      dir,
      damage: w.damage,
      range: w.range,
      weapon: w.name,
      weaponId: w.id,
    };
  }

  _throwNade(w) {
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.y += 0.18;
    dir.normalize();
    return {
      pos: origin.clone().add(dir.clone().multiplyScalar(0.6)),
      vel: dir.multiplyScalar(w.throwSpeed),
      damage: w.damage,
      splash: w.splash,
      fuse: 1.6,
      weapon: w.name,
      weaponId: w.id,
      kind: 'grenade',
      gravity: 18,
      impact: false,
      radius: 0.15,
      color: 0x4ade80,
    };
  }

  _fireRocket(w) {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.normalize();
    return {
      pos: this._muzzleWorldPosition(w.id),
      vel: dir.multiplyScalar(w.projectileSpeed),
      damage: w.damage,
      splash: w.splash,
      fuse: w.fuse,
      weapon: w.name,
      weaponId: w.id,
      kind: 'rocket',
      gravity: 0,
      impact: true,
      radius: 0.18,
      color: 0xf97316,
    };
  }

  _startReload(w) {
    if (
      !w ||
      (w.type !== 'gun' && w.type !== 'launcher') ||
      w.reloading ||
      w.ammo >= w.magSize
    ) {
      return false;
    }
    w.reloading = true;
    w.reloadT = w.reloadTime;
    this.cancelFire();
    this._frameEvents?.push({ type: 'reload_start', weaponId: w.id });
    return true;
  }

  _muzzleWorldPosition(weaponId) {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const isRpg = weaponId === 'rpg';
    return this.camera.position
      .clone()
      .add(forward.multiplyScalar(isRpg ? 0.95 : 0.75))
      .add(right.multiplyScalar(isRpg ? 0.25 : 0.22))
      .add(up.multiplyScalar(isRpg ? -0.2 : -0.17));
  }

  _showMuzzleFlash() {
    this.muzzleFlashT = 0.065;
    const flash =
      this.weapon.id === 'rpg'
        ? this.viewmodel.userData.rpgFlash
        : this.viewmodel.userData.gunFlash;
    if (flash) {
      flash.visible = true;
      const scale = 0.85 + Math.random() * 0.45;
      flash.scale.setScalar(this.weapon.id === 'rpg' ? scale * 1.45 : scale);
      flash.rotation.z = Math.random() * Math.PI;
    }
  }

  _hideMuzzleFlash() {
    const { gunFlash, rpgFlash } = this.viewmodel.userData;
    if (gunFlash) gunFlash.visible = false;
    if (rpgFlash) rpgFlash.visible = false;
  }

  _updateViewmodel(dt, now) {
    const vm = this.viewmodel;
    const t = now;
    const bob = this.onGround && (Math.abs(this.velocity.x) + Math.abs(this.velocity.z)) > 1
      ? Math.sin(t * (this.sprinting ? 14 : 10)) * 0.012
      : 0;
    const baseY = -0.02 + bob - this.recoilKick * 0.4;
    const baseX = 0.02;
    const punch = this._punchAnim || 0;
    if (this._punchAnim > 0) this._punchAnim -= dt;
    if (this.muzzleFlashT > 0) {
      this.muzzleFlashT -= dt;
      if (this.muzzleFlashT <= 0) this._hideMuzzleFlash();
    }

    const w = this.weapon;
    const reloadProgress = w.reloading
      ? THREE.MathUtils.clamp(1 - w.reloadT / w.reloadTime, 0, 1)
      : 0;
    const reloadArc = w.reloading ? Math.sin(reloadProgress * Math.PI) : 0;
    const mag = vm.userData.mag;
    if (mag) {
      mag.position.set(0, -0.14 - reloadArc * 0.2, -0.05);
      mag.rotation.set(reloadArc * 0.55, 0, reloadArc * -0.25);
    }

    vm.position.set(
      baseX + reloadArc * -0.08,
      baseY - reloadArc * 0.2,
      -0.08 + this.weaponKick * 0.11 - this.recoilKick * 0.35
    );
    vm.rotation.set(
      this.recoilKick * 2.8 + this.weaponKick * 0.16 + punch * 0.8 + reloadArc * 0.45,
      0.05 + reloadArc * -0.28,
      punch * -0.4 + this.weaponKick * -0.08 + reloadArc * 0.65
    );

    // Hide slightly when sliding
    if (this.sliding) vm.position.y -= 0.08;
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
      if (!this.onGround) this.airJumps = 0;
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
    const eyeH = this.sliding ? EYE * 0.65 : EYE;
    this.camera.position.set(x, y + eyeH, z);
  }

  _hitsWall(x, y, z) {
    const feet = Math.max(y, this.floorY) + SKIN * 2;
    const top = y + (this.sliding ? HEIGHT * 0.6 : HEIGHT);
    const box = new THREE.Box3(
      new THREE.Vector3(x - RADIUS, feet, z - RADIUS),
      new THREE.Vector3(x + RADIUS, top, z + RADIUS)
    );
    if (box.max.y <= box.min.y) return false;
    for (const c of this.colliders) {
      if (c.max.y <= feet + 0.05) continue;
      if (c.min.y >= top) continue;
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
        new THREE.Vector3(p.x + 0.4, p.y + 1.5, p.z + 0.4)
      ),
      head: new THREE.Box3(
        new THREE.Vector3(p.x - 0.28, p.y + 1.5, p.z - 0.28),
        new THREE.Vector3(p.x + 0.28, p.y + 2.05, p.z + 0.28)
      ),
    };
  }
}
