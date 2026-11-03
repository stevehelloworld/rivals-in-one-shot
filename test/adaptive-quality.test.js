const test = require('node:test');
const assert = require('node:assert/strict');

test('adaptive quality degrades under sustained load and recovers conservatively', async () => {
  const { AdaptiveQuality } = await import('../js/adaptive-quality.mjs');
  const quality = new AdaptiveQuality();
  const run = (fps, seconds) => {
    for (let i = 0; i < fps * seconds; i++) quality.sample(1 / fps, true);
  };
  run(30, 4);
  assert.equal(quality.level, 2);
  run(30, 2);
  assert.equal(quality.level, 1);
  run(30, 6);
  assert.equal(quality.level, 0);
  run(60, 10);
  assert.equal(quality.level, 0);
  run(60, 11);
  assert.equal(quality.level, 1);
  quality.sample(10, true);
  quality.sample(0.1, false);
  assert.equal(quality.level, 1);
  assert.equal(quality.frames, 0);
});
