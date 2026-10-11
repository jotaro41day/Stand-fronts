import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createServer } from 'vite';
import { AmmoMagazine } from '../game/ammo.js';
import { VisualGarbageCollector } from '../visual/garbageCollector.js';
import { CHARACTER_BALANCE } from '../balance.js';

const createTestServer = () => createServer({ configFile: false,
  optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true }, appType: 'custom' });

test('shots spend ammo, while cooldown and empty magazine create no projectile', async () => {
  const vite = await createTestServer();
  const { Player } = await vite.ssrLoadModule('/src/entities/player.js');
  try {
    const scene = new THREE.Scene();
    const player = Object.assign(Object.create(Player.prototype), {
      x: 800, y: 500, aim: { x: 1, y: 0 }, nextShot: 0,
      ammo: new AmmoMagazine(), animator: null, standAnimator: null,
    });
    assert.equal(player.shoot(scene, 1000).damage, 1);
    assert.equal(player.ammo.charges, 2);
    assert.equal(player.shoot(scene, 1100), null);
    assert.equal(player.ammo.charges, 2);
    assert.ok(player.shoot(scene, 1240));
    assert.ok(player.shoot(scene, 1480));
    assert.equal(player.ammo.charges, 0);
    assert.equal(player.shoot(scene, 1720), null);
    assert.equal(scene.children.length, 3);
    assert.ok(player.shoot(scene, 2500));
    assert.equal(player.ammo.charges, 0);
  } finally {
    await vite.close();
  }
});

test('Kira throws a bomb using his own ammo, damage, range and slower reload', async () => {
  const vite = await createTestServer();
  const { Player } = await vite.ssrLoadModule('/src/entities/player.js');
  try {
    const scene = new THREE.Scene();
    const collector = new VisualGarbageCollector(scene);
    const kira = Object.assign(Object.create(Player.prototype), {
      x: 800, y: 500, aim: { x: 1, y: 0 }, nextShot: 0,
      characterId: 'kira', stats: CHARACTER_BALANCE.kira,
      ammo: new AmmoMagazine(CHARACTER_BALANCE.kira), animator: null, standAnimator: null,
    });
    const shot = kira.shoot(scene, 1000, collector);
    assert.equal(shot.kind, 'bomb');
    assert.equal(shot.damage, 2);
    assert.equal(shot.visualKind, 'bombProjectile');
    assert.equal(shot.initialLife * shot.vx + 34, CHARACTER_BALANCE.kira.attackRange);
    assert.equal(kira.ammo.charges, 2);
    assert.equal(kira.ammo.nextReloadAt, 3000);
    assert.equal(collector.release('bombProjectile', shot.visual), true);
  } finally { await vite.close(); }
});

test('shot has a bright blue core and a translucent blue trail behind it', async () => {
  const vite = await createTestServer();
  const { Player } = await vite.ssrLoadModule('/src/entities/player.js');
  try {
    const player = Object.assign(Object.create(Player.prototype), {
      x: 800, y: 500, aim: { x: 1, y: 0 }, nextShot: 0,
      ammo: new AmmoMagazine(), animator: null, standAnimator: null,
    });
    const shot = player.shoot(new THREE.Scene(), 1000);
    assert.ok(shot.visual.isGroup);
    const core = shot.visual.children.find(mesh => !mesh.material.transparent);
    const trail = shot.visual.children.find(mesh => mesh.material.transparent && mesh.position.x < 0);
    assert.ok(core.material.color.b > core.material.color.r * 2);
    assert.ok(trail);
    assert.ok(trail.material.color.b > trail.material.color.r * 2);
  } finally {
    await vite.close();
  }
});

test('expired projectile visuals are reused on the next shot', async () => {
  const vite = await createTestServer();
  const { Player } = await vite.ssrLoadModule('/src/entities/player.js');
  try {
    const scene = new THREE.Scene();
    const collector = new VisualGarbageCollector(scene);
    const player = Object.assign(Object.create(Player.prototype), {
      x: 800, y: 500, aim: { x: 1, y: 0 }, nextShot: 0,
      ammo: new AmmoMagazine(), animator: null, standAnimator: null,
    });
    const first = player.shoot(scene, 1000, collector);
    assert.equal(collector.release('projectile', first.visual), true);
    assert.equal(scene.children.length, 0);
    player.aim = { x: 0, y: 1 };
    const second = player.shoot(scene, 1240, collector);
    assert.equal(second.visual, first.visual);
    assert.ok(second.visual.children[2].position.z < 0);
    assert.equal(collector.stats().projectile.active, 1);
  } finally {
    await vite.close();
  }
});
