import { hitsCircleRect } from './rules.js';

export function nearestFreePoint(point, arena, obstacles, radius) {
  const margin = (arena.margin ?? 0) + radius;
  const clamp = candidate => ({
    x: Math.max(margin, Math.min(arena.width - margin, candidate.x)),
    y: Math.max(margin, Math.min(arena.height - margin, candidate.y)),
  });
  const free = candidate => !obstacles.some(box => hitsCircleRect({ ...candidate, radius }, box));
  const center = clamp(point);
  if (free(center)) return center;
  const step = Math.max(radius * 1.5, 12);
  const maxRing = Math.ceil(Math.hypot(arena.width, arena.height) / step);
  for (let ring = 1; ring <= maxRing; ring++) {
    const distance = ring * step;
    const count = Math.max(12, Math.ceil(2 * Math.PI * ring * 3));
    for (let i = 0; i < count; i++) {
      const angle = i * 2 * Math.PI / count;
      const candidate = clamp({ x: point.x + Math.cos(angle) * distance,
        y: point.y + Math.sin(angle) * distance });
      if (free(candidate)) return candidate;
    }
  }
  return null;
}

export function tuskStrikeTarget(origin, direction, targets, range) {
  const length = Math.hypot(direction.x, direction.y) || 1;
  let closest = null;
  let bestDistance = range;
  for (const target of targets) {
    if (!target.active || target.invulnerable) continue;
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const distance = Math.hypot(dx, dy);
    if (distance > bestDistance || distance < .001) continue;
    if ((dx * direction.x + dy * direction.y) / (distance * length) < .7) continue;
    closest = target;
    bestDistance = distance;
  }
  return closest;
}

export class WormholeSuper {
  constructor(stats) {
    this.stats = stats;
    this.charge = 0;
    this.hole = null;
    this.enterAt = null;
    this.enterFrom = null;
    this.insideAt = null;
  }

  get ready() { return this.charge >= this.stats.superChargeMax; }
  get pulling() { return this.enterAt !== null; }
  get inside() { return this.insideAt !== null; }
  get invulnerable() { return this.pulling || this.inside; }

  chargeHit() {
    this.charge = Math.min(this.stats.superChargeMax,
      this.charge + this.stats.superChargePerHit);
  }

  spend() {
    if (!this.ready || this.invulnerable) return false;
    this.charge = 0;
    this.hole = null;
    return true;
  }

  open(position, now, arena, obstacles, radius) {
    const safe = nearestFreePoint(position, arena, obstacles, radius);
    if (!safe) return false;
    this.hole = { position: safe, openedAt: now,
      expiresAt: now + this.stats.superHoleDurationMs };
    return true;
  }

  beginEnter(now, from) {
    if (!this.hole || now >= this.hole.expiresAt || this.invulnerable) return false;
    this.enterAt = now;
    this.enterFrom = { ...from };
    return true;
  }

  pullPosition(now) {
    if (!this.pulling || !this.hole) return null;
    const t = Math.max(0, Math.min(1, (now - this.enterAt) / this.stats.superPullMs));
    const eased = t * t * (3 - 2 * t);
    return { x: this.enterFrom.x + (this.hole.position.x - this.enterFrom.x) * eased,
      y: this.enterFrom.y + (this.hole.position.y - this.enterFrom.y) * eased };
  }

  exit(arena, obstacles, radius) {
    if (!this.invulnerable || !this.hole) return null;
    const position = nearestFreePoint(this.hole.position, arena, obstacles, radius);
    this.enterAt = null;
    this.enterFrom = null;
    this.insideAt = null;
    this.hole = null;
    return { type: 'exit', position };
  }

  update(now, arena, obstacles, radius) {
    if (!this.hole) return null;
    if (this.invulnerable && now >= this.hole.expiresAt)
      return this.exit(arena, obstacles, radius);
    if (this.pulling && now - this.enterAt >= this.stats.superPullMs) {
      this.enterAt = null;
      this.enterFrom = null;
      this.insideAt = now;
      return { type: 'entered', position: { ...this.hole.position } };
    }
    if (this.inside && now - this.insideAt >= this.stats.superInsideMs)
      return this.exit(arena, obstacles, radius);
    if (now >= this.hole.expiresAt) this.hole = null;
    return null;
  }
}
