const lerp = (a, b, t) => a + (b - a) * t;
const position = (newer, older, amount) => older
  ? { ...newer, x: lerp(older.x, newer.x, amount),
    y: lerp(older.y, newer.y, amount) } : newer;

export class SnapshotBuffer {
  constructor(delayMs = 100) {
    this.delayMs = delayMs;
    this.items = [];
  }

  push(snapshot, receivedAt) {
    if (this.items.length && snapshot.sequence <= this.items.at(-1).snapshot.sequence) return false;
    this.items.push({ snapshot, receivedAt });
    if (this.items.length > 6) this.items.shift();
    return true;
  }

  latest() { return this.items.at(-1)?.snapshot ?? null; }

  sample(now) {
    if (!this.items.length) return null;
    const target = now - this.delayMs;
    let left = this.items[0];
    let right = left;
    for (const item of this.items) {
      if (item.receivedAt <= target) left = item;
      if (item.receivedAt >= target) { right = item; break; }
      right = item;
    }
    if (left === right) return left.snapshot;
    const amount = Math.max(0, Math.min(1,
      (target - left.receivedAt) / (right.receivedAt - left.receivedAt)));
    const previous = left.snapshot;
    const current = right.snapshot;
    const byId = (list, id) => new Map(list.map(item => [item[id], item]));
    const oldActors = byId(previous.actors, 'id');
    const oldShots = byId(previous.projectiles, 'id');
    const oldTanks = byId(previous.tanks, 'id');
    return { ...current,
      actors: current.actors.map(actor => position(actor, oldActors.get(actor.id), amount)),
      projectiles: current.projectiles.map(shot => position(shot, oldShots.get(shot.id), amount)),
      tanks: current.tanks.map(tank => position(tank, oldTanks.get(tank.id), amount)) };
  }
}

export function correctPredictedPosition(predicted, authoritative, secondsSinceSnapshot = 0) {
  const x = authoritative.x + authoritative.vx * Math.min(.12, secondsSinceSnapshot);
  const y = authoritative.y + authoritative.vy * Math.min(.12, secondsSinceSnapshot);
  const distance = Math.hypot(x - predicted.x, y - predicted.y);
  if (distance > 90) return { x, y };
  return { x: predicted.x + (x - predicted.x) * .2,
    y: predicted.y + (y - predicted.y) * .2 };
}
