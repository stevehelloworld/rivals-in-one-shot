async (page) => {
  await page.goto('http://127.0.0.1:8770/?touch=1');
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  await page.locator('#btn-open-armory').click();
  for (const [category, expected] of [['primary', 7], ['secondary', 3], ['gear', 3], ['skin', 2], ['all', 15]]) {
    await page.locator('#armory-category').selectOption(category);
    if (await page.locator('#armory-list li:visible').count() !== expected) throw new Error('Category mismatch: ' + category);
  }
  if (!(await page.locator('[data-weapon="shotgun"] .weapon-stats').textContent()).includes('10 × 6 (60 max)')) throw new Error('Shotgun stats mismatch');
  for (const [width, height] of [[1280, 800], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `output/playwright/weapon-comparison-${width}.png` });
    if (await page.locator('#armory-dialog').evaluate(e => e.scrollWidth > e.clientWidth + 1)) throw new Error('Armory overflow');
  }
  await page.locator('#armory-dialog .dialog-close').click();
  await page.locator('#btn-start-ai').click();
  await page.locator('#touch-controls.active').waitFor();
  await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    const { createLoadout } = await import('/js/weapons.js');
    game.update = () => {};
    game.player.loadout = createLoadout({ 0: 'sniper' });
    game.player.switchSlot(0);
  });
  await page.locator('[data-action="aim"]').click();
  await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    const p = game.player;
    if (!p.aiming) throw new Error('Touch aim did not toggle');
    for (let i = 0; i < 60; i++) p._updateViewmodel(1 / 60, 10 + i / 60);
    game._updateHUD();
    if (p.ads < 0.99 || p.camera.fov > 30 || p.weapon.adsSpread >= p.weapon.spread) throw new Error('Scope/precision mismatch');
    p.pressFire();
    const shot = p.update(1 / 60, 20, {});
    if (shot.shots.length !== 1) throw new Error('Scoped fire failed');
    p.releaseFire();
    p.resetInput();
    if (p.aiming || p.ads || Math.abs(p.camera.fov - p.baseFov) > 0.1) throw new Error('Aim reset failed');
    const { animateWeaponParts } = await import('/js/weapon-details.js');
    for (const id of ['shotgun', 'sniper', 'revolver', 'lmg']) {
      animateWeaponParts(p.viewmodel, id, 0.8, 0.8, false);
      const moving = p.viewmodel.userData.details[id].moving;
      if (moving.position.lengthSq() + moving.rotation.x ** 2 + moving.rotation.z ** 2 === 0) throw new Error(id + ' missing action');
      animateWeaponParts(p.viewmodel, id, 0, 0, false);
      if (moving.position.lengthSq() > 0 || moving.rotation.z !== 0) throw new Error(id + ' action failed to reset');
    }
  });
  console.log('PASS: weapon categories, live comparisons, mobile scope, aim reset and unique actions');
}
