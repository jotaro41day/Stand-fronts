import test from 'node:test';
import assert from 'node:assert/strict';

test('quick attack selects the nearest active target within the shot reach', async () => {
  const module = await import('./attack.js').catch(() => ({}));
  assert.equal(typeof module.autoAimDirection, 'function');
  const player = { x: 100, y: 100 };
  const targets = [
    { x: 320, y: 100, active: true },
    { x: 130, y: 140, active: false },
    { x: 100, y: 180, active: true },
  ];
  assert.deepEqual(module.autoAimDirection(player, targets), { x: 0, y: 1 });
  assert.equal(module.autoAimDirection(player, [{ x: 900, y: 100, active: true }]), null);
});

test('Johnny reaches about 20% less distance and auto aim respects the new edge', async () => {
  const { ATTACK_RANGE, autoAimDirection } = await import('./attack.js');
  assert.ok(ATTACK_RANGE > 440 && ATTACK_RANGE < 445);
  const player = { x: 0, y: 0 };
  assert.deepEqual(autoAimDirection(player, [{ x: 440, y: 0, active: true }]), { x: 1, y: 0 });
  assert.equal(autoAimDirection(player, [{ x: 450, y: 0, active: true }]), null);
});

test('a projectile never travels beyond its remaining lifetime', async () => {
  const { advanceShot } = await import('./attack.js');
  assert.equal(typeof advanceShot, 'function');
  const shot = { x: 34, y: 0, vx: 610, vy: 0, life: .02 };
  advanceShot(shot, .04);
  assert.ok(Math.abs(shot.x - 46.2) < .001);
  assert.ok(shot.life <= 0);
});
