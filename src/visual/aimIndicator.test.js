import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTACK_RANGE, ATTACK_WIDTH } from '../game/attack.js';

test('ground aim band shows the full attack reach and width only while aiming', async () => {
  const module = await import('./aimIndicator.js').catch(() => ({}));
  assert.equal(typeof module.createAimIndicator, 'function');
  assert.equal(typeof module.updateAimIndicator, 'function');
  const band = module.createAimIndicator();
  assert.equal(band.isMesh, true);
  assert.equal(band.material.transparent, true);
  assert.equal(band.material.depthWrite, false);
  assert.equal(band.children.length, 0);
  module.updateAimIndicator(band, { x: 1, z: 2 }, { x: 0, y: -1 });
  assert.equal(band.visible, true);
  assert.ok(Math.abs(band.position.x - 1) < 1e-8);
  assert.ok(Math.abs(band.position.z - (2 - ATTACK_RANGE / 100)) < 1e-8);
  assert.ok(Math.abs(band.scale.x - ATTACK_WIDTH / 50) < 1e-8);
  assert.ok(Math.abs(band.scale.z - ATTACK_RANGE / 50) < 1e-8);
  module.updateAimIndicator(band, { x: 1, z: 2 }, null);
  assert.equal(band.visible, false);
});
