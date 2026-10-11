import * as THREE from 'three';
import { addMesh } from '../visual/toon.js';

const sphere = (radius, detail = 10) => new THREE.SphereGeometry(radius, detail, 8);

export function createFallbackHero() {
  const hero = new THREE.Group();
  hero.name = 'Herói provisório';
  addMesh(hero, new THREE.CylinderGeometry(.35, .42, .65, 8), 0x8648d6, 0, .68, 0);
  addMesh(hero, new THREE.BoxGeometry(.4, .16, .44), 0xffbf36, .15, .88, 0);
  addMesh(hero, sphere(.49, 12), 0xffc59d, .04, 1.38, 0);
  addMesh(hero, new THREE.SphereGeometry(.5, 12, 6, 0, Math.PI * 2, 0, Math.PI * .47), 0x281747, .01, 1.43, 0);
  addMesh(hero, new THREE.ConeGeometry(.25, .38, 5), 0xfabf43, -.18, 1.88, .03, -.25);
  for (const z of [-.23, .23]) {
    addMesh(hero, sphere(.075, 8), 0x201733, .48, 1.4, z);
    addMesh(hero, new THREE.CylinderGeometry(.14, .17, .39, 7), 0x342250, -.03, .21, z * 1.05);
    addMesh(hero, new THREE.BoxGeometry(.32, .14, .3), 0xffbd40, .11, .1, z * 1.05);
    addMesh(hero, new THREE.CylinderGeometry(.13, .15, .49, 7), 0x7442bb, -.02, .72, z * 2.1, z < 0 ? -.28 : .28);
    addMesh(hero, sphere(.16, 8), 0xffc59d, .08, .48, z * 2.2);
  }
  addMesh(hero, new THREE.BoxGeometry(.31, .19, .17), 0xf3b338, .52, .64, 0);
  return hero;
}

export function createFallbackStand() {
  const stand = new THREE.Group();
  stand.name = 'Stand provisório';
  addMesh(stand, new THREE.CylinderGeometry(.34, .23, .77, 6), 0x3fb7c9, 0, 1.05, 0);
  addMesh(stand, new THREE.OctahedronGeometry(.32), 0xe858be, .29, 1.16, 0);
  addMesh(stand, new THREE.CylinderGeometry(.24, .29, .46, 7), 0x392d82, 0, 1.74, 0);
  addMesh(stand, new THREE.ConeGeometry(.26, .36, 6), 0x65d9da, -.08, 2.13, 0);
  for (const z of [-.19, .19]) {
    addMesh(stand, sphere(.09, 8), 0xffe47d, .25, 1.8, z);
    addMesh(stand, new THREE.CylinderGeometry(.12, .13, .57, 6), 0x253b91, 0, .43, z * 1.1);
    addMesh(stand, new THREE.BoxGeometry(.25, .16, .28), 0x65d9da, .13, .16, z * 1.1);
  }
  addMesh(stand, new THREE.OctahedronGeometry(.31), 0x7148c8, -.05, 1.48, -.46);
  addMesh(stand, new THREE.OctahedronGeometry(.31), 0x7148c8, -.05, 1.48, .46);
  addMesh(stand, new THREE.CylinderGeometry(.13, .18, .64, 6), 0x57cbd1, .24, 1.22, -.54, -.55);
  addMesh(stand, new THREE.BoxGeometry(.34, .31, .3), 0xf4d04d, .54, 1.47, -.54);
  addMesh(stand, new THREE.CylinderGeometry(.13, .18, .63, 6), 0x57cbd1, -.25, 1.58, .52, .38);
  addMesh(stand, new THREE.BoxGeometry(.34, .31, .3), 0xf4d04d, -.41, 1.96, .52);
  return stand;
}
