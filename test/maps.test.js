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
    // Check a ground-level route with player-radius clearance. Overhead beams
    // do not count as ground obstacles; jumping is not required by this route.
    const blocked = (x, z) => solids.some(([cx, y, cz, w, h, d]) =>
      y < 1.8 && y + h > 0.1 && Math.abs(x - cx) < w / 2 + 0.4 && Math.abs(z - cz) < d / 2 + 0.4);
    const start = [Math.round(map.spawns[0][0]), Math.round(map.spawns[0][2])];
    const end = map.spawns[1];
    const queue = [start];
    const seen = new Set([start.join(',')]);
    let reachable = false;
    for (let head = 0; head < queue.length; head++) {
      const [x, z] = queue[head];
      if (x === Math.round(end[0]) && z === Math.round(end[2])) { reachable = true; break; }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz, key = `${nx},${nz}`;
        if (Math.abs(nx) > 29 || Math.abs(nz) > 21 || seen.has(key) || blocked(nx, nz)) continue;
        seen.add(key); queue.push([nx, nz]);
      }
    }
    assert.ok(reachable, map.id + ' has no traversable route between spawns');
  }
  assert.equal(layouts.size, maps.length);
  assert.equal(getMap('unknown').id, 'sunset');
});
