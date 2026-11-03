export default {
  id: 'sunset', name: 'Sunset Arena', preview: 'arena-preview.jpg',
  spawns: [[0, 0.1, 18], [0, 0.1, -18]],
  build(addBox) {
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
    for (let i = 0; i < 5; i++) {
      addBox(-20 + i * 0.15, i * 0.55, -14, 5, 0.55, 4, 0x6d28d9);
      addBox(20 - i * 0.15, i * 0.55, 14, 5, 0.55, 4, 0x0e7490);
    }

    // High platforms
    addBox(-20, 2.75, -14, 6, 0.5, 6, 0x7c3aed);
    addBox(20, 2.75, 14, 6, 0.5, 6, 0x0e7490);
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
