export default {
  id: 'viaduct', name: 'Viaduct Works', preview: 'actual-viaduct.jpg',
  spawns: [[0, 0.1, 19], [0, 0.1, -19]],
  build(box) {
    box(0, 2.8, 0, 24, 0.5, 5, 0xa7a5a0, { step: true });
    for (const side of [-1, 1]) {
      box(7 * side, 0, 0, 2, 2.8, 3, 0x878883);
      for (let i = 0; i < 10; i++) {
        box(10 * side, 0, (12 - i) * side, 4, 0.33 * (i + 1), 1, 0xaaa9a4, { step: true });
      }
      box(0, 0, 12 * side, 7, 2.2, 1.4, 0x4975ab);
      box(-17 * side, 0, 7 * side, 6, 1.4, 3, 0x96795f);
    }
  },
};
