const test = require('node:test');
const assert = require('node:assert/strict');

test('touch assistance slows near a visible target and guides only active drags', async () => {
  const { assistLook } = await import('../js/aim-assist.mjs');
  const opts = { yaw: 0, pitch: 0, dx: 0.02, dy: 0, level: 'standard',
    targets: [{ yaw: 0.04, pitch: 0.01 }], visible: () => true };
  const slow = assistLook(opts);
  assert.ok(slow.dx > 0 && slow.dx < opts.dx);
  assert.equal(slow.dy, 0);
  const pull = assistLook({ ...opts, pull: true });
  assert.ok(pull.dx > slow.dx && pull.dy > 0);
  assert.ok(Math.hypot(pull.dx - slow.dx, pull.dy) <= 0.00401);
  for (const change of [
    { level: 'off' }, { dx: 0 }, { dx: 0.25 }, { visible: () => false },
    { targets: [{ yaw: 1, pitch: 0 }] }, { zoom: 4, targets: [{ yaw: 0.08, pitch: 0 }] },
  ]) assert.equal(assistLook({ ...opts, ...change }), null);
  assert.ok(assistLook({ ...opts, yaw: Math.PI - 0.01, targets: [{ yaw: -Math.PI + 0.01, pitch: 0 }] }));
});
