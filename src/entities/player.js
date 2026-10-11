import * as THREE from 'three';
import { MOVE_SPEED, moveAroundObstacles, shotVelocity } from '../game/rules.js';
import { ATTACK_START, ATTACK_WIDTH } from '../game/attack.js';
import { AmmoMagazine } from '../game/ammo.js';
import { ARENA, OBSTACLES, toWorld } from '../maps/gemArena.js';
import { createFallbackHero, createFallbackStand } from '../models/fallbackModels.js';
import { loadModelIfPresent } from '../models/loadModels.js';
import { standHoverHeight, standPosition } from './standFollow.js';
import { CHARACTER_BALANCE, statsForActor } from '../balance.js';
import { createThrownBombVisual } from '../visual/kiraVisuals.js';

const shotGeometry = new THREE.SphereGeometry(.17, 8, 6);
const shotMaterial = new THREE.MeshBasicMaterial({
  color: new THREE.Color(0x58d6ff).multiplyScalar(1.8), toneMapped: false,
});
const trailMaterial = new THREE.MeshBasicMaterial({
  color: 0x58d6ff, transparent: true, opacity: .45,
  blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
});
const glowMaterial = new THREE.MeshBasicMaterial({
  color: 0x45caff, transparent: true, opacity: .22,
  blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
});

function createShotVisual() {
  const visual = new THREE.Group();
  visual.add(new THREE.Mesh(shotGeometry, shotMaterial));
  const glow = new THREE.Mesh(shotGeometry, glowMaterial);
  glow.scale.setScalar(2.3);
  visual.add(glow);
  const trail = new THREE.Mesh(shotGeometry, trailMaterial);
  trail.scale.set(.6, .6, 2.4);
  visual.add(trail);
  return visual;
}

export class Player {
  constructor(scene, characterId = 'johnny') {
    this.x = 800;
    this.y = 850;
    this.radius = 19;
    this.characterId = characterId;
    this.stats = CHARACTER_BALANCE[characterId] ?? statsForActor('johnny');
    this.aim = { x: 1, y: 0 };
    this.nextShot = 0;
    this.ammo = new AmmoMagazine(this.stats);
    this.motion = 0;
    this.worldPosition = { x: 0, z: 0 };
    this.standPosition = { x: 0, z: 0 };
    this.nextPosition = { x: 0, y: 0 };
    this.animator = null;
    this.standAnimator = null;
    this.modelSources = { hero: 'geométrico', stand: 'geométrico' };
    this.heroRoot = new THREE.Group();
    this.standRoot = new THREE.Group();
    this.hero = createFallbackHero();
    this.stand = createFallbackStand();
    this.heroRoot.add(this.hero);
    this.standRoot.add(this.stand);
    scene.add(this.heroRoot, this.standRoot);
    this.standRoot.position.y = standHoverHeight(0);
    this.syncPosition();
    this.tryLoadModel('hero', characterId === 'kira' ? 'kira' : 'hero', 2.1);
    this.tryLoadModel('stand', characterId === 'kira' ? 'killer_queen' : 'stand', 2.3);
  }

  async tryLoadModel(name, assetName, height) {
    try {
      const loaded = await loadModelIfPresent(assetName, height);
      if (!loaded) return;
      const { model, animator } = loaded;
      const root = name === 'hero' ? this.heroRoot : this.standRoot;
      root.clear();
      root.add(model);
      if (name === 'hero') root.traverse(object => {
        if (object.isMesh && !object.userData.isOutline) object.castShadow = true;
      });
      this[name] = model;
      if (name === 'hero') this.animator = animator;
      else this.standAnimator = animator;
      this.modelSources[name] = 'GLB';
      this.onModelLoaded?.();
    } catch (error) {
      console.warn(`Falha ao carregar ${assetName}.glb; modelo geométrico mantido.`, error);
    }
  }

  syncPosition() {
    const at = toWorld(this.x, this.y, this.worldPosition);
    const stand = standPosition(at, this.aim, this.standPosition);
    if (this.characterId === 'kira') {
      stand.x += this.aim.x * .75;
      stand.z += this.aim.y * .75;
    }
    this.heroRoot.position.set(at.x, 0, at.z);
    this.standRoot.position.x = stand.x;
    this.standRoot.position.z = stand.z;
  }

  move(direction, seconds) {
    const speed = this.stats?.moveSpeed ?? MOVE_SPEED;
    const next = moveAroundObstacles(this, direction, speed, seconds, ARENA, OBSTACLES,
      this.radius, this.nextPosition);
    this.motion = seconds > 0
      ? Math.min(1, Math.hypot(next.x - this.x, next.y - this.y) / (speed * seconds))
      : 0;
    this.x = next.x;
    this.y = next.y;
    this.syncPosition();
    if (Math.hypot(direction.x, direction.y) > .08) this.setAim(direction);
  }

  setAim(direction) {
    const length = Math.hypot(direction.x, direction.y);
    if (length < .001) return;
    this.aim.x = direction.x / length;
    this.aim.y = direction.y / length;
    const angle = -Math.atan2(this.aim.y, this.aim.x);
    this.heroRoot.rotation.y = angle;
    this.standRoot.rotation.y = angle;
    this.syncPosition();
  }

  animate(time, seconds) {
    if (this.animator) {
      this.animator.update(time, this.motion, seconds);
      this.heroRoot.position.y = 0;
    } else {
      this.heroRoot.position.y = this.motion > .05 ? Math.sin(time * .018) * .045 : 0;
    }
    this.standRoot.position.y = standHoverHeight(time);
    this.standAnimator?.update(time, this.motion, seconds);
  }

  shoot(scene, now, collector = null) {
    const stats = this.stats ?? CHARACTER_BALANCE.johnny;
    if (now < this.nextShot) return null;
    if (!this.ammo.consume(now)) return null;
    this.nextShot = now + stats.shotCooldownMs;
    this.animator?.triggerAttack(now);
    this.standAnimator?.triggerAttack(now);
    const velocity = shotVelocity(this.aim, stats.projectileSpeed);
    const x = this.x + this.aim.x * ATTACK_START;
    const y = this.y + this.aim.y * ATTACK_START;
    const at = toWorld(x, y);
    const isBomb = this.characterId === 'kira';
    const visualKind = isBomb ? 'bombProjectile' : 'projectile';
    const factory = isBomb ? createThrownBombVisual : createShotVisual;
    const visual = collector ? collector.acquire(visualKind, factory) : factory();
    if (!isBomb) {
      const trail = visual.children[2];
      trail.position.set(-this.aim.x * .31, 0, -this.aim.y * .31);
      trail.rotation.y = Math.atan2(this.aim.x, this.aim.y);
    }
    visual.position.set(at.x, .78, at.z);
    if (!collector) scene.add(visual);
    const life = (stats.attackRange - ATTACK_START) / stats.projectileSpeed;
    return { x, y, prevX: x, prevY: y, radius: isBomb ? 10 : ATTACK_WIDTH / 2,
      vx: velocity.x, vy: velocity.y, life, initialLife: life,
      damage: stats.shotDamage, visual, visualKind, kind: isBomb ? 'bomb' : 'nail' };
  }
}
