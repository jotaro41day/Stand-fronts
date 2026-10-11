import * as THREE from 'three';
import { toWorld } from '../maps/gemArena.js';

const bombCore = new THREE.SphereGeometry(.20, 10, 8);
const bombMarkGeometry = new THREE.OctahedronGeometry(.12);
const bombRingGeometry = new THREE.TorusGeometry(.3, .035, 5, 20);
const world = { x: 0, z: 0 };
const bombMaterial = new THREE.MeshBasicMaterial({ color: 0x3a244c, toneMapped: false });
const bombMark = new THREE.MeshBasicMaterial({ color: 0xff77d8, toneMapped: false });
const bombGlow = new THREE.MeshBasicMaterial({ color: 0xff6acb, transparent: true,
  opacity: .26, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const tankBody = new THREE.BoxGeometry(.58, .24, .38);
const tankTrack = new THREE.BoxGeometry(.54, .16, .12);
const tankTurret = new THREE.SphereGeometry(.20, 8, 6);

export function createThrownBombVisual() {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(bombCore, bombMaterial));
  const mark = new THREE.Mesh(bombMarkGeometry, bombMark);
  mark.position.y = .18;
  group.add(mark);
  const glow = new THREE.Mesh(bombCore, bombGlow);
  glow.scale.setScalar(2);
  group.add(glow);
  return group;
}

export function createPlantedBombVisual() {
  const group = createThrownBombVisual();
  const ring = new THREE.Mesh(bombRingGeometry, bombMark);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -.12;
  group.add(ring);
  return group;
}

export function updateBombVisual(visual, bomb, now) {
  const at = toWorld(bomb.x, bomb.y, world);
  visual.position.set(at.x, .28, at.z);
  visual.rotation.y = now * .005;
  visual.scale.setScalar(1 + Math.sin(now * .025) * .11);
}

export function createTankVisual() {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(tankBody, bombMaterial);
  hull.position.y = .18;
  group.add(hull);
  for (const side of [-1, 1]) {
    const track = new THREE.Mesh(tankTrack, bombMark);
    track.position.set(0, .09, side * .24);
    group.add(track);
  }
  const turret = new THREE.Mesh(tankTurret, bombMark);
  turret.position.y = .36;
  group.add(turret);
  const glow = new THREE.Mesh(tankTurret, bombGlow);
  glow.position.y = .36;
  glow.scale.setScalar(1.6);
  group.add(glow);
  return group;
}

export function updateTankVisual(visual, tank, now) {
  const at = toWorld(tank.x, tank.y, world);
  visual.position.set(at.x, .08 + Math.sin(now * .012) * .035, at.z);
  visual.rotation.y = -Math.atan2(tank.aim.y, tank.aim.x);
}
