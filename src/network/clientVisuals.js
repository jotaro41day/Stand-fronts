import * as THREE from 'three';
import { toWorld } from '../maps/gemArena.js';
import { createPlantedBombVisual, createTankVisual, createThrownBombVisual,
  updateBombVisual, updateTankVisual } from '../visual/kiraVisuals.js';
import { WormholeVisual } from '../visual/wormholeVisual.js';

const nailGeometry = new THREE.SphereGeometry(.18, 8, 6);
const nailMaterial = new THREE.MeshBasicMaterial({ color: 0x64d8ff, toneMapped: false });
const nailGlowMaterial = new THREE.MeshBasicMaterial({ color: 0x64d8ff,
  transparent: true, opacity: .26, blending: THREE.AdditiveBlending,
  depthWrite: false, toneMapped: false });

function createNail() {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(nailGeometry, nailMaterial));
  const glow = new THREE.Mesh(nailGeometry, nailGlowMaterial);
  glow.scale.setScalar(2.2);
  group.add(glow);
  return group;
}

export class ClientVisuals {
  constructor(scene, garbage) {
    this.scene = scene;
    this.garbage = garbage;
    this.shots = new Map();
    this.bombs = new Map();
    this.tanks = new Map();
    this.holes = new Map();
    this.seenShots = new Set();
    this.seenBombs = new Set();
    this.seenTanks = new Set();
    this.seenHoles = new Set();
    this.world = { x: 0, z: 0 };
  }

  sync(snapshot, now) {
    const seenShots = this.seenShots;
    seenShots.clear();
    for (const shot of snapshot.projectiles) {
      seenShots.add(shot.id);
      let item = this.shots.get(shot.id);
      if (!item) {
        const kind = shot.kind === 'bomb' ? 'bombProjectile' : 'projectile';
        const visual = this.garbage.acquire(kind,
          shot.kind === 'bomb' ? createThrownBombVisual : createNail);
        item = { visual, kind };
        this.shots.set(shot.id, item);
      }
      const at = toWorld(shot.x, shot.y, this.world);
      item.visual.position.set(at.x, shot.kind === 'bomb' ? .8 : .78, at.z);
      item.visual.rotation.y = Math.atan2(shot.vx, shot.vy);
    }
    for (const [id, item] of this.shots) {
      if (seenShots.has(id)) continue;
      this.garbage.release(item.kind, item.visual);
      this.shots.delete(id);
    }

    const seenBombs = this.seenBombs;
    seenBombs.clear();
    for (const bomb of snapshot.bombs) {
      seenBombs.add(bomb.id);
      let visual = this.bombs.get(bomb.id);
      if (!visual) {
        visual = this.garbage.acquire('bomb', createPlantedBombVisual);
        this.bombs.set(bomb.id, visual);
      }
      updateBombVisual(visual, bomb, now);
    }
    for (const [id, visual] of this.bombs) {
      if (seenBombs.has(id)) continue;
      this.garbage.release('bomb', visual);
      this.bombs.delete(id);
    }

    const seenTanks = this.seenTanks;
    seenTanks.clear();
    for (const tank of snapshot.tanks) {
      seenTanks.add(tank.id);
      let visual = this.tanks.get(tank.id);
      if (!visual) {
        visual = this.garbage.acquire('tank', createTankVisual);
        this.tanks.set(tank.id, visual);
      }
      updateTankVisual(visual, tank, now);
    }
    for (const [id, visual] of this.tanks) {
      if (seenTanks.has(id)) continue;
      this.garbage.release('tank', visual);
      this.tanks.delete(id);
    }

    const seenHoles = this.seenHoles;
    seenHoles.clear();
    for (const hole of snapshot.holes) {
      seenHoles.add(hole.ownerId);
      let item = this.holes.get(hole.ownerId);
      if (!item) {
        item = { visual: new WormholeVisual(this.scene),
          hole: { position: { x: hole.x, y: hole.y }, openedAt: now } };
        this.holes.set(hole.ownerId, item);
      }
      item.hole.position.x = hole.x;
      item.hole.position.y = hole.y;
      item.visual.update(now, item.hole);
    }
    for (const [id, item] of this.holes) {
      if (seenHoles.has(id)) continue;
      item.visual.update(now, null);
    }
  }
}
