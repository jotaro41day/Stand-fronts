import * as THREE from 'three';
import { AMMO_CAPACITY } from '../game/ammo.js';

const slotWidth = .3;
const fillWidth = .26;
const spacing = .36;
const backgroundGeometry = new THREE.PlaneGeometry(slotWidth, .12);
const fillGeometry = new THREE.PlaneGeometry(fillWidth, .08);
const backgroundMaterial = new THREE.MeshBasicMaterial({
  color: 0x211a36, depthTest: false, depthWrite: false, toneMapped: false,
});
const fillMaterial = new THREE.MeshBasicMaterial({
  color: 0x58d6ff, depthTest: false, depthWrite: false, toneMapped: false,
});

export function createAmmoBar() {
  const group = new THREE.Group();
  const fills = [];
  for (let i = 0; i < AMMO_CAPACITY; i++) {
    const x = (i - (AMMO_CAPACITY - 1) / 2) * spacing;
    const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    background.position.x = x;
    background.renderOrder = 90;
    group.add(background);
    const fill = new THREE.Mesh(fillGeometry, fillMaterial);
    fill.position.set(x, 0, .002);
    fill.renderOrder = 91;
    group.add(fill);
    fills.push({ mesh: fill, x });
  }
  return { group, fills };
}

export function updateAmmoBar(bar, fractions, position, camera) {
  bar.group.position.set(position.x, 2.65, position.z);
  bar.group.quaternion.copy(camera.quaternion);
  for (let i = 0; i < bar.fills.length; i++) {
    const { mesh, x } = bar.fills[i];
    const fraction = fractions[i];
    mesh.scale.x = fraction;
    mesh.position.x = x - fillWidth * (1 - fraction) / 2;
  }
}
