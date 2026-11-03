export default {
  id: 'foundry', name: 'Iron Foundry', preview: 'actual-foundry.jpg',
  spawns: [[0, 0.1, 19], [0, 0.1, -19]],
  build(box) {
    for (const side of [-1, 1]) {
      box(0, 0, 12 * side, 8, 2.6, 2, 0x854b34);
      box(7 * side, 0, 4 * side, 7, 3.5, 6, 0xb75b36);
      box(-12 * side, 0, 7 * side, 4, 2.3, 8, 0x6d7076);
      box(19 * side, 0, 1 * side, 3, 1.4, 8, 0x948477);
    }
  },
};
