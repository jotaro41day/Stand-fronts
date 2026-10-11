import test from 'node:test';
import assert from 'node:assert/strict';
import { hitsCircleRect, moveAroundObstacles } from '../game/rules.js';
import * as THREE from 'three';

test('gem arena has mirrored cover, three routes, and blocks movement and shots', async () => {
  const { ARENA, OBSTACLES } = await import('./gemArena.js').catch(() => ({}));
  assert.ok(ARENA && OBSTACLES);
  assert.ok(OBSTACLES.length >= 8);
  for (const box of OBSTACLES) {
    assert.ok(OBSTACLES.some(other => other.x === ARENA.width - box.x - box.width &&
      other.y === ARENA.height - box.y - box.height &&
      other.width === box.width && other.height === box.height));
  }
  for (const x of [280, 800, 1320]) {
    assert.equal(OBSTACLES.some(box => hitsCircleRect({ x, y: 500, radius: 19 }, box)), false);
  }
  const wall = OBSTACLES.find(box => box.x < 800 && box.y < 500 && box.height > 100);
  assert.ok(wall);
  const shot = { x: wall.x + wall.width / 2, y: wall.y + wall.height / 2, radius: 8 };
  assert.equal(hitsCircleRect(shot, wall), true);
  const blocked = moveAroundObstacles({ x: wall.x - 30, y: shot.y }, { x: 1, y: 0 },
    245, .2, ARENA, OBSTACLES, 19);
  assert.ok(blocked.x < wall.x);
});

test('static cover uses shared instanced meshes and never enters the shadow map', async () => {
  const { createGemArena } = await import('./gemArena.js');
  const scene = new THREE.Scene();
  createGemArena(scene);
  let batches = 0;
  scene.traverse(object => {
    if (object.isInstancedMesh) batches++;
    if (object.isMesh) assert.equal(object.castShadow, false);
  });
  assert.ok(batches >= 5);
});
