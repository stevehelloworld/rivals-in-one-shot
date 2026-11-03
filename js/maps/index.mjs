import sunset from './sunset.mjs';
import dock from './dock.mjs';
import foundry from './foundry.mjs';
import viaduct from './viaduct.mjs';
import courtyard from './courtyard.mjs';
import range from './range.mjs';

export const maps = [sunset, dock, foundry, viaduct, courtyard];
export const arenaLayouts = [...maps, range];
export const getMap = id => arenaLayouts.find(map => map.id === id) ?? sunset;
