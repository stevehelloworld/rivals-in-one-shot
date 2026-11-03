async (page) => {
  await page.goto('http://127.0.0.1:8770/?touch=1');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  for (const id of ['sunset', 'dock', 'foundry', 'viaduct', 'courtyard']) {
    await page.locator('#ai-map').selectOption(id);
    await page.locator('.arena-art').evaluate(image => image.decode());
    const source = await page.locator('.arena-art').getAttribute('src');
    if (!source.endsWith(`preview-${id}.jpg`)) throw new Error(`Wrong preview for ${id}`);
    await page.screenshot({ path: `output/playwright/menu-${id}-enhanced.png`, scale: 'css' });
    await page.locator('#btn-start-ai').click();
    await page.locator('#touch-controls.active').waitFor();
    const actual = await page.evaluate(async () => (await import('/js/main.js')).game.arena.id);
    if (actual !== id) throw new Error(`Wrong arena for ${id}`);
    await page.locator('[data-action="pause"]').click();
    await page.locator('#btn-quit').click();
  }
  await page.locator('#ai-map').selectOption('random');
  if (!(await page.locator('.arena-preview-name').textContent()).includes('5 arenas')) throw new Error('Random preview label');
  await page.locator('#tab-online').click();
  if (!(await page.locator('.arena-art').getAttribute('src')).endsWith('preview-sunset.jpg')) throw new Error('Online map mismatch');
  console.log('PASS: all previews decode and match the selected playable arena');
}
