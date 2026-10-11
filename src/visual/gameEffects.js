import * as THREE from 'three';

export const QUALITY = Object.freeze({
  high: { maxParticles: 48, burst: 1, dustMs: 120, shake: 1, text: true },
  medium: { maxParticles: 28, burst: .65, dustMs: 190, shake: .6, text: true },
  low: { maxParticles: 12, burst: .35, dustMs: 320, shake: .2, text: false },
});

const particleGeometry = new THREE.SphereGeometry(.075, 5, 4);
const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
const dummy = new THREE.Object3D();
const color = new THREE.Color();

export class GameEffects {
  constructor(scene) {
    this.quality = QUALITY.medium;
    this.level = 'medium';
    this.enabled = true;
    this.particles = Array.from({ length: QUALITY.high.maxParticles }, () => ({ life: 0 }));
    this.activeCount = 0;
    this.mesh = new THREE.InstancedMesh(particleGeometry, particleMaterial, this.particles.length);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    particleGeometry.computeBoundingSphere();
    particleGeometry.boundingSphere.radius = 40;
    this.mesh.frustumCulled = true;
    for (let i = 0; i < this.particles.length; i++) {
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    scene.add(this.mesh);
    this.textures = new Map();
    this.labels = Array.from({ length: 12 }, () => ({ life: 0, sprite: null }));
  }

  get activeParticles() { return this.activeCount; }

  setQuality(level) {
    this.level = QUALITY[level] ? level : 'medium';
    this.quality = QUALITY[this.level];
    for (let i = this.quality.maxParticles; i < this.particles.length; i++) {
      if (this.particles[i].life <= 0) continue;
      this.particles[i].life = 0;
      this.activeCount--;
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.mesh.visible = this.enabled;
    if (!this.enabled) {
      for (let i = 0; i < this.particles.length; i++) {
        this.particles[i].life = 0;
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(i, dummy.matrix);
      }
      this.activeCount = 0;
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const label of this.labels) {
      if (!this.enabled) label.life = 0;
      if (label.sprite) label.sprite.visible = this.enabled && label.life > 0;
    }
  }

  spawnParticle(x, y, z, tint, vx = 0, vy = 0, vz = 0, life = .45, size = 1) {
    if (!this.enabled) return false;
    const slot = this.particles.findIndex((particle, index) => index < this.quality.maxParticles && particle.life <= 0);
    if (slot < 0) return false;
    const particle = this.particles[slot];
    Object.assign(particle, { x, y, z, vx, vy, vz, life, maxLife: life, size });
    this.activeCount++;
    this.mesh.setColorAt(slot, color.setHex(tint));
    this.mesh.instanceColor.needsUpdate = true;
    return true;
  }

  burst(x, y, z, count, colors, speed = 2.2) {
    if (!this.enabled) return;
    const total = Math.max(1, Math.round(count * this.quality.burst));
    for (let i = 0; i < total; i++) {
      const angle = i * 2.399963 + Math.random() * .35;
      const force = speed * (.55 + Math.random() * .55);
      this.spawnParticle(x, y, z, colors[i % colors.length], Math.cos(angle) * force,
        .9 + Math.random() * 2.2, Math.sin(angle) * force, .35 + Math.random() * .4,
        .65 + Math.random() * .8);
    }
  }

  update(seconds) {
    if (!this.enabled) return;
    let matricesChanged = false;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.life <= 0) continue;
      p.life = Math.max(0, p.life - seconds);
      if (p.life === 0) this.activeCount--;
      p.x += p.vx * seconds;
      p.y += p.vy * seconds;
      p.z += p.vz * seconds;
      p.vy -= 5 * seconds;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(p.life > 0 ? p.size * Math.min(1, p.life / .15) : 0);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      matricesChanged = true;
    }
    if (matricesChanged) this.mesh.instanceMatrix.needsUpdate = true;
    for (const label of this.labels) {
      if (label.life <= 0) continue;
      label.life = Math.max(0, label.life - seconds);
      label.sprite.position.y += seconds * label.speed;
      label.sprite.material.opacity = Math.min(1, label.life / .2);
      label.sprite.visible = this.enabled && label.life > 0;
    }
  }

  text(scene, value, x, y, z, tint = '#ffffff', strong = false) {
    if (!this.enabled) return;
    if (strong && !this.quality.text) return;
    const slot = this.labels.find(label => label.life <= 0);
    if (!slot || typeof document === 'undefined') return;
    const key = `${value}:${tint}`;
    let texture = this.textures.get(key);
    if (!texture) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.font = '900 68px "Arial Black", "Noto Sans CJK JP", system-ui, sans-serif';
      ctx.lineWidth = 13;
      ctx.strokeStyle = '#261339';
      ctx.strokeText(value, 128, 65);
      ctx.fillStyle = tint;
      ctx.fillText(value, 128, 65);
      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      this.textures.set(key, texture);
    }
    if (!slot.sprite) {
      slot.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
      scene.add(slot.sprite);
    }
    slot.sprite.material.map = texture;
    slot.sprite.material.needsUpdate = true;
    slot.sprite.material.opacity = 1;
    slot.sprite.position.set(x, y, z);
    slot.sprite.scale.set(strong ? 2.6 : 1.25, strong ? 1.3 : .62, 1);
    slot.sprite.visible = true;
    slot.speed = strong ? 1.25 : 1.8;
    slot.life = strong ? .65 : .75;
  }
}
