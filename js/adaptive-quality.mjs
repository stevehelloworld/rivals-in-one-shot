// Five-second windows and asymmetric thresholds prevent quality oscillation.
export class AdaptiveQuality {
  constructor() { this.reset(); }
  reset() {
    this.level = 2;
    this.elapsed = 0;
    this.frames = 0;
    this.goodWindows = 0;
    this.fps = 0;
  }
  sample(dt, active) {
    if (!active || !Number.isFinite(dt) || dt <= 0 || dt > 0.5) {
      this.elapsed = 0;
      this.frames = 0;
      return false;
    }
    this.elapsed += dt;
    this.frames++;
    if (this.elapsed < 5) return false;
    this.fps = this.frames / this.elapsed;
    this.elapsed = 0;
    this.frames = 0;
    const before = this.level;
    if (this.fps < 42) {
      this.level = Math.max(0, this.level - 1);
      this.goodWindows = 0;
    } else if (this.fps > 57) {
      if (++this.goodWindows >= 3) {
        this.level = Math.min(2, this.level + 1);
        this.goodWindows = 0;
      }
    } else this.goodWindows = 0;
    return before !== this.level;
  }
}
