import test from 'node:test';
import assert from 'node:assert/strict';
import { blastTargets, bombLanding, createTank, damageTank, findTankHit,
  stepTank } from './kiraCombat.js';
import { createNavigationGrid } from './botNavigation.js';

const arena = { width: 500, height: 500, margin: 20 };
const wall = { x: 240, y: 150, width: 30, height: 200 };
const stats = { superTankLifetimeMs: 5000, superTankSpeed: 190,
  superTankHealth: 3, superTankRadius: 14 };

test('a thrown bomb lands before a wall and its blast respects cover and teams', () => {
  const landing = bombLanding({ x: 245, y: 250, prevX: 225, prevY: 250 },
    { type: 'wall' }, arena);
  assert.deepEqual(landing, { x: 225, y: 250 });
  const actors = [
    { id: 'near', x: 210, y: 250, radius: 19, team: 'red', active: true },
    { id: 'covered', x: 280, y: 250, radius: 19, team: 'red', active: true },
    { id: 'ally', x: 210, y: 260, radius: 19, team: 'blue', active: true },
  ];
  assert.deepEqual(blastTargets(landing, 'blue', actors, [wall], 90).map(actor => actor.id), ['near']);
});

test('Sheer Heart Attack chases an enemy, ignores protected targets and expires at five seconds', () => {
  const tank = createTank({ id: 'kira', x: 80, y: 250, team: 'blue' }, 100, stats,
    { x: 1, y: 0 });
  const grid = createNavigationGrid(arena, [], 50, stats.superTankRadius);
  const protectedEnemy = { x: 100, y: 250, radius: 19, team: 'red', active: true, invulnerable: true };
  const enemy = { x: 300, y: 250, radius: 19, team: 'red', active: true };
  const first = stepTank(tank, 200, .1, [protectedEnemy, enemy], grid, []);
  assert.equal(first, null);
  assert.ok(tank.x > 80);
  assert.equal(tank.target, enemy);
  assert.equal(stepTank(tank, 5100, .1, [protectedEnemy, enemy], grid, []), 'expire');
});

test('enemy shots destroy the tank in a few hits; allied shots do not touch it', () => {
  const tank = createTank({ id: 'kira', x: 80, y: 250, team: 'blue' }, 0, stats,
    { x: 1, y: 0 });
  const shot = { x: tank.x, y: tank.y, radius: 8, team: 'red' };
  assert.equal(findTankHit(shot, [tank]), tank);
  assert.equal(findTankHit({ ...shot, team: 'blue' }, [tank]), null);
  assert.equal(damageTank(tank, 1), false);
  assert.equal(damageTank(tank, 2), true);
  assert.equal(tank.hp, 0);
});
