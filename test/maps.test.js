const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('each arena has a distinct layout, preview and unobstructed spawns', async () => {
  const { maps, getMap } = await import('../js/maps/index.mjs');
  assert.equal(maps.length, 5);
  assert.equal(new Set(maps.map(map => map.id)).size, maps.length);
  const layouts = new Set();
  for (const map of maps) {
    assert.ok(fs.statSync('assets/images/' + map.preview).size > 0);
    const solids = [];
    map.build((x, y, z, w, h, d, color, options) => {
      if (options?.collide !== false) solids.push([x, y, z, w, h, d]);
    });
    assert.ok(solids.length > 0);
    layouts.add(JSON.stringify(solids));
    for (const [sx, sy, sz] of map.spawns) {
      assert.ok(!solids.some(([x, y, z, w, h, d]) =>
        Math.abs(sx - x) < w / 2 + 0.4 && Math.abs(sz - z) < d / 2 + 0.4 &&
        sy < y + h && sy + 1.8 > y), map.id + ' spawn intersects cover');
    }
  }
  assert.equal(layouts.size, maps.length);
  assert.equal(getMap('unknown').id, 'sunset');
});
