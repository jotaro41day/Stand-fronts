import test from 'node:test';
import assert from 'node:assert/strict';
import { movePosition, shotVelocity, hitsCircle, hitsCircleRect, moveAroundObstacles } from './rules.js';

test('movimento diagonal mantém a mesma velocidade e respeita as bordas', () => {
  const next = movePosition({ x: 50, y: 50 }, { x: 1, y: 1 }, 100, 1, { width: 200, height: 200, margin: 16 });
  assert.ok(Math.abs(Math.hypot(next.x - 50, next.y - 50) - 100) < 0.001);
  assert.deepEqual(movePosition({ x: 190, y: 50 }, { x: 1, y: 0 }, 100, 1, { width: 200, height: 200, margin: 16 }), { x: 184, y: 50 });
});

test('tiro usa a direção indicada, com recuo para a direita quando não há mira', () => {
  assert.deepEqual(shotVelocity({ x: 0, y: -1 }, 500), { x: 0, y: -500 });
  assert.deepEqual(shotVelocity({ x: 0, y: 0 }, 500), { x: 500, y: 0 });
});

test('colisão circular acerta somente alvos ao alcance', () => {
  assert.equal(hitsCircle({ x: 10, y: 10, radius: 4 }, { x: 17, y: 10, radius: 4 }), true);
  assert.equal(hitsCircle({ x: 10, y: 10, radius: 4 }, { x: 19, y: 10, radius: 4 }), false);
});

test('caixas barram o jogador e os projéteis sem impedir movimento lateral', () => {
  const box = { x: 80, y: 80, width: 40, height: 40 };
  assert.equal(hitsCircleRect({ x: 75, y: 100, radius: 6 }, box), true);
  assert.equal(hitsCircleRect({ x: 60, y: 100, radius: 6 }, box), false);
  const next = moveAroundObstacles({ x: 65, y: 70 }, { x: 1, y: 1 }, 100, 0.4,
    { width: 200, height: 200, margin: 10 }, [box], 10);
  assert.ok(next.x <= 70);
  assert.ok(next.y > 70);
});
