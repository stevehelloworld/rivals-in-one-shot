async (page) => {
  await page.goto('http://127.0.0.1:8770/?touch=1');
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  const saved = await page.evaluate(() => localStorage.getItem('rivals.armory.v1'));
  await page.locator('#btn-practice').click();
  await page.locator('#range-panel').waitFor({ state: 'visible' });
  for (const id of ['sniper', 'shotgun', 'revolver', 'rpg', 'grenade', 'ar']) {
    await page.locator('#range-weapon').selectOption(id);
    const actual = await page.evaluate(async () => (await import('/js/main.js')).game.player.weapon.id);
    if (actual !== id) throw new Error('Trial weapon mismatch: ' + id);
  }
  const stats = await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    const THREE = await import('three');
    if (game.mode !== 'range' || game.arena.id !== 'range' || game.rivalMesh.visible) throw new Error('Range mode invalid');
    game.update = () => {};
    const target = game.practice.targets[1];
    const origin = game.camera.position.clone();
    const dir = target.position.clone().add(new THREE.Vector3(0, 1, 0)).sub(origin).normalize();
    game._resolvePractice({ shots: [{ origin, dir, damage: 12, headMult: 1.25, range: 120, weaponId: 'ar' }], nades: [], melee: null }, 1 / 60);
    if (game.practice.hits !== 1 || game.practice.damage !== 12 || game.practice.shots !== 1) throw new Error('Target damage not recorded');
    game._explode({ pos: target.position.clone(), splash: 7, damage: 100, ownerIsMe: true, kind: 'rocket' });
    if (game.practice.damage <= 12 || game.player.hp !== 100 || game.score.you !== 0) throw new Error('Practice explosion or score isolation failed');
    game.clearTracers();
    game.renderer.render(game.scene, game.camera);
    const batched = game.renderer.info.render.calls;
    const instances = [], clones = [];
    game.scene.traverse(mesh => { if (mesh.isInstancedMesh && mesh.visible) instances.push(mesh); });
    for (const instance of instances) {
      instance.visible = false;
      for (let i = 0; i < instance.count; i++) {
        const mesh = new THREE.Mesh(instance.geometry, instance.material);
        instance.getMatrixAt(i, mesh.matrix);
        mesh.matrixAutoUpdate = false;
        mesh.castShadow = instance.castShadow; mesh.receiveShadow = instance.receiveShadow;
        instance.parent.add(mesh); clones.push(mesh);
      }
    }
    game.renderer.render(game.scene, game.camera);
    const unbatched = game.renderer.info.render.calls;
    clones.forEach(mesh => mesh.removeFromParent());
    instances.forEach(mesh => { mesh.visible = true; });
    game.renderer.render(game.scene, game.camera);
    if (batched >= unbatched) throw new Error('Same-view batching benchmark did not improve');
    return { calls: batched, unbatched, triangles: game.renderer.info.render.triangles, geometries: game.renderer.info.memory.geometries };
  });
  if (stats.calls >= 54) throw new Error('Static batching did not lower draw calls: ' + stats.calls);
  for (const [width, height] of [[1280, 720], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `output/playwright/practice-${width}.png` });
    const overlap = await page.evaluate(() => {
      const panel = document.getElementById('range-panel').getBoundingClientRect();
      const weapon = document.getElementById('weapon-hud').getBoundingClientRect();
      return panel.left < weapon.right && panel.right > weapon.left && panel.top < weapon.bottom && panel.bottom > weapon.top;
    });
    if (overlap) throw new Error('Practice controls overlap weapon HUD at ' + width);
  }
  await page.locator('#range-reset').click();
  if ((await page.evaluate(async () => (await import('/js/main.js')).game.practice.damage)) !== 0) throw new Error('Range reset failed');
  await page.locator('#range-exit').click();
  if ((await page.evaluate(() => localStorage.getItem('rivals.armory.v1'))) !== saved) throw new Error('Practice modified permanent unlocks');
  await page.locator('#btn-play-hard').click();
  await page.locator('#btn-start-ai').click();
  const tactics = await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    const { maps } = await import('/js/maps/index.mjs');
    const results = [];
    for (const map of maps) {
      game.arena.select(map.id);
      game.bot.spawn(game.arena.spawns.enemy.clone());
      game.bot.highGround = [];
      const from = game.bot.position.clone();
      for (let i = 0; i < 180; i++) game.bot.update(1 / 60, i / 60, game.arena.spawns.player, true);
      if (game.bot.position.distanceTo(from) < 2) throw new Error(map.id + ' bot stuck at spawn');
      results.push({ map: map.id, moved: Number(game.bot.position.distanceTo(from).toFixed(1)), tactic: game.bot.tactic });
    }
    for (const map of maps.filter(map => map.vantageRoutes)) {
      game.arena.select(map.id);
      game.bot.spawn(game.arena.spawns.enemy.clone());
      game.bot.highGround = map.vantageRoutes[0].map(([x, z]) => ({ x, z }));
      game.bot.reactDelay = 999;
      game.bot.jumpPeek = 0;
      let peak = 0;
      for (let i = 0; i < 900; i++) {
        game.bot.update(1 / 60, i / 60, game.arena.spawns.player, true);
        peak = Math.max(peak, game.bot.position.y);
      }
      if (peak < 2.7) throw new Error(map.id + ' bot failed to climb its tactical stair route: ' + peak);
      results.push({ map: map.id, peak: Number(peak.toFixed(2)) });
    }
    return results;
  });
  console.log('PASS: free trials, range damage/reset, no rewards, responsive controls, batching', stats, tactics);
  return { stats, tactics };
}
