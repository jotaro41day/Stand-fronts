import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const createTestServer = () => createServer({ configFile: false,
  optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true }, appType: 'custom' });

test('Pique-Gema game entry loads with the existing Three.js controls and combat modules', async () => {
  const vite = await createTestServer();
  try {
    const module = await vite.ssrLoadModule('/src/game/GemGame.js').catch(() => ({}));
    assert.equal(typeof module.GemGame, 'function');
  } finally {
    await vite.close();
  }
});

test('a Johnny shot creates visual recoil without requiring aim on the match actor', async () => {
  const vite = await createTestServer();
  try {
    const { GemGame } = await vite.ssrLoadModule('/src/game/GemGame.js');
    const game = Object.create(GemGame.prototype);
    const state = { recoilAt: 0, recoilX: 0, recoilZ: 0 };
    game.characterFx = new Map([['johnny', state]]);
    game.effects = { burst() {} };
    game.onShot({ id: 'johnny' }, { x: 800, y: 500, vx: 610, vy: 0 }, 100);
    assert.equal(state.recoilX, -.13);
    assert.equal(state.recoilAt, 100);
  } finally {
    await vite.close();
  }
});

test('medium and low quality render the scene directly while high quality uses bloom', async () => {
  const vite = await createTestServer();
  try {
    const { GemGame } = await vite.ssrLoadModule('/src/game/GemGame.js');
    const game = Object.create(GemGame.prototype);
    const calls = [];
    game.renderer = { render: () => calls.push('direct') };
    game.composer = { render: () => calls.push('bloom') };
    game.scene = {};
    game.camera = {};
    for (const quality of ['medium', 'low', 'high']) {
      game.renderQuality = quality;
      game.renderScene();
    }
    assert.deepEqual(calls, ['direct', 'direct', 'bloom']);
  } finally {
    await vite.close();
  }
});
