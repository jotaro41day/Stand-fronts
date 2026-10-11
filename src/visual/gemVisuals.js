import * as THREE from 'three';
import { GEM_RULES } from '../game/gemMatch.js';
import { CHARACTER_BALANCE } from '../balance.js';
import { toWorld } from '../maps/gemArena.js';
import { outlinedMesh } from './toon.js';
import { standHoverHeight, standPosition } from '../entities/standFollow.js';

const gemGeometry = new THREE.OctahedronGeometry(.24);
const gemMaterial = new THREE.MeshBasicMaterial({ color: 0xff85ff, toneMapped: false });
const gemHaloGeometry = new THREE.TorusGeometry(.28, .035, 4, 12);
const gemHaloMaterial = new THREE.MeshBasicMaterial({ color: 0xe56fff, toneMapped: false });
const healthBack = new THREE.PlaneGeometry(.93, .12);
const healthFill = new THREE.PlaneGeometry(.89, .08);

export function createHealthBar(scene, team, height = 2.23) {
  const color = team === 'blue' ? 0x49c5f2 : 0xf1718e;
  const group = new THREE.Group();
  const back = new THREE.Mesh(healthBack, new THREE.MeshBasicMaterial({
    color: 0x251a36, depthTest: false, depthWrite: false,
  }));
  const trail = new THREE.Mesh(healthFill, new THREE.MeshBasicMaterial({
    color: 0xffffff, depthTest: false, depthWrite: false, toneMapped: false,
  }));
  const fill = new THREE.Mesh(healthFill, new THREE.MeshBasicMaterial({
    color, depthTest: false, depthWrite: false, toneMapped: false,
  }));
  trail.position.z = .002;
  fill.position.z = .004;
  back.renderOrder = 90;
  trail.renderOrder = 91;
  fill.renderOrder = 92;
  group.position.y = height;
  group.add(back, trail, fill);
  scene.add(group);
  return { group, fill, trail, fraction: 1, delayed: 1, delay: 0 };
}

export function updateHealthBar(bar, hp, camera, seconds, now, maxHealth = CHARACTER_BALANCE.johnny.health) {
  const fraction = Math.max(0, hp / maxHealth);
  if (fraction < bar.fraction) bar.delay = now + 110;
  if (fraction > bar.delayed) bar.delayed = fraction;
  bar.fraction = fraction;
  if (now >= bar.delay) bar.delayed += (fraction - bar.delayed) * Math.min(1, seconds * 6);
  for (const [mesh, width] of [[bar.fill, fraction], [bar.trail, bar.delayed]]) {
    mesh.scale.x = Math.max(.001, width);
    mesh.position.x = -.89 * (1 - width) / 2;
  }
  bar.group.quaternion.copy(camera.quaternion);
}

export function createFighterVisual(scene, actor) {
  const color = actor.characterId === 'kira' ? 0xb668d9
    : actor.team === 'blue' ? 0x49c5f2 : 0xf1718e;
  const group = new THREE.Group();
  const ring = outlinedMesh(new THREE.CylinderGeometry(.55, .55, .08, 16), color);
  ring.position.y = .05;
  group.add(ring);
  const figure = new THREE.Group();
  const body = outlinedMesh(new THREE.CylinderGeometry(.34, .44, .82, 8), color);
  body.position.y = .63;
  figure.add(body);
  const head = outlinedMesh(new THREE.SphereGeometry(.42, 10, 8), 0xffd3aa);
  head.position.y = 1.35;
  figure.add(head);
  const crest = outlinedMesh(new THREE.ConeGeometry(.2, .48, 6), color);
  crest.position.y = 1.82;
  figure.add(crest);
  group.add(figure);
  const health = createHealthBar(group, actor.team);
  scene.add(group);
  return { group, figure, health, standRoot: null, standUntil: 0 };
}

export async function loadFighterModels(scene, visual, actor) {
  const { loadModelIfPresent } = await import('../models/loadModels.js');
  const heroName = actor.characterId === 'kira' ? 'kira' : 'hero';
  const standName = actor.characterId === 'kira' ? 'killer_queen' : 'stand';
  const [hero, stand] = await Promise.all([
    loadModelIfPresent(heroName, 2.1), loadModelIfPresent(standName, 2.3),
  ]);
  if (hero) {
    visual.figure.visible = false;
    visual.group.add(hero.model);
    visual.animator = hero.animator;
  }
  if (stand) {
    visual.standRoot = stand.model;
    visual.standAnimator = stand.animator;
    scene.add(visual.standRoot);
  }
}

export function updateFighterVisual(visual, actor, camera, seconds = 0, now = 0, dying = false) {
  visual.group.visible = (actor.active && !actor.inside) || dying;
  const at = toWorld(actor.x, actor.y);
  visual.group.position.set(at.x, 0, at.z);
  if (actor.aim) visual.group.rotation.y = -Math.atan2(actor.aim.y, actor.aim.x);
  visual.animator?.update(now, Math.min(1, Math.hypot(actor.vx || 0, actor.vy || 0) /
    actor.stats.moveSpeed), seconds);
  if (visual.standRoot) {
    const stand = standPosition(at, actor.aim ?? { x: 1, y: 0 });
    if (actor.characterId === 'kira') {
      stand.x += (actor.aim?.x ?? 1) * .75;
      stand.z += (actor.aim?.y ?? 0) * .75;
    }
    visual.standRoot.position.set(stand.x, standHoverHeight(now), stand.z);
    visual.standRoot.rotation.y = visual.group.rotation.y;
    visual.standRoot.visible = actor.active && (!actor.inside || now < visual.standUntil) &&
      (actor.characterId !== 'kira' || now < visual.standUntil);
    visual.standAnimator?.update(now, 0, seconds);
  }
  updateHealthBar(visual.health, actor.hp, camera, seconds, now, actor.stats.health);
}

export function createGemVisual(scene) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(gemGeometry, gemMaterial);
  group.add(core);
  const halo = new THREE.Mesh(gemHaloGeometry, gemHaloMaterial);
  halo.rotation.x = Math.PI / 2;
  group.add(halo);
  scene?.add(group);
  return group;
}

export function updateGemVisual(visual, gem, now, launch = null) {
  const jump = Math.min(1, Math.max(0, (now - gem.bornAt) / GEM_RULES.gemLandingTime));
  const at = toWorld(gem.x, gem.y);
  if (launch) {
    const progress = Math.min(1, (now - launch.at) / 420);
    visual.position.set(launch.x + (at.x - launch.x) * progress,
      .34 + Math.sin(progress * Math.PI) * .95, launch.z + (at.z - launch.z) * progress);
  } else {
    visual.position.set(at.x * jump, .34 + Math.sin(jump * Math.PI) * .85,
      at.z * jump);
  }
  visual.position.y += Math.sin(now * .005 + gem.id) * .07;
  visual.rotation.y = now * .0025 + gem.id;
}
