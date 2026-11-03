const test = require('node:test');
const assert = require('node:assert/strict');

test('bots can route around cover between both spawns on every arena', async () => {
  const { maps } = await import('../js/maps/index.mjs');
  const { ArenaNavigator } = await import('../js/navigation.mjs');
  for (const map of maps) {
    const colliders = [];
    map.build((x, y, z, w, h, d, color, options = {}) => {
      if (options.collide === false) return;
      colliders.push({ min: { x: x - w / 2, y, z: z - d / 2 }, max: { x: x + w / 2, y: y + h, z: z + d / 2 }, walkableStep: options.step });
    });
    const navigator = new ArenaNavigator(colliders);
    const [a, b] = map.spawns.map(([x, y, z]) => ({ x, z }));
    const path = navigator.path(a, b);
    assert.ok(path.length > 0, map.id + ' navigation is disconnected');
    for (const point of path) assert.ok(navigator.free(point.x, point.z), map.id + ' path crosses cover');
    assert.ok(Math.hypot(path.at(-1).x - b.x, path.at(-1).z - b.z) < 1.5);
    for (const route of map.vantageRoutes || []) for (const [x, z] of route) assert.ok(navigator.free(x, z), map.id + ' elevated route blocked');
  }
});

test('navigation handles unreachable goals and chooses occluded cover', async () => {
  const { ArenaNavigator } = await import('../js/navigation.mjs');
  const nav = new ArenaNavigator([{ min: { x: -1, y: 0, z: -22 }, max: { x: 1, y: 4, z: 22 } }]);
  assert.deepEqual(nav.path({ x: -10, z: 0 }, { x: 10, z: 0 }), []);
  const cover = nav.cover({ x: -10, z: 0 }, { x: 10, z: 0 }, point => point.x < -12);
  assert.ok(cover && cover.x < -12);
});
