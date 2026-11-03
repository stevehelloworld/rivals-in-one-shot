export default {
  id: 'courtyard', name: 'Sandstone Court', preview: 'preview-courtyard.jpg',
  spawns: [[0, 0.1, 19], [0, 0.1, -19]],
  previewCamera: [-24, 7, 18],
  build(box) {
    for (const side of [-1, 1]) {
      // Colonnades frame long outside lanes; openings connect to the court.
      for (const z of [-9, 0, 9]) {
        box(20 * side, 0, z, 2.2, 4.2, 2.2, 0xc3a57c);
        box(20 * side, 0, z, 3.1, 0.38, 3.1, 0xb28b62);
      }
      box(20 * side, 4.2, 0, 4, 0.65, 21, 0xc3a57c);
      box(9 * side, 0, -10 * side, 3.5, 1.35, 2, 0xb28b62);
      box(0, 0, 13 * side, 6, 2.3, 1.5, 0xb28b62);
      box(5 * side, 0, 5, 2.5, 4.5, 2.5, 0xc3a57c);
      box(5 * side, 0, -5, 2.5, 4.5, 2.5, 0xc3a57c);
      box(13 * side, 0, 3 * side, 8, 1.2, 1, 0xc29d70);
      box(-22 * side, 0, 8 * side, 2, 1.5, 4, 0xac8b66);
    }
  },
};
