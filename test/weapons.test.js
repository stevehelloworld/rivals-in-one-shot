const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { sanitizeRelayMessage } = require('../server/protocol');

async function weapons() {
  const url = pathToFileURL(require('node:path').resolve('js/armory.mjs')).href;
  const specs = pathToFileURL(require('node:path').resolve('js/weapon-specs.mjs')).href;
  const source = fs.readFileSync('js/weapons.js', 'utf8').replace("'./armory.mjs'", JSON.stringify(url)).replaceAll("'./weapon-specs.mjs'", JSON.stringify(specs));
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}

test('six new weapon choices preserve slots and have distinct playable stats', async () => {
  const { catalog } = await import('../js/armory.mjs');
  const { createLoadout } = await weapons();
  const choices = catalog.filter(item => item.stats);
  assert.equal(choices.length, 6);
  for (const item of choices) {
    const loadout = createLoadout({ [item.slot]: item.key });
    const gun = loadout[item.slot];
    assert.equal(loadout.length, 5);
    assert.equal(gun.id, item.key);
    assert.equal(gun.ammo, gun.magSize);
    assert.equal(gun.type, 'gun');
    assert.ok(gun.fireRate > 0 && gun.reloadTime > 0 && gun.range > 0);
    assert.ok(Number.isFinite(gun.damage) && gun.damage > 0);
    assert.equal(gun.name, item.name);
    gun.ammo = 0;
    assert.equal(createLoadout({ [item.slot]: item.key })[item.slot].ammo, gun.magSize);
    const packet = sanitizeRelayMessage({ type: 'damage', damage: Math.round(gun.damage * gun.headMult), eventId: 'shot_1', weapon: gun.name, weaponId: gun.id });
    assert.equal(packet.weaponId, gun.id);
    assert.equal(packet.weapon, gun.name);
    const server = fs.readFileSync('server.js', 'utf8');
    const cap = Number(server.match(new RegExp(`\\b${gun.id}: (\\d+)`))[1]);
    assert.ok(packet.damage <= cap, `${gun.id} headshot rejected by server`);
  }
  assert.equal(createLoadout({ 1: 'sniper' })[1].id, 'handgun');
  assert.equal(createLoadout({ 0: 'missing' })[0].id, 'ar');
});

test('shotgun uses six pellets and one shell, legacy unlocks remain compatible', async () => {
  const { createLoadout } = await weapons();
  assert.equal(createLoadout({ 0: 'shotgun' })[0].pellets, 6);
  assert.equal(createLoadout({ 0: 'carbine' })[0].damage, 10);
  assert.equal(createLoadout({ 1: 'sidearm' })[1].reloadTime, 0.75);
});

test('all selectable weapons and skins have shipped model previews', async () => {
  const { armoryItems, defaultItems } = await import('../js/armory.mjs');
  assert.equal(armoryItems.length, 15);
  assert.equal(defaultItems.length, 5);
  for (const item of armoryItems) {
    assert.ok(fs.statSync(item.image).size > 1000, item.key + ' missing preview');
    const png = fs.readFileSync(item.image);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 512);
    assert.equal(png.readUInt32BE(20), 256);
  }
});

test('comparison and scope values are derived from gameplay specs', async () => {
  const { catalog } = await import('../js/armory.mjs');
  const { weaponSpec, comparison } = await import('../js/weapon-specs.mjs');
  const sniper = catalog.find(item => item.key === 'sniper');
  const shotgun = catalog.find(item => item.key === 'shotgun');
  assert.equal(weaponSpec(sniper).zoom, 4);
  assert.equal(weaponSpec(catalog.find(item => item.key === 'marksman')).zoom, 2);
  assert.ok(weaponSpec(sniper).adsSpread < weaponSpec(sniper).spread);
  assert.equal(comparison(shotgun).damage, 48);
  assert.equal(comparison(sniper, sniper).damage, 0);
});
