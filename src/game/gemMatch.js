import { hitsCircle, hitsCircleRect } from './rules.js';
import { ACTOR_CHARACTER, CHARACTER_BALANCE, statsForActor } from '../balance.js';

export const GEM_RULES = Object.freeze({
  matchTime: 180_000,
  gemInterval: 7_000,
  targetGems: 10,
  countdownTime: 15_000,
  respawnTime: 3_000,
  health: CHARACTER_BALANCE.johnny.health,
  gemLandingTime: 500,
});

export function findShotHit(shot, actors, obstacles) {
  if (obstacles.some(box => hitsCircleRect(shot, box))) return { type: 'wall' };
  const actor = actors.find(target => target.active && !target.invulnerable &&
    target.team !== shot.team && hitsCircle(shot, target));
  return actor ? { type: 'actor', actor } : null;
}

const starts = [
  { id: 'johnny', team: 'blue', x: 800, y: 850, spawn: { x: 800, y: 850 } },
  { id: 'ally-left', team: 'blue', x: 800, y: 560, spawn: { x: 665, y: 850 } },
  { id: 'ally-right', team: 'blue', x: 1180, y: 610, spawn: { x: 935, y: 850 } },
  { id: 'enemy-left', team: 'red', x: 420, y: 390, spawn: { x: 665, y: 150 } },
  { id: 'enemy-center', team: 'red', x: 800, y: 450, spawn: { x: 800, y: 150 } },
  { id: 'enemy-right', team: 'red', x: 1180, y: 390, spawn: { x: 935, y: 150 } },
];

export class GemMatch {
  constructor(startAt = 0, playerCharacter = 'johnny', roster = {}) {
    this.startAt = startAt;
    this.nextGemAt = startAt + GEM_RULES.gemInterval;
    this.actors = starts.map(actor => {
      const characterId = roster[actor.id] ?? (actor.id === 'johnny' || actor.id === 'enemy-right'
        ? playerCharacter : ACTOR_CHARACTER[actor.id]);
      const stats = statsForActor({ id: actor.id, characterId });
      return { ...actor, spawn: { ...actor.spawn }, radius: 19,
        characterId, stats,
        hp: stats.health, gems: 0, active: true, respawnAt: null };
    });
    this.gems = [];
    this.nextGemId = 0;
    this.countdowns = { blue: null, red: null };
    this.phase = 'playing';
    this.winner = null;
  }

  get scores() {
    return {
      blue: this.actors.filter(actor => actor.team === 'blue').reduce((sum, actor) => sum + actor.gems, 0),
      red: this.actors.filter(actor => actor.team === 'red').reduce((sum, actor) => sum + actor.gems, 0),
    };
  }

  spawnGem(now) {
    const index = this.nextGemId++;
    const angle = index * 2.3999632297;
    const distance = 34 + index % 4 * 14;
    const gem = { id: index, x: 800 + Math.cos(angle) * distance,
      y: 500 + Math.sin(angle) * distance, radius: 16, bornAt: now };
    this.gems.push(gem);
    return gem;
  }

  collect(actor, gem, now) {
    if (!actor.active || actor.invulnerable || this.phase === 'finished' ||
        now < gem.bornAt + GEM_RULES.gemLandingTime) return false;
    const index = this.gems.indexOf(gem);
    if (index < 0) return false;
    this.gems.splice(index, 1);
    actor.gems++;
    this.checkVictory(now);
    return true;
  }

  damage(actor, amount, now) {
    if (!actor.active || actor.invulnerable || this.phase === 'finished') return false;
    actor.hp = Math.max(0, actor.hp - amount);
    if (actor.hp > 0) return false;
    actor.active = false;
    actor.respawnAt = now + GEM_RULES.respawnTime;
    const count = actor.gems;
    actor.gems = 0;
    for (let i = 0; i < count; i++) {
      const angle = i * 2.3999632297;
      this.gems.push({ id: this.nextGemId++, x: actor.x + Math.cos(angle) * (12 + i % 3 * 7),
        y: actor.y + Math.sin(angle) * (12 + i % 3 * 7), radius: 16,
        bornAt: now - GEM_RULES.gemLandingTime });
    }
    this.checkVictory(now);
    return true;
  }

  checkVictory(now) {
    if (this.phase === 'finished') return;
    const scores = this.scores;
    if (this.phase === 'suddenDeath' && scores.blue !== scores.red) {
      this.finish(scores.blue > scores.red ? 'blue' : 'red');
      return;
    }
    for (const team of ['blue', 'red']) {
      if (scores[team] < GEM_RULES.targetGems) this.countdowns[team] = null;
      else {
        this.countdowns[team] ??= now + GEM_RULES.countdownTime;
        if (now >= this.countdowns[team]) {
          this.finish(team);
          return;
        }
      }
    }
  }

  finish(team) {
    this.phase = 'finished';
    this.winner = team;
  }

  update(now) {
    if (this.phase === 'finished') return;
    const stepAt = this.phase === 'playing'
      ? Math.min(now, this.startAt + GEM_RULES.matchTime) : now;
    for (const actor of this.actors) {
      if (!actor.active && stepAt >= actor.respawnAt) {
        actor.active = true;
        actor.hp = actor.stats.health;
        actor.gems = 0;
        actor.x = actor.spawn.x;
        actor.y = actor.spawn.y;
        actor.respawnAt = null;
      }
    }
    while (stepAt >= this.nextGemAt) {
      this.spawnGem(this.nextGemAt);
      this.nextGemAt += GEM_RULES.gemInterval;
    }
    for (const gem of [...this.gems]) {
      if (stepAt < gem.bornAt + GEM_RULES.gemLandingTime) continue;
      const collector = this.actors.find(actor => actor.active && !actor.invulnerable &&
        Math.hypot(actor.x - gem.x, actor.y - gem.y) <= actor.radius + gem.radius);
      if (collector) this.collect(collector, gem, stepAt);
    }
    this.checkVictory(stepAt);
    if (this.phase === 'playing' && now >= this.startAt + GEM_RULES.matchTime) {
      const scores = this.scores;
      if (scores.blue === scores.red) {
        this.phase = 'suddenDeath';
        if (this.nextGemAt < now) this.nextGemAt = now + GEM_RULES.gemInterval;
      }
      else this.finish(scores.blue > scores.red ? 'blue' : 'red');
    }
  }
}
