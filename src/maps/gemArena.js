import * as THREE from 'three';
import { outlinedMesh, toon } from '../visual/toon.js';

export const ARENA = { width: 1600, height: 1000, margin: 38 };
export const WORLD_SCALE = 50;

const cover = [
  { x: 510, y: 200, width: 48, height: 210, height3d: 1.65, kind: 'wall' },
  { x: 275, y: 345, width: 105, height: 90, height3d: 1.05, kind: 'block' },
  { x: 700, y: 265, width: 76, height: 62, height3d: 1.1, kind: 'block' },
];
export const OBSTACLES = cover.flatMap(box => [
  box,
  { ...box, x: ARENA.width - box.x - box.width },
  { ...box, y: ARENA.height - box.y - box.height },
  { ...box, x: ARENA.width - box.x - box.width, y: ARENA.height - box.y - box.height },
]);

export function toWorld(x, y) {
  return { x: (x - ARENA.width / 2) / WORLD_SCALE, z: (y - ARENA.height / 2) / WORLD_SCALE };
}

export function createGemArena(scene) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(32, 20), toon(0x34304d));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(31.2, 20, 0x594871, 0x473d61);
  grid.position.y = .025;
  scene.add(grid);

  for (const x of [-5.5, 5.5]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(.06, .025, 19),
      new THREE.MeshBasicMaterial({ color: 0x654f7d }));
    stripe.position.set(x, .04, 0);
    scene.add(stripe);
  }

  const boundary = [[0, -9.85, 32, .55], [0, 9.85, 32, .55], [-15.85, 0, .55, 20], [15.85, 0, .55, 20]];
  for (const [x, z, width, depth] of boundary) {
    const wall = outlinedMesh(new THREE.BoxGeometry(width, 1.15, depth), 0x604071);
    wall.position.set(x, .575, z);
    scene.add(wall);
  }

  for (const box of OBSTACLES) {
    const at = toWorld(box.x + box.width / 2, box.y + box.height / 2);
    const color = box.kind === 'wall' ? 0x78527e : 0x9c6a5a;
    const mesh = outlinedMesh(new THREE.BoxGeometry(box.width / WORLD_SCALE,
      box.height3d, box.height / WORLD_SCALE), color);
    mesh.position.set(at.x, box.height3d / 2, at.z);
    scene.add(mesh);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(box.width / WORLD_SCALE * .94, .08,
      box.height / WORLD_SCALE * .94), toon(box.kind === 'wall' ? 0xe8a961 : 0xf2ba70));
    cap.position.set(at.x, box.height3d + .04, at.z);
    scene.add(cap);
  }

  for (const [y, color] of [[150, 0xf06481], [850, 0x42bce9]]) {
    const at = toWorld(800, y);
    const pad = outlinedMesh(new THREE.CylinderGeometry(1.5, 1.5, .1, 32), color);
    pad.position.set(at.x, .06, at.z);
    scene.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, .075, 5, 32),
      new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(at.x, .14, at.z);
    scene.add(ring);
  }

  const minePad = outlinedMesh(new THREE.CylinderGeometry(1.05, 1.15, .28, 12), 0x8f57a3);
  minePad.position.y = .14;
  scene.add(minePad);
  const crystal = outlinedMesh(new THREE.OctahedronGeometry(.62), 0xd966ee);
  crystal.position.y = .9;
  scene.add(crystal);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.35, .055, 5, 48),
    new THREE.MeshBasicMaterial({ color: 0xf593ff, toneMapped: false }));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = .07;
  scene.add(halo);
}
