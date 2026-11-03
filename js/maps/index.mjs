import sunset from './sunset.mjs';
import dock from './dock.mjs';
import foundry from './foundry.mjs';
import viaduct from './viaduct.mjs';
import courtyard from './courtyard.mjs';

export const maps = [sunset, dock, foundry, viaduct, courtyard];
export const getMap = id => maps.find(map => map.id === id) ?? sunset;
