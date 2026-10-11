import * as THREE from 'three';
import { ATTACK_RANGE, ATTACK_WIDTH } from '../game/attack.js';
import { WORLD_SCALE } from '../maps/gemArena.js';

const geometry = new THREE.PlaneGeometry(1, 1);
geometry.rotateX(-Math.PI / 2);

export function createAimIndicator() {
  const band = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: .32,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  }));
  band.visible = false;
  band.scale.set(ATTACK_WIDTH / WORLD_SCALE, 1, ATTACK_RANGE / WORLD_SCALE);
  return band;
}

export function updateAimIndicator(band, origin, direction, range = ATTACK_RANGE) {
  const length = direction && Math.hypot(direction.x, direction.y);
  if (!length) {
    band.visible = false;
    return;
  }
  const x = direction.x / length;
  const z = direction.y / length;
  const halfReach = range / WORLD_SCALE / 2;
  band.scale.z = range / WORLD_SCALE;
  band.position.set(origin.x + x * halfReach, .12, origin.z + z * halfReach);
  band.rotation.y = Math.atan2(x, z);
  band.visible = true;
}
