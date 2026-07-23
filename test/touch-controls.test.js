'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('touch joystick applies a deadzone and clamps to its radius', async () => {
  const { clampStick } = await import('../js/touch-math.mjs');

  assert.deepEqual(clampStick(0, 0, 50), { x: 0, y: 0, dx: 0, dy: 0 });
  assert.deepEqual(clampStick(4, 0, 50), { x: 0, y: 0, dx: 4, dy: 0 });

  const full = clampStick(100, 0, 50);
  assert.equal(full.x, 1);
  assert.equal(full.y, 0);
  assert.equal(full.dx, 50);
  assert.equal(full.dy, 0);

  const diagonal = clampStick(100, 100, 50);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 0.0001);
  assert.ok(Math.abs(Math.hypot(diagonal.dx, diagonal.dy) - 50) < 0.0001);
});
