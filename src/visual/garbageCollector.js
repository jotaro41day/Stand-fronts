// Keeps short-lived scene objects out of the JS/WebGL allocation path.
// Factories used here must share their geometry and materials.
export class VisualGarbageCollector {
  constructor(scene, limits = { projectile: 24, bombProjectile: 18, bomb: 18, tank: 6, gem: 32 }) {
    this.scene = scene;
    this.pools = new Map(Object.entries(limits).map(([kind]) => [kind, []]));
    this.active = new Map(Object.entries(limits).map(([kind]) => [kind, new Set()]));
    this.limits = limits;
  }

  acquire(kind, factory) {
    const pool = this.pools.get(kind);
    if (!pool) throw new Error(`Tipo de visual desconhecido: ${kind}`);
    const visual = pool.pop() ?? factory();
    visual.visible = true;
    this.scene.add(visual);
    this.active.get(kind).add(visual);
    return visual;
  }

  release(kind, visual) {
    const active = this.active.get(kind);
    if (!active?.delete(visual)) return false;
    this.scene.remove(visual);
    visual.visible = false;
    const pool = this.pools.get(kind);
    if (pool.length < this.limits[kind]) pool.push(visual);
    return true;
  }

  stats() {
    return Object.fromEntries([...this.pools].map(([kind, pool]) => [kind, {
      active: this.active.get(kind).size,
      cached: pool.length,
      limit: this.limits[kind],
    }]));
  }

  clear() {
    for (const [kind, active] of this.active) {
      for (const visual of [...active]) this.release(kind, visual);
      this.pools.get(kind).length = 0;
    }
  }
}
