import { CHARACTER_BALANCE } from '../balance.js';

export const MOVE_SPEED = CHARACTER_BALANCE.johnny.moveSpeed;

export function movePosition(position, input, speed, seconds, bounds, out = {}) {
  const length = Math.hypot(input.x, input.y);
  const scale = length > 1 ? 1 / length : 1;
  const margin = bounds.margin ?? 0;
  out.x = Math.max(margin, Math.min(bounds.width - margin, position.x + input.x * scale * speed * seconds));
  out.y = Math.max(margin, Math.min(bounds.height - margin, position.y + input.y * scale * speed * seconds));
  return out;
}

export function shotVelocity(direction, speed) {
  const length = Math.hypot(direction.x, direction.y);
  if (length < 0.001) return { x: speed, y: 0 };
  return { x: direction.x / length * speed, y: direction.y / length * speed };
}

export function hitsCircle(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) <= a.radius + b.radius;
}

export function hitsCircleRect(circle, rect) {
  const nearX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const nearY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
  return Math.hypot(circle.x - nearX, circle.y - nearY) <= circle.radius;
}

function hitsCircleRectAt(x, y, radius, rect) {
  const nearX = Math.max(rect.x, Math.min(x, rect.x + rect.width));
  const nearY = Math.max(rect.y, Math.min(y, rect.y + rect.height));
  return Math.hypot(x - nearX, y - nearY) <= radius;
}

export function moveAroundObstacles(position, input, speed, seconds, bounds, obstacles, radius, out = {}) {
  movePosition(position, input, speed, seconds, bounds, out);
  let x = out.x;
  for (const box of obstacles) {
    if (hitsCircleRectAt(x, position.y, radius, box)) { x = position.x; break; }
  }
  let y = out.y;
  for (const box of obstacles) {
    if (hitsCircleRectAt(x, y, radius, box)) { y = position.y; break; }
  }
  out.x = x;
  out.y = y;
  return out;
}
