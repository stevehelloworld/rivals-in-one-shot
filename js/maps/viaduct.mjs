export default {
  id: 'viaduct', name: 'Viaduct Works', preview: 'preview-viaduct.jpg',
  spawns: [[0, 0.1, 19], [0, 0.1, -19]],
  previewCamera: [24, 8, 15],
  build(box) {
    box(0, 2.8, 0, 24, 0.5, 5, 0xa7a5a0, { step: true });
    for (const side of [-1, 1]) {
      box(4 * side, 3.3, 2.22 * side, 7, 1.05, 0.28, 0xb9943a);
      box(16 * side, 0, -8 * side, 5, 2.5, 3, 0x4975ab);
      box(-24 * side, 0, -3 * side, 2, 2.5, 6, 0x9d7958);
      box(0, 0, 6 * side, 4, 1.2, 1.6, 0x878883);
      box(7 * side, 0, 0, 2, 2.8, 3, 0x878883);
      for (let i = 0; i < 10; i++) {
        box(10 * side, 0, (12 - i) * side, 4, 0.33 * (i + 1), 1, 0xaaa9a4, { step: true });
      }
      box(0, 0, 12 * side, 7, 2.2, 1.4, 0x4975ab);
      box(-17 * side, 0, 7 * side, 6, 1.4, 3, 0x96795f);
    }
  },
};
