import { hitsCircleRect } from './rules.js';

function segmentIntersectsBox(from, to, box) {
  let enter = 0;
  let leave = 1;
  for (const axis of ['x', 'y']) {
    const min = box[axis];
    const max = box[axis] + (axis === 'x' ? box.width : box.height);
    const delta = to[axis] - from[axis];
    if (Math.abs(delta) < 1e-9) {
      if (from[axis] < min || from[axis] > max) return false;
      continue;
    }
    const first = (min - from[axis]) / delta;
    const last = (max - from[axis]) / delta;
    enter = Math.max(enter, Math.min(first, last));
    leave = Math.min(leave, Math.max(first, last));
    if (enter > leave) return false;
  }
  return true;
}

function pointSegmentDistanceSquared(point, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0
    ? Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared)) : 0;
  return (point.x - from.x - dx * t) ** 2 + (point.y - from.y - dy * t) ** 2;
}

function crossesBox(from, to, box, padding) {
  if (segmentIntersectsBox(from, to, box)) return true;
  if (padding <= 0) return false;
  const near = point => {
    const x = Math.max(box.x, Math.min(point.x, box.x + box.width));
    const y = Math.max(box.y, Math.min(point.y, box.y + box.height));
    return (point.x - x) ** 2 + (point.y - y) ** 2 <= padding ** 2;
  };
  if (near(from) || near(to)) return true;
  for (const x of [box.x, box.x + box.width]) {
    for (const y of [box.y, box.y + box.height]) {
      if (pointSegmentDistanceSquared({ x, y }, from, to) <= padding ** 2) return true;
    }
  }
  return false;
}

export function lineOfSight(from, to, obstacles, padding = 0) {
  return !obstacles.some(box => crossesBox(from, to, box, padding));
}

export function createNavigationGrid(arena, obstacles, cellSize = 50, radius = 19) {
  const columns = Math.ceil(arena.width / cellSize);
  const rows = Math.ceil(arena.height / cellSize);
  const blocked = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = (column + .5) * cellSize;
      const y = (row + .5) * cellSize;
      blocked[row * columns + column] = Number(x < arena.margin + radius ||
        y < arena.margin + radius || x > arena.width - arena.margin - radius ||
        y > arena.height - arena.margin - radius ||
        obstacles.some(box => hitsCircleRect({ x, y, radius }, box)));
    }
  }
  return { arena, obstacles, cellSize, radius, columns, rows, blocked };
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
    const x = (index % grid.columns + .5) * grid.cellSize;
    const y = (Math.floor(index / grid.columns) + .5) * grid.cellSize;
    const distance = (x - point.x) ** 2 + (y - point.y) ** 2;
    if (distance < bestDistance) { best = index; bestDistance = distance; }
  }
  return best;
}

function center(grid, index) {
  return { x: (index % grid.columns + .5) * grid.cellSize,
    y: (Math.floor(index / grid.columns) + .5) * grid.cellSize };
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
  const heuristic = index => Math.hypot(center(grid, index).x - goalCenter.x,
    center(grid, index).y - goalCenter.y);
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++) {
      if (cost[open[i]] + heuristic(open[i]) < cost[open[best]] + heuristic(open[best])) best = i;
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
    const column = current % grid.columns;
    const row = Math.floor(current / grid.columns);
    for (const [dx, dy] of directions) {
      const nextColumn = column + dx;
      const nextRow = row + dy;
      if (nextColumn < 0 || nextColumn >= grid.columns || nextRow < 0 || nextRow >= grid.rows) continue;
      const next = nextRow * grid.columns + nextColumn;
      if (grid.blocked[next] || closed[next]) continue;
      if (dx && dy && (grid.blocked[row * grid.columns + nextColumn] ||
        grid.blocked[nextRow * grid.columns + column])) continue;
      if (!lineOfSight(center(grid, current), center(grid, next), grid.obstacles, grid.radius)) continue;
      const newCost = cost[current] + Math.hypot(dx, dy) * grid.cellSize;
      if (newCost >= cost[next]) continue;
      cost[next] = newCost;
      parent[next] = current;
      if (!inOpen[next]) { open.push(next); inOpen[next] = 1; }
    }
  }
  return [];
}
