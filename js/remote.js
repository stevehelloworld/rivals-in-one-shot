import * as THREE from 'three';

/** Networked rival avatar (position driven by peer state packets). */
export class RemotePlayer {
  constructor(mesh) {
    this.mesh = mesh;
    this.position = new THREE.Vector3();
    this.targetPos = new THREE.Vector3();
    this.yaw = 0;
    this.targetYaw = 0;
    this.hp = 100;
    this.maxHp = 100;
    this.alive = true;
    this.slot = 0;
    this.name = 'RIVAL';
    this._gotState = false;
  }

  spawn(pos) {
    this.position.copy(pos);
    this.targetPos.copy(pos);
    this.hp = this.maxHp;
    this.alive = true;
    this.mesh.visible = true;
    this.mesh.position.copy(pos);
    this._gotState = true;
  }

  applyState(s) {
    this.targetPos.set(s.x, s.y, s.z);
    this.targetYaw = s.yaw ?? 0;
    this.slot = s.slot ?? 0;
    if (typeof s.hp === 'number') this.hp = s.hp;
    if (typeof s.alive === 'boolean') {
      this.alive = s.alive;
      this.mesh.visible = s.alive;
    }
    if (!this._gotState) {
      this.position.copy(this.targetPos);
      this._gotState = true;
    }
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

  /** Smooth render interpolation */
  update(dt) {
    if (!this._gotState) return;
    this.position.lerp(this.targetPos, Math.min(1, 14 * dt));
    // yaw lerp shortest path
    let dy = this.targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, 12 * dt);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw;
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
