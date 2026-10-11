import * as THREE from 'three';
import { outlinedMesh, toon } from '../visual/toon.js';

export const ARENA = { width: 1600, height: 1000, margin: 38 };
export const WORLD_SCALE = 50;
export const OBSTACLES = [
  { x: 560, y: 545, width: 72, height: 72, height3d: .85 },
  { x: 1090, y: 605, width: 76, height: 76, height3d: 1.1 },
  { x: 415, y: 270, width: 125, height: 44, height3d: .72 },
  { x: 1210, y: 345, width: 118, height: 44, height3d: .72 },
];

export function toWorld(x, y) {
  return { x: (x - ARENA.width / 2) / WORLD_SCALE, z: (y - ARENA.height / 2) / WORLD_SCALE };
}

function labelTexture(text, color = '#ffe8b2') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.font = '900 52px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 11;
  context.strokeStyle = '#211634';
  context.strokeText(text, 256, 64);
  context.fillStyle = color;
  context.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createTrainingArena(scene) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(32, 20), toon(0x363052));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(31.2, 20, 0x725687, 0x55476b);
  grid.position.y = .025;
  scene.add(grid);

  for (const radius of [3.7, 4.7]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .045, 5, 96),
      new THREE.MeshBasicMaterial({ color: radius < 4 ? 0xf5bb43 : 0x8565a5 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = .06;
    scene.add(ring);
  }

  for (const [x, z, w, d] of [[0, 0, .055, 11], [0, 0, 11, .055]]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w, .025, d),
      new THREE.MeshBasicMaterial({ color: 0x9c76b8 }));
    stripe.position.set(x, .07, z);
    scene.add(stripe);
  }

  const floorMark = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.8),
    new THREE.MeshBasicMaterial({ map: labelTexture('CAMPO DE TESTE', '#8d6ca7'), transparent: true, depthWrite: false }));
  floorMark.rotation.x = -Math.PI / 2;
  floorMark.position.set(0, .085, -5.8);
  scene.add(floorMark);

  const wallMaterial = toon(0x68447d);
  const capMaterial = toon(0xf2aa43);
  for (const [x, z, width, depth] of [[0, -9.85, 32, .55], [0, 9.85, 32, .55], [-15.85, 0, .55, 20], [15.85, 0, .55, 20]]) {
    const wall = outlinedMesh(new THREE.BoxGeometry(width, 1.1, depth), 0x68447d);
    wall.position.set(x, .55, z);
    wall.material = wallMaterial;
    scene.add(wall);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(width, .12, depth), capMaterial);
    cap.position.set(x, 1.17, z);
    cap.castShadow = true;
    scene.add(cap);
  }

  for (const [index, box] of OBSTACLES.entries()) {
    const at = toWorld(box.x + box.width / 2, box.y + box.height / 2);
    const width = box.width / WORLD_SCALE;
    const depth = box.height / WORLD_SCALE;
    const block = outlinedMesh(new THREE.BoxGeometry(width, box.height3d, depth), index % 2 ? 0x9b548e : 0x9f6d40);
    block.position.set(at.x, box.height3d / 2, at.z);
    scene.add(block);
    const top = new THREE.Mesh(new THREE.BoxGeometry(width * .85, .055, depth * .85),
      new THREE.MeshBasicMaterial({ color: index % 2 ? 0xf49e7b : 0xe2bb66 }));
    top.position.set(at.x, box.height3d + .055, at.z);
    scene.add(top);
  }

  for (const [x, z] of [[-11, -7], [11, -7], [-11, 7], [11, 7]]) {
    const marker = new THREE.Mesh(new THREE.ConeGeometry(.45, .8, 3), toon(0xf3b644));
    marker.position.set(x, .4, z);
    marker.rotation.y = Math.PI / 2;
    marker.castShadow = true;
    scene.add(marker);
  }
}

export function createTargets(scene) {
  return [
    { x: 1015, y: 500, label: '01' },
    { x: 630, y: 370, label: '02' },
    { x: 680, y: 700, label: '03' },
    { x: 1130, y: 710, label: '04' },
  ].map((point, index) => {
    const at = toWorld(point.x, point.y);
    const visual = new THREE.Group();
    visual.position.set(at.x, 0, at.z);
    const pad = outlinedMesh(new THREE.CylinderGeometry(.64, .7, .18, 12), 0x965c79);
    pad.position.y = .1;
    visual.add(pad);
    const body = outlinedMesh(new THREE.CylinderGeometry(.32, .43, 1.05, 9), 0xc35e69);
    body.position.y = .68;
    visual.add(body);
    const face = outlinedMesh(new THREE.SphereGeometry(.42, 12, 8), 0xf08e81);
    face.position.set(0, 1.32, .07);
    visual.add(face);
    const bullseye = outlinedMesh(new THREE.CylinderGeometry(.21, .21, .05, 12), 0xffe1b1);
    bullseye.rotation.x = Math.PI / 2;
    bullseye.position.set(0, 1.34, .48);
    visual.add(bullseye);
    const center = new THREE.Mesh(new THREE.SphereGeometry(.075, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xa43d62 }));
    center.position.set(0, 1.34, .53);
    visual.add(center);
    const name = new THREE.Sprite(new THREE.SpriteMaterial({
      map: labelTexture(`ALVO ${point.label}`), transparent: true, depthWrite: false,
    }));
    name.position.set(0, 2.13, 0);
    name.scale.set(2.25, .56, 1);
    visual.add(name);
    scene.add(visual);
    return { x: point.x, y: point.y, radius: 26, hp: 3, active: true, visual, face, index };
  });
}
