async (page) => {
  await page.goto('http://127.0.0.1:8770/');
  await page.locator('#boot-status').waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 512, height: 256 });
  const keys = await page.evaluate(async () => {
    const { armoryItems } = await import('/js/armory.mjs');
    return armoryItems.map(item => item.key);
  });
  await page.evaluate(async () => {
    const { game } = await import('/js/main.js');
    game.update = () => {};
    game.renderer.setAnimationLoop(null);
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;background:transparent;overflow:hidden';
    const THREE = await import('three');
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(512, 256);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.id = 'weapon-capture';
    renderer.domElement.style.cssText = 'position:fixed;inset:0;width:512px;height:256px;display:block';
    document.body.append(renderer.domElement);
    window.weaponCapture = renderer;
  });
  for (const key of keys) {
    await page.evaluate(async (key) => {
      const THREE = await import('three');
      const { createViewmodel, setViewmodelWeapon } = await import('/js/map.js');
      const { catalog } = await import('/js/armory.mjs');
      const item = catalog.find(item => item.key === key);
      const model = createViewmodel();
      if (item?.slot === 'skin') model.userData.skinColor = item.color;
      const id = item?.slot === 'skin' || key === 'carbine' ? 'ar' : key === 'sidearm' ? 'handgun' : key;
      setViewmodelWeapon(model, id);
      // Remove hidden alternatives before framing the real visible geometry.
      const hidden = [];
      model.traverse(child => { if (!child.visible) hidden.push(child); });
      for (const child of hidden) child.removeFromParent();
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xe5efff, 0x6c7691, 2.5));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
      keyLight.position.set(2, 4, 3);
      scene.add(keyLight);
      model.rotation.y = -Math.PI / 2 + 0.18;
      scene.add(model);
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);
      const size = box.getSize(new THREE.Vector3());
      const halfHeight = Math.max(size.y * 0.7, size.x * 0.34, 0.16);
      const camera = new THREE.OrthographicCamera(-halfHeight * 2, halfHeight * 2, halfHeight, -halfHeight, 0.01, 20);
      camera.position.set(0, 0.4, 3);
      camera.lookAt(0, 0, 0);
      window.weaponCapture.render(scene, camera);
      // Keep the source objects alive through the screenshot, then release.
      window.disposeWeaponCapture?.();
      window.disposeWeaponCapture = () => scene.traverse(child => {
        child.geometry?.dispose();
        if (child.material) child.material.dispose();
      });
    }, key);
    await page.locator('#weapon-capture').screenshot({ path: `output/playwright/weapons/${key}.png`, omitBackground: true });
  }
  console.log('Captured', keys.length, 'weapon images from actual models');
}
