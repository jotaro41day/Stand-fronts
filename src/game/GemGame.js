import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Player } from '../entities/player.js';
import { standHoverHeight, standPosition } from '../entities/standFollow.js';
import { ARENA, OBSTACLES, createGemArena, toWorld } from '../maps/gemArena.js';
import { advanceShot, autoAimDirection } from './attack.js';
import { AMMO_CAPACITY } from './ammo.js';
import { GemMatch, GEM_RULES, findShotHit } from './gemMatch.js';
import { BotController, BOT_DIFFICULTY } from './botAI.js';
import { createNavigationGrid, lineOfSight } from './botNavigation.js';
import { TouchControls } from '../input/touchControls.js';
import { MouseControls } from '../input/mouseControls.js';
import { createAimIndicator, updateAimIndicator } from '../visual/aimIndicator.js';
import { createAmmoBar, updateAmmoBar } from '../visual/ammoBar.js';
import { createFighterVisual, updateFighterVisual, createHealthBar, updateHealthBar,
  createGemVisual, updateGemVisual, loadFighterModels } from '../visual/gemVisuals.js';
import { GameEffects } from '../visual/gameEffects.js';
import { VisualGarbageCollector } from '../visual/garbageCollector.js';
import { WormholeSuper, nearestFreePoint, tuskStrikeTarget } from './wormhole.js';
import { WormholeVisual, createSuperNail } from '../visual/wormholeVisual.js';
import { hitsCircleRect, moveAroundObstacles, shotVelocity } from './rules.js';
import { ATTACK_START } from './attack.js';
import { AmmoMagazine } from './ammo.js';
import { CHARACTER_BALANCE } from '../balance.js';
import { SnapshotBuffer, correctPredictedPosition } from '../network/prediction.js';
import { INPUT_INTERVAL_MS } from '../network/protocol.js';
import { ClientVisuals } from '../network/clientVisuals.js';
import { blastTargets, bombLanding, createTank, damageTank, findTankHit,
  stepTank } from './kiraCombat.js';
import { createPlantedBombVisual, createTankVisual, updateBombVisual,
  updateTankVisual } from '../visual/kiraVisuals.js';
import { AdaptivePixelRatio, FrameStats, chooseQuality, clampPixelRatio } from
  '../performance/performanceSettings.js';
import { PerformancePanel } from '../performance/PerformancePanel.js';

const beamGeometry = new THREE.CylinderGeometry(.45, .75, 3.2, 10, 1, true);
const teams = ['blue', 'red'];
const setTextIfChanged = (element, value) => {
  if (element.textContent !== value) element.textContent = value;
};

export class GemGame {
  constructor(characterId = 'johnny', options = {}) {
    this.role = options.role ?? 'offline';
    this.localActorId = options.localActorId ?? 'johnny';
    this.remoteGates = options.remoteGates ?? new Map();
    this.networkSink = options.onNetworkEvent ?? null;
    this.clientRoom = options.room ?? null;
    this.running = true;
    this.characterId = characterId === 'kira' ? 'kira' : 'johnny';
    this.container = document.getElementById('game');
    this.blueScore = document.getElementById('blue-score');
    this.redScore = document.getElementById('red-score');
    this.clock = document.getElementById('match-clock');
    this.countdown = document.getElementById('countdown');
    this.healthHud = document.getElementById('health');
    this.endScreen = document.getElementById('match-end');
    this.endTitle = document.getElementById('end-title');
    document.getElementById('play-again').addEventListener('click', () => window.location.reload());
    this.toast = document.getElementById('toast');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x171329);
    this.camera = new THREE.OrthographicCamera(-8, 8, 5, -5, .1, 100);
    this.cameraFocus = new THREE.Vector3(0, 0, 0);
    this.adaptiveRatio = new AdaptivePixelRatio();
    this.currentPixelRatio = 1;
    this.frameStats = new FrameStats();
    this.lastMetricsAt = 0;
    this.lastRenderedAt = 0;
    this.autoQualityAt = performance.now() + 4000;
    this.autoQualityChosen = false;
    this.autoQualityReviewAt = 0;
    this.renderer = this.createRenderer(true);

    this.scene.add(new THREE.HemisphereLight(0xb7a8ff, 0x453158, 2.2));
    const sun = new THREE.DirectionalLight(0xffe5b5, 3.0);
    sun.position.set(-7, 15, 8);
    sun.castShadow = true;
    this.highShadowSize = 512;
    sun.shadow.mapSize.set(this.highShadowSize, this.highShadowSize);
    sun.shadow.camera.left = -4;
    sun.shadow.camera.right = 4;
    sun.shadow.camera.top = 4;
    sun.shadow.camera.bottom = -4;
    sun.shadow.camera.near = .1;
    sun.shadow.camera.far = 30;
    sun.shadow.normalBias = .025;
    sun.shadow.radius = 3;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    createGemArena(this.scene);
    this.match = new GemMatch(performance.now(), this.characterId, options.roster);
    this.playerActor = this.match.actors.find(actor => actor.id === this.localActorId);
    if (!this.playerActor) throw new Error(`Jogador local inválido: ${this.localActorId}`);
    this.characterId = this.playerActor.characterId;
    this.viewTeam = this.playerActor.team;
    this.player = new Player(this.scene, this.characterId);
    this.player.heroRoot.traverse(object => {
      if (object.isMesh && !object.userData.isOutline) object.castShadow = true;
    });
    this.player.onModelLoaded = () => this.updateOutlineVisibility();
    this.playerActor.ammo = this.player.ammo;
    this.player.x = this.playerActor.x;
    this.player.y = this.playerActor.y;
    this.player.syncPosition();
    const navigation = createNavigationGrid(ARENA, OBSTACLES, 50, this.player.radius);
    this.navigation = navigation;
    this.bots = new Map(this.match.actors.filter(actor => actor !== this.playerActor &&
      !this.remoteGates.has(actor.id) && this.role !== 'client')
      .map(actor => [actor.id, new BotController(actor, navigation, BOT_DIFFICULTY)]));
    this.remoteWormholes = new Map();
    for (const actor of this.match.actors.filter(fighter => this.remoteGates.has(fighter.id))) {
      actor.ammo = new AmmoMagazine(actor.stats);
      actor.nextShot = 0;
      actor.aim = { x: 0, y: actor.team === 'blue' ? -1 : 1 };
      actor.vx = 0;
      actor.vy = 0;
      if (actor.characterId === 'johnny') this.remoteWormholes.set(actor.id,
        new WormholeSuper(actor.stats));
    }
    this.botVisuals = new Map(this.match.actors.filter(actor => actor !== this.playerActor)
      .map(actor => [actor.id, createFighterVisual(this.scene, actor)]));
    for (const actor of this.match.actors.filter(fighter => fighter !== this.playerActor)) {
      loadFighterModels(this.scene, this.botVisuals.get(actor.id), actor)
        .then(() => this.updateOutlineVisibility())
        .catch(error => console.warn(`Falha ao carregar bot ${actor.id}:`, error));
    }
    this.gemVisuals = new Map();
    this.gemLaunches = new Map();
    this.projectiles = [];
    this.bombs = [];
    this.tanks = [];
    this.nextNetworkObjectId = 0;
    this.kiraCharge = new Map(this.match.actors.filter(actor => actor.characterId === 'kira')
      .map(actor => [actor.id, 0]));
    this.tankGrid = createNavigationGrid(ARENA, OBSTACLES, 50, CHARACTER_BALANCE.kira.superTankRadius);
    this.superShots = [];
    this.wormhole = new WormholeSuper(this.player.stats);
    this.wormholeVisual = new WormholeVisual(this.scene);
    this.remoteHoleVisuals = new Map([...this.remoteWormholes.keys()]
      .map(id => [id, new WormholeVisual(this.scene)]));
    this.garbage = new VisualGarbageCollector(this.scene);
    this.effects = new GameEffects(this.scene);
    this.characterFx = new Map(this.match.actors.map(actor => [actor.id, {
      hitUntil: 0, deathAt: 0, deathUntil: 0, respawnAt: 0,
      kickX: 0, kickZ: 0, recoilAt: 0, recoilX: 0, recoilZ: 0,
      lastDustAt: 0, flashMaterials: null, beam: null,
    }]));
    this.playerHealthBar = createHealthBar(this.scene, 'blue', 2.43);
    this.shakeAt = 0;
    this.shakeUntil = 0;
    this.shakePower = 0;
    this.strongHitCount = 0;
    this.endShown = false;
    this.scoreShown = { blue: 0, red: 0 };
    this.hudScores = { blue: 0, red: 0 };
    this.lastHudAt = 0;
    this.flyGems = Array.from({ length: 8 }, () => {
      const element = document.createElement('div');
      element.className = 'flying-gem';
      element.hidden = true;
      document.getElementById('app').appendChild(element);
      return { element, active: false };
    });
    this.qualitySelect = document.getElementById('quality');
    this.performancePanel = new PerformancePanel(() => this.applyPerformanceSettings());
    this.performancePanel.botSlots = this.bots.size;
    if (this.performancePanel.quality) this.qualitySelect.value = this.performancePanel.quality;
    this.qualitySelect.addEventListener('change', () => {
      this.performancePanel.quality = this.qualitySelect.value;
      this.performancePanel.overrides = {};
      this.performancePanel.save();
      this.setRenderQuality(this.qualitySelect.value);
    });
    this.controls = new TouchControls();
    this.mouseControls = new MouseControls(this.renderer.domElement);
    this.aimIndicator = createAimIndicator();
    this.scene.add(this.aimIndicator);
    this.ammoBar = createAmmoBar();
    this.scene.add(this.ammoBar.group);
    this.attackButton = document.getElementById('attack');
    this.superButton = document.getElementById('super');
    this.superLabel = document.getElementById('super-label');
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
    this.keyboardDirection = { x: 0, y: 0 };
    this.attackQueue = [];
    this.worldScratch = { x: 0, z: 0 };
    this.standScratch = { x: 0, z: 0 };
    this.aimScratch = { x: 0, y: 0 };
    this.ndc = new THREE.Vector2();
    this.wasAlive = new Map();
    this.gemsBefore = new Map();
    this.heldBefore = new Map();
    this.gains = new Map();
    this.liveGemIds = new Set();
    this.keys = new Set();
    this.keyboardAttacks = 0;
    this.keyboardSupers = [];
    this.keyEShotArmed = false;
    this.tuskPunchUntil = 0;
    this.kiraStandUntil = 0;
    this.attackFacing = null;
    this.attackFacingUntil = 0;
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.pointerGround = new THREE.Vector3();
    this.snapshotBuffer = new SnapshotBuffer();
    this.lastAppliedSnapshot = -1;
    this.lastInputSentAt = 0;
    this.pendingNetworkActions = [];
    this.clientVisuals = new ClientVisuals(this.scene, this.garbage);
    if (this.viewTeam === 'red') {
      document.querySelector('.team-gems.blue span').textContent = 'INIMIGOS';
      document.querySelector('.team-gems.red span').textContent = 'SEU TIME';
    }

    this.composer = null;
    this.bloomPass = null;

    window.addEventListener('keydown', event => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE'].includes(event.code)) event.preventDefault();
      if (event.code === 'Space' && !event.repeat) this.keyboardAttacks++;
      if (event.code === 'KeyE' && !event.repeat) {
        if (this.wormhole.inside) this.keyboardSupers.push({ type: 'exit' });
        else if (this.wormhole.hole && event.shiftKey && this.wormhole.ready)
          this.keyEShotArmed = true;
        else if (this.wormhole.hole) this.keyboardSupers.push({ type: 'enter' });
        else this.keyEShotArmed = this.superReady();
      }
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', event => {
      if (event.code === 'KeyE' && this.keyEShotArmed)
        this.keyboardSupers.push({ type: 'aim', direction:
          { ...(this.aimDirectionFromScreen(this.mouseControls.mouseScreen) ?? this.player.aim) } });
      if (event.code === 'KeyE') this.keyEShotArmed = false;
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.keyboardAttacks = 0;
      this.keyboardSupers.length = 0; this.keyEShotArmed = false; });
    window.addEventListener('resize', () => this.resize());
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this.setRenderQuality(this.qualitySelect.value);

    window.__stage1 = {
      getState: () => ({
        role: this.role, botIds: [...this.bots.keys()],
        x: this.player.x, y: this.player.y, shots: this.projectiles.length,
        characterId: this.characterId, bombs: this.bombs.length, tanks: this.tanks.length,
        garbage: this.garbage.stats(),
        match: { phase: this.match.phase, winner: this.match.winner, scores: this.match.scores,
          countdowns: { ...this.match.countdowns }, gems: this.match.gems.length,
          actors: this.match.actors.map(actor => ({ id: actor.id, team: actor.team,
            characterId: actor.characterId, hp: actor.hp,
            stats: actor.stats,
            active: actor.active, gems: actor.gems, x: actor.x, y: actor.y,
            ai: this.bots.get(actor.id)?.decision?.state ?? null,
            ammo: actor.ammo?.charges ?? null })) },
        renderer: 'three', models: { ...this.player.modelSources },
        aim: { ...this.player.aim }, aiming: this.aimIndicator.visible,
        ammo: {
          charges: this.player.ammo.charges,
          segments: [...this.currentAmmoFractions],
          worldSegments: this.ammoBar.fills.map(({ mesh }) => mesh.scale.x),
        },
        super: { charge: this.superCharge(), ready: this.superReady(),
          hole: this.wormhole.hole, pulling: this.wormhole.pulling,
          inside: this.wormhole.inside, invulnerable: this.wormhole.invulnerable },
        resolution: {
          pixelRatio: this.renderer.getPixelRatio(),
          canvasWidth: this.renderer.domElement.width,
          canvasHeight: this.renderer.domElement.height,
          renderQuality: this.renderQuality,
          targetWidth: this.composer?.renderTarget1.width ?? null,
          targetHeight: this.composer?.renderTarget1.height ?? null,
          bloomWidth: this.bloomPass?.renderTargetBright.width ?? null,
          bloomHeight: this.bloomPass?.renderTargetBright.height ?? null,
        },
      }),
    };
    this.lastFrame = performance.now();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  createRenderer(antialias) {
    const renderer = new THREE.WebGLRenderer({ antialias, powerPreference: 'high-performance' });
    renderer.setPixelRatio(this.currentPixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.info.autoReset = false;
    renderer.domElement.setAttribute('aria-label', 'Arena 3D de Pique-Gema');
    this.container.appendChild(renderer.domElement);
    this.requestedAntialias = antialias;
    return renderer;
  }

  replaceRenderer(antialias) {
    const old = this.renderer;
    let replacement;
    try { replacement = this.createRenderer(antialias); }
    catch (error) {
      console.warn('Não foi possível trocar o antialias neste aparelho:', error);
      return false;
    }
    this.composer?.dispose();
    this.composer = null;
    this.bloomPass = null;
    old.dispose();
    old.forceContextLoss();
    old.domElement.remove();
    this.renderer = replacement;
    this.mouseControls.attachCanvas(this.renderer.domElement);
    return true;
  }

  resize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const pixelRatio = this.performanceSettings?.resolutionScale === undefined
      ? this.adaptiveRatio.value : clampPixelRatio(this.performanceSettings.resolutionScale);
    const ratioChanged = pixelRatio !== this.currentPixelRatio;
    this.currentPixelRatio = pixelRatio;
    if (ratioChanged) {
      this.renderer.setPixelRatio(pixelRatio);
      this.composer?.setPixelRatio(pixelRatio);
    }
    const ratio = width / height;
    const viewWidth = Math.max(10.2, ratio * 12.5);
    const viewHeight = viewWidth / ratio;
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer?.setSize(width, height);
    this.canvasRect = this.renderer.domElement.getBoundingClientRect();
    this.updateCamera(true);
  }

  setRenderQuality(level) {
    this.renderQuality = ['high', 'medium', 'low'].includes(level) ? level : 'medium';
    this.effects.setQuality(this.renderQuality);
    this.applyPerformanceSettings();
  }

  updateOutlineVisibility() {
    const visible = this.performanceSettings?.outline ?? true;
    this.scene.traverse(object => {
      if (object.userData.isOutline) object.visible = visible;
    });
  }

  applyPerformanceSettings() {
    const settings = this.performancePanel.refresh(this.renderQuality);
    this.performanceSettings = settings;
    this.effects.setEnabled(settings.particles);
    this.activeBotCount = Math.min(this.bots.size, Math.max(0,
      Math.round(Number(settings.botCount ?? this.bots.size))));
    if (this.requestedAntialias !== !!settings.antialias &&
        !this.replaceRenderer(!!settings.antialias)) {
      settings.antialias = this.requestedAntialias;
      this.performancePanel.overrides.antialias = this.requestedAntialias;
      this.performancePanel.refresh(this.renderQuality);
      this.performancePanel.save();
    }
    this.sun.castShadow = !!settings.shadows;
    this.renderer.shadowMap.enabled = !!settings.shadows;
    const shadowSize = this.renderQuality === 'high' ? this.highShadowSize : 256;
    if (this.sun.shadow.mapSize.x !== shadowSize) {
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    }
    if (settings.shadows) this.renderer.shadowMap.needsUpdate = true;
    this.updateOutlineVisibility();
    if (settings.postprocess && !this.composer) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), .34, .2, .9);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    } else if (!settings.postprocess && this.composer) {
      this.composer.dispose();
      this.composer = null;
      this.bloomPass = null;
    }
    if (this.bloomPass) this.bloomPass.enabled = !!settings.bloom;
    this.resize();
  }

  renderScene() {
    this.renderer.info?.reset();
    if (this.performanceSettings?.postprocess ?? this.renderQuality === 'high') this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  updateCamera(immediate = false) {
    const at = toWorld(this.player.x, this.player.y, this.worldScratch);
    if (immediate) this.cameraFocus.set(at.x, 0, at.z);
    else {
      this.cameraFocus.x += (at.x - this.cameraFocus.x) * .13;
      this.cameraFocus.z += (at.z - this.cameraFocus.z) * .13;
    }
    this.camera.position.set(this.cameraFocus.x, 18, this.cameraFocus.z + 10);
    this.camera.lookAt(this.cameraFocus);
    this.camera.updateMatrixWorld();
    this.sun.target.position.set(at.x, 0, at.z);
    this.sun.position.set(at.x - 7, 15, at.z + 8);
    this.sun.target.updateMatrixWorld();
  }

  aimDirectionFromScreen(screen) {
    if (!screen) return null;
    const rect = this.canvasRect;
    this.ndc.set(((screen.x - rect.left) / rect.width) * 2 - 1,
      -((screen.y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.pointerGround)) return null;
    const at = toWorld(this.player.x, this.player.y, this.worldScratch);
    const direction = this.aimScratch;
    direction.x = this.pointerGround.x - at.x;
    direction.y = this.pointerGround.z - at.z;
    return Math.hypot(direction.x, direction.y) > .001 ? direction : null;
  }

  beginFrame(now) {
    const interval = 1000 / (this.performanceSettings?.fpsLimit ?? 60);
    if (now - this.lastRenderedAt < interval - 1) {
      requestAnimationFrame(this.frame);
      return false;
    }
    this.lastRenderedAt = now;
    this.frameCpuStart = performance.now();
    return true;
  }

  finishFrame(now) {
    this.frameStats.add(now, performance.now() - this.frameCpuStart);
    if (now - this.lastMetricsAt < 500) return;
    this.lastMetricsAt = now;
    const stats = this.frameStats.summary();
    if (!this.autoQualityChosen && now >= this.autoQualityAt && this.frameStats.count >= 60) {
      this.autoQualityChosen = true;
      if (!this.performancePanel.quality && !this.performancePanel.hasOverrides()) {
        const chosen = chooseQuality(stats.average);
        this.qualitySelect.value = chosen;
        this.setRenderQuality(chosen);
        this.autoQualityReviewAt = now + 3000;
      }
    }
    if (this.autoQualityReviewAt && now >= this.autoQualityReviewAt) {
      this.autoQualityReviewAt = 0;
      if (!this.performancePanel.quality && !this.performancePanel.hasOverrides() &&
          this.frameStats.count >= 60 && this.performanceSettings.fpsLimit === 60) {
        const chosen = chooseQuality(stats.average);
        if (chosen !== this.renderQuality) {
          this.qualitySelect.value = chosen;
          this.setRenderQuality(chosen);
        }
      }
    }
    if (this.performanceSettings?.resolutionScale === undefined) {
      const previous = this.adaptiveRatio.value;
      this.adaptiveRatio.update(this.frameStats.recentAverage(), now,
        this.performanceSettings.fpsLimit);
      if (previous !== this.adaptiveRatio.value) this.resize();
    }
    let entities = this.match.actors.length + this.match.gems.length +
      this.projectiles.length + this.bombs.length + this.tanks.length +
      this.superShots.length + this.effects.activeParticles;
    if (this.wormhole.hole) entities++;
    for (const hole of this.remoteWormholes.values()) if (hole.hole) entities++;
    this.performancePanel.showMetrics(stats, this.renderer, entities, this.currentPixelRatio);
  }

  frame(now) {
    if (!this.running) return;
    if (this.role === 'client') { this.frameClient(now); return; }
    if (!this.beginFrame(now)) return;
    const seconds = Math.min((now - this.lastFrame) / 1000, .04);
    this.lastFrame = now;
    this.applyWormholeTransition(this.wormhole.update(now, ARENA, OBSTACLES, this.player.radius), now);
    const pullPosition = this.wormhole.pullPosition(now);
    if (pullPosition) this.placeJohnny(pullPosition);
    this.playerActor.invulnerable = this.wormhole.invulnerable;
    const k = this.keys;
    const keyboard = this.keyboardDirection;
    keyboard.x = Number(k.has('KeyD') || k.has('ArrowRight')) - Number(k.has('KeyA') || k.has('ArrowLeft'));
    keyboard.y = Number(k.has('KeyS') || k.has('ArrowDown')) - Number(k.has('KeyW') || k.has('ArrowUp'));
    const touch = this.controls.move;
    const move = Math.hypot(touch.x, touch.y) > .05 ? touch : keyboard;
    if (this.playerActor.active && this.match.phase !== 'finished' && !this.wormhole.invulnerable) {
      const beforeX = this.player.x;
      const beforeY = this.player.y;
      this.player.move(move, seconds);
      this.playerActor.x = this.player.x;
      this.playerActor.y = this.player.y;
      this.playerActor.vx = seconds > 0 ? (this.player.x - beforeX) / seconds : 0;
      this.playerActor.vy = seconds > 0 ? (this.player.y - beforeY) / seconds : 0;
      this.player.animate(now, seconds);
    } else {
      this.playerActor.vx = 0;
      this.playerActor.vy = 0;
    }
    this.updateCamera();
    const superAiming = this.controls.superAim || this.keyEShotArmed;
    const activeAim = this.playerActor.active && this.match.phase !== 'finished' &&
      !this.wormhole.pulling
      ? this.controls.superAim ?? (superAiming
        ? this.aimDirectionFromScreen(this.mouseControls.mouseScreen) ?? this.player.aim
        : this.controls.aim ?? this.aimDirectionFromScreen(this.mouseControls.aimScreen)) : null;
    if (activeAim) this.player.setAim(activeAim);
    else if (now < this.attackFacingUntil) this.player.setAim(this.attackFacing);
    updateAimIndicator(this.aimIndicator,
      toWorld(this.player.x, this.player.y, this.worldScratch), activeAim,
      superAiming ? this.player.stats.superRange : this.player.stats.attackRange);

    const attacks = this.attackQueue;
    attacks.length = 0;
    let action;
    while ((action = this.controls.consumeAttack())) attacks.push(action);
    let released;
    while ((released = this.mouseControls.consumeRelease())) {
      const direction = this.aimDirectionFromScreen(released);
      attacks.push({ type: 'aim', direction: direction ? { ...direction } : null });
    }
    while (this.keyboardAttacks > 0) {
      attacks.push({ type: 'auto' });
      this.keyboardAttacks--;
    }
    for (const attack of attacks) {
      if (!this.playerActor.active || this.match.phase === 'finished' || this.wormhole.pulling) continue;
      const direction = attack.type === 'auto'
        ? autoAimDirection(this.player, this.match.actors.filter(actor => actor.team === 'red' &&
          !actor.invulnerable), this.player.stats.attackRange)
        : attack.direction;
      if (direction) this.player.setAim(direction);
      const shot = this.player.shoot(this.scene, now, this.garbage);
      if (shot) {
        shot.team = 'blue';
        shot.ownerId = 'johnny';
        const strike = this.characterId === 'johnny' && this.wormhole.inside
          ? tuskStrikeTarget(this.wormhole.hole.position,
          this.player.aim, this.match.actors.filter(actor => actor.team === 'red' &&
            lineOfSight(this.wormhole.hole.position, actor, OBSTACLES)),
          this.player.stats.superTuskStrikeRange) : null;
        if (strike) {
          this.garbage.release('projectile', shot.visual);
          shot.damage = this.player.stats.superTuskStrikeDamage;
          shot.isTuskStrike = true;
          this.tuskPunchUntil = now + this.player.stats.superTuskStrikeVisualMs;
          this.hitActor(strike, shot, now);
        } else this.addProjectile(shot);
        this.onShot(this.playerActor, shot, now);
        this.attackFacing = { ...this.player.aim };
        this.attackFacingUntil = now + 300;
      }
    }
    let superAction;
    while ((superAction = this.controls.consumeSuper())) this.keyboardSupers.push(superAction);
    while ((superAction = this.keyboardSupers.shift())) {
      if (!this.playerActor.active || this.match.phase === 'finished') continue;
      if (this.characterId === 'kira') {
        if (!['auto', 'aim'].includes(superAction.type) || !this.superReady()) continue;
        const direction = superAction.type === 'auto'
          ? autoAimDirection(this.player, this.match.actors.filter(actor => actor.team === 'red' &&
            !actor.invulnerable), this.player.stats.superRange) ?? this.player.aim
          : superAction.direction;
        if (!direction) continue;
        this.player.setAim(direction);
        this.kiraCharge.set(this.playerActor.id, 0);
        this.launchTank(this.playerActor, direction, now);
        continue;
      }
      if (superAction.type === 'exit') {
        this.applyWormholeTransition(this.wormhole.exit(ARENA, OBSTACLES, this.player.radius), now);
        this.playerActor.invulnerable = false;
        continue;
      }
      if (superAction.type === 'enter') {
        if (this.wormhole.beginEnter(now, { x: this.player.x, y: this.player.y }))
          this.playerActor.invulnerable = true;
        continue;
      }
      if (this.wormhole.invulnerable) continue;
      if (!this.wormhole.ready) continue;
      const direction = superAction.type === 'auto'
        ? autoAimDirection(this.player, this.match.actors.filter(actor => actor.team === 'red' &&
          !actor.invulnerable),
          this.player.stats.superRange) ?? this.player.aim
        : superAction.direction;
      if (!direction || !this.wormhole.spend()) continue;
      this.player.setAim(direction);
      this.fireSuper(now);
    }
    for (const [id, gate] of this.remoteGates) {
      const actor = this.match.actors.find(fighter => fighter.id === id);
      if (actor) this.updateRemotePlayer(actor, gate, now, seconds);
    }
    let botIndex = 0;
    for (const controller of this.bots.values()) {
      if (botIndex++ >= this.activeBotCount) continue;
      const fire = controller.update(now, seconds, this.match);
      if (controller.actor.characterId === 'kira' &&
          this.kiraCharge.get(controller.actor.id) >= controller.actor.stats.superChargeMax &&
          controller.actor.active) {
        const target = this.match.actors.filter(actor => actor.active && !actor.invulnerable &&
          actor.team !== controller.actor.team &&
          Math.hypot(actor.x - controller.actor.x, actor.y - controller.actor.y) <=
            controller.actor.stats.superRange && lineOfSight(controller.actor, actor, OBSTACLES))
          .sort((a, b) => Math.hypot(a.x - controller.actor.x, a.y - controller.actor.y) -
            Math.hypot(b.x - controller.actor.x, b.y - controller.actor.y))[0];
        if (target) {
          this.kiraCharge.set(controller.actor.id, 0);
          this.launchTank(controller.actor, { x: target.x - controller.actor.x,
            y: target.y - controller.actor.y }, now);
        }
      }
      if (!fire) continue;
      const shot = Player.prototype.shoot.call(controller.actor, this.scene, now, this.garbage);
      if (shot) {
        shot.team = controller.actor.team;
        shot.ownerId = controller.actor.id;
        this.addProjectile(shot);
        this.onShot(controller.actor, shot, now);
      }
    }
    this.player.ammo.fractions(now, this.currentAmmoFractions);
    updateAmmoBar(this.ammoBar, this.currentAmmoFractions,
      toWorld(this.player.x, this.player.y, this.worldScratch), this.camera);
    this.ammoHudFills.forEach((fill, index) => {
      const transform = `scaleX(${Math.round(this.currentAmmoFractions[index] * 50) / 50})`;
      if (fill.style.transform !== transform) fill.style.transform = transform;
    });
    const blocked = this.player.ammo.charges === 0 || !this.playerActor.active ||
      this.match.phase === 'finished' || this.wormhole.pulling;
    this.attackButton.classList.toggle('blocked', blocked);
    if (this.attackButton.getAttribute('aria-disabled') !== String(blocked))
      this.attackButton.setAttribute('aria-disabled', String(blocked));
    this.controls.superMode = !this.playerActor.active || this.match.phase === 'finished' ||
      this.wormhole.pulling ? 'blocked' : this.characterId === 'kira'
      ? this.superReady() ? 'launch' : 'blocked'
      : this.wormhole.inside ? 'exit' : this.wormhole.hole ? 'enter'
        : this.wormhole.ready ? 'launch' : 'blocked';
    this.controls.superCanReplace = this.characterId === 'johnny' && this.wormhole.ready;
    this.superButton.classList.toggle('ready', this.controls.superMode === 'launch');
    this.superButton.classList.toggle('enter', ['enter', 'exit'].includes(this.controls.superMode));
    this.superButton.classList.toggle('blocked', this.controls.superMode === 'blocked');
    const charge = `${this.superCharge()}%`;
    if (this.superButton.style.getPropertyValue('--charge') !== charge)
      this.superButton.style.setProperty('--charge', charge);
    setTextIfChanged(this.superLabel, this.characterId === 'kira' ? 'SHEER'
      : this.wormhole.inside ? 'SAIR' : this.wormhole.hole ? 'ENTRAR' : 'SUPER');

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shot = this.projectiles[i];
      shot.prevX = shot.x;
      shot.prevY = shot.y;
      advanceShot(shot, seconds);
      const at = toWorld(shot.x, shot.y);
      if (shot.kind === 'bomb') {
        const progress = 1 - shot.life / shot.initialLife;
        shot.visual.position.set(at.x, .78 * (1 - progress) + .22 * progress +
          Math.sin(progress * Math.PI) * 1.05, at.z);
        shot.visual.rotation.y += seconds * 12;
      } else shot.visual.position.set(at.x, .78, at.z);
      const wall = OBSTACLES.some(box => hitsCircleRect(shot, box));
      const tank = wall ? null : findTankHit(shot, this.tanks);
      const hit = wall ? { type: 'wall' } : tank ? { type: 'tank', tank }
        : findShotHit(shot, this.match.actors, OBSTACLES);
      if (hit?.type === 'tank' && damageTank(tank, shot.damage)) this.removeTank(tank, now);
      if (shot.kind !== 'bomb') {
        if (hit?.type === 'actor') this.hitActor(hit.actor, shot, now);
        else if (hit?.type === 'wall' || hit?.type === 'tank')
          this.effects.burst(at.x, .78, at.z, 4, [0x58d6ff, 0x8ceaff], 1.25);
      }
      if (hit) shot.life = 0;
      if (shot.life <= 0 || shot.x < 0 || shot.y < 0 || shot.x > ARENA.width || shot.y > ARENA.height) {
        if (shot.kind === 'bomb') this.plantBomb(shot, bombLanding(shot, hit, ARENA), now);
        this.garbage.release(shot.visualKind ?? 'projectile', shot.visual);
        this.projectiles.splice(i, 1);
      }
    }
    this.updateTanks(now, seconds);
    this.updateBombs(now);
    this.updateSuperShots(seconds, now);
    this.wormholeVisual.update(now, this.wormhole.hole);
    const wasAlive = this.wasAlive;
    const gemsBefore = this.gemsBefore;
    const heldBefore = this.heldBefore;
    wasAlive.clear();
    gemsBefore.clear();
    heldBefore.clear();
    for (const actor of this.match.actors) {
      wasAlive.set(actor.id, actor.active);
      heldBefore.set(actor.id, actor.gems);
    }
    for (const gem of this.match.gems) gemsBefore.set(gem.id, gem);
    this.match.update(now);
    for (const actor of this.match.actors) {
      if (!wasAlive.get(actor.id) && actor.active) this.onRespawn(actor, now);
    }
    if (!wasAlive.get('johnny') && this.playerActor.active) {
      this.player.x = this.playerActor.x;
      this.player.y = this.playerActor.y;
      this.playerActor.vx = 0;
      this.playerActor.vy = 0;
      this.player.syncPosition();
    }
    const gains = this.gains;
    gains.clear();
    for (const actor of this.match.actors) gains.set(actor.id, actor.gems - heldBefore.get(actor.id));
    for (const gem of gemsBefore.values()) {
      if (this.match.gems.includes(gem)) continue;
      const collector = this.match.actors.find(actor => gains.get(actor.id) > 0 &&
        Math.hypot(actor.x - gem.x, actor.y - gem.y) <= actor.radius + gem.radius + 4);
      if (collector) {
        gains.set(collector.id, gains.get(collector.id) - 1);
        this.flyGemToScore(gem, collector.team, now);
      }
    }
    const playerDying = now < this.characterFx.get('johnny').deathUntil;
    this.player.heroRoot.visible = (this.playerActor.active && !this.wormhole.inside) || playerDying;
    this.player.standRoot.visible = (this.playerActor.active &&
      (this.characterId === 'kira' ? now < this.kiraStandUntil
        : !this.wormhole.inside || now < this.tuskPunchUntil)) || playerDying;
    this.ammoBar.group.visible = this.playerActor.active;
    for (const actor of this.match.actors) {
      const visual = this.botVisuals.get(actor.id);
      if (visual) updateFighterVisual(visual, actor, this.camera, seconds, now,
        now < this.characterFx.get(actor.id).deathUntil);
      this.updateCharacterFx(actor, now, seconds);
    }
    if (this.wormhole.pulling) {
      const progress = Math.min(1, (now - this.wormhole.enterAt) / this.player.stats.superPullMs);
      const angle = -Math.atan2(this.player.aim.y, this.player.aim.x) + progress * Math.PI * 4;
      this.player.heroRoot.rotation.y = angle;
      this.player.standRoot.rotation.y = angle;
      this.player.heroRoot.scale.multiplyScalar(Math.max(.05, 1 - progress * .95));
      this.player.standRoot.scale.multiplyScalar(Math.max(.05, 1 - progress * .95));
    } else if (this.wormhole.inside && this.player.standRoot.visible) {
      const at = toWorld(this.player.x, this.player.y, this.worldScratch);
      this.player.standRoot.position.set(at.x + this.player.aim.x * .48,
        .18, at.z + this.player.aim.y * .48);
    }
    const playerAt = toWorld(this.playerActor.x, this.playerActor.y, this.worldScratch);
    this.playerHealthBar.group.position.set(playerAt.x, 2.43, playerAt.z);
    this.playerHealthBar.group.visible = this.playerActor.active;
    updateHealthBar(this.playerHealthBar, this.playerActor.hp, this.camera, seconds, now,
      this.playerActor.stats.health);
    for (const gem of this.match.gems) {
      if (!this.gemVisuals.has(gem.id)) {
        this.gemVisuals.set(gem.id, this.garbage.acquire('gem', createGemVisual));
      }
      updateGemVisual(this.gemVisuals.get(gem.id), gem, now, this.gemLaunches.get(gem.id));
    }
    const liveGemIds = this.liveGemIds;
    liveGemIds.clear();
    for (const gem of this.match.gems) liveGemIds.add(gem.id);
    for (const [id, visual] of this.gemVisuals) {
      if (liveGemIds.has(id)) continue;
      this.garbage.release('gem', visual);
      this.gemVisuals.delete(id);
      this.gemLaunches.delete(id);
    }
    this.updateHud(now);
    this.effects.update(seconds);
    this.updateFlyGems(now);
    this.updateShake(now);
    this.renderScene();
    this.finishFrame(now);
    requestAnimationFrame(this.frame);
  }

  addProjectile(shot) {
    shot.netId = ++this.nextNetworkObjectId;
    this.projectiles.push(shot);
  }

  updateRemotePlayer(actor, gate, now, seconds) {
    const wormhole = this.remoteWormholes.get(actor.id);
    if (wormhole) {
      const transition = wormhole.update(now, ARENA, OBSTACLES, actor.radius);
      if (transition?.position) {
        actor.x = transition.position.x;
        actor.y = transition.position.y;
      }
      const pull = wormhole.pullPosition(now);
      if (pull) { actor.x = pull.x; actor.y = pull.y; }
      actor.invulnerable = wormhole.invulnerable;
      actor.inside = wormhole.inside;
      this.remoteHoleVisuals.get(actor.id)?.update(now, wormhole.hole);
    }
    actor.ammo.update(now);
    const input = gate.consume(now);
    const before = { x: actor.x, y: actor.y };
    if (actor.active && this.match.phase !== 'finished' && !actor.invulnerable) {
      const next = moveAroundObstacles(actor, input.move, actor.stats.moveSpeed,
        seconds, ARENA, OBSTACLES, actor.radius);
      actor.x = next.x;
      actor.y = next.y;
    }
    actor.vx = seconds > 0 ? (actor.x - before.x) / seconds : 0;
    actor.vy = seconds > 0 ? (actor.y - before.y) / seconds : 0;
    if (input.aim && Math.hypot(input.aim.x, input.aim.y) > .01) actor.aim = input.aim;
    for (const command of input.actions) {
      if (!actor.active || this.match.phase === 'finished') break;
      const { kind, action } = command;
      if (kind === 'attack' && ['aim', 'auto'].includes(action.type) && !wormhole?.pulling) {
        const enemies = this.match.actors.filter(target => target.team !== actor.team &&
          !target.invulnerable);
        const direction = action.type === 'auto'
          ? autoAimDirection(actor, enemies, actor.stats.attackRange) ?? actor.aim
          : action.direction;
        if (direction) actor.aim = direction;
        const shot = Player.prototype.shoot.call(actor, this.scene, now, this.garbage);
        if (!shot) continue;
        shot.team = actor.team;
        shot.ownerId = actor.id;
        const strike = wormhole?.inside ? tuskStrikeTarget(wormhole.hole.position,
          actor.aim, enemies.filter(target => lineOfSight(wormhole.hole.position,
            target, OBSTACLES)), actor.stats.superTuskStrikeRange) : null;
        if (strike) {
          this.garbage.release(shot.visualKind, shot.visual);
          shot.damage = actor.stats.superTuskStrikeDamage;
          shot.isTuskStrike = true;
          this.hitActor(strike, shot, now);
        } else this.addProjectile(shot);
        this.onShot(actor, shot, now);
      }
      if (kind !== 'super') continue;
      if (actor.characterId === 'kira') {
        if (!['aim', 'auto'].includes(action.type) ||
            (this.kiraCharge.get(actor.id) ?? 0) < actor.stats.superChargeMax) continue;
        const direction = action.type === 'auto'
          ? autoAimDirection(actor, this.match.actors.filter(target =>
            target.team !== actor.team && !target.invulnerable), actor.stats.superRange) ?? actor.aim
          : action.direction;
        if (!direction) continue;
        actor.aim = direction;
        this.kiraCharge.set(actor.id, 0);
        this.launchTank(actor, direction, now);
      } else if (wormhole) {
        if (action.type === 'exit') {
          const transition = wormhole.exit(ARENA, OBSTACLES, actor.radius);
          if (transition?.position) { actor.x = transition.position.x;
            actor.y = transition.position.y; actor.invulnerable = false; actor.inside = false; }
        } else if (action.type === 'enter') {
          if (wormhole.beginEnter(now, actor)) actor.invulnerable = true;
        } else if (['aim', 'auto'].includes(action.type) && wormhole.ready &&
                   !wormhole.invulnerable) {
          const direction = action.type === 'auto'
            ? autoAimDirection(actor, this.match.actors.filter(target =>
              target.team !== actor.team && !target.invulnerable), actor.stats.superRange) ?? actor.aim
            : action.direction;
          if (direction && wormhole.spend()) {
            actor.aim = direction;
            this.fireSuper(now, actor, wormhole);
          }
        }
      }
    }
  }

  releaseRemotePlayer(actorId) {
    const gate = this.remoteGates.get(actorId);
    if (!gate) return;
    this.remoteGates.delete(actorId);
    const actor = this.match.actors.find(fighter => fighter.id === actorId);
    if (!actor) return;
    const wormhole = this.remoteWormholes.get(actorId);
    if (wormhole?.invulnerable) {
      const exit = wormhole.exit(ARENA, OBSTACLES, actor.radius);
      if (exit?.position) { actor.x = exit.position.x; actor.y = exit.position.y; }
    }
    actor.invulnerable = false;
    actor.inside = false;
    this.remoteWormholes.delete(actorId);
    const holeVisual = this.remoteHoleVisuals.get(actorId);
    if (holeVisual) {
      this.scene.remove(holeVisual.group);
      this.remoteHoleVisuals.delete(actorId);
    }
    const ammo = actor.ammo;
    const nextShot = actor.nextShot;
    const aim = actor.aim;
    const bot = new BotController(actor, this.navigation, BOT_DIFFICULTY);
    actor.ammo = ammo;
    actor.nextShot = nextShot;
    actor.aim = aim;
    this.bots.set(actorId, bot);
  }

  receiveSnapshot(snapshot) {
    if (this.role === 'client') this.snapshotBuffer.push(snapshot, performance.now());
  }

  applyNetworkEvent(event) {
    if (this.role !== 'client') return;
    const actor = this.match.actors.find(fighter => fighter.id === event.actorId);
    if (!actor) return;
    const now = performance.now();
    const state = this.characterFx.get(actor.id);
    const at = toWorld(event.x, event.y);
    if (event.type === 'shot') {
      if (actor === this.playerActor) {
        this.player.animator?.triggerAttack(now);
        this.player.standAnimator?.triggerAttack(now);
        if (actor.characterId === 'kira') this.kiraStandUntil = now + 360;
      } else {
        const visual = this.botVisuals.get(actor.id);
        visual?.animator?.triggerAttack(now);
        visual?.standAnimator?.triggerAttack(now);
        if (actor.characterId === 'kira' && visual) visual.standUntil = now + 360;
      }
      this.effects.burst(at.x, .8, at.z, 4,
        actor.characterId === 'kira' ? [0xf878d5, 0xffd378] : [0x58d6ff, 0x9ceaff], 1.2);
    } else if (event.type === 'hit') {
      state.kickAt = now;
      state.kickX = .12;
      state.kickZ = 0;
      this.flashActor(actor, now);
      this.effects.burst(at.x, 1.1, at.z, 8, [0x58d6ff, 0x9feaff], 1.8);
      this.effects.text(this.scene, String(event.damage), at.x + .3, 1.7, at.z, '#9ee9ff');
      if (actor === this.playerActor) this.startShake(now, 1);
    } else if (event.type === 'death') {
      state.deathAt = now;
      state.deathUntil = now + 300;
      this.effects.burst(at.x, 1, at.z, 16, [0x5bd5ff, 0x8c4af2, 0xce76ff], 2.8);
    } else if (event.type === 'respawn') this.onRespawn(actor, now);
  }

  applyClientSnapshot(snapshot, now) {
    if (!snapshot || snapshot.sequence === this.lastAppliedSnapshot) return;
    this.lastAppliedSnapshot = snapshot.sequence;
    this.match.phase = snapshot.phase;
    this.match.winner = snapshot.winner;
    this.match.startAt = now - (GEM_RULES.matchTime - snapshot.remainingMs);
    this.match.countdowns = Object.fromEntries(['blue', 'red'].map(team =>
      [team, snapshot.countdowns[team] === null ? null : now + snapshot.countdowns[team]]));
    this.match.gems = snapshot.gems.map(gem => ({ id: gem.id, x: gem.x, y: gem.y,
      bornAt: now - gem.ageMs, radius: 16 }));
    for (const state of snapshot.actors) {
      const actor = this.match.actors.find(fighter => fighter.id === state.id);
      if (!actor) continue;
      const wasActive = actor.active;
      actor.hp = state.hp;
      actor.active = state.active;
      actor.invulnerable = state.invulnerable;
      actor.inside = state.inside;
      actor.gems = state.gems;
      actor.vx = state.vx;
      actor.vy = state.vy;
      actor.aim = state.aim;
      actor.netAmmoFractions = state.ammoFractions;
      this.kiraCharge.set(actor.id, state.superCharge);
      if (actor === this.playerActor) {
        this.player.ammo.charges = state.ammo;
        this.currentAmmoFractions = state.ammoFractions;
        const corrected = !wasActive && state.active
          ? { x: state.x, y: state.y }
          : correctPredictedPosition(this.player, state, .06);
        this.player.x = corrected.x;
        this.player.y = corrected.y;
        this.player.syncPosition();
        const hole = snapshot.holes.find(item => item.ownerId === actor.id);
        this.wormhole.charge = state.superCharge;
        this.wormhole.hole = hole ? { position: { x: hole.x, y: hole.y },
          openedAt: now - 100, expiresAt: now + hole.remainingMs } : null;
        this.wormhole.insideAt = state.inside ? now : null;
        this.wormhole.enterAt = state.invulnerable && !state.inside ? now : null;
      }
    }
  }

  frameClient(now) {
    if (!this.beginFrame(now)) return;
    const seconds = Math.min((now - this.lastFrame) / 1000, .04);
    this.lastFrame = now;
    const latest = this.snapshotBuffer.latest();
    this.applyClientSnapshot(latest, now);
    const sampled = this.snapshotBuffer.sample(now, true);
    if (sampled) for (const state of sampled.actors) {
      if (state.id === this.localActorId) continue;
      const actor = this.match.actors.find(fighter => fighter.id === state.id);
      if (!actor) continue;
      actor.x = state.x;
      actor.y = state.y;
    }
    const k = this.keys;
    const keyboard = this.keyboardDirection;
    keyboard.x = Number(k.has('KeyD') || k.has('ArrowRight')) - Number(k.has('KeyA') || k.has('ArrowLeft'));
    keyboard.y = Number(k.has('KeyS') || k.has('ArrowDown')) - Number(k.has('KeyW') || k.has('ArrowUp'));
    const touch = this.controls.move;
    const move = Math.hypot(touch.x, touch.y) > .05 ? touch : keyboard;
    if (this.playerActor.active && !this.playerActor.invulnerable &&
        this.match.phase !== 'finished') {
      this.player.move(move, seconds);
      this.playerActor.x = this.player.x;
      this.playerActor.y = this.player.y;
    }
    this.player.animate(now, seconds);
    this.updateCamera();
    const superAiming = this.controls.superAim || this.keyEShotArmed;
    const activeAim = this.playerActor.active && this.match.phase !== 'finished'
      ? this.controls.superAim ?? (superAiming
        ? this.aimDirectionFromScreen(this.mouseControls.mouseScreen) ?? this.player.aim
        : this.controls.aim ?? this.aimDirectionFromScreen(this.mouseControls.aimScreen)) : null;
    if (activeAim) this.player.setAim(activeAim);
    updateAimIndicator(this.aimIndicator,
      toWorld(this.player.x, this.player.y, this.worldScratch), activeAim,
      superAiming ? this.player.stats.superRange : this.player.stats.attackRange);

    let action;
    while ((action = this.controls.consumeAttack()))
      this.pendingNetworkActions.push({ kind: 'attack', action });
    while ((action = this.mouseControls.consumeRelease())) this.pendingNetworkActions.push({
      kind: 'attack', action: { type: 'aim',
        direction: { ...(this.aimDirectionFromScreen(action) ?? this.player.aim) } } });
    while (this.keyboardAttacks > 0) {
      this.pendingNetworkActions.push({ kind: 'attack', action: { type: 'auto' } });
      this.keyboardAttacks--;
    }
    while ((action = this.controls.consumeSuper())) this.keyboardSupers.push(action);
    while ((action = this.keyboardSupers.shift())) this.pendingNetworkActions.push({
      kind: 'super', action: action.type === 'aim' && !action.direction
        ? { ...action, direction: this.player.aim } : action });
    if (this.pendingNetworkActions.length > 12) this.pendingNetworkActions.splice(0,
      this.pendingNetworkActions.length - 12);
    if (now - this.lastInputSentAt >= INPUT_INTERVAL_MS && this.clientRoom) {
      this.lastInputSentAt = now;
      this.clientRoom.sendInput(this.playerActor.active ? move : { x: 0, y: 0 },
        this.player.aim, this.pendingNetworkActions.splice(0, 4));
    }

    this.ammoBar.group.visible = this.playerActor.active;
    updateAmmoBar(this.ammoBar, this.currentAmmoFractions,
      toWorld(this.player.x, this.player.y, this.worldScratch), this.camera);
    this.ammoHudFills.forEach((fill, index) => {
      const transform = `scaleX(${Math.round((this.currentAmmoFractions[index] ?? 0) * 50) / 50})`;
      if (fill.style.transform !== transform) fill.style.transform = transform;
    });
    const blocked = !this.playerActor.active || this.player.ammo.charges === 0 ||
      this.match.phase === 'finished' || this.wormhole.pulling;
    this.attackButton.classList.toggle('blocked', blocked);
    if (this.attackButton.getAttribute('aria-disabled') !== String(blocked))
      this.attackButton.setAttribute('aria-disabled', String(blocked));
    this.controls.superMode = !this.playerActor.active || this.match.phase === 'finished' ||
      this.wormhole.pulling ? 'blocked' : this.characterId === 'kira'
      ? this.superReady() ? 'launch' : 'blocked'
      : this.wormhole.inside ? 'exit' : this.wormhole.hole ? 'enter'
        : this.wormhole.ready ? 'launch' : 'blocked';
    this.controls.superCanReplace = this.characterId === 'johnny' && this.wormhole.ready;
    this.superButton.classList.toggle('ready', this.controls.superMode === 'launch');
    this.superButton.classList.toggle('enter', ['enter', 'exit'].includes(this.controls.superMode));
    this.superButton.classList.toggle('blocked', this.controls.superMode === 'blocked');
    const charge = `${this.superCharge()}%`;
    if (this.superButton.style.getPropertyValue('--charge') !== charge)
      this.superButton.style.setProperty('--charge', charge);
    setTextIfChanged(this.superLabel, this.characterId === 'kira' ? 'SHEER'
      : this.wormhole.inside ? 'SAIR' : this.wormhole.hole ? 'ENTRAR' : 'SUPER');

    this.player.heroRoot.visible = this.playerActor.active && !this.playerActor.inside;
    this.player.standRoot.visible = this.playerActor.active &&
      (this.characterId === 'kira' ? now < this.kiraStandUntil
        : !this.playerActor.inside || now < this.tuskPunchUntil);
    for (const actor of this.match.actors) {
      const visual = this.botVisuals.get(actor.id);
      if (visual) updateFighterVisual(visual, actor, this.camera, seconds, now,
        now < this.characterFx.get(actor.id).deathUntil);
      this.updateCharacterFx(actor, now);
    }
    const playerAt = toWorld(this.player.x, this.player.y, this.worldScratch);
    this.playerHealthBar.group.position.set(playerAt.x, 2.43, playerAt.z);
    this.playerHealthBar.group.visible = this.playerActor.active;
    updateHealthBar(this.playerHealthBar, this.playerActor.hp, this.camera, seconds, now,
      this.playerActor.stats.health);
    if (sampled) this.clientVisuals.sync(sampled, now);
    for (const gem of this.match.gems) {
      if (!this.gemVisuals.has(gem.id)) this.gemVisuals.set(gem.id,
        this.garbage.acquire('gem', createGemVisual));
      updateGemVisual(this.gemVisuals.get(gem.id), gem, now);
    }
    const liveGemIds = this.liveGemIds;
    liveGemIds.clear();
    for (const gem of this.match.gems) liveGemIds.add(gem.id);
    for (const [id, visual] of this.gemVisuals) {
      if (liveGemIds.has(id)) continue;
      this.garbage.release('gem', visual);
      this.gemVisuals.delete(id);
    }
    this.updateHud(now);
    this.effects.update(seconds);
    this.updateShake(now);
    this.renderScene();
    this.finishFrame(now);
    requestAnimationFrame(this.frame);
  }

  stop() { this.running = false; }

  placeJohnny(position) {
    this.player.x = this.playerActor.x = position.x;
    this.player.y = this.playerActor.y = position.y;
    this.player.syncPosition();
    this.playerActor.vx = 0;
    this.playerActor.vy = 0;
  }

  applyWormholeTransition(transition, now) {
    if (!transition?.position) return;
    this.placeJohnny(transition.position);
    const at = toWorld(transition.position.x, transition.position.y);
    this.effects.burst(at.x, .35, at.z, transition.type === 'exit' ? 14 : 8,
      [0x5bd9ff, 0xe873ff], 1.8);
    if (transition.type === 'exit') this.player.setAim(this.player.aim);
  }

  superCharge() {
    return this.characterId === 'kira'
      ? this.kiraCharge.get(this.playerActor.id) ?? 0 : this.wormhole.charge;
  }

  superReady() {
    return this.superCharge() >= this.player.stats.superChargeMax;
  }

  plantBomb(shot, position, now) {
    const bomb = { ...position, netId: ++this.nextNetworkObjectId,
      team: shot.team, ownerId: shot.ownerId,
      damage: shot.damage, radius: CHARACTER_BALANCE.kira.bombBlastRadius,
      detonateAt: now + CHARACTER_BALANCE.kira.bombFuseMs,
      visual: this.garbage.acquire('bomb', createPlantedBombVisual) };
    this.bombs.push(bomb);
    updateBombVisual(bomb.visual, bomb, now);
  }

  updateBombs(now) {
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      if (now < bomb.detonateAt) {
        updateBombVisual(bomb.visual, bomb, now);
        continue;
      }
      this.explodeAt(bomb, bomb.team, bomb.damage, bomb.radius, bomb.ownerId, now, false);
      this.garbage.release('bomb', bomb.visual);
      this.bombs.splice(i, 1);
    }
  }

  launchTank(actor, direction, now) {
    const stats = actor.stats;
    const tank = createTank(actor, now, stats, direction);
    tank.netId = ++this.nextNetworkObjectId;
    if (!lineOfSight(actor, tank, OBSTACLES, tank.radius)) {
      tank.x = actor.x;
      tank.y = actor.y;
    }
    const safe = nearestFreePoint(tank, ARENA, OBSTACLES, tank.radius);
    if (safe) { tank.x = safe.x; tank.y = safe.y; }
    for (const old of [...this.tanks]) {
      if (old.ownerId === actor.id) this.removeTank(old, now);
    }
    tank.visual = this.garbage.acquire('tank', createTankVisual);
    this.tanks.push(tank);
    updateTankVisual(tank.visual, tank, now);
    const velocity = shotVelocity(direction, stats.superTankSpeed);
    this.onShot(actor, { x: tank.x, y: tank.y, vx: velocity.x, vy: velocity.y }, now);
    if (actor.id === 'johnny') {
      this.player.animator?.triggerAttack(now);
      this.player.standAnimator?.triggerAttack(now);
    }
  }

  removeTank(tank, now) {
    const index = this.tanks.indexOf(tank);
    if (index < 0) return;
    this.tanks.splice(index, 1);
    this.garbage.release('tank', tank.visual);
    const at = toWorld(tank.x, tank.y);
    this.effects.burst(at.x, .35, at.z, 7, [0xf178d2, 0xffd16c], 1.2);
  }

  updateTanks(now, seconds) {
    for (let index = this.tanks.length - 1; index >= 0; index--) {
      const tank = this.tanks[index];
      const result = stepTank(tank, now, seconds, this.match.actors, this.tankGrid, OBSTACLES);
      if (result) {
        if (result === 'hit') this.explodeAt(tank, tank.team, tank.damage, tank.blastRadius,
          tank.ownerId, now, true);
        this.removeTank(tank, now);
      } else updateTankVisual(tank.visual, tank, now);
    }
  }

  explodeAt(center, team, damage, radius, ownerId, now, isSuper) {
    const at = toWorld(center.x, center.y);
    this.effects.burst(at.x, .45, at.z, isSuper ? 22 : 15,
      [0xff84dd, 0xffd16b, 0xa679ff], isSuper ? 3.5 : 2.6);
    this.effects.text(this.scene, 'BOOM', at.x, 1.7, at.z, '#ffd087', true);
    for (const target of blastTargets(center, team, this.match.actors, OBSTACLES, radius)) {
      this.hitActor(target, { x: center.x, y: center.y, vx: target.x - center.x || 1,
        vy: target.y - center.y, damage, team, ownerId, isSuper }, now);
    }
  }

  fireSuper(now, actor = this.playerActor, wormhole = this.wormhole) {
    const stats = actor.stats;
    const aim = actor === this.playerActor ? this.player.aim : actor.aim;
    const velocity = shotVelocity(aim, stats.superProjectileSpeed);
    const shot = { x: actor.x + aim.x * ATTACK_START,
      y: actor.y + aim.y * ATTACK_START,
      vx: velocity.x, vy: velocity.y, radius: 10,
      life: (stats.superRange - ATTACK_START) / stats.superProjectileSpeed,
      damage: stats.superDamage, team: actor.team, ownerId: actor.id,
      isSuper: true, wormhole, netId: ++this.nextNetworkObjectId };
    shot.visual = createSuperNail(this.scene, shot);
    const at = toWorld(shot.x, shot.y);
    shot.visual.position.set(at.x, .8, at.z);
    this.superShots.push(shot);
    if (actor === this.playerActor) {
      this.player.animator?.triggerAttack(now);
      this.player.standAnimator?.triggerAttack(now);
    }
    this.onShot(actor, shot, now);
  }

  updateSuperShots(seconds, now) {
    for (let i = this.superShots.length - 1; i >= 0; i--) {
      const shot = this.superShots[i];
      advanceShot(shot, seconds);
      const at = toWorld(shot.x, shot.y);
      shot.visual.position.set(at.x, .8, at.z);
      const hit = findShotHit(shot, this.match.actors, OBSTACLES);
      if (hit?.type === 'actor') this.hitActor(hit.actor, shot, now);
      if (hit || shot.life <= 0 || shot.x < 0 || shot.y < 0 ||
          shot.x > ARENA.width || shot.y > ARENA.height) {
        (shot.wormhole ?? this.wormhole).open({ x: Math.max(0, Math.min(ARENA.width, shot.x)),
          y: Math.max(0, Math.min(ARENA.height, shot.y)) }, now,
        ARENA, OBSTACLES, Math.max(this.player.radius,
          (shot.wormhole ?? this.wormhole).stats.superHoleRadius));
        this.effects.burst(at.x, .3, at.z, 12, [0x5bd9ff, 0xf175ef], 1.6);
        this.scene.remove(shot.visual);
        this.superShots.splice(i, 1);
      }
    }
  }

  onShot(actor, shot, now) {
    this.networkSink?.({ type: 'shot', actorId: actor.id, ownerId: actor.id,
      x: shot.x, y: shot.y });
    const state = this.characterFx.get(actor.id);
    state.recoilAt = now;
    const shotSpeed = Math.hypot(shot.vx, shot.vy) || 1;
    state.recoilX = -shot.vx / shotSpeed * .13;
    state.recoilZ = -shot.vy / shotSpeed * .13;
    const at = toWorld(shot.x, shot.y);
    this.effects.burst(at.x, .8, at.z, 5,
      actor.characterId === 'kira' ? [0xf878d5, 0xffd378, 0xa46cff]
        : [0x58d6ff, 0x9ceaff, 0x397dff], 1.45);
    if (actor === this.playerActor && actor.characterId === 'kira') this.kiraStandUntil = now + 360;
    if (actor !== this.playerActor) {
      const visual = this.botVisuals?.get(actor.id);
      if (visual) {
        if (actor.characterId === 'kira') visual.standUntil = now + 360;
        visual.animator?.triggerAttack(now);
        visual.standAnimator?.triggerAttack(now);
      }
    }
  }

  flashActor(actor, now) {
    const state = this.characterFx.get(actor.id);
    if (!state.flashMaterials) {
      state.flashMaterials = [];
      const roots = actor === this.playerActor
        ? [this.player.heroRoot, this.player.standRoot]
        : [this.botVisuals.get(actor.id).group];
      for (const root of roots) root.traverse(object => {
        if (!object.isMesh) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (!material?.emissive) continue;
          state.flashMaterials.push({ material, color: material.emissive.getHex(),
            intensity: material.emissiveIntensity });
          material.emissive.setHex(0xffffff);
          material.emissiveIntensity = 2.5;
        }
      });
    }
    state.hitUntil = now + 105;
  }

  hitActor(target, shot, now) {
    const oldHp = target.hp;
    const previousGems = new Set(this.match.gems.map(gem => gem.id));
    const eliminated = this.match.damage(target, shot.damage, now);
    if (target.hp === oldHp) return;
    if (shot.ownerId && !shot.isSuper) {
      const owner = this.match.actors.find(actor => actor.id === shot.ownerId);
      if (owner?.characterId === 'kira') {
        this.kiraCharge.set(owner.id, Math.min(owner.stats.superChargeMax,
          (this.kiraCharge.get(owner.id) ?? 0) + owner.stats.superChargePerHit));
      } else if (owner?.characterId === 'johnny') {
        (owner.id === this.playerActor.id ? this.wormhole
          : this.remoteWormholes.get(owner.id))?.chargeHit();
      }
    }
    const at = toWorld(target.x, target.y);
    const state = this.characterFx.get(target.id);
    state.kickAt = now;
    state.kickX = shot.vx / Math.hypot(shot.vx, shot.vy) * .19;
    state.kickZ = shot.vy / Math.hypot(shot.vx, shot.vy) * .19;
    this.flashActor(target, now);
    this.effects.burst(at.x, 1.1, at.z, 9, [0x58d6ff, 0x4a86ff, 0x9feaff], 2.1);
    this.effects.text(this.scene, String(shot.damage), at.x + .35, 1.7, at.z, '#9ee9ff');
    this.networkSink?.({ type: 'hit', actorId: target.id, ownerId: shot.ownerId,
      damage: shot.damage, x: target.x, y: target.y });
    if (eliminated) {
      this.networkSink?.({ type: 'death', actorId: target.id, ownerId: shot.ownerId,
        x: target.x, y: target.y });
      state.deathAt = now;
      state.deathUntil = now + 300;
      this.effects.burst(at.x, 1.0, at.z, 18, [0x5bd5ff, 0x8c4af2, 0xce76ff], 3.2);
      for (const gem of this.match.gems) {
        if (!previousGems.has(gem.id)) this.gemLaunches.set(gem.id, { x: at.x, z: at.z, at: now });
      }
      this.effects.text(this.scene, this.strongHitCount++ % 2 ? 'ドン' : 'POW',
        at.x, 2.45, at.z, '#ffe077', true);
      this.startShake(now, .9);
    }
    if (target === this.playerActor) this.startShake(now, 1);
    this.toast.textContent = eliminated ? 'ELIMINADO!' : 'ACERTO!';
    this.toast.classList.remove('show');
    void this.toast.offsetWidth;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.classList.remove('show'), 480);
  }

  onRespawn(actor, now) {
    this.networkSink?.({ type: 'respawn', actorId: actor.id, x: actor.x, y: actor.y });
    const state = this.characterFx.get(actor.id);
    state.respawnAt = now;
    state.deathUntil = 0;
    if (!state.beam) {
      state.beam = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({
        color: actor.team === 'blue' ? 0x6ddcff : 0xff85b1,
        transparent: true, opacity: .3, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      }));
      this.scene.add(state.beam);
    }
    const at = toWorld(actor.x, actor.y, this.worldScratch);
    state.beam.position.set(at.x, 1.6, at.z);
    state.beam.visible = true;
    this.effects.burst(at.x, .35, at.z, 10,
      actor.team === 'blue' ? [0x6ddcff, 0xb4f4ff] : [0xff85b1, 0xffc1d6], 1.2);
  }

  updateCharacterFx(actor, now) {
    const state = this.characterFx.get(actor.id);
    if (state.flashMaterials && now >= state.hitUntil) {
      for (const { material, color, intensity } of state.flashMaterials) {
        material.emissive.setHex(color);
        material.emissiveIntensity = intensity;
      }
      state.flashMaterials = null;
    }
    const kick = Math.max(0, 1 - (now - (state.kickAt ?? -1000)) / 180);
    const recoil = Math.max(0, 1 - (now - state.recoilAt) / 130);
    const offsetX = state.kickX * kick + state.recoilX * recoil;
    const offsetZ = state.kickZ * kick + state.recoilZ * recoil;
    const dying = now < state.deathUntil;
    const deathProgress = dying ? Math.max(0, (now - state.deathAt) / 300) : 0;
    const spawnProgress = state.respawnAt && now - state.respawnAt < 520
      ? (now - state.respawnAt) / 520 : 1;
    const scale = dying ? Math.max(.05, 1 - deathProgress * .95)
      : spawnProgress < 1 ? .55 + spawnProgress * .45 : 1;
    const hop = spawnProgress < 1 ? Math.sin(spawnProgress * Math.PI) * .5 : 0;
    const at = toWorld(actor.x, actor.y, this.worldScratch);
    if (actor.id === this.localActorId) {
      const stand = standPosition(at, this.player.aim, this.standScratch);
      this.player.heroRoot.position.x = at.x + offsetX;
      this.player.heroRoot.position.z = at.z + offsetZ;
      this.player.heroRoot.position.y = (actor.active ? this.player.heroRoot.position.y : 0) + hop;
      this.player.standRoot.position.set(stand.x + offsetX, standHoverHeight(now) + hop, stand.z + offsetZ);
      this.player.heroRoot.scale.setScalar(scale);
      this.player.standRoot.scale.setScalar(scale);
    } else {
      const visual = this.botVisuals.get(actor.id);
      visual.group.position.set(at.x + offsetX, hop, at.z + offsetZ);
      visual.group.scale.setScalar(scale);
    }
    if (state.beam) {
      const beamProgress = (now - state.respawnAt) / 520;
      state.beam.visible = beamProgress >= 0 && beamProgress < 1;
      if (state.beam.visible) {
        state.beam.material.opacity = .32 * (1 - beamProgress) * this.effects.quality.burst;
        state.beam.scale.setScalar(.75 + beamProgress * .5);
      }
    }
    if (actor.active && Math.hypot(actor.vx || 0, actor.vy || 0) > 65 &&
        now - state.lastDustAt >= this.effects.quality.dustMs) {
      state.lastDustAt = now;
      this.effects.spawnParticle(at.x - actor.vx / 900, .12, at.z - actor.vy / 900,
        0xc9b9d3, (Math.random() - .5) * .35, .3, (Math.random() - .5) * .35, .28, .85);
    }
  }

  startShake(now, power) {
    this.shakeAt = now;
    this.shakeUntil = now + 180;
    this.shakePower = Math.max(this.shakePower, power);
  }

  updateShake(now) {
    if (now >= this.shakeUntil) { this.shakePower = 0; return; }
    const strength = (1 - (now - this.shakeAt) / 180) * this.shakePower *
      this.effects.quality.shake * .13;
    const x = Math.sin(now * .17) * strength;
    const z = Math.cos(now * .23) * strength;
    this.camera.position.x += x;
    this.camera.position.z += z;
    this.camera.lookAt(this.cameraFocus.x + x, 0, this.cameraFocus.z + z);
    this.camera.updateMatrixWorld();
  }

  flyGemToScore(gem, team, now) {
    const slot = this.flyGems.find(item => !item.active);
    if (!slot) return;
    const at = toWorld(gem.x, gem.y);
    const projected = new THREE.Vector3(at.x, .8, at.z).project(this.camera);
    const target = (team === 'blue' ? this.blueScore : this.redScore).getBoundingClientRect();
    slot.x0 = (projected.x + 1) * window.innerWidth / 2;
    slot.y0 = (1 - projected.y) * window.innerHeight / 2;
    slot.x1 = target.left + target.width / 2;
    slot.y1 = target.top + target.height / 2;
    slot.at = now;
    slot.team = team;
    slot.active = true;
    slot.element.hidden = false;
  }

  updateFlyGems(now) {
    for (const fly of this.flyGems) {
      if (!fly.active) continue;
      const t = Math.min(1, (now - fly.at) / 440);
      const ease = 1 - (1 - t) ** 3;
      fly.element.style.left = `${fly.x0 + (fly.x1 - fly.x0) * ease}px`;
      fly.element.style.top = `${fly.y0 + (fly.y1 - fly.y0) * ease - Math.sin(t * Math.PI) * 32}px`;
      fly.element.style.transform = `translate(-50%, -50%) scale(${1 - t * .3}) rotate(${t * 540}deg)`;
      if (t === 1) {
        fly.active = false;
        fly.element.hidden = true;
        this.pulseScore(fly.team);
      }
    }
  }

  pulseScore(team) {
    const element = team === 'blue' ? this.blueScore : this.redScore;
    element.classList.remove('score-pulse');
    void element.offsetWidth;
    element.classList.add('score-pulse');
  }

  updateHud(now) {
    if (now - this.lastHudAt < 100 && this.match.phase !== 'finished') return;
    this.lastHudAt = now;
    const scores = this.match.scoreInto(this.hudScores);
    for (const team of teams) {
      if (scores[team] !== this.scoreShown[team]) {
        this.scoreShown[team] = scores[team];
        this.pulseScore(team);
      }
    }
    setTextIfChanged(this.blueScore, `${scores.blue}/${GEM_RULES.targetGems}`);
    setTextIfChanged(this.redScore, `${scores.red}/${GEM_RULES.targetGems}`);
    const remaining = Math.max(0, this.match.startAt + GEM_RULES.matchTime - now);
    const totalSeconds = Math.ceil(remaining / 1000);
    setTextIfChanged(this.clock, this.match.phase === 'suddenDeath' ? 'MORTE SÚBITA'
      : `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`);
    this.clock.classList.toggle('sudden', this.match.phase === 'suddenDeath');
    setTextIfChanged(this.healthHud, `VIDA ${this.playerActor.hp}/${this.playerActor.stats.health}`);
    const blueEnd = this.match.countdowns.blue;
    const redEnd = this.match.countdowns.red;
    if (blueEnd !== null || redEnd !== null) {
      const team = redEnd === null || (blueEnd !== null && blueEnd <= redEnd) ? 'blue' : 'red';
      const end = this.match.countdowns[team];
      setTextIfChanged(this.countdown,
        `${team === this.viewTeam ? 'SEU TIME' : 'INIMIGOS'} VENCEM EM ${Math.max(0, Math.ceil((end - now) / 1000))}`);
      this.countdown.hidden = false;
      this.countdown.classList.toggle('enemy', team !== this.viewTeam);
      this.countdown.classList.toggle('urgent', end - now <= 5000);
    } else {
      this.countdown.hidden = true;
      this.countdown.classList.remove('urgent');
    }
    if (this.match.phase === 'finished' && !this.endShown) {
      this.endShown = true;
      this.countdown.hidden = true;
      this.endTitle.textContent = this.match.winner === this.viewTeam ? 'VITÓRIA' : 'DERROTA';
      this.endScreen.hidden = false;
      document.dispatchEvent(new Event('standfronts:match-end'));
      this.networkSink?.({ type: 'finish', actorId: this.localActorId });
    }
  }
}
