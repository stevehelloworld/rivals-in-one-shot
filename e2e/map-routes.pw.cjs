async (page) => {
  await page.goto('http://127.0.0.1:8770/?touch=1');
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  const result = await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    const { maps } = await import('/js/maps/index.mjs');
    const reports = [];
    for (const map of maps) {
      game.arena.select(map.id);
      if (game.player.colliders !== game.arena.colliders || game.bot.colliders !== game.arena.colliders) throw new Error('Collision references lost');
      if (game.arena.id !== map.id) throw new Error('Map switch failed');
      reports.push({ id: map.id, colliders: game.arena.colliders.length });
    }
    for (const [id, x, z, end] of [['viaduct', 10, 14, 1], ['sunset', 20, 2, 13]]) {
      game.arena.select(id);
      for (const entity of [game.player, game.bot]) {
        entity.position.set(x, 0.03, z); entity.onGround = true; entity.floorY = 0;
        for (const target of [end, z]) {
          const direction = Math.sign(target - entity.position.z);
          for (let i = 0; i < 240 && Math.abs(target - entity.position.z) > 0.08; i++) {
            entity.velocity.z = direction * 4; entity.velocity.y -= 28 / 60; entity._move(1 / 60);
          }
          if (Math.abs(target - entity.position.z) > 0.16 ||
              (target === end ? entity.position.y < 3 : entity.position.y > 0.1)) throw new Error(`${id}: stair route blocked`);
        }
      }
    }
    return reports;
  });
  console.log(JSON.stringify(result));
}
