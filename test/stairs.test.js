const test = require('node:test');
const assert = require('node:assert/strict');

test('stair support allows a short step up or down without climbing cover', async () => {
  const { stairFloor } = await import('../js/stairs.mjs');
  const box = (height, walkableStep) => ({
    min: { x: -1, z: -1 }, max: { x: 1, z: 1, y: height }, walkableStep,
  });
  const floor = box(0, false);
  const first = box(0.33, true);
  assert.equal(stairFloor([floor, first], 0, 0.03, 0, 0.35, 0.03), 0.36);
  assert.equal(stairFloor([floor], 0, 0.36, 0, 0.35, 0.03, true), 0.03);
  assert.equal(stairFloor([box(0.33, false)], 0, 0.03, 0, 0.35, 0.03), -Infinity);
  assert.equal(stairFloor([box(0.8, true)], 0, 0.03, 0, 0.35, 0.03), -Infinity);
});
