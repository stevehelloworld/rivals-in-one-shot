export default {
  id: 'courtyard', name: 'Sandstone Court', preview: 'courtyard.jpg',
  spawns: [[0, 0.1, 19], [0, 0.1, -19]],
  build(box) {
    for (const side of [-1, 1]) {
      box(0, 0, 13 * side, 6, 2.3, 1.5, 0xb28b62);
      box(5 * side, 0, 5, 2.5, 4.5, 2.5, 0xc3a57c);
      box(5 * side, 0, -5, 2.5, 4.5, 2.5, 0xc3a57c);
      box(13 * side, 0, 3 * side, 8, 1.2, 1, 0xc29d70);
      box(-22 * side, 0, 8 * side, 2, 1.5, 4, 0xac8b66);
    }
  },
};
