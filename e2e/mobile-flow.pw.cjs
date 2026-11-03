// Run with playwright-cli run-code, against a running local server.
async (page) => {
  const check = (value, message) => { if (!value) throw new Error(message); };
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('http://127.0.0.1:8770/?touch=1');
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  await page.locator('#btn-play-easy').click();
  await page.locator('#btn-start-ai').click();
  await page.locator('#touch-controls.active').waitFor();
  const result = await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    const fire = document.querySelector('[data-action="fire"]');
    const dispatch = (type, id, x, y) => fire.dispatchEvent(new PointerEvent(type, {
      pointerId: id, clientX: x, clientY: y, bubbles: true,
    }));
    // Real pointer capture is verified separately through mouse below.
    const start = game.camera.quaternion.clone();
    game.touchControls.firePointer = 11;
    game.touchControls.fireX = 400;
    game.touchControls.fireY = 200;
    dispatch('pointermove', 11, 440, 210);
    const aimed = start.angleTo(game.camera.quaternion) > 0.01;
    game.player.pressFire();
    game.player.keys.f = true;
    game.player.setTouchMove(1, -1);
    window.dispatchEvent(new Event('blur'));
    const cleared = !game.player.shooting && !game.player.fireQueued &&
      Object.values(game.player.keys).every(value => !value) &&
      game.player.touchMove.x === 0 && game.touchControls.firePointer === null;
    return { aimed, cleared, paused: game.state === 'pause' };
  });
  check(result.aimed && result.cleared && result.paused, 'Aim or background input reset failed');
  await page.locator('#btn-resume').click();
  const fireBox = await page.locator('[data-action="fire"]').boundingBox();
  await page.mouse.move(fireBox.x + 35, fireBox.y + 35);
  await page.mouse.down();
  await page.mouse.move(fireBox.x - 50, fireBox.y + 15, { steps: 8 });
  await page.waitForFunction(() => Number(document.querySelector('#ammo-cur').textContent) < 20);
  await page.mouse.up();
  await page.locator('[data-action="reload"]').click();
  await page.waitForFunction(() => document.querySelector('#ammo-cur').textContent === '20');
  await page.locator('[data-slot="4"]').click();
  await page.waitForFunction(() => document.querySelector('#weapon-name').textContent === 'RPG');
  await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    const old = game.player.position.clone();
    game.player.setTouchMove(0, -1);
    game.player.update(0.05, performance.now() / 1000);
    if (old.distanceTo(game.player.position) === 0) throw new Error('Movement failed');
    game.player.takeDamage(100);
    game._onKill(false, 'TEST');
  });
  await page.locator('#round-end').waitFor({ state: 'visible' });
  await page.waitForFunction(async () => (await import('/js/main.js')).game.round === 2);
  await page.locator('#touch-controls.active').waitFor();
  check(await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    return game.player.alive && game.player.hp > 0 && game.touchControls.active;
  }), 'Next round failed');
  for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(size);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile horizontal overflow');
  }
  // Force module failure and verify that Retry can recover once the network works.
  await page.route('**/js/touch-math.mjs', route => route.abort());
  await page.reload();
  await page.locator('#boot-retry').waitFor({ state: 'visible' });
  check(await page.locator('#boot-title').textContent() === 'COULD NOT START', 'Missing startup error');
  await page.unroute('**/js/touch-math.mjs');
  await page.locator('#boot-retry').click();
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  console.log('PASS: startup, aim/fire, input reset, resume, reload, weapons, movement, death, next round, mobile layouts, load failure/retry');
}
