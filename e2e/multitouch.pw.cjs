async (page) => {
  await page.goto('http://127.0.0.1:8770/?touch=1');
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('#btn-play-easy').click();
  await page.locator('#touch-controls.active').waitFor();
  const center = async selector => {
    const rect = await page.locator(selector).boundingBox();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  };
  const stick = await center('[data-touch="joystick"]');
  const fire = await center('[data-action="fire"]');
  const cdp = await page.context().newCDPSession(page);
  const points = [{ id: 1, ...stick }, { id: 2, ...fire }, { id: 3, x: 380, y: 180 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
  points[0].y -= 30;
  points[1].x += 25;
  points[2].x += 20;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points });
  await page.waitForFunction(async () => (await import('/js/main.js')).game.player.weapon.ammo < 20);
  const active = await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    return game.player.touchMove.y < 0 && game.player.shooting && game.touchControls.lookPointer !== null;
  });
  if (!active) throw new Error('Simultaneous move/fire/look failed');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  const released = await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    return !game.player.shooting && game.player.touchMove.y === 0 && game.touchControls.lookPointer === null;
  });
  if (!released) throw new Error('Touch cancellation failed');
  await cdp.detach();
  console.log('PASS: three simultaneous touch contacts, move/fire/look, touch cancellation');
}
