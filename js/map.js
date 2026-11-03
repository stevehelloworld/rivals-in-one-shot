import * as THREE from 'three';
import { maps, getMap } from './maps/index.mjs';

/**
 * RIVALS-style compact duel arena:
 * mid cover, side lanes, ramps, high ground — bright Roblox block aesthetic.
 */
export function buildArena(scene) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  const floorTexture = new THREE.Texture();
  const concrete = new THREE.TextureLoader().load('assets/images/concrete.jpg', loaded => {
    floorTexture.image = loaded.image;
    floorTexture.needsUpdate = true;
  });
  concrete.colorSpace = THREE.SRGBColorSpace;
  concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping;
  const palette = new Map([
    [0x352650, 0xc1beb8], [0x4c1d95, 0xa9aaa8], [0x5b21b6, 0xa0a4a7],
    [0x7c3aed, 0x3569c5], [0x9333ea, 0x3569c5], [0xa855f7, 0x4277cf],
    [0xdb2777, 0xcb6556], [0xf472b6, 0xe27a67], [0x0891b2, 0x3569c5],
    [0x22d3ee, 0xe8bd43], [0xec4899, 0xe8bd43], [0x6d28d9, 0xaeb0af],
    [0x0e7490, 0xb9b7b2], [0x155e75, 0x9b9d9f], [0xc026d3, 0xb8b7b2],
    [0xf0abfc, 0xc4c1bb], [0x164e63, 0xabaaa6], [0x8b5cf6, 0x3569c5],
    [0x06b6d4, 0xcb6556],
  ]);
  const materials = new Map();
  const layouts = new Map();
  let targetGroup = group;
  let targetColliders = colliders;

  const addBox = (x, y, z, w, h, d, color, opts = {}) => {
    const paint = palette.get(color) ?? color;
    if (!materials.has(paint)) materials.set(paint, new THREE.MeshLambertMaterial({ color: paint, map: concrete }));
    const mat = materials.get(paint);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    targetGroup.add(mesh);
    if (opts.collide !== false) {
      targetColliders.push(
        new THREE.Box3(
          new THREE.Vector3(x - w / 2, y, z - d / 2),
          new THREE.Vector3(x + w / 2, y + h, z + d / 2)
        )
      );
    }
    return mesh;
  };

  // Floor
  floorTexture.colorSpace = THREE.SRGBColorSpace;
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(16, 12);
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(64, 1, 48),
    new THREE.MeshLambertMaterial({ color: 0xb2b0aa, map: floorTexture })
  );
  floor.position.set(0, -0.5, 0);
  floor.receiveShadow = true;
  group.add(floor);
  colliders.push(new THREE.Box3(new THREE.Vector3(-32, -1, -24), new THREE.Vector3(32, 0, 24)));

  // Floor tiles pattern
  for (let i = -3; i <= 3; i++) {
    for (let j = -2; j <= 2; j++) {
      if ((i + j) % 2 === 0) {
        addBox(i * 8, 0.01, j * 8, 7.6, 0.04, 7.6, 0x352650, { collide: false });
      }
    }
  }

  // Outer walls
  addBox(0, 0, -24, 64, 8, 1.2, 0x4c1d95);
  addBox(0, 0, 24, 64, 8, 1.2, 0x4c1d95);
  addBox(-32, 0, 0, 1.2, 8, 48, 0x5b21b6);
  addBox(32, 0, 0, 1.2, 8, 48, 0x5b21b6);

  // Accent trim
  addBox(0, 7.5, -24, 64, 0.4, 1.4, 0xec4899, { collide: false, emissive: 0xec4899, emissiveIntensity: 0.3 });
  addBox(0, 7.5, 24, 64, 0.4, 1.4, 0x22d3ee, { collide: false, emissive: 0x22d3ee, emissiveIntensity: 0.3 });

  const sharedCount = colliders.length;
  const spawns = { player: new THREE.Vector3(), enemy: new THREE.Vector3() };
  for (const map of maps) {
    targetGroup = new THREE.Group();
    targetColliders = [];
    group.add(targetGroup);
    map.build(addBox);
    map.spawns.forEach(([x, , z], i) => addBox(x, 0.02, z, 4, 0.08, 4,
      i === 0 ? 0x3b82f6 : 0xef4444, { collide: false }));
    layouts.set(map.id, { group: targetGroup, colliders: targetColliders });
  }
  targetGroup = group;
  targetColliders = colliders;

  // Flat wayfinding paint does not alter collision or the arena layout.
  for (const z of [-15, 15]) {
    for (let i = -1; i <= 1; i++) addBox(i * 0.7, 0.075, z, 0.35, 0.015, 1.4, 0xe8bd43, { collide: false });
  }

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 1.4);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0xd5e5ff, 0x8b766a, 1.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd2a5, 2.4);
  sun.position.set(-25, 28, -35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 100;
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  scene.add(sun);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 20, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { horizon: { value: new THREE.Color(0xffc28a) }, zenith: { value: new THREE.Color(0xb95546) } },
    vertexShader: 'varying vec3 skyDirection; void main(){skyDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 horizon; uniform vec3 zenith; varying vec3 skyDirection; void main(){float h=normalize(skyDirection).y; gl_FragColor=vec4(mix(horizon,zenith,smoothstep(0.0,0.85,h)),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  }));
  scene.add(sky);
  const sunset = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffedbd, fog: false }));
  sunset.position.set(-85, 35, -115);
  scene.add(sunset);
  scene.background = new THREE.Color(0xe9ac8a);
  scene.fog = new THREE.Fog(0xd9b8a3, 48, 120);

  const arena = {
    select(id) {
      const map = getMap(id);
      for (const [key, layout] of layouts) layout.group.visible = key === map.id;
      colliders.splice(sharedCount, colliders.length - sharedCount, ...layouts.get(map.id).colliders);
      spawns.player.set(...map.spawns[0]);
      spawns.enemy.set(...map.spawns[1]);
      arena.id = map.id;
    },
    colliders,
    group,
    spawns,
  };
  arena.select('sunset');
  return arena;
}

/** Simple capsule-like rival body */
export function createRivalMesh() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 0.9, 4, 8),
    new THREE.MeshLambertMaterial({ color: 0xef4444 })
  );
  body.position.y = 1.0;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.55, 0.55),
    new THREE.MeshLambertMaterial({ color: 0xfca5a5 })
  );
  head.position.y = 1.85;
  head.castShadow = true;
  g.add(head);

  // Visor
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.15, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee })
  );
  visor.position.set(0, 1.9, 0.28);
  g.add(visor);

  // Team marker ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.06, 6, 16),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  g.add(ring);

  g.userData.body = body;
  g.userData.head = head;
  return g;
}

/** First-person viewmodel gun */
export function createViewmodel() {
  const root = new THREE.Group();

  const gun = new THREE.Group();
  gun.name = 'gun';

  // Body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.14, 0.55),
    new THREE.MeshLambertMaterial({ color: 0x2d2d3a })
  );
  body.position.set(0, 0, -0.15);
  gun.add(body);

  // Barrel
  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.06, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x1a1a22 })
  );
  barrel.position.set(0, 0.02, -0.5);
  gun.add(barrel);

  // Muzzle flash, toggled briefly by Player when firing.
  const gunFlash = new THREE.Group();
  const flashCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 8, 8),
    new THREE.MeshBasicMaterial({
      color: 0xfff7b2,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  const flashCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.075, 0.22, 8),
    new THREE.MeshBasicMaterial({
      color: 0xff8a00,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  flashCone.rotation.x = -Math.PI / 2;
  flashCone.position.z = -0.11;
  gunFlash.add(flashCore, flashCone);
  gunFlash.position.set(0, 0.02, -0.75);
  gunFlash.visible = false;
  gun.add(gunFlash);

  // Magazine
  const mag = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.18, 0.12),
    new THREE.MeshLambertMaterial({ color: 0x3f3f50 })
  );
  mag.position.set(0, -0.14, -0.05);
  gun.add(mag);

  // Accent
  const accent = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.04, 0.2),
    new THREE.MeshBasicMaterial({ color: 0xf5d84f })
  );
  accent.position.set(0, 0.08, -0.1);
  gun.add(accent);

  // Handgun variant parts stored
  gun.position.set(0.28, -0.28, -0.55);
  root.add(gun);

  // Fists
  const fists = new THREE.Group();
  fists.name = 'fists';
  const makeFist = (x) => {
    const f = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.18),
      new THREE.MeshLambertMaterial({ color: 0xf5c6a0 })
    );
    f.position.set(x, -0.25, -0.4);
    return f;
  };
  fists.add(makeFist(0.2));
  fists.add(makeFist(-0.15));
  fists.visible = false;
  root.add(fists);

  // Grenade
  const nade = new THREE.Group();
  nade.name = 'nade';
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 10),
    new THREE.MeshLambertMaterial({ color: 0x3f7f3f })
  );
  sphere.position.set(0.25, -0.22, -0.4);
  nade.add(sphere);
  const pin = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.08, 0.03),
    new THREE.MeshLambertMaterial({ color: 0xcccc00 })
  );
  pin.position.set(0.25, -0.14, -0.4);
  nade.add(pin);
  nade.visible = false;
  root.add(nade);

  // RPG
  const rpg = new THREE.Group();
  rpg.name = 'rpg';
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 0.62, 10),
    new THREE.MeshLambertMaterial({ color: 0x374151 })
  );
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0.24, -0.2, -0.45);
  rpg.add(tube);
  const rocketTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.085, 0.18, 10),
    new THREE.MeshLambertMaterial({ color: 0xf97316 })
  );
  rocketTip.rotation.x = -Math.PI / 2;
  rocketTip.position.set(0.24, -0.2, -0.84);
  rpg.add(rocketTip);
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.18, 0.08),
    new THREE.MeshLambertMaterial({ color: 0x1f2937 })
  );
  grip.position.set(0.24, -0.31, -0.42);
  rpg.add(grip);
  const rpgFlash = gunFlash.clone(true);
  rpgFlash.position.set(0.24, -0.2, -0.96);
  rpgFlash.scale.setScalar(1.45);
  rpgFlash.visible = false;
  rpg.add(rpgFlash);
  rpg.visible = false;
  root.add(rpg);

  root.userData.gun = gun;
  root.userData.fists = fists;
  root.userData.nade = nade;
  root.userData.rpg = rpg;
  root.userData.accent = accent;
  root.userData.barrel = barrel;
  root.userData.body = body;
  root.userData.mag = mag;
  root.userData.gunFlash = gunFlash;
  root.userData.rpgFlash = rpgFlash;

  return root;
}

export function setViewmodelWeapon(vm, weaponId) {
  const { gun, fists, nade, rpg, accent, barrel, body, gunFlash, rpgFlash } =
    vm.userData;
  gun.visible = false;
  fists.visible = false;
  nade.visible = false;
  rpg.visible = false;
  gunFlash.visible = false;
  rpgFlash.visible = false;

  if (weaponId === 'ar') {
    gun.visible = true;
    body.scale.set(1, 1, 1.15);
    barrel.scale.set(1, 1, 1.2);
    barrel.position.z = -0.55;
    gunFlash.position.z = -0.79;
    accent.material.color.set(vm.userData.skinColor ?? 0xf5d84f);
  } else if (weaponId === 'handgun') {
    gun.visible = true;
    body.scale.set(0.85, 0.9, 0.55);
    barrel.scale.set(0.9, 0.9, 0.5);
    barrel.position.z = -0.35;
    gunFlash.position.z = -0.47;
    accent.material.color.set(vm.userData.skinColor ?? 0x22d3ee);
  } else if (weaponId === 'fists') {
    fists.visible = true;
  } else if (weaponId === 'grenade') {
    nade.visible = true;
  } else if (weaponId === 'rpg') {
    rpg.visible = true;
  }
}
