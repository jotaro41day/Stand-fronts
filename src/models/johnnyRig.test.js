import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { addOutlineToModel } from '../visual/toon.js';

test('Johnny trousers do not follow the punching arm', async () => {
  const { createJohnnyRig } = await import('./johnnyRig.js');
  const raw = readFileSync(new URL('../assets/hero.glb', import.meta.url));
  const jsonLength = raw.readUInt32LE(12);
  const gltf = JSON.parse(raw.subarray(20, 20 + jsonLength).toString());
  const binaryStart = 20 + jsonLength + 8;
  const accessor = gltf.accessors.find(item => item.type === 'VEC3' && item.componentType === 5126);
  const view = gltf.bufferViews[accessor.bufferView];
  const positions = new Float32Array(accessor.count * 3);
  for (let vertex = 0; vertex < accessor.count; vertex++) {
    for (let axis = 0; axis < 3; axis++) {
      positions[vertex * 3 + axis] = raw.readFloatLE(
        binaryStart + view.byteOffset + (accessor.byteOffset ?? 0)
        + vertex * (view.byteStride ?? 12) + axis * 4,
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const { mesh, bones } = createJohnnyRig(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
  const index = mesh.geometry.getAttribute('skinIndex');
  const weight = mesh.geometry.getAttribute('skinWeight');
  const armIndex = mesh.skeleton.bones.indexOf(bones.rightArm);
  const armWeight = vertex => {
    let total = 0;
    for (let slot = 0; slot < 4; slot++) {
      if (index.getComponent(vertex, slot) === armIndex) total += weight.getComponent(vertex, slot);
    }
    return total;
  };
  // These adjacent vertices are on the right trouser leg, beside the low fist.
  for (const vertex of [8693, 8694, 8695]) {
    assert.ok(armWeight(vertex) < .05, `trouser vertex ${vertex} follows arm: ${armWeight(vertex)}`);
  }
  bones.rightArm.rotation.x = -1.15;
  bones.rightArm.position.z = .08;
  mesh.updateMatrixWorld(true);
  const posed = [8693, 8694, 8695].map(vertex => mesh.getVertexPosition(vertex, new THREE.Vector3()));
  const rest = [8693, 8694, 8695].map(vertex => new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('position'), vertex));
  for (let edge = 0; edge < 3; edge++) {
    const next = (edge + 1) % 3;
    assert.ok(posed[edge].distanceTo(posed[next]) / rest[edge].distanceTo(rest[next]) < 1.5);
  }
});

test('rig chibi assigns normalized, smoothly blended weights by body region', async () => {
  const module = await import('./johnnyRig.js').catch(() => ({}));
  assert.equal(typeof module.createJohnnyRig, 'function');

  const vertices = [
    [-.12, 0, 0], [.12, 0, 0],
    [-.12, .08, 0], [.12, .08, 0],
    [-.3, .38, 0], [.3, .38, 0],
    [0, .33, 0], [0, .52, 0],
    [0, .64, 0], [0, 1, 0],
    [.18, .5, 0], [.18, .5, 0],
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flat(), 3));
  const source = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  const { mesh, bones } = module.createJohnnyRig(source);
  const names = ['hips', 'torso', 'head', 'leftLeg', 'rightLeg', 'leftArm', 'rightArm'];
  assert.deepEqual(Object.keys(bones).sort(), names.sort());
  assert.equal(mesh.isSkinnedMesh, true);

  const index = mesh.geometry.getAttribute('skinIndex');
  const weight = mesh.geometry.getAttribute('skinWeight');
  const influence = (vertex, bone) => {
    const boneIndex = mesh.skeleton.bones.indexOf(bones[bone]);
    let result = 0;
    for (let slot = 0; slot < 4; slot++) {
      if (index.getComponent(vertex, slot) === boneIndex) result += weight.getComponent(vertex, slot);
    }
    return result;
  };

  for (let vertex = 0; vertex < vertices.length; vertex++) {
    let total = 0;
    for (let slot = 0; slot < 4; slot++) total += weight.getComponent(vertex, slot);
    assert.ok(Math.abs(total - 1) < 1e-5, `vertex ${vertex}: ${total}`);
  }
  assert.ok(influence(2, 'leftLeg') > .6);
  assert.ok(influence(3, 'rightLeg') > .6);
  assert.ok(influence(4, 'leftArm') > .6);
  assert.ok(influence(5, 'rightArm') > .6);
  assert.ok(influence(9, 'head') > .8);
  assert.ok(influence(8, 'head') > 0 && influence(8, 'torso') > 0);
  for (let slot = 0; slot < 4; slot++) {
    assert.equal(index.getComponent(10, slot), index.getComponent(11, slot));
    assert.equal(weight.getComponent(10, slot), weight.getComponent(11, slot));
  }
});

test('idle breathes, walking alternates limbs, and attack punches forward then returns', async () => {
  const module = await import('./johnnyAnimator.js').catch(() => ({}));
  assert.equal(typeof module.createJohnnyAnimator, 'function');
  const bones = Object.fromEntries(
    ['hips', 'torso', 'head', 'leftLeg', 'rightLeg', 'leftArm', 'rightArm']
      .map(name => [name, new THREE.Bone()]),
  );
  bones.hips.position.y = .32;
  const animator = module.createJohnnyAnimator(bones);

  animator.update(1000, 0, 1 / 60);
  assert.ok(Math.abs(bones.torso.scale.y - 1) > .001);
  assert.equal(bones.leftLeg.rotation.x, 0);

  animator.update(1100, 1, .1);
  assert.ok(Math.abs(bones.leftLeg.rotation.x) > .1);
  assert.ok(Math.abs(bones.leftLeg.rotation.x + bones.rightLeg.rotation.x) < 1e-5);
  assert.ok(bones.leftArm.rotation.x * bones.leftLeg.rotation.x < 0);
  assert.ok(bones.hips.position.y > .32);

  animator.triggerAttack(1100);
  animator.update(1230, 0, .13);
  assert.ok(bones.rightArm.rotation.x < -.65);
  animator.update(1600, 0, .37);
  assert.ok(bones.rightArm.rotation.x > -.4);
});

test('toon outline follows a skinned fist instead of staying in the rest pose', async () => {
  const { createJohnnyRig } = await import('./johnnyRig.js');
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -.3, 0, 0, .3, 0, 0, -.3, .38, 0, .3, .38, 0, 0, 1, 0,
  ], 3));
  const { mesh, bones } = createJohnnyRig(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
  addOutlineToModel(mesh);
  const outline = mesh.children.find(child => child !== bones.hips);
  assert.equal(outline?.isSkinnedMesh, true);
  const model = new THREE.Group();
  model.rotation.y = Math.PI / 2;
  model.scale.setScalar(2);
  model.add(mesh);
  bones.rightArm.rotation.x = -1;
  model.updateMatrixWorld(true);
  mesh.bindMatrixInverse.copy(mesh.matrixWorld).invert();
  if (outline.bindMode === THREE.AttachedBindMode) {
    outline.bindMatrixInverse.copy(outline.matrixWorld).invert();
  }
  const fist = mesh.getVertexPosition(3, new THREE.Vector3());
  const rim = outline.getVertexPosition(3, new THREE.Vector3());
  assert.ok(fist.z > .05);
  assert.ok(fist.distanceTo(rim) < 1e-5);
});
