import * as THREE from 'three';
import { sharedToon } from '../visual/toon.js';

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

export function toWorld(x, y, out = {}) {
  out.x = (x - ARENA.width / 2) / WORLD_SCALE;
  out.z = (y - ARENA.height / 2) / WORLD_SCALE;
  return out;
}

export function createGemArena(scene) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(32, 20), sharedToon(0x34304d));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(31.2, 20, 0x594871, 0x473d61);
  grid.position.y = .025;
  scene.add(grid);

  const stripeGeometry = new THREE.BoxGeometry(.06, .025, 19);
  const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0x654f7d });
  for (const x of [-5.5, 5.5]) {
    const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
    stripe.position.set(x, .04, 0);
    scene.add(stripe);
  }

  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const transform = new THREE.Object3D();
  const boundary = [[0, -9.85, 32, .55], [0, 9.85, 32, .55], [-15.85, 0, .55, 20], [15.85, 0, .55, 20]];
  const walls = new THREE.InstancedMesh(boxGeometry, sharedToon(0x604071), boundary.length);
  boundary.forEach(([x, z, width, depth], index) => {
    transform.position.set(x, .575, z);
    transform.scale.set(width, 1.15, depth);
    transform.updateMatrix();
    walls.setMatrixAt(index, transform.matrix);
  });
  walls.computeBoundingSphere();
  scene.add(walls);

  const coverWalls = OBSTACLES.filter(box => box.kind === 'wall');
  const coverBlocks = OBSTACLES.filter(box => box.kind === 'block');
  for (const [boxes, color, capColor] of [
    [coverWalls, 0x78527e, 0xe8a961],
    [coverBlocks, 0x9c6a5a, 0xf2ba70],
  ]) {
    const cover = new THREE.InstancedMesh(boxGeometry, sharedToon(color), boxes.length);
    const caps = new THREE.InstancedMesh(boxGeometry, sharedToon(capColor), boxes.length);
    boxes.forEach((box, index) => {
    const at = toWorld(box.x + box.width / 2, box.y + box.height / 2);
      transform.position.set(at.x, box.height3d / 2, at.z);
      transform.scale.set(box.width / WORLD_SCALE, box.height3d, box.height / WORLD_SCALE);
      transform.updateMatrix();
      cover.setMatrixAt(index, transform.matrix);
      transform.position.y = box.height3d + .04;
      transform.scale.set(box.width / WORLD_SCALE * .94, .08,
        box.height / WORLD_SCALE * .94);
      transform.updateMatrix();
      caps.setMatrixAt(index, transform.matrix);
    });
    cover.computeBoundingSphere();
    caps.computeBoundingSphere();
    scene.add(cover, caps);
  }

  const padGeometry = new THREE.CylinderGeometry(1.5, 1.5, .1, 32);
  const ringGeometry = new THREE.TorusGeometry(1.25, .075, 5, 32);
  for (const [y, color] of [[150, 0xf06481], [850, 0x42bce9]]) {
    const at = toWorld(800, y);
    const pad = new THREE.Mesh(padGeometry, sharedToon(color));
    pad.position.set(at.x, .06, at.z);
    scene.add(pad);
    const ring = new THREE.Mesh(ringGeometry,
      new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(at.x, .14, at.z);
    scene.add(ring);
  }

  const minePad = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, .28, 12), sharedToon(0x8f57a3));
  minePad.position.y = .14;
  scene.add(minePad);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.62), sharedToon(0xd966ee));
  crystal.position.y = .9;
  scene.add(crystal);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.35, .055, 5, 48),
    new THREE.MeshBasicMaterial({ color: 0xf593ff, toneMapped: false }));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = .07;
  scene.add(halo);
}
