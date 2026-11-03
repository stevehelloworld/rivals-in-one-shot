async (page) => {
  await page.goto('http://127.0.0.1:8770/?touch=1');
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  await page.locator('#btn-open-settings').click();
  await page.locator('#setting-performance').check();
  await page.locator('#settings-dialog .dialog-close').click();
  await page.locator('#btn-practice').click();
  const report = await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    game.update = () => {};
    const results = [];
    for (const quality of ['low', 'high']) {
      game.clearTracers();
      game.effectsQuality = quality;
      let peak = 0;
      for (let frame = 0; frame < 240; frame++) {
        if (frame % 6 === 0) game._explode({ pos: game.practice.targets[1].position.clone(), splash: 7, damage: 0, kind: 'rocket', ownerIsMe: true });
        game._updateTracers(1 / 60);
        peak = Math.max(peak, game.tracers.length);
      }
      const budget = quality === 'low' ? 100 : 240;
      if (peak > budget) throw new Error(quality + ' effect budget exceeded');
      game._updateTracers(2);
      if (game.tracers.length) throw new Error('Burst effects did not expire');
      results.push({ quality, peak, budget });
    }
    for (let i = 0; i < 61; i++) game.recordFrame(1 / 60);
    if (!game.ui.performance.textContent.includes('FPS')) throw new Error('Performance HUD failed');
    game.player.setAiming(true);
    game.player.controls.dispatchEvent({ type: 'unlock' });
    if (game.player.aiming || game.player.ads || !game.ui.scope.hidden) throw new Error('Desktop unlock failed to reset aim');
    return results;
  });
  await page.locator('#btn-quit').click();
  console.log('PASS: sustained burst budgets, FX recycling, performance HUD and desktop aim reset');
  return report;
}
