import test from 'node:test';
import assert from 'node:assert/strict';
import { WormholeSuper, nearestFreePoint, tuskStrikeTarget } from './wormhole.js';
import { GemMatch, findShotHit } from './gemMatch.js';
import { hitsCircleRect } from './rules.js';

const stats = { superChargePerHit: 25, superChargeMax: 100, superHoleDurationMs: 6000,
  superPullMs: 400, superInsideMs: 3000 };
const arena = { width: 500, height: 500, margin: 20 };
const obstacles = [{ x: 200, y: 200, width: 100, height: 100 }];
const radius = 19;
const holeRadius = 32;

function charged() {
  const power = new WormholeSuper(stats);
  for (let i = 0; i < 4; i++) power.chargeHit();
  assert.equal(power.spend(), true);
  return power;
}

test('the hole opens outside walls, replaces the previous hole and expires without refund', () => {
  const power = charged();
  assert.equal(power.open({ x: 300, y: 300 }, 100, arena, obstacles, holeRadius), true);
  assert.ok(!obstacles.some(box => hitsCircleRect({ ...power.hole.position,
    radius: holeRadius }, box)));
  power.open({ x: 410, y: 410 }, 200, arena, obstacles, radius);
  assert.deepEqual(power.hole.position, { x: 410, y: 410 });
  power.update(6199, arena, obstacles, radius);
  assert.ok(power.hole);
  power.update(6200, arena, obstacles, radius);
  assert.equal(power.hole, null);
  assert.equal(power.charge, 0);
  assert.equal(power.beginEnter(6201, { x: 100, y: 100 }), false);
});

test('a newly charged super closes the previous hole before its nail flies', () => {
  const power = charged();
  power.open({ x: 410, y: 410 }, 100, arena, obstacles, radius);
  for (let i = 0; i < 4; i++) power.chargeHit();
  assert.equal(power.spend(), true);
  assert.equal(power.hole, null);
});

test('the pull reaches a free hole position, grants immunity, and exits after the inside limit', () => {
  const power = charged();
  power.open({ x: 250, y: 250 }, 100, arena, obstacles, radius);
  const destination = { ...power.hole.position };
  assert.equal(power.beginEnter(200, { x: 100, y: 100 }), true);
  assert.equal(power.invulnerable, true);
  assert.equal(power.inside, false);
  assert.equal(power.update(599, arena, obstacles, radius), null);
  assert.deepEqual(power.update(600, arena, obstacles, radius),
    { type: 'entered', position: destination });
  assert.equal(power.inside, true);
  assert.equal(power.update(3599, arena, obstacles, radius), null);
  assert.deepEqual(power.update(3600, arena, obstacles, radius),
    { type: 'exit', position: destination });
  assert.equal(power.invulnerable, false);
  assert.equal(power.hole, null);
});

test('expiry ejects Johnny early from the safe hole position', () => {
  const power = charged();
  power.open({ x: 250, y: 250 }, 0, arena, obstacles, radius);
  const destination = { ...power.hole.position };
  power.beginEnter(5000, { x: 100, y: 100 });
  power.update(5400, arena, obstacles, radius);
  assert.equal(power.inside, true);
  assert.deepEqual(power.update(6000, arena, obstacles, radius),
    { type: 'exit', position: destination });
  assert.equal(power.hole, null);
});

test('protected Johnny takes no damage and cannot be hit by a projectile', () => {
  const match = new GemMatch(0);
  const johnny = match.actors.find(actor => actor.id === 'johnny');
  johnny.invulnerable = true;
  const health = johnny.hp;
  assert.equal(match.damage(johnny, 2, 100), false);
  assert.equal(johnny.hp, health);
  const shot = { x: johnny.x, y: johnny.y, radius: 8, team: 'red' };
  assert.equal(findShotHit(shot, match.actors, []), null);
});

test('Tusk strike picks only a nearby enemy in the aimed direction', () => {
  const near = { x: 80, y: 0, active: true };
  assert.equal(tuskStrikeTarget({ x: 0, y: 0 }, { x: 1, y: 0 },
    [near, { x: -30, y: 0, active: true }], 110), near);
  assert.equal(tuskStrikeTarget({ x: 0, y: 0 }, { x: 0, y: 1 }, [near], 110), null);
  assert.equal(tuskStrikeTarget({ x: 0, y: 0 }, { x: 1, y: 0 }, [near], 60), null);
});

test('nearest free point respects arena bounds', () => {
  const point = nearestFreePoint({ x: -50, y: 250 }, arena, obstacles, radius);
  assert.ok(point.x >= 39 && point.x <= 461);
  assert.ok(point.y >= 39 && point.y <= 461);
});
