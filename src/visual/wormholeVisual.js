import * as THREE from 'three';
import { toWorld } from '../maps/gemArena.js';

const nailGeometry = new THREE.ConeGeometry(.18, .75, 7);
nailGeometry.rotateX(Math.PI / 2);
const nailMaterial = new THREE.MeshBasicMaterial({ color: 0x71ddff, toneMapped: false });
const nailGlowMaterial = new THREE.MeshBasicMaterial({ color: 0xef79ff, transparent: true,
  opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

export function createSuperNail(scene, shot) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(nailGeometry, nailMaterial));
  const glow = new THREE.Mesh(new THREE.SphereGeometry(.3, 8, 6), nailGlowMaterial);
  group.add(glow);
  group.rotation.y = Math.atan2(shot.vx, shot.vy);
  scene.add(group);
  return group;
}

export class WormholeVisual {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.core = new THREE.Mesh(new THREE.CircleGeometry(.54, 32),
      new THREE.MeshBasicMaterial({ color: 0x451c78, transparent: true, opacity: .86,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.core.rotation.x = -Math.PI / 2;
    this.group.add(this.core);
    this.rings = [0x62dfff, 0xf269eb].map((color, index) => {
      const pivot = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.46 + index * .14, .075, 6, 32,
        Math.PI * 1.65),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = .03 + index * .015;
      pivot.add(ring);
      this.group.add(pivot);
      return pivot;
    });
    this.holeRef = null;
    this.closingAt = null;
  }

  update(now, hole) {
    if (hole !== this.holeRef) {
      if (hole) {
        const at = toWorld(hole.position.x, hole.position.y);
        this.group.position.set(at.x, .15, at.z);
        this.group.visible = true;
        this.closingAt = null;
      } else if (this.holeRef) this.closingAt = now;
      this.holeRef = hole;
    }
    if (!this.group.visible) return;
    const age = hole ? now - hole.openedAt : 0;
    const opening = hole ? Math.min(1, age / 220) : 1;
    const closing = this.closingAt === null ? 1 : Math.max(0, 1 - (now - this.closingAt) / 220);
    this.group.scale.setScalar(Math.max(.001, opening * closing * (1 + Math.sin(now * .009) * .035)));
    this.rings[0].rotation.y = now * .0028;
    this.rings[1].rotation.y = -now * .0038;
    if (closing === 0) this.group.visible = false;
  }
}
