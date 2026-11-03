async (page) => {
  const guest = await page.context().newPage();
  try {
    await page.goto('http://127.0.0.1:8770/?touch=1');
    await page.locator('#boot-status').waitFor({ state: 'hidden' });
    await page.locator('#btn-create').click();
    await page.waitForFunction(() => document.querySelector('#room-code-display').textContent !== '----');
    const code = await page.locator('#room-code-display').textContent();
    await guest.goto('http://127.0.0.1:8770/?touch=1');
    await guest.locator('#boot-status').waitFor({ state: 'hidden' });
    await guest.locator('#join-code').fill(code);
    await guest.locator('#btn-join').click();
    await guest.locator('#touch-controls.active').waitFor();
    await page.evaluate(async () => (await import('/js/main.js')).game.net.ws.close());
    await page.waitForFunction(async () => !(await import('/js/main.js')).game.net.connected);
    await page.waitForFunction(async () => {
      const { game } = await import('/js/main.js');
      return game.net.connected && !game._networkPaused;
    });
    await guest.waitForFunction(async () => !(await import('/js/main.js')).game._networkPaused);
    console.log('PASS: mobile online room creation, join, disconnect and reconnect');
  } finally {
    await guest.close();
  }
}
