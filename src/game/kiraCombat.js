import { findPath, lineOfSight } from './botNavigation.js';
import { hitsCircle, moveAroundObstacles } from './rules.js';
import { ATTACK_START } from './attack.js';

const TANK_PATH_INTERVAL_MS = 300;

export function bombLanding(shot, hit, arena) {
  const point = hit?.type === 'wall'
    ? { x: shot.prevX, y: shot.prevY } : shot;
  return { x: Math.max(0, Math.min(arena.width, point.x)),
    y: Math.max(0, Math.min(arena.height, point.y)) };
}

export function blastTargets(center, team, actors, obstacles, radius) {
  return actors.filter(actor => actor.active && !actor.invulnerable && actor.team !== team &&
    Math.hypot(actor.x - center.x, actor.y - center.y) <= radius + actor.radius &&
    lineOfSight(center, actor, obstacles));
}

export function createTank(owner, now, stats, direction) {
  const length = Math.hypot(direction.x, direction.y) || 1;
  return { ownerId: owner.id, team: owner.team,
    x: owner.x + direction.x / length * ATTACK_START,
    y: owner.y + direction.y / length * ATTACK_START,
    radius: stats.superTankRadius, hp: stats.superTankHealth,
    speed: stats.superTankSpeed, damage: stats.superDamage,
    blastRadius: stats.superBlastRadius,
    expiresAt: now + stats.superTankLifetimeMs,
    nextPathAt: 0, path: [], target: null,
    aim: { x: direction.x / length, y: direction.y / length } };
}

export function stepTank(tank, now, seconds, actors, grid, obstacles) {
  if (now >= tank.expiresAt) return 'expire';
  let closest = Infinity;
  let target = null;
  for (const actor of actors) {
    if (!actor.active || actor.invulnerable || actor.team === tank.team) continue;
    const distance = Math.hypot(actor.x - tank.x, actor.y - tank.y);
    if (distance < closest) { closest = distance; target = actor; }
  }
  tank.target = target;
  if (!target) return null;
  if (closest <= tank.radius + target.radius) return 'hit';
  if (now >= tank.nextPathAt) {
    tank.path = findPath(grid, tank, target);
    tank.nextPathAt = now + TANK_PATH_INTERVAL_MS;
  }
  while (tank.path.length && Math.hypot(tank.path[0].x - tank.x,
    tank.path[0].y - tank.y) < 12) tank.path.shift();
  const waypoint = tank.path[0];
  if (waypoint) {
    const length = Math.hypot(waypoint.x - tank.x, waypoint.y - tank.y) || 1;
    tank.aim = { x: (waypoint.x - tank.x) / length, y: (waypoint.y - tank.y) / length };
    const next = moveAroundObstacles(tank, tank.aim, tank.speed, seconds,
      grid.arena, obstacles, tank.radius);
    tank.x = next.x;
    tank.y = next.y;
  }
  return hitsCircle(tank, target) ? 'hit' : null;
}

export function findTankHit(shot, tanks) {
  return tanks.find(tank => tank.hp > 0 && tank.team !== shot.team && hitsCircle(shot, tank)) ?? null;
}

export function damageTank(tank, damage) {
  tank.hp = Math.max(0, tank.hp - damage);
  return tank.hp === 0;
}
