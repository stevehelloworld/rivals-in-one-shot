async page => {
  const cases = [
    { name: 'hybrid computer', features: ['(pointer: fine)', '(any-pointer: coarse)'], query: '', touch: false },
    { name: 'touch-only phone', features: ['(pointer: coarse)'], query: '', touch: true },
    { name: 'manual desktop override', features: ['(pointer: coarse)'], query: '?touch=0', touch: false },
    { name: 'manual touch override', features: ['(pointer: fine)'], query: '?touch=1', touch: true },
  ];
  for (const scenario of cases) {
    const context = await page.context().browser().newContext();
    try {
      const tab = await context.newPage();
      await tab.addInitScript(({ features }) => {
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 });
        const matchMedia = window.matchMedia.bind(window);
        window.matchMedia = query => /pointer|any-hover/.test(query)
          ? { matches: features.includes(query) } : matchMedia(query);
        window.pointerLockRequested = false;
        const request = Element.prototype.requestPointerLock;
        Element.prototype.requestPointerLock = function (...args) {
          window.pointerLockRequested = true;
          return request?.apply(this, args);
        };
      }, scenario);
      await tab.goto('http://127.0.0.1:8771/' + scenario.query);
      await tab.locator('#boot-status').waitFor({ state: 'hidden' });
      await tab.locator('#btn-start-ai').click();
      await tab.waitForFunction(() => window.pointerLockRequested || document.body.classList.contains('touch-playing'));
      const input = await tab.evaluate(() => ({
        touch: document.body.classList.contains('touch-playing'),
        desktop: window.pointerLockRequested,
      }));
      if (input.touch !== scenario.touch || input.desktop === scenario.touch) {
        throw Error(scenario.name + ': ' + JSON.stringify(input));
      }
    } finally {
      await context.close();
    }
  }
  return cases.map(scenario => scenario.name);
}
