export const PERFORMANCE_PRESETS = Object.freeze({
  high: Object.freeze({ shadows: true, outline: true, bloom: true,
    postprocess: true, antialias: true, particles: true, fpsLimit: 60 }),
  medium: Object.freeze({ shadows: true, outline: true, bloom: false,
    postprocess: false, antialias: true, particles: true, fpsLimit: 60 }),
  low: Object.freeze({ shadows: false, outline: false, bloom: false,
    postprocess: false, antialias: false, particles: false, fpsLimit: 30 }),
});

export const clampPixelRatio = value => Math.max(.5, Math.min(1.5, Number(value) || 1));
export const chooseQuality = fps => fps >= 55 ? 'high' : fps >= 40 ? 'medium' : 'low';

export class AdaptivePixelRatio {
  constructor() {
    this.value = 1;
    this.lastChangeAt = 0;
  }

  update(fps, now, fpsLimit = 60) {
    if (fpsLimit === 30 || now - this.lastChangeAt < 1200) return this.value;
    if (fps < 40) this.value = Math.max(.75, this.value - .15);
    else if (fps > 55) this.value = Math.min(1.5, this.value + .05);
    else return this.value;
    this.lastChangeAt = now;
    return this.value;
  }
}

export class FrameStats {
  constructor(size = 180) {
    this.intervals = new Float32Array(size);
    this.count = 0;
    this.cursor = 0;
    this.previousAt = 0;
    this.cpuMs = 0;
    this.frameMs = 0;
  }

  add(now, cpuMs) {
    this.cpuMs = cpuMs;
    if (this.previousAt) {
      const interval = now - this.previousAt;
      if (interval > 250) {
        this.count = 0;
        this.cursor = 0;
        this.previousAt = now;
        return;
      }
      this.frameMs = interval;
      this.intervals[this.cursor] = interval;
      this.cursor = (this.cursor + 1) % this.intervals.length;
      this.count = Math.min(this.count + 1, this.intervals.length);
    }
    this.previousAt = now;
  }

  summary() {
    if (!this.count) return { average: 0, minimum: 0, frameMs: 0, cpuMs: 0 };
    let total = 0;
    let worst = 0;
    for (let index = 0; index < this.count; index++) {
      const interval = this.intervals[index];
      total += interval;
      worst = Math.max(worst, interval);
    }
    return { average: 1000 * this.count / total, minimum: 1000 / worst,
      frameMs: this.frameMs, cpuMs: this.cpuMs };
  }

  recentAverage(samples = 30) {
    const count = Math.min(this.count, samples);
    if (!count) return 0;
    let total = 0;
    for (let index = 0; index < count; index++)
      total += this.intervals[(this.cursor - 1 - index + this.intervals.length) % this.intervals.length];
    return 1000 * count / total;
  }
}
