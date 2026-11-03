// Ground navigation is rebuilt at spawn, never per frame. Four-neighbour paths
// preserve player-radius clearance at corners and leave stairs traversable.
export class ArenaNavigator {
  constructor(colliders) {
    this.width = 61; this.depth = 45;
    this.blocked = new Uint8Array(this.width * this.depth);
    this.height = new Float32Array(this.blocked.length);
    for (let z = -22; z <= 22; z++) for (let x = -30; x <= 30; x++) {
      const index = this.index(x, z);
      const floor = colliders.reduce((height, c) => c.walkableStep && x >= c.min.x && x <= c.max.x && z >= c.min.z && z <= c.max.z ? Math.max(height, c.max.y) : height, 0);
      this.height[index] = floor;
      this.blocked[index] = Number(colliders.some(c => !c.walkableStep && c.min.y < floor + 1.85 && c.max.y > floor + 0.12 && x > c.min.x - 0.45 && x < c.max.x + 0.45 && z > c.min.z - 0.45 && z < c.max.z + 0.45));
    }
  }
  index(x, z) { return (z + 22) * this.width + x + 30; }
  point(index) { return { x: index % this.width - 30, z: Math.floor(index / this.width) - 22 }; }
  free(x, z) { return x >= -30 && x <= 30 && z >= -22 && z <= 22 && !this.blocked[this.index(x, z)]; }
  nearest(point) {
    const x = Math.max(-30, Math.min(30, Math.round(point.x))), z = Math.max(-22, Math.min(22, Math.round(point.z)));
    for (let r = 0; r <= 6; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (this.free(x + dx, z + dz)) return this.index(x + dx, z + dz);
    return -1;
  }
  path(from, to) {
    const start = this.nearest(from), end = this.nearest(to);
    if (start < 0 || end < 0) return [];
    const parents = new Int16Array(this.blocked.length).fill(-1);
    const queue = new Int16Array(this.blocked.length); queue[0] = start; parents[start] = start;
    let head = 0, tail = 1;
    while (head < tail && parents[end] < 0) {
      const current = queue[head++], { x, z } = this.point(current);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!this.free(x + dx, z + dz)) continue;
        const next = this.index(x + dx, z + dz);
        // Do not approach an upper stair or platform through its vertical side.
        // A one-metre cell can span two 0.33m risers, hence the 0.7m bound.
        if (Math.abs(this.height[next] - this.height[current]) > 0.7) continue;
        if (parents[next] >= 0) continue;
        parents[next] = current; queue[tail++] = next;
      }
    }
    if (parents[end] < 0) return [];
    const result = [];
    for (let at = end; at !== start; at = parents[at]) result.push(this.point(at));
    return result.reverse();
  }
  cover(from, enemy, hidden) {
    let best = null, score = Infinity;
    for (let z = -8; z <= 8; z += 2) for (let x = -8; x <= 8; x += 2) {
      const candidate = { x: Math.round(from.x + x), z: Math.round(from.z + z) };
      const distance = Math.hypot(x, z);
      if (distance < 2 || !this.free(candidate.x, candidate.z) || !hidden(candidate)) continue;
      const cost = distance + Math.abs(Math.hypot(candidate.x - enemy.x, candidate.z - enemy.z) - 12) * 0.15;
      if (cost < score) { best = candidate; score = cost; }
    }
    return best;
  }
}
