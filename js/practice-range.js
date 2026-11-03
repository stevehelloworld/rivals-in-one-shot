import * as THREE from 'three';

export class PracticeRange {
  constructor(scene) {
    this.group = new THREE.Group(); scene.add(this.group); this.group.visible = false;
    this.targets = [];
    for (const [distance, x] of [[5, -1.5], [15, 0], [35, 8]]) {
      const position = new THREE.Vector3(x, 0.1, 18 - Math.sqrt(distance ** 2 - x ** 2));
      const group = new THREE.Group(); group.position.copy(position); this.group.add(group);
      const material = new THREE.MeshLambertMaterial({ color: 0x356fe7, emissive: 0x000000 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.35, 0.2), material); body.position.y = 0.9; group.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), new THREE.MeshLambertMaterial({ color: 0xff9b88 })); head.position.y = 1.85; group.add(head);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), material); post.position.y = 0.2; group.add(post);
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#101b2b'; ctx.fillRect(0, 0, 256, 64); ctx.fillStyle = '#f3f6fa'; ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(distance + ' m', 128, 45);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) })); label.position.y = 2.5; label.scale.set(1.6, 0.4, 1); group.add(label);
      this.targets.push({ position, alive: true, material, flash: 0, getHitboxes: () => ({
        body: new THREE.Box3(position.clone().add(new THREE.Vector3(-0.4, 0.2, -0.15)), position.clone().add(new THREE.Vector3(0.4, 1.575, 0.15))),
        head: new THREE.Box3(position.clone().add(new THREE.Vector3(-0.28, 1.57, -0.28)), position.clone().add(new THREE.Vector3(0.28, 2.13, 0.28))),
      }) });
    }
    this.reset();
  }
  reset() { this.shots = 0; this.hits = 0; this.headshots = 0; this.damage = 0; this.elapsed = 0; this.started = false; }
  record(target, damage, head = false) {
    this.started = true;
    if (!target) return;
    this.hits++; this.headshots += Number(head); this.damage += damage;
    target.flash = 0.14; target.material.emissive.setHex(0xffffff);
  }
  update(dt) {
    if (this.started) this.elapsed += dt;
    for (const target of this.targets) if (target.flash > 0) { target.flash -= dt; if (target.flash <= 0) target.material.emissive.setHex(0x000000); }
  }
  get summary() { return `HITS ${this.hits}/${this.shots} · HEAD ${this.headshots} · DAMAGE ${this.damage} · DPS ${Math.round(this.damage / Math.max(1, this.elapsed))}`; }
}
