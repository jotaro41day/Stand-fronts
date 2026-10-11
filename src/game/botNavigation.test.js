import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA, OBSTACLES } from '../maps/gemArena.js';

test('line of sight is blocked by cover but open through the center lane', async () => {
  const { lineOfSight } = await import('./botNavigation.js').catch(() => ({}));
  assert.equal(typeof lineOfSight, 'function');
  assert.equal(lineOfSight({ x: 450, y: 300 }, { x: 620, y: 300 }, OBSTACLES, 8), false);
  assert.equal(lineOfSight({ x: 450, y: 500 }, { x: 620, y: 500 }, OBSTACLES, 8), true);
});

test('A* routes around cover with enough clearance for a fighter', async () => {
  const { createNavigationGrid, findPath, lineOfSight } = await import('./botNavigation.js').catch(() => ({}));
  assert.equal(typeof createNavigationGrid, 'function');
  const grid = createNavigationGrid(ARENA, OBSTACLES, 50, 19);
  const start = { x: 450, y: 300 };
  const goal = { x: 630, y: 300 };
  const path = findPath(grid, start, goal);
  assert.ok(path.length > 1, 'a blocked direct route requires waypoints');
  let previous = start;
  for (const point of path) {
    assert.equal(lineOfSight(previous, point, OBSTACLES, 19), true,
      `waypoint ${JSON.stringify(point)} clips a wall`);
    previous = point;
  }
  assert.ok(Math.hypot(previous.x - goal.x, previous.y - goal.y) < 51);
});

test('paths stay usable near obstacle corners and when a strafe goal lands inside cover', async () => {
  const { createNavigationGrid, findPath, lineOfSight } = await import('./botNavigation.js');
  const grid = createNavigationGrid(ARENA, OBSTACLES, 50, 19);
  for (const [start, goal] of [
    [{ x: 682, y: 334 }, { x: 846, y: 560 }],
    [{ x: 1175, y: 669 }, { x: 1305, y: 625 }],
  ]) {
    const path = findPath(grid, start, goal);
    assert.ok(path.length > 0, `no route from ${JSON.stringify(start)} to ${JSON.stringify(goal)}`);
    let previous = start;
    for (const point of path) {
      assert.equal(lineOfSight(previous, point, OBSTACLES, 19), true);
      previous = point;
    }
  }
});
