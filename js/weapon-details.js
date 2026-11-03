import * as THREE from 'three';
import { batchStaticMeshes } from './static-batch.js';

export function createWeaponDetails(gun) {
  const metal = new THREE.MeshLambertMaterial({ color: 0x69788b });
  const dark = new THREE.MeshLambertMaterial({ color: 0x253043 });
  const wood = new THREE.MeshLambertMaterial({ color: 0xa9774d });
  const glass = new THREE.MeshBasicMaterial({ color: 0x72c8df });
  const groups = {};
  const box = (parent, w, h, d, x, y, z, material = dark) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const cylinder = (parent, radius, length, x, y, z, material = metal) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), material);
    mesh.rotation.x = Math.PI / 2; mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  for (const id of ['ar', 'smg', 'shotgun', 'marksman', 'sniper', 'lmg', 'handgun', 'revolver']) {
    const group = new THREE.Group(); group.visible = false; gun.add(group);
    const pistol = ['handgun', 'revolver'].includes(id);
    const grip = box(group, 0.075, 0.17, 0.09, 0, -0.14, 0.09, id === 'revolver' ? wood : dark);
    grip.rotation.x = -0.2;
    box(group, 0.035, 0.02, 0.13, 0, -0.15, -0.015, metal);
    box(group, 0.035, 0.09, 0.02, 0, -0.1, -0.08, metal);
    box(group, 0.025, 0.05, 0.025, 0, 0.1, pistol ? -0.34 : -0.5, metal);
    if (!pistol) {
      box(group, id === 'smg' ? 0.035 : 0.09, 0.07, 0.22, 0, -0.005, 0.24);
      box(group, 0.1, 0.19, 0.045, 0, -0.035, 0.36);
      for (let i = 0; i < 5; i++) box(group, 0.14, 0.018, 0.025, 0, 0.085, -0.1 - i * 0.06, metal);
    }
    const moving = new THREE.Group(); group.add(moving);
    if (id === 'shotgun') {
      cylinder(group, 0.027, 0.6, 0, -0.045, -0.48);
      box(moving, 0.12, 0.09, 0.22, 0, -0.045, -0.48, wood);
      for (let i = 0; i < 4; i++) box(moving, 0.13, 0.014, 0.015, 0, -0.09, -0.4 - i * 0.045);
    } else if (id === 'sniper' || id === 'marksman') {
      cylinder(group, 0.052, 0.09, 0, 0.15, -0.36, glass);
      box(moving, 0.14, 0.025, 0.03, 0.08, 0.045, -0.08, metal);
      cylinder(moving, 0.025, 0.045, 0.15, 0.02, -0.08);
      if (id === 'sniper') {
        const leg = box(group, 0.025, 0.25, 0.025, 0.08, -0.12, -0.56, metal); leg.rotation.z = -0.3;
        const other = leg.clone(); other.position.x = -0.08; other.rotation.z = 0.3; group.add(other);
      }
    } else if (id === 'revolver') {
      cylinder(moving, 0.09, 0.16, 0, 0, -0.12);
      for (let i = 0; i < 6; i++) cylinder(moving, 0.018, 0.17, Math.cos(i * Math.PI / 3) * 0.065, Math.sin(i * Math.PI / 3) * 0.065, -0.12, dark);
      box(group, 0.04, 0.06, 0.025, 0, 0.09, 0.06, metal);
    } else if (id === 'lmg') {
      box(moving, 0.22, 0.18, 0.18, 0, -0.16, -0.05, metal);
      for (let i = 0; i < 5; i++) cylinder(group, 0.012, 0.05, 0.09 + i * 0.018, -0.045, -0.08 + i * 0.022, wood);
    } else box(moving, 0.13, 0.035, pistol ? 0.24 : 0.12, 0, 0.075, -0.1, metal);
    groups[id] = { group, moving };
    batchStaticMeshes(group);
    batchStaticMeshes(moving);
  }
  return groups;
}

export function animateWeaponParts(vm, id, reload, cycle, reduced) {
  const parts = vm.userData.details?.[id];
  if (!parts) return;
  const p = parts.moving;
  p.position.set(0, 0, 0); p.rotation.set(0, 0, 0);
  const strength = reduced ? 0.35 : 1;
  if (id === 'shotgun') p.position.z = (cycle * 0.15 + reload * 0.07) * strength;
  else if (id === 'sniper' || id === 'marksman') { p.position.z = cycle * 0.13 * strength; p.rotation.z = cycle * 0.45 * strength; }
  else if (id === 'revolver') { p.position.x = reload * 0.16 * strength; p.rotation.z = (reload * Math.PI * 2 + cycle * Math.PI / 3) * strength; }
  else if (id === 'lmg') { p.position.y = -reload * 0.18 * strength; p.rotation.z = reload * 0.3 * strength; }
  else p.position.z = cycle * 0.06 * strength;
}
