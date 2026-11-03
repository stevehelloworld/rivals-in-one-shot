export default {
  id: 'range', name: 'Practice Range', preview: 'preview-sunset.jpg',
  spawns: [[0, 0.1, 18], [0, 0.1, -18]],
  build(addBox) {
    for (const x of [-14, 14]) addBox(x, 0, -1, 0.4, 2.6, 40, 0x69788b);
    addBox(0, 0, -21, 28, 4, 1, 0x69788b);
    for (const z of [13, 3, -17]) addBox(0, 0.06, z, 26, 0.02, 0.12, 0xe8bd43, { collide: false });
  },
};
