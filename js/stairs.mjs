const STEP = 0.4;

export function stairFloor(colliders, x, y, z, radius, skin, descending = false) {
  let best = -Infinity;
  for (const c of colliders) {
    const top = c.max.y + skin;
    if ((!c.walkableStep && !(descending && top <= y + skin)) ||
        top > y + STEP || top < y - STEP ||
        x + radius <= c.min.x || x - radius >= c.max.x ||
        z + radius <= c.min.z || z - radius >= c.max.z) continue;
    best = Math.max(best, top);
  }
  return best;
}
