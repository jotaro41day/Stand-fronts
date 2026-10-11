import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Player } from '../entities/player.js';
import { ARENA, OBSTACLES, createTargets, createTrainingArena, toWorld } from '../maps/trainingArena.js';
import { hitsCircle, hitsCircleRect } from './rules.js';
import { advanceShot, autoAimDirection } from './attack.js';
import { AMMO_CAPACITY } from './ammo.js';
import { TouchControls } from '../input/touchControls.js';
import { MouseControls } from '../input/mouseControls.js';
import { createAimIndicator, updateAimIndicator } from '../visual/aimIndicator.js';
import { createAmmoBar, updateAmmoBar } from '../visual/ammoBar.js';

const impactGeometry = new THREE.TorusGeometry(.28, .065, 6, 16);

export class TrainingGame {
  constructor() {
    this.container = document.getElementById('game');
    this.scoreElement = document.getElementById('score');
    this.toast = document.getElementById('toast');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x171329);
    this.camera = new THREE.OrthographicCamera(-8, 8, 5, -5, .1, 100);
    this.cameraFocus = new THREE.Vector3(0, 0, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute('aria-label', 'Arena 3D de treino');
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xb7a8ff, 0x453158, 2.2));
    const sun = new THREE.DirectionalLight(0xffe5b5, 3.0);
    sun.position.set(-7, 15, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(window.innerWidth < 650 ? 512 : 1024, window.innerWidth < 650 ? 512 : 1024);
    sun.shadow.camera.left = -19;
    sun.shadow.camera.right = 19;
    sun.shadow.camera.top = 13;
    sun.shadow.camera.bottom = -13;
    sun.shadow.normalBias = .025;
    sun.shadow.radius = 3;
    this.scene.add(sun);

    createTrainingArena(this.scene);
    this.player = new Player(this.scene);
    this.targets = createTargets(this.scene);
    this.projectiles = [];
    this.effects = [];
    this.score = 0;
    this.controls = new TouchControls();
    this.mouseControls = new MouseControls(this.renderer.domElement);
    this.aimIndicator = createAimIndicator();
    this.scene.add(this.aimIndicator);
    this.ammoBar = createAmmoBar();
    this.scene.add(this.ammoBar.group);
    this.attackButton = document.getElementById('attack');
    const ammoHud = document.getElementById('ammo-hud');
    this.ammoHudFills = Array.from({ length: AMMO_CAPACITY }, () => {
      const slot = document.createElement('span');
      slot.className = 'ammo-slot';
      const fill = document.createElement('span');
      fill.className = 'ammo-fill';
      slot.appendChild(fill);
      ammoHud.appendChild(slot);
      return fill;
    });
    this.currentAmmoFractions = Array(AMMO_CAPACITY).fill(1);
    this.keys = new Set();
    this.keyboardAttacks = 0;
    this.attackFacing = null;
    this.attackFacingUntil = 0;
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.pointerGround = new THREE.Vector3();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), .34, .2, .9);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    window.addEventListener('keydown', event => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      if (event.code === 'Space' && !event.repeat) this.keyboardAttacks++;
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.keyboardAttacks = 0; });
    window.addEventListener('resize', () => this.resize());
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();

    window.__stage1 = {
      getState: () => ({
        x: this.player.x, y: this.player.y, score: this.score, shots: this.projectiles.length,
        renderer: 'three', models: { ...this.player.modelSources },
        aim: { ...this.player.aim }, aiming: this.aimIndicator.visible,
        ammo: {
          charges: this.player.ammo.charges,
          segments: [...this.currentAmmoFractions],
          worldSegments: this.ammoBar.fills.map(({ mesh }) => mesh.scale.x),
        },
        resolution: {
          pixelRatio: this.renderer.getPixelRatio(),
          canvasWidth: this.renderer.domElement.width,
          canvasHeight: this.renderer.domElement.height,
          targetWidth: this.composer.renderTarget1.width,
          targetHeight: this.composer.renderTarget1.height,
          bloomWidth: this.bloomPass.renderTargetBright.width,
          bloomHeight: this.bloomPass.renderTargetBright.height,
        },
      }),
    };
    this.lastFrame = performance.now();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  resize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(pixelRatio);
    this.composer.setPixelRatio(pixelRatio);
    const ratio = width / height;
    const viewWidth = Math.max(10.2, ratio * 12.5);
    const viewHeight = viewWidth / ratio;
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.updateCamera(true);
  }

  updateCamera(immediate = false) {
    const at = toWorld(this.player.x, this.player.y);
    const desired = new THREE.Vector3(at.x, 0, at.z);
    if (immediate) this.cameraFocus.copy(desired);
    else this.cameraFocus.lerp(desired, .13);
    this.camera.position.set(this.cameraFocus.x, 18, this.cameraFocus.z + 10);
    this.camera.lookAt(this.cameraFocus);
    this.camera.updateMatrixWorld();
  }

  aimDirectionFromScreen(screen) {
    if (!screen) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const point = new THREE.Vector2(
      ((screen.x - rect.left) / rect.width) * 2 - 1,
      -((screen.y - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(point, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.pointerGround)) return null;
    const at = toWorld(this.player.x, this.player.y);
    const direction = { x: this.pointerGround.x - at.x, y: this.pointerGround.z - at.z };
    return Math.hypot(direction.x, direction.y) > .001 ? direction : null;
  }

  frame(now) {
    const seconds = Math.min((now - this.lastFrame) / 1000, .04);
    this.lastFrame = now;
    const k = this.keys;
    const keyboard = {
      x: Number(k.has('KeyD') || k.has('ArrowRight')) - Number(k.has('KeyA') || k.has('ArrowLeft')),
      y: Number(k.has('KeyS') || k.has('ArrowDown')) - Number(k.has('KeyW') || k.has('ArrowUp')),
    };
    const touch = this.controls.move;
    const move = Math.hypot(touch.x, touch.y) > .05 ? touch : keyboard;
    this.player.move(move, seconds);
    this.player.animate(now, seconds);
    this.updateCamera();
    const activeAim = this.controls.aim ?? this.aimDirectionFromScreen(this.mouseControls.aimScreen);
    if (activeAim) this.player.setAim(activeAim);
    else if (now < this.attackFacingUntil) this.player.setAim(this.attackFacing);
    updateAimIndicator(this.aimIndicator, toWorld(this.player.x, this.player.y), activeAim);

    const attacks = [];
    let action;
    while ((action = this.controls.consumeAttack())) attacks.push(action);
    let released;
    while ((released = this.mouseControls.consumeRelease())) {
      attacks.push({ type: 'aim', direction: this.aimDirectionFromScreen(released) });
    }
    while (this.keyboardAttacks > 0) {
      attacks.push({ type: 'auto' });
      this.keyboardAttacks--;
    }
    for (const attack of attacks) {
      const direction = attack.type === 'auto'
        ? autoAimDirection(this.player, this.targets)
        : attack.direction;
      if (direction) this.player.setAim(direction);
      const shot = this.player.shoot(this.scene, now);
      if (shot) {
        this.projectiles.push(shot);
        this.attackFacing = { ...this.player.aim };
        this.attackFacingUntil = now + 300;
      }
    }
    this.currentAmmoFractions = this.player.ammo.fractions(now);
    updateAmmoBar(this.ammoBar, this.currentAmmoFractions, toWorld(this.player.x, this.player.y), this.camera);
    this.ammoHudFills.forEach((fill, index) => {
      fill.style.transform = `scaleX(${this.currentAmmoFractions[index]})`;
    });
    const blocked = this.player.ammo.charges === 0;
    this.attackButton.classList.toggle('blocked', blocked);
    this.attackButton.setAttribute('aria-disabled', String(blocked));

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shot = this.projectiles[i];
      advanceShot(shot, seconds);
      const at = toWorld(shot.x, shot.y);
      shot.visual.position.set(at.x, .78, at.z);
      const target = this.targets.find(item => item.active && hitsCircle(shot, item));
      if (target) { this.hitTarget(target); shot.life = 0; }
      if (OBSTACLES.some(box => hitsCircleRect(shot, box))) shot.life = 0;
      if (shot.life <= 0 || shot.x < 0 || shot.y < 0 || shot.x > ARENA.width || shot.y > ARENA.height) {
        this.scene.remove(shot.visual);
        this.projectiles.splice(i, 1);
      }
    }
    for (const target of this.targets) {
      target.visual.position.y = target.active ? Math.sin(now * .002 + target.index) * .035 : 0;
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.life -= seconds;
      effect.mesh.scale.setScalar(1 + (1 - effect.life / .38) * 2.3);
      effect.mesh.material.opacity = Math.max(0, effect.life / .38);
      if (effect.life <= 0) {
        this.scene.remove(effect.mesh);
        effect.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }
    this.composer.render();
    requestAnimationFrame(this.frame);
  }

  hitTarget(target) {
    target.hp--;
    this.score++;
    this.scoreElement.textContent = String(this.score).padStart(2, '0');
    target.face.material.color.setHex(0xffefb4);
    window.setTimeout(() => target.face.material.color.setHex(0xf08e81), 110);
    const at = toWorld(target.x, target.y);
    const mesh = new THREE.Mesh(impactGeometry, new THREE.MeshBasicMaterial({
      color: 0xffe77c, transparent: true, opacity: 1, depthWrite: false, toneMapped: false,
    }));
    mesh.position.set(at.x, 1.25, at.z + .56);
    this.scene.add(mesh);
    this.effects.push({ mesh, life: .38 });
    this.toast.classList.remove('show');
    void this.toast.offsetWidth;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.classList.remove('show'), 480);
    if (target.hp <= 0) {
      target.active = false;
      target.visual.visible = false;
      window.setTimeout(() => {
        target.hp = 3;
        target.active = true;
        target.visual.visible = true;
      }, 1100);
    }
  }
}
