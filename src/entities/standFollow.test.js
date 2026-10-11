import test from 'node:test';
import assert from 'node:assert/strict';

test('Stand stays behind the player after cardinal direction changes', async () => {
  const module = await import('./standFollow.js').catch(() => ({}));
  assert.equal(typeof module.standPosition, 'function');
  const player = { x: 2, z: 3 };
  const cases = [
    [{ x: 1, y: 0 }, { x: .88, z: 2.52 }],
    [{ x: 0, y: 1 }, { x: 2.48, z: 1.88 }],
    [{ x: -1, y: 0 }, { x: 3.12, z: 3.48 }],
    [{ x: 0, y: -1 }, { x: 1.52, z: 4.12 }],
  ];
  for (const [aim, expected] of cases) {
    const actual = module.standPosition(player, aim);
    assert.ok(Math.abs(actual.x - expected.x) < 1e-10);
    assert.ok(Math.abs(actual.z - expected.z) < 1e-10);
  }
});

test('Stand keeps clear of the ground throughout its hover cycle', async () => {
  const module = await import('./standFollow.js').catch(() => ({}));
  assert.equal(typeof module.standHoverHeight, 'function');
  const heights = [0, 300, 600, 900, 1200, 1500].map(module.standHoverHeight);
  assert.ok(heights.every(height => height > .2));
  assert.ok(Math.max(...heights) - Math.min(...heights) > .08);
});
