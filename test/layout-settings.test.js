const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('saved mobile layouts preserve orientation and clamp invalid values', async () => {
  const source = fs.readFileSync('js/settings.js', 'utf8');
  const { normalizeSettings } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  assert.equal(normalizeSettings(null).autoQuality, true);
  const normalized = normalizeSettings({ autoQuality: false, touchLayout: {
    leftHanded: true, landscape: { fire: { x: 2, y: -1, size: 8, opacity: 0 } },
    portrait: { fire: { x: 0.8, y: 0.9, size: 90, opacity: 0.7 } },
  } });
  assert.equal(normalized.autoQuality, false);
  assert.equal(normalized.touchLayout.leftHanded, true);
  assert.deepEqual(normalized.touchLayout.landscape.fire, { x: 1, y: 0, size: 44, opacity: 0.3 });
  assert.deepEqual(normalized.touchLayout.portrait.fire, { x: 0.8, y: 0.9, size: 90, opacity: 0.7 });
  assert.deepEqual(normalizeSettings(normalized), normalized);
  const aim = normalizeSettings({ showPerformance: true, touchLayout: { portrait: { aim: { x: 0.7, y: 0.7, size: 60, opacity: 0.8 } } } });
  assert.equal(aim.showPerformance, true);
  assert.equal(aim.touchLayout.portrait.aim.size, 60);
});
