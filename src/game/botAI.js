import { ATTACK_START, ATTACK_WIDTH } from './attack.js';
import { AmmoMagazine } from './ammo.js';
import { hitsCircleRect, moveAroundObstacles } from './rules.js';
import { ARENA } from '../maps/gemArena.js';
import { findPath, lineOfSight } from './botNavigation.js';
import { statsForActor } from '../balance.js';

export const BOT_DIFFICULTY = 'normal'; // 'easy', 'normal', 'hard'

export const BOT_TUNING = Object.freeze({
  pathIntervalMs: 300,
  lowHealthFraction: .35,
  dangerRadius: 160,
  gemThreatRadius: 250,
  manyGems: 3,
  guardDistance: 90,
  preferredRange: 235,
  strafeDistance: 125,
  coverPadding: 31,
});

export const BOT_WEIGHTS = Object.freeze({
  lowHealthRetreat: 160,
  emptyAmmoRetreat: 140,
  gemCarrierRetreat: 145,
  ownCountdownRetreat: 125,
  enemyCountdownHunt: 130,
  ownCountdownProtect: 110,
  richCarrierHunt: 70,
  supportProtect: 48,
  collect: 45,
  attack: 40,
  roam: 10,
});

export const BOT_PERSONALITIES = Object.freeze({
  'ally-left': { style: 'aggressive', aggression: 1.22, reactionMs: 270, aimErrorDegrees: 8 },
  'ally-right': { style: 'support', aggression: .72, reactionMs: 420, aimErrorDegrees: 11 },
  'enemy-left': { style: 'aggressive', aggression: .98, reactionMs: 360, aimErrorDegrees: 10 },
  'enemy-center': { style: 'balanced', aggression: .9, reactionMs: 390, aimErrorDegrees: 11 },
  'enemy-right': { style: 'aggressive', aggression: .96, reactionMs: 410, aimErrorDegrees: 11 },
});
export const BOT_DIFFICULTY_SETTINGS = Object.freeze({
  easy: { reaction: 1.25, error: 1.5, aggression: .75 },
  normal: { reaction: 1, error: 1, aggression: 1 },
  hard: { reaction: .78, error: .55, aggression: 1.2 },
});

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const toward = (from, to, out = {}) => {
  const length = Math.max(.001, distance(from, to));
  out.x = (to.x - from.x) / length;
  out.y = (to.y - from.y) / length;
  return out;
};
const bounded = (point, arena, radius) => ({
  x: clamp(point.x, arena.margin + radius, arena.width - arena.margin - radius),
  y: clamp(point.y, arena.margin + radius, arena.height - arena.margin - radius),
});

export function botProfile(id, difficulty = BOT_DIFFICULTY) {
  const personality = BOT_PERSONALITIES[id] ?? BOT_PERSONALITIES['enemy-center'];
  const setting = BOT_DIFFICULTY_SETTINGS[difficulty] ?? BOT_DIFFICULTY_SETTINGS.normal;
  return {
    style: personality.style,
    aggression: personality.aggression * setting.aggression,
    reactionMs: clamp(personality.reactionMs * setting.reaction, 200, 500),
    aimError: personality.aimErrorDegrees * setting.error * Math.PI / 180,
  };
}

function coverGoal(bot, enemies, allies, obstacles, arena, preferBase) {
  if (preferBase || enemies.length === 0) return bot.spawn;
  const enemy = enemies.reduce((nearest, candidate) =>
    distance(bot, candidate) < distance(bot, nearest) ? candidate : nearest);
  let best = null;
  let bestCost = Infinity;
  for (const box of obstacles) {
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const dx = center.x - enemy.x;
    const dy = center.y - enemy.y;
    const point = Math.abs(dx) > Math.abs(dy)
      ? { x: dx > 0 ? box.x + box.width + BOT_TUNING.coverPadding : box.x - BOT_TUNING.coverPadding, y: center.y }
      : { x: center.x, y: dy > 0 ? box.y + box.height + BOT_TUNING.coverPadding : box.y - BOT_TUNING.coverPadding };
    const goal = bounded(point, arena, bot.radius);
    if (obstacles.some(other => hitsCircleRect({ ...goal, radius: bot.radius }, other))) continue;
    if (lineOfSight(enemy, goal, obstacles, ATTACK_WIDTH / 2)) continue;
    const cost = distance(bot, goal) + distance(goal, bot.spawn) * .15;
    if (cost < bestCost) { best = goal; bestCost = cost; }
  }
  if (best) return best;
  const safeAlly = allies.filter(ally => ally !== bot && ally.active && distance(enemy, ally) > distance(enemy, bot))
    .sort((a, b) => distance(bot, a) - distance(bot, b))[0];
  return safeAlly ? { x: safeAlly.x, y: safeAlly.y } : bot.spawn;
}

function combatGoal(bot, target, now, arena) {
  const away = toward(target, bot);
  const sign = (bot.id.length + Math.floor(now / 1200)) % 2 ? 1 : -1;
  const range = distance(bot, target);
  const radial = clamp(BOT_TUNING.preferredRange - range, -110, 110);
  return bounded({
    x: bot.x + away.x * radial - away.y * sign * BOT_TUNING.strafeDistance,
    y: bot.y + away.y * radial + away.x * sign * BOT_TUNING.strafeDistance,
  }, arena, bot.radius);
}

function guardGoal(bot, carrier, enemies, arena) {
  const threat = enemies.length ? enemies.reduce((nearest, enemy) =>
    distance(carrier, enemy) < distance(carrier, nearest) ? enemy : nearest) : null;
  const direction = threat ? toward(carrier, threat) : { x: bot.team === 'blue' ? -1 : 1, y: 0 };
  return bounded({ x: carrier.x + direction.x * BOT_TUNING.guardDistance,
    y: carrier.y + direction.y * BOT_TUNING.guardDistance }, arena, bot.radius);
}

function predictedAim(bot, target, profile, now) {
  const stats = bot.stats ?? statsForActor(bot);
  const flight = Math.min((stats.attackRange - ATTACK_START) / stats.projectileSpeed,
    distance(bot, target) / stats.projectileSpeed) * .75;
  const future = { x: target.x + (target.vx ?? 0) * flight,
    y: target.y + (target.vy ?? 0) * flight };
  const direction = toward(bot, future);
  const seed = Array.from(bot.id).reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  const error = Math.sin(now * .013 + seed) * profile.aimError;
  return { future, direction: {
    x: direction.x * Math.cos(error) - direction.y * Math.sin(error),
    y: direction.x * Math.sin(error) + direction.y * Math.cos(error),
  } };
}

export function decideBot(bot, match, obstacles, profile = botProfile(bot.id), arena = ARENA, now = 0) {
  const stats = bot.stats ?? statsForActor(bot);
  const enemies = match.actors.filter(actor => actor.active && !actor.invulnerable &&
    actor.team !== bot.team);
  const allies = match.actors.filter(actor => actor.active && actor.team === bot.team);
  const nearestEnemy = [...enemies].sort((a, b) => distance(bot, a) - distance(bot, b))[0];
  const ownCountdown = match.countdowns[bot.team] !== null;
  const enemyCountdown = match.countdowns[bot.team === 'blue' ? 'red' : 'blue'] !== null;
  const enemyCarrier = [...enemies].sort((a, b) => b.gems - a.gems || distance(bot, a) - distance(bot, b))[0];
  const teamCarrier = [...allies].sort((a, b) => b.gems - a.gems)[0];
  const safeGem = match.gems.filter(gem => !enemies.some(enemy =>
    distance(gem, enemy) < BOT_TUNING.dangerRadius))
    .sort((a, b) => distance(bot, a) - distance(bot, b))[0];
  const visible = enemies.filter(enemy => distance(bot, enemy) <= stats.attackRange &&
    lineOfSight(bot, enemy, obstacles, ATTACK_WIDTH / 2));
  const candidates = [];
  const offer = (state, score, goal, target = null) => candidates.push({ state, score, goal, target });

  if (bot.hp / stats.health < BOT_TUNING.lowHealthFraction) {
    offer('retreat', BOT_WEIGHTS.lowHealthRetreat, coverGoal(bot, enemies, allies, obstacles, arena, false));
  }
  if (bot.ammo?.charges === 0) {
    offer('retreat', BOT_WEIGHTS.emptyAmmoRetreat, coverGoal(bot, enemies, allies, obstacles, arena, false));
  }
  if (bot.gems >= BOT_TUNING.manyGems && nearestEnemy &&
    distance(bot, nearestEnemy) < BOT_TUNING.gemThreatRadius) {
    offer('retreat', BOT_WEIGHTS.gemCarrierRetreat, coverGoal(bot, enemies, allies, obstacles, arena, false));
  }
  if (ownCountdown && bot.gems > 0) {
    offer('retreat', BOT_WEIGHTS.ownCountdownRetreat,
      coverGoal(bot, enemies, allies, obstacles, arena, true));
  }
  if (enemyCountdown && enemyCarrier?.gems > 0) {
    offer('hunt', BOT_WEIGHTS.enemyCountdownHunt, enemyCarrier, enemyCarrier);
  }
  if (ownCountdown && teamCarrier && teamCarrier !== bot) {
    offer('protect', BOT_WEIGHTS.ownCountdownProtect,
      guardGoal(bot, teamCarrier, enemies, arena), teamCarrier);
  }
  if (enemyCarrier?.gems >= BOT_TUNING.manyGems) {
    offer('hunt', BOT_WEIGHTS.richCarrierHunt + enemyCarrier.gems * 2,
      enemyCarrier, enemyCarrier);
  }
  if (profile.style === 'support' && teamCarrier?.gems > 0 && teamCarrier !== bot) {
    offer('protect', BOT_WEIGHTS.supportProtect,
      guardGoal(bot, teamCarrier, enemies, arena), teamCarrier);
  }
  if (safeGem) offer('collect', BOT_WEIGHTS.collect - distance(bot, safeGem) / 1000, safeGem, safeGem);
  if (visible.length && bot.ammo?.charges > 0) {
    const target = [...visible].sort((a, b) => b.gems - a.gems || distance(bot, a) - distance(bot, b))[0];
    offer('attack', BOT_WEIGHTS.attack * profile.aggression,
      combatGoal(bot, target, now, arena), target);
  }
  offer('collect', BOT_WEIGHTS.roam, { x: arena.width / 2,
    y: arena.height / 2 + (bot.team === 'blue' ? 120 : -120) });
  const chosen = candidates.sort((a, b) => b.score - a.score)[0]
    ?? { state: 'collect', goal: { x: arena.width / 2, y: arena.height / 2 }, target: null };

  let fire = null;
  if (chosen.state !== 'retreat' && bot.ammo?.charges > 0) {
    const target = visible.includes(chosen.target) ? chosen.target
      : [...visible].sort((a, b) => b.gems - a.gems || distance(bot, a) - distance(bot, b))[0];
    if (target && distance(bot, target) > ATTACK_START + target.radius / 2) {
      const aim = predictedAim(bot, target, profile, now);
      if (lineOfSight(bot, aim.future, obstacles, ATTACK_WIDTH / 2)) {
        fire = { target, direction: aim.direction };
      }
    }
  }
  return { state: chosen.state, goal: { x: chosen.goal.x, y: chosen.goal.y },
    target: chosen.target, fire };
}

export class BotController {
  constructor(actor, grid, difficulty = BOT_DIFFICULTY) {
    this.actor = actor;
    this.grid = grid;
    this.profile = botProfile(actor.id, difficulty);
    this.nextThinkAt = 0;
    this.nextPathAt = 0;
    this.path = [];
    this.decision = null;
    this.wasActive = actor.active;
    this.nextPosition = { x: 0, y: 0 };
    this.direction = { x: 0, y: 0 };
    this.facing = { x: 0, y: actor.team === 'blue' ? -1 : 1 };
    actor.ammo = new AmmoMagazine(actor.stats ?? statsForActor(actor));
    actor.nextShot = 0;
    actor.aim = { x: 0, y: actor.team === 'blue' ? -1 : 1 };
    actor.vx = 0;
    actor.vy = 0;
  }

  update(now, seconds, match) {
    const actor = this.actor;
    actor.ammo.update(now);
    if (!actor.active || match.phase === 'finished') {
      actor.vx = 0;
      actor.vy = 0;
      this.wasActive = false;
      return null;
    }
    if (!this.wasActive) {
      this.nextThinkAt = 0;
      this.nextPathAt = 0;
      this.path = [];
      this.wasActive = true;
    }
    let fire = null;
    if (this.decision?.target?.invulnerable) this.nextThinkAt = 0;
    if (now >= this.nextThinkAt) {
      this.decision = decideBot(actor, match, this.grid.obstacles, this.profile, this.grid.arena, now);
      this.nextThinkAt = now + this.profile.reactionMs;
      fire = this.decision.fire;
    }
    if (this.decision && now >= this.nextPathAt) {
      this.path = findPath(this.grid, actor, this.decision.goal);
      this.nextPathAt = now + BOT_TUNING.pathIntervalMs;
    }
    while (this.path.length && distance(actor, this.path[0]) < 13) this.path.shift();
    const waypoint = this.path[0];
    const beforeX = actor.x;
    const beforeY = actor.y;
    if (waypoint && seconds > 0) {
      const next = moveAroundObstacles(actor, toward(actor, waypoint, this.direction),
        (actor.stats ?? statsForActor(actor)).moveSpeed, seconds,
        this.grid.arena, this.grid.obstacles, actor.radius, this.nextPosition);
      actor.x = next.x;
      actor.y = next.y;
    }
    actor.vx = seconds > 0 ? (actor.x - beforeX) / seconds : 0;
    actor.vy = seconds > 0 ? (actor.y - beforeY) / seconds : 0;
    if (fire) actor.aim = fire.direction;
    else if (this.decision?.target?.team && this.decision.target.team !== actor.team) {
      actor.aim = toward(actor, this.decision.target, this.facing);
    } else if (Math.hypot(actor.vx, actor.vy) > 1) {
      this.facing.x = actor.vx / Math.hypot(actor.vx, actor.vy);
      this.facing.y = actor.vy / Math.hypot(actor.vx, actor.vy);
      actor.aim = this.facing;
    }
    return fire;
  }
}
