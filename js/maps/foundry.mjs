export default {
  id: 'foundry', name: 'Iron Foundry', preview: 'preview-foundry.jpg',
  spawns: [[0, 0.1, 19], [0, 0.1, -19]],
  previewCamera: [-23, 8, 17],
  build(box) {
    box(0, 4.3, 0, 24, 0.65, 2.3, 0x545e65);
    box(0, 0, 0, 3, 2.2, 3, 0x695449);
    for (const side of [-1, 1]) {
      box(11 * side, 0, 0, 1.4, 4.3, 2.3, 0x545e65);
      box(7 * side, 3.5, 4 * side, 3, 0.8, 3, 0x45494c);
      for (let i = 0; i < 4; i++) {
        box((5 + i * 1.3) * side, 0.6, 7 * side, 0.6, 2.2, 0.1, 0x484647, { collide: false });
      }
      box(22 * side, 0, -9 * side, 5, 2.1, 2, 0x854b34);
      box(0, 0, 12 * side, 8, 2.6, 2, 0x854b34);
      box(7 * side, 0, 4 * side, 7, 3.5, 6, 0xb75b36);
      box(-12 * side, 0, 7 * side, 4, 2.3, 8, 0x6d7076);
      box(19 * side, 0, 1 * side, 3, 1.4, 8, 0x948477);
    }
  },
};
