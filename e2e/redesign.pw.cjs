async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:8770/?touch=1');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.querySelector('.arena-preview img').complete);
  await page.screenshot({ path: '.impeccable/review/mobile.png', fullPage: true, scale: 'css' });
  await page.screenshot({ path: '.impeccable/review/hero-repro.png', scale: 'css' });
  const desktop = await page.context().browser().newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const desk = await desktop.newPage();
  await desk.goto('http://127.0.0.1:8770/');
  await desk.locator('#boot-status').waitFor({ state: 'hidden' });
  await desk.evaluate(() => document.fonts.ready);
  await desk.screenshot({ path: '.impeccable/review/desktop.png', fullPage: true });
  await desktop.close();
  await page.locator('#tab-online').click();
  await page.locator('#btn-create').waitFor({ state: 'visible' });
  await page.locator('#tab-ai').click();
  await page.locator('#btn-play-hard').click();
  if (await page.locator('#btn-start-ai span').textContent() !== 'PLAY HARD') throw new Error('Difficulty selection failed');
  await page.locator('#btn-play-easy').click();
  await page.locator('#btn-start-ai').click();
  await page.locator('#touch-controls.active').waitFor();
  await page.locator('#round-banner').waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => document.querySelector('[data-touch="joystick"]').getBoundingClientRect().width === 112);
  await page.screenshot({ path: '.impeccable/review/gameplay-landscape.png', scale: 'css' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.impeccable/review/gameplay-portrait.png', scale: 'css' });
  await page.locator('[data-action="pause"]').click();
  await page.screenshot({ path: '.impeccable/review/pause.png', scale: 'css' });
  await page.locator('#btn-quit').click();
  await page.locator('#btn-open-settings').click();
  await page.screenshot({ path: '.impeccable/review/settings.png', scale: 'css' });
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    if (await page.evaluate(() => document.querySelector('#menu').scrollWidth > innerWidth)) throw new Error('Menu overflow');
  }
  if (errors.length) throw new Error(errors.join('; '));
  console.log('PASS: B lobby, tabs, difficulty/play, settings, pause, gameplay, responsive layouts');
}
