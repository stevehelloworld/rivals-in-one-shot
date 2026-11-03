async (page) => {
  await page.goto('http://127.0.0.1:8770/?touch=1');
  await page.evaluate(() => localStorage.setItem('rivals.armory.v1', JSON.stringify({ credits: 5000, owned: [], equipped: {} })));
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  await page.locator('#btn-open-armory').click();
  for (const name of ['VECTOR SMG', 'BREACH SHOTGUN', 'SENTINEL DMR', 'LONGSHOT SNIPER', 'BASTION LMG', 'IRON SIX REVOLVER']) {
    await page.locator('#armory-list li').filter({ hasText: name }).getByRole('button').click();
  }
  await page.screenshot({ path: 'output/playwright/expanded-armory.png' });
  await page.locator('#armory-dialog .dialog-close').click();
  await page.reload();
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  await page.locator('#btn-start-ai').click();
  await page.locator('#touch-controls.active').waitFor();
  const result = await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    const { createLoadout } = await import('/js/weapons.js');
    const p = game.player;
    if (p.loadout[0].id !== 'lmg' || p.loadout[1].id !== 'revolver') throw new Error('Equipped weapons did not persist');
    const saved = JSON.parse(localStorage.getItem('rivals.armory.v1'));
    if (saved.owned.length !== 6 || saved.credits !== 3250) throw new Error('Purchase accounting mismatch');
    const results = [];
    for (const id of ['smg', 'shotgun', 'marksman', 'sniper', 'lmg', 'revolver']) {
      const slot = id === 'revolver' ? 1 : 0;
      p.loadout = createLoadout({ [slot]: id });
      p.alive = true;
      p.touchActive = true;
      p.switchSlot(slot);
      if (!p.viewmodel.userData.gun.visible) throw new Error(id + ' missing weapon model');
      p.pressFire();
      const act = p.update(1 / 60, 100, {});
      p.releaseFire();
      const expected = id === 'shotgun' ? 6 : 1;
      if (act.shots.length !== expected || p.weapon.ammo !== p.weapon.magSize - 1) throw new Error(id + ' firing mismatch');
      if (!p.viewmodel.userData.gunFlash.visible) throw new Error(id + ' missing muzzle flash');
      p.requestReload();
      p.update(1 / 60, 101, {});
      if (!p.weapon.reloading) throw new Error(id + ' manual reload failed');
      p.weapon.reloadT = 0;
      p.update(1 / 60, 102, {});
      if (p.weapon.ammo !== p.weapon.magSize) throw new Error(id + ' reload incomplete');
      results.push(id + ': fire, model, muzzle, reload PASS');
    }
    return results;
  });
  console.log(result);
}
