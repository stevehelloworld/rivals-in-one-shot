async (page) => {
  await page.goto('http://127.0.0.1:8770/?touch=1');
  await page.evaluate(() => localStorage.setItem('rivals.armory.v1', JSON.stringify({ credits: 5000, owned: [], equipped: {} })));
  await page.reload();
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  await page.locator('#btn-open-armory').click();
  await page.locator('#armory-list img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  if (await page.locator('#armory-list img').count() !== 15) throw new Error('Missing weapon images');
  for (const [width, height] of [[1280, 800], [390, 844]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.locator('#armory-dialog').evaluate(dialog => ({ width: dialog.clientWidth, scrollWidth: dialog.scrollWidth }));
    if (layout.scrollWidth > layout.width + 1) throw new Error('Gallery overflows horizontally');
    const badImages = await page.locator('#armory-list img').evaluateAll(images => images.filter(image => !image.complete || image.naturalWidth < 100).length);
    if (badImages) throw new Error('Broken weapon image');
    await page.screenshot({ path: `output/playwright/armory-gallery-${width}.png` });
  }
  await page.locator('[data-weapon="smg"] button').click();
  await page.locator('[data-weapon="ar"] button').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('rivals.armory.v1')));
  if (saved.credits !== 4800 || !saved.owned.includes('smg') || saved.equipped[0]) throw new Error('Default selection or purchase regression');
  await page.locator('#armory-dialog .dialog-close').click();
  await page.reload();
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  await page.locator('#btn-open-armory').click();
  await page.locator('[data-weapon="smg"] button').click();
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('rivals.armory.v1')));
  if (persisted.credits !== 4800 || persisted.equipped[0] !== 'smg') throw new Error('Owned weapon charged twice');
  await page.locator('#armory-dialog .dialog-close').click();
  console.log('PASS: all 15 model images, desktop/mobile layout, default selection and persistent unlocks');
}
