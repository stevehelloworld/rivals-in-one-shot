import * as THREE from 'three';
const box = new THREE.BoxGeometry(1, 1, 1);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);

// Batch only immutable direct children. Animated groups and colliders are
// independent, so magazines, bolts and navigation keep their original state.
export function batchStaticMeshes(group) {
  const buckets = new Map();
  for (const child of [...group.children]) {
    if (!child.isMesh || !child.visible || Array.isArray(child.material)) continue;
    const p = child.geometry.parameters;
    let shape, dimensions;
    if (child.geometry.type === 'BoxGeometry') { shape = 'box'; dimensions = new THREE.Vector3(p.width, p.height, p.depth); }
    else if (child.geometry.type === 'CylinderGeometry' && p.radiusTop === p.radiusBottom) { shape = 'cylinder'; dimensions = new THREE.Vector3(p.radiusTop, p.height, p.radiusTop); }
    else continue;
    const key = shape + child.material.uuid + child.castShadow + child.receiveShadow;
    if (!buckets.has(key)) buckets.set(key, { shape, children: [] });
    buckets.get(key).children.push({ child, dimensions });
  }
  const matrix = new THREE.Matrix4();
  for (const { shape, children } of buckets.values()) {
    if (children.length < 2) continue;
    const first = children[0].child;
    const instances = new THREE.InstancedMesh(shape === 'box' ? box : cylinder, first.material, children.length);
    instances.castShadow = first.castShadow; instances.receiveShadow = first.receiveShadow;
    children.forEach(({ child, dimensions }, index) => {
      matrix.compose(child.position, child.quaternion, dimensions.multiply(child.scale));
      instances.setMatrixAt(index, matrix);
      child.removeFromParent(); child.geometry.dispose();
    });
    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingSphere();
    group.add(instances);
  }
}
