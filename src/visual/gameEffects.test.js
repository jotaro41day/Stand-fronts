import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

test('particle effects reuse a bounded pool at every quality level', async () => {
  const { GameEffects, QUALITY } = await import('./gameEffects.js');
  const scene = new THREE.Scene();
  const effects = new GameEffects(scene);
  for (const level of ['high', 'medium', 'low']) {
    effects.setQuality(level);
    for (let i = 0; i < 100; i++) effects.spawnParticle(0, 0, 0, 0x58d6ff, 0, 1, 0);
    assert.ok(effects.activeParticles <= QUALITY[level].maxParticles);
    effects.update(2);
    assert.equal(effects.activeParticles, 0);
  }
  assert.equal(effects.particles.length, QUALITY.high.maxParticles);
});
