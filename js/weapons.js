import { catalog } from './armory.mjs';
import { WEAPONS, weaponSpec } from './weapon-specs.mjs';
export { WEAPONS } from './weapon-specs.mjs';

export function createLoadout(equipped = {}) {
  return WEAPONS.map((base, slot) => {
    const variant = catalog.find(item => item.slot === slot && item.key === equipped[slot]);
    const w = weaponSpec(variant || { slot, isDefault: true });
    return { ...w, ammo: w.magSize, cd: 0, reloading: false, reloadT: 0, lastShot: -999 };
  });
}
