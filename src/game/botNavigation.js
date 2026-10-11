import { hitsCircleRect } from './rules.js';

function segmentIntersectsBox(from, to, box) {
  let enter = 0;
  let leave = 1;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) < 1e-9) {
    if (from.x < box.x || from.x > box.x + box.width) return false;
  } else {
    const first = (box.x - from.x) / dx;
    const last = (box.x + box.width - from.x) / dx;
    enter = Math.max(enter, Math.min(first, last));
    leave = Math.min(leave, Math.max(first, last));
    if (enter > leave) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (from.y < box.y || from.y > box.y + box.height) return false;
  } else {
    const first = (box.y - from.y) / dy;
    const last = (box.y + box.height - from.y) / dy;
    enter = Math.max(enter, Math.min(first, last));
    leave = Math.min(leave, Math.max(first, last));
    if (enter > leave) return false;
  }
  return true;
}

function pointSegmentDistanceSquared(x, y, from, to, lengthSquared) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const t = lengthSquared > 0
    ? Math.max(0, Math.min(1, ((x - from.x) * dx + (y - from.y) * dy) / lengthSquared)) : 0;
  return (x - from.x - dx * t) ** 2 + (y - from.y - dy * t) ** 2;
}

function crossesBox(from, to, box, padding) {
  if (segmentIntersectsBox(from, to, box)) return true;
  if (padding <= 0) return false;
  const maxX = box.x + box.width;
  const maxY = box.y + box.height;
  const paddingSquared = padding * padding;
  const fromX = Math.max(box.x, Math.min(from.x, maxX));
  const fromY = Math.max(box.y, Math.min(from.y, maxY));
  if ((from.x - fromX) ** 2 + (from.y - fromY) ** 2 <= paddingSquared) return true;
  const toX = Math.max(box.x, Math.min(to.x, maxX));
  const toY = Math.max(box.y, Math.min(to.y, maxY));
  if ((to.x - toX) ** 2 + (to.y - toY) ** 2 <= paddingSquared) return true;
  const lengthSquared = (to.x - from.x) ** 2 + (to.y - from.y) ** 2;
  return pointSegmentDistanceSquared(box.x, box.y, from, to, lengthSquared) <= paddingSquared ||
    pointSegmentDistanceSquared(box.x, maxY, from, to, lengthSquared) <= paddingSquared ||
    pointSegmentDistanceSquared(maxX, box.y, from, to, lengthSquared) <= paddingSquared ||
    pointSegmentDistanceSquared(maxX, maxY, from, to, lengthSquared) <= paddingSquared;
}

export function lineOfSight(from, to, obstacles, padding = 0) {
  return !obstacles.some(box => crossesBox(from, to, box, padding));
}

export function createNavigationGrid(arena, obstacles, cellSize = 50, radius = 19) {
  const columns = Math.ceil(arena.width / cellSize);
  const rows = Math.ceil(arena.height / cellSize);
  const count = columns * rows;
  const blocked = new Uint8Array(count);
  const centers = Array.from({ length: count }, (_, index) => ({
    x: (index % columns + .5) * cellSize,
    y: (Math.floor(index / columns) + .5) * cellSize,
  }));
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column;
      const { x, y } = centers[index];
      blocked[index] = Number(x < arena.margin + radius ||
        y < arena.margin + radius || x > arena.width - arena.margin - radius ||
        y > arena.height - arena.margin - radius ||
        obstacles.some(box => hitsCircleRect({ x, y, radius }, box)));
    }
  }
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const neighbors = new Int32Array(count * directions.length).fill(-1);
  for (let index = 0; index < count; index++) {
    if (blocked[index]) continue;
    const column = index % columns;
    const row = Math.floor(index / columns);
    for (let direction = 0; direction < directions.length; direction++) {
      const [dx, dy] = directions[direction];
      const nextColumn = column + dx;
      const nextRow = row + dy;
      if (nextColumn < 0 || nextColumn >= columns || nextRow < 0 || nextRow >= rows) continue;
      const next = nextRow * columns + nextColumn;
      if (blocked[next] || (dx && dy && (blocked[row * columns + nextColumn] ||
        blocked[nextRow * columns + column]))) continue;
      if (lineOfSight(centers[index], centers[next], obstacles, radius))
        neighbors[index * directions.length + direction] = next;
    }
  }
  return { arena, obstacles, cellSize, radius, columns, rows, blocked, centers, neighbors };
}

function nearestOpen(grid, point) {
  const column = Math.max(0, Math.min(grid.columns - 1, Math.floor(point.x / grid.cellSize)));
  const row = Math.max(0, Math.min(grid.rows - 1, Math.floor(point.y / grid.cellSize)));
  const start = row * grid.columns + column;
  if (!grid.blocked[start]) return start;
  let best = -1;
  let bestDistance = Infinity;
  for (let index = 0; index < grid.blocked.length; index++) {
    if (grid.blocked[index]) continue;
    const { x, y } = grid.centers[index];
    const distance = (x - point.x) ** 2 + (y - point.y) ** 2;
    if (distance < bestDistance) { best = index; bestDistance = distance; }
  }
  return best;
}

function center(grid, index) {
  return grid.centers[index];
}

export function findPath(grid, from, to) {
  if (lineOfSight(from, to, grid.obstacles, grid.radius)) return [to];
  const start = nearestOpen(grid, from);
  const goal = nearestOpen(grid, to);
  if (start < 0 || goal < 0) return [];
  const count = grid.blocked.length;
  const cost = new Float32Array(count).fill(Infinity);
  const parent = new Int32Array(count).fill(-1);
  const closed = new Uint8Array(count);
  const inOpen = new Uint8Array(count);
  const open = [start];
  cost[start] = 0;
  inOpen[start] = 1;
  const goalCenter = center(grid, goal);
  const heuristic = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    const point = center(grid, index);
    heuristic[index] = Math.hypot(point.x - goalCenter.x, point.y - goalCenter.y);
  }

  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++) {
      if (cost[open[i]] + heuristic[open[i]] < cost[open[best]] + heuristic[open[best]]) best = i;
    }
    const current = open.splice(best, 1)[0];
    inOpen[current] = 0;
    if (current === goal) {
      const cells = [];
      for (let index = goal; index !== start; index = parent[index]) cells.push(center(grid, index));
      cells.reverse();
      if (!grid.blocked[goal] && lineOfSight(cells.at(-1) ?? from, to, grid.obstacles, grid.radius)) cells.push(to);
      const path = [];
      let position = from;
      for (let i = 0; i < cells.length;) {
        let farthest = i;
        for (let j = i; j < cells.length; j++) {
          if (lineOfSight(position, cells[j], grid.obstacles, grid.radius)) farthest = j;
        }
        if (!lineOfSight(position, cells[farthest], grid.obstacles, grid.radius)) return [];
        position = cells[farthest];
        path.push(position);
        i = farthest + 1;
      }
      return path;
    }
    closed[current] = 1;
    for (let direction = 0; direction < 8; direction++) {
      const next = grid.neighbors[current * 8 + direction];
      if (next < 0 || closed[next]) continue;
      const newCost = cost[current] + (direction < 4 ? 1 : Math.SQRT2) * grid.cellSize;
      if (newCost >= cost[next]) continue;
      cost[next] = newCost;
      parent[next] = current;
      if (!inOpen[next]) { open.push(next); inOpen[next] = 1; }
    }
  }
  return [];
}
