export const WEAPONS = [
  {
    id: 'ar',
    name: 'ASSAULT RIFLE',
    short: 'AR',
    type: 'gun',
    damage: 12,
    headMult: 1.25,
    fireRate: 0.1, // seconds between shots
    magSize: 20,
    reserve: 999,
    reloadTime: 1.55,
    auto: true,
    spread: 0.012,
    adsSpread: 0.005,
    range: 120,
    recoil: 0.012,
  },
  {
    id: 'handgun',
    name: 'HANDGUN',
    short: 'HG',
    type: 'gun',
    damage: 18,
    headMult: 1.5,
    fireRate: 0.18,
    magSize: 12,
    reserve: 999,
    reloadTime: 1.2,
    auto: false,
    spread: 0.018,
    adsSpread: 0.008,
    range: 90,
    recoil: 0.02,
  },
  {
    id: 'fists',
    name: 'FISTS',
    short: 'FIST',
    type: 'melee',
    damage: 30,
    headMult: 1,
    fireRate: 0.38,
    magSize: 0,
    reserve: 0,
    reloadTime: 0,
    auto: false,
    range: 2.8,
    // RIVALS signature: fists grant air double-jump
    doubleJump: true,
  },
  {
    id: 'grenade',
    name: 'GRENADE',
    short: 'NADE',
    type: 'utility',
    damage: 75,
    splash: 6.5,
    fireRate: 0.5,
    magSize: 1,
    reserve: 0,
    reloadTime: 0,
    cooldown: 12, // seconds to recharge (simplified vs 30s)
    auto: false,
    throwSpeed: 22,
  },
  {
    id: 'rpg',
    name: 'RPG',
    short: 'RPG',
    type: 'launcher',
    damage: 100,
    splash: 7,
    fireRate: 0.85,
    magSize: 1,
    reserve: 999,
    reloadTime: 2.35,
    auto: false,
    projectileSpeed: 32,
    fuse: 4,
    recoil: 0.05,
  },
];

export function weaponSpec(item) {
  const base = WEAPONS[item?.slot];
  if (!base) return null;
  const variant = item && !item.isDefault && item.key !== base.id;
  const spec = variant ? { ...base, ...(item.stats || { damage: item.damage, reloadTime: item.reloadTime }), name: item.name, short: item.short } : { ...base };
  spec.adsSpread = (spec.spread || 0) * (spec.id === 'shotgun' ? 0.8 : 0.35);
  spec.zoom = spec.id === 'sniper' ? 4 : spec.id === 'marksman' ? 2 : spec.type === 'gun' ? 1.35 : spec.type === 'launcher' ? 1.2 : 1;
  return spec;
}
export function comparison(item, equipped) {
  const a = weaponSpec(item), b = weaponSpec(equipped || { slot: item.slot, isDefault: true });
  if (!a || !b) return null;
  const total = w => w.damage * (w.pellets || 1);
  return { damage: total(a) - total(b), magazine: a.magSize - b.magSize, reload: Number((a.reloadTime - b.reloadTime).toFixed(2)) };
}
