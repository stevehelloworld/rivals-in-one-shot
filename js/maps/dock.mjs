export default {
  id: 'dock', name: 'Container Dock', preview: 'dock-concept.jpg',
  spawns: [[0, 0.1, 18], [0, 0.1, -18]],
  build(addBox) {
    for (const side of [-1, 1]) {
      const paint = side > 0 ? 0x3569c5 : 0xcb6556;
      for (const [x, z, w, d] of [[0, 11, 9, 2.8], [12, 5, 3, 10], [-16, 12, 3, 9], [23, 15, 5, 3]]) {
        addBox(x * side, 0, z * side, w, 2.8, d, paint);
        addBox(x * side, 2.8, z * side, w, 0.14, d, 0x39495c, { collide: false });
        for (let i = 1; i < 8; i++) {
          addBox(x * side - w / 2 + w * i / 8, 0.08, z * side, 0.06, 2.6, d + 0.03, paint, { collide: false });
        }
      }
    }
  },
};
