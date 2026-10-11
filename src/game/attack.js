import { CHARACTER_BALANCE } from '../balance.js';

export const ATTACK_SPEED = CHARACTER_BALANCE.johnny.projectileSpeed;
export const ATTACK_START = 34;
export const ATTACK_RANGE = CHARACTER_BALANCE.johnny.attackRange;
export const ATTACK_LIFE = (ATTACK_RANGE - ATTACK_START) / ATTACK_SPEED;
export const ATTACK_WIDTH = 16;

export function advanceShot(shot, seconds) {
  const travel = Math.max(0, Math.min(seconds, shot.life));
  shot.x += shot.vx * travel;
  shot.y += shot.vy * travel;
  shot.life = Math.max(0, shot.life - seconds);
}

export function autoAimDirection(player, targets, range = ATTACK_RANGE) {
  let nearest = range * range;
  let direction = null;
  for (const target of targets) {
    if (!target.active) continue;
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const distance = dx * dx + dy * dy;
    if (distance < .001 || distance > nearest) continue;
    nearest = distance;
    const length = Math.sqrt(distance);
    direction = { x: dx / length, y: dy / length };
  }
  return direction;
}
