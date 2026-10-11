import test from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotBuffer, correctPredictedPosition } from './prediction.js';

test('other players and projectiles interpolate between ordered snapshots', () => {
  const buffer = new SnapshotBuffer(100);
  const first = { sequence: 1, actors: [{ id: 'ally-left', x: 0, y: 0 }],
    projectiles: [{ id: 4, x: 0, y: 0 }], tanks: [] };
  const second = { sequence: 2, actors: [{ id: 'ally-left', x: 10, y: 20 }],
    projectiles: [{ id: 4, x: 20, y: 0 }], tanks: [] };
  buffer.push(first, 1000);
  buffer.push(second, 1100);
  assert.equal(buffer.push(first, 1200), false);
  const halfway = buffer.sample(1150);
  assert.equal(halfway.actors[0].x, 5);
  assert.equal(halfway.actors[0].y, 10);
  assert.equal(halfway.projectiles[0].x, 10);
});

test('local prediction corrects small drift smoothly and snaps after a respawn', () => {
  assert.deepEqual(correctPredictedPosition({ x: 10, y: 0 },
    { x: 0, y: 0, vx: 0, vy: 0 }), { x: 8, y: 0 });
  assert.deepEqual(correctPredictedPosition({ x: 300, y: 0 },
    { x: 0, y: 0, vx: 0, vy: 0 }), { x: 0, y: 0 });
});
