async (page) => {
  await page.goto('http://127.0.0.1:8770/?touch=1');
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  await page.locator('#btn-start-ai').click();
  await page.locator('#touch-controls.active').waitFor();
  // Freeze only the test frame so screenshots capture the same blast phase.
  await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    game.update = () => {};
    game.camera.position.set(0, 1.7, 18);
    game.camera.lookAt(0, 1.7, 0);
    game.player.position.copy(game.camera.position);
  });
  for (const [name, width, height, quality, reduced, distance] of [
    ['near-desktop', 1280, 720, 'high', false, 0.25],
    ['near-mobile-low', 390, 844, 'low', false, 0.25],
    ['near-reduced', 390, 844, 'high', true, 0.25],
    ['mid-desktop', 1280, 720, 'high', false, 7],
  ]) {
    await page.setViewportSize({ width, height });
    const result = await page.evaluate(async ({ quality, reduced, distance }) => {
      const { game } = await import('/js/main.js');
      const THREE = await import('three');
      game.clearTracers();
      game.effectsQuality = quality;
      game.settings.reducedMotion = reduced;
      const pos = game.camera.position.clone().add(new THREE.Vector3(0, 0, -distance));
      game._explode({ pos, splash: 7, damage: 0, kind: 'rocket', ownerIsMe: true, weapon: 'RPG', weaponId: 'rpg' });
      const blast = game.tracers.find(t => t.poolKind === 'blast');
      if (blast.line.material.side !== THREE.DoubleSide || blast.life < 0.4) throw new Error('Inside-blast visibility regression');
      const flash = game.tracers.find(t => t.poolKind === 'flash');
      if (!flash || flash.line.parent !== game.camera || flash.line.material.depthTest) throw new Error('Close feedback missing');
      const sparks = game.tracers.filter(t => t.poolKind === 'impact').length;
      if (sparks !== (reduced ? 4 : quality === 'low' ? 8 : 18)) throw new Error('Effect quality budget mismatch');
      if ((reduced || quality === 'low') && game.tracers.some(t => t.poolKind === 'smoke')) throw new Error('Smoke budget mismatch');
      game._updateTracers(0.06);
      game.renderer.render(game.scene, game.camera);
      return { sparks, effects: game.tracers.length };
    }, { quality, reduced, distance });
    await page.screenshot({ path: `output/playwright/explosion-${name}.png` });
    console.log(name, result);
  }
  await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    game._updateTracers(2);
    if (game.tracers.length) throw new Error('Expired FX were not recycled');
    if (game.camera.children.some(child => game._fxPools.flash.includes(child))) throw new Error('Flash leaked into camera');
    for (let i = 0; i < 12; i++) {
      game._explode({ pos: game.camera.position.clone(), splash: 7, damage: 0, kind: 'rocket', ownerIsMe: true });
      game.clearTracers();
    }
    if (game.tracers.length || game._fxPools.flash.length > 1) throw new Error('Repeated explosions leaked effects');
    const hasLOS = game.hasLOS;
    game.hasLOS = () => false;
    game._explode({ pos: game.camera.position.clone(), splash: 6.5, damage: 0, kind: 'grenade', ownerIsMe: false });
    if (game.tracers.some(t => t.poolKind === 'flash')) throw new Error('Flash visible through cover');
    game.hasLOS = hasLOS;
    game.clearTracers();
    const THREE = await import('three');
    const origin = game.camera.position.clone();
    game._spawnTracer(origin, new THREE.Vector3(0, 0, -1), 0xffffaa, 0.2);
    const bullet = game.tracers[0];
    if (bullet.line.scale.y > 0.2 || bullet.start.distanceTo(bullet.end) > 0.2) throw new Error('Near-wall tracer overshoots');
    game.clearTracers();
  });
  console.log('PASS: inside-blast feedback, mobile budgets, reduced motion and FX recycling');
}
