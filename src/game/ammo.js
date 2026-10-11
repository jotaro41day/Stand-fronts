import { CHARACTER_BALANCE } from '../balance.js';

export const AMMO_CAPACITY = CHARACTER_BALANCE.johnny.ammoCapacity;
export const AMMO_RELOAD_MS = CHARACTER_BALANCE.johnny.reloadMs;

export class AmmoMagazine {
  constructor(stats = CHARACTER_BALANCE.johnny) {
    this.capacity = stats.ammoCapacity;
    this.charges = this.capacity;
    this.nextReloadAt = null;
    this.reloadMs = stats.reloadMs;
  }

  update(now) {
    while (this.nextReloadAt !== null && now >= this.nextReloadAt) {
      this.charges++;
      this.nextReloadAt = this.charges === this.capacity
        ? null
        : this.nextReloadAt + this.reloadMs;
    }
  }

  consume(now) {
    this.update(now);
    if (this.charges === 0) return false;
    this.charges--;
    if (this.nextReloadAt === null) this.nextReloadAt = now + this.reloadMs;
    return true;
  }

  fractions(now, out = Array(this.capacity)) {
    this.update(now);
    const progress = this.nextReloadAt === null
      ? 0
      : 1 - (this.nextReloadAt - now) / this.reloadMs;
    for (let index = 0; index < this.capacity; index++)
      out[index] = index < this.charges ? 1 : index === this.charges ? progress : 0;
    return out;
  }
}
