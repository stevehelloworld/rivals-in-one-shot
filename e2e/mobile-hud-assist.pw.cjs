async page => {
  await page.goto('http://127.0.0.1:8770/?touch=1');
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  await page.locator('#btn-open-settings').click();
  await page.locator('#setting-aim-assist').selectOption('strong');
  await page.locator('#settings-dialog .dialog-close').click();
  await page.reload();
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  await page.locator('#btn-open-settings').click();
  if (await page.locator('#setting-aim-assist').inputValue() !== 'strong') throw Error('Assist preference did not persist');
  await page.locator('#settings-dialog .dialog-close').click();
  await page.locator('#btn-start-ai').click();
  await page.locator('#touch-controls.active').waitFor();
  await page.evaluate(async () => { (await import('/js/main.js')).game.update = () => {}; });
  const results = [];
  for (const [width, height] of [[320, 568], [390, 844], [568, 320], [844, 390]]) {
    await page.setViewportSize({ width, height });
    results.push(await page.evaluate(async () => {
      const { game } = await import('/js/main.js');
      const editor = game.touchControls.editor;
      for (const left of [false, true]) {
        editor.layout = { leftHanded: left, portrait: {}, landscape: {} };
        editor.apply();
        for (const button of document.querySelectorAll('.wslot, .touch-action')) {
          const r = button.getBoundingClientRect();
          if (r.width < 44 || r.height < 44) throw Error('Undersized touch action');
        }
        const boxes = [...document.querySelectorAll('.touch-action, .touch-joystick, #weapon-hud, #scoreboard, #hp-bar-wrap')].map(e => [e.className || e.id, e.getBoundingClientRect()]);
        for (const [name, r] of boxes) {
          if (r.left < 0 || r.right > innerWidth + 1 || r.top < 0 || r.bottom > innerHeight + 1) throw Error('Out of view: ' + name);
        }
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          const [an, a] = boxes[i], [bn, b] = boxes[j];
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
              Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) throw Error(`Overlap at ${innerWidth}x${innerHeight}: ${an}, ${bn}`);
        }
      }
      editor.layout.leftHanded = false;
      editor.apply();
      return [innerWidth, innerHeight];
    }));
    if (width === 390 || width === 844) await page.screenshot({ path: `output/playwright/mobile-hud-${width}.png` });
  }
  await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    const p = game.player, target = game.opponent;
    game.camera.position.set(0, 1.6, 0);
    game.camera.quaternion.identity();
    target.position.set(0.3, 0.4, -10);
    const colliders = game.arena.colliders;
    colliders.length = 0;
    if (!game._assistTouchLook({ x: 0, y: 0 }, 0.01, 0, true)) throw Error('Visible enemy was not assisted');
    const before = game.camera.quaternion.clone();
    p.applyTouchLook(4, 0, 1, true);
    if (before.equals(game.camera.quaternion) || !(p.assistUntil > performance.now())) throw Error('Drag did not apply assistance');
    const THREE = await import('three');
    colliders.push(new THREE.Box3(new THREE.Vector3(-2, 0, -6), new THREE.Vector3(2, 3, -5)));
    if (game._assistTouchLook({ x: 0, y: 0 }, 0.01, 0, true)) throw Error('Assistance passed through a wall');
    colliders.length = 0;
    p.touchActive = false;
    if (game._assistTouchLook({ x: 0, y: 0 }, 0.01, 0, true)) throw Error('Desktop received touch assist');
  });
  return results;
}
