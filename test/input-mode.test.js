const test = require('node:test');
const assert = require('node:assert/strict');

test('touch-enabled computers prefer the mouse while touch-only browsers get touch controls', async () => {
  const { prefersTouchControls } = await import('../js/input-mode.mjs');
  const detect = (search, ...features) => prefersTouchControls(search, query => features.includes(query));

  assert.equal(detect('', '(pointer: fine)', '(any-pointer: coarse)'), false);
  assert.equal(detect('', '(pointer: coarse)', '(any-pointer: fine)', '(any-hover: hover)'), false);
  assert.equal(detect('', '(pointer: coarse)'), true);
  assert.equal(detect('', '(any-pointer: coarse)'), true);
  assert.equal(detect('', '(pointer: coarse)', '(any-pointer: fine)'), true);
  assert.equal(detect(''), false);
  assert.equal(detect('?touch=1', '(pointer: fine)'), true);
  assert.equal(detect('?touch', '(pointer: fine)'), true);
  assert.equal(detect('?touch=0', '(pointer: coarse)'), false);
  assert.equal(detect('?touch=invalid', '(pointer: fine)'), false);
});
