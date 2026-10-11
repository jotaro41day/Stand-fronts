import { CHARACTER_BALANCE } from '../balance.js';

export const MOVE_SPEED = CHARACTER_BALANCE.johnny.moveSpeed;

export function movePosition(position, input, speed, seconds, bounds) {
  const length = Math.hypot(input.x, input.y);
  const scale = length > 1 ? 1 / length : 1;
  const margin = bounds.margin ?? 0;
  return {
    x: Math.max(margin, Math.min(bounds.width - margin, position.x + input.x * scale * speed * seconds)),
    y: Math.max(margin, Math.min(bounds.height - margin, position.y + input.y * scale * speed * seconds)),
  };
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

export function moveAroundObstacles(position, input, speed, seconds, bounds, obstacles, radius) {
  const next = movePosition(position, input, speed, seconds, bounds);
  const xOnly = { x: next.x, y: position.y, radius };
  const x = obstacles.some(box => hitsCircleRect(xOnly, box)) ? position.x : next.x;
  const yOnly = { x, y: next.y, radius };
  const y = obstacles.some(box => hitsCircleRect(yOnly, box)) ? position.y : next.y;
  return { x, y };
}
