import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { VisualGarbageCollector } from './garbageCollector.js';
import { createGemVisual } from './gemVisuals.js';

test('collector detaches and reuses transient visuals without retaining an unbounded cache', () => {
  const scene = new THREE.Scene();
  const collector = new VisualGarbageCollector(scene, { projectile: 2, gem: 1 });
  let created = 0;
  const makeVisual = () => { created++; return new THREE.Group(); };
  const first = collector.acquire('projectile', makeVisual);
  const second = collector.acquire('projectile', makeVisual);
  assert.equal(scene.children.length, 2);
  assert.equal(collector.release('projectile', first), true);
  assert.equal(collector.release('projectile', first), false);
  assert.equal(first.parent, null);
  assert.equal(collector.acquire('projectile', makeVisual), first);
  assert.equal(created, 2);
  collector.release('projectile', first);
  collector.release('projectile', second);
  const third = collector.acquire('projectile', makeVisual);
  const fourth = collector.acquire('projectile', makeVisual);
  const fifth = collector.acquire('projectile', makeVisual);
  collector.release('projectile', third);
  collector.release('projectile', fourth);
  collector.release('projectile', fifth);
  assert.equal(collector.stats().projectile.cached, 2);
  assert.equal(collector.stats().projectile.active, 0);
  assert.equal(scene.children.length, 0);
});

test('gem visuals share their GPU geometry and material', () => {
  const first = createGemVisual();
  const second = createGemVisual();
  assert.equal(first.children[0].geometry, second.children[0].geometry);
  assert.equal(first.children[0].material, second.children[0].material);
  assert.equal(first.children[1].geometry, second.children[1].geometry);
  assert.equal(first.children[1].material, second.children[1].material);
});
