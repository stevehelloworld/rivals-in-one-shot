/** Default RIVALS loadout — simplified but same roles & feel */

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
];

export function createLoadout() {
  return WEAPONS.map((w) => ({
    ...w,
    ammo: w.magSize,
    cd: 0, // grenade cooldown remaining
    reloading: false,
    reloadT: 0,
    lastShot: -999,
  }));
}
