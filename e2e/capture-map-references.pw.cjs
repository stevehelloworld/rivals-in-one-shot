async (page) => {
  await page.goto('http://127.0.0.1:8770/');
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  const ids = await page.evaluate(async () => (await import('/js/maps/index.mjs')).maps.map(map => map.id));
  for (const id of ids) {
    await page.evaluate(async id => {
      const { game } = await import('/js/main.js');
      const { getMap } = await import('/js/maps/index.mjs');
      game.settings.effects = 'high'; game.settings.autoQuality = false; game._applyRenderQuality();
      game.arena.select(id); game.viewmodel.visible = false; game.rivalMesh.visible = false;
      game.camera.fov = 65; game.camera.updateProjectionMatrix();
      game.camera.position.set(...getMap(id).previewCamera); game.camera.lookAt(0, 1.5, 0);
      document.querySelector('#menu').classList.add('hidden');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, id);
    await page.locator('canvas').screenshot({ path: `output/playwright/complex-${id}.png`, scale: 'css' });
  }
}
