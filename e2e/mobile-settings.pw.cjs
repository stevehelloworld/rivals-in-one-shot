async (page) => {
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const check = (value, message) => { if (!value) throw new Error(message); };
  await page.goto('http://127.0.0.1:8770/?touch=1');
  await page.evaluate(() => localStorage.removeItem('rivals.settings.v1'));
  await page.reload();
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('#btn-open-settings').click();
  await page.locator('#btn-touch-layout').click();
  await page.locator('#touch-editor').waitFor({ state: 'visible' });
  await page.locator('#layout-size').fill('86');
  await page.locator('#layout-opacity').fill('0.65');
  const box = await page.locator('[data-action="fire"]').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(650, 310, { steps: 8 });
  await page.mouse.up();
  await page.locator('#layout-left-hand').check();
  await page.screenshot({ path: 'output/playwright/layout-landscape.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#layout-size').fill('70');
  await page.screenshot({ path: 'output/playwright/layout-portrait.png' });
  await page.locator('#layout-save').click();
  await page.reload();
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  check(await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    const layout = game.settings.touchLayout;
    return layout.leftHanded && layout.landscape.fire.size === 86 &&
      layout.landscape.fire.opacity === 0.65 && layout.portrait.fire.size === 70;
  }), 'Layout persistence failed');
  await page.locator('#btn-play-easy').click();
  await page.locator('#btn-start-ai').click();
  await page.locator('#touch-controls.active').waitFor();
  check(await page.evaluate(() => {
    const fire = document.querySelector('[data-action="fire"]').getBoundingClientRect();
    return fire.left >= 0 && fire.right <= innerWidth && fire.width === 70 && fire.left < innerWidth / 2;
  }), 'Left-handed portrait layout failed');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => document.querySelector('[data-action="fire"]').getBoundingClientRect().width === 86);
  const quality = await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    for (let i = 0; i < 400; i++) game.recordFrame(1 / 30);
    const low = game.renderer.getPixelRatio();
    const disabledShadows = !game.renderer.shadowMap.enabled;
    for (let i = 0; i < 2400; i++) game.recordFrame(1 / 60);
    return { low, restored: game.renderer.getPixelRatio(), disabledShadows };
  });
  check(quality.low === 0.65 && quality.restored > quality.low && quality.disabledShadows, 'Adaptive render quality failed');
  check(await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    game.settings.autoQuality = false;
    game._applyRenderQuality();
    const ratio = game.renderer.getPixelRatio();
    for (let i = 0; i < 400; i++) game.recordFrame(1 / 30);
    return ratio === game.renderer.getPixelRatio();
  }), 'Manual quality override failed');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(async () => (await import('/js/main.js')).game.audio.context.state === 'suspended');
  await page.locator('#btn-resume').click();
  await page.waitForFunction(async () => (await import('/js/main.js')).game.audio.context.state === 'running');
  page.off('pageerror', onError);
  check(errors.length === 0, `Unhandled browser errors: ${errors.join('; ')}`);
  console.log('PASS: layout drag/size/opacity/save, handedness, orientation, adaptive rendering, audio suspend/resume');
}
