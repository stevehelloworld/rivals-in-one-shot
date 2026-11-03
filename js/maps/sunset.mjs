export default {
  id: 'sunset', name: 'Sunset Arena', preview: 'preview-sunset.jpg',
  spawns: [[0, 0.1, 18], [0, 0.1, -18]],
  previewCamera: [25, 8, 20],
  vantageRoutes: [[[-14, -2], [-20, -2], [-20, -6], [-20, -10], [-20, -14]], [[14, 2], [20, 2], [20, 6], [20, 10], [20, 14]]],
  build(addBox) {
    // Side galleries create covered flanks without closing the central lane.
    for (const side of [-1, 1]) {
      for (const z of [-5, 5]) addBox(24 * side, 0, z, 1.4, 4.4, 1.4, 0xa9aaa8);
      addBox(24 * side, 4.4, 0, 6, 0.55, 12, 0xc4c1bb);
      addBox(27 * side, 0, 0, 1, 1.35, 6, 0x3569c5);
      addBox(16 * side, 0, -9 * side, 4, 1.25, 1, 0xcb6556);
    }
    addBox(0, 0, 0, 3, 2.2, 6, 0x7c3aed);
    addBox(-8, 0, 4, 4, 1.6, 2.5, 0x9333ea);
    addBox(8, 0, -4, 4, 1.6, 2.5, 0x9333ea);
    addBox(-6, 0, -8, 2.5, 2.8, 2.5, 0xa855f7);
    addBox(6, 0, 8, 2.5, 2.8, 2.5, 0xa855f7);

    // Side crates
    addBox(-14, 0, 0, 3, 1.4, 3, 0xdb2777);
    addBox(14, 0, 0, 3, 1.4, 3, 0x0891b2);
    addBox(-14, 1.4, 0, 2, 1, 2, 0xf472b6);
    addBox(14, 1.4, 0, 2, 1, 2, 0x22d3ee);

    // Ramps (stepped blocks)
    for (let i = 0; i < 9; i++) {
      const z = 3.35 + i * 0.9;
      addBox(-20, 0, -z, 5, (i + 1) * 0.325, 0.9, 0x6d28d9, { step: true });
      addBox(20, 0, z, 5, (i + 1) * 0.325, 0.9, 0x0e7490, { step: true });
    }

    // High platforms
    addBox(-20, 2.75, -14, 6, 0.5, 6, 0x7c3aed, { step: true });
    addBox(20, 2.75, 14, 6, 0.5, 6, 0x0e7490, { step: true });
    // Platform walls / half cover
    addBox(-20, 3.25, -16.5, 6, 1.2, 0.5, 0x5b21b6);
    addBox(20, 3.25, 16.5, 6, 1.2, 0.5, 0x155e75);

    // Center arch / gateway
    addBox(-4, 0, 0, 1.2, 4.5, 1.2, 0xc026d3);
    addBox(4, 0, 0, 1.2, 4.5, 1.2, 0xc026d3);
    addBox(0, 4, 0, 9.2, 1, 1.2, 0xf0abfc, { emissive: 0xf0abfc, emissiveIntensity: 0.15 });

    // Corner towers
    addBox(-26, 0, -18, 4, 6, 4, 0x4c1d95);
    addBox(26, 0, 18, 4, 6, 4, 0x164e63);
    addBox(-26, 6, -18, 4.4, 0.6, 4.4, 0xec4899, { emissive: 0xec4899, emissiveIntensity: 0.2 });
    addBox(26, 6, 18, 4.4, 0.6, 4.4, 0x22d3ee, { emissive: 0x22d3ee, emissiveIntensity: 0.2 });

    // Low mid walls for peeking
    addBox(-3, 0, 12, 8, 1.3, 0.8, 0x8b5cf6);
    addBox(3, 0, -12, 8, 1.3, 0.8, 0x06b6d4);
  },
};
