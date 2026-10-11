import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

function tuskSource() {
  const raw = readFileSync(new URL('../assets/stand.glb', import.meta.url));
  const jsonLength = raw.readUInt32LE(12);
  const gltf = JSON.parse(raw.subarray(20, 20 + jsonLength).toString());
  const binaryStart = 20 + jsonLength + 8;
  const primitive = gltf.meshes[0].primitives[0];
  const readAccessor = accessorIndex => {
    const accessor = gltf.accessors[accessorIndex];
    const view = gltf.bufferViews[accessor.bufferView];
    const components = accessor.type === 'VEC3' ? 3 : 1;
    const bytes = accessor.componentType === 5126 || accessor.componentType === 5125 ? 4 : 2;
    const values = accessor.componentType === 5126
      ? new Float32Array(accessor.count * components)
      : new Uint32Array(accessor.count * components);
    for (let vertex = 0; vertex < accessor.count; vertex++) {
      for (let axis = 0; axis < components; axis++) {
        const offset = binaryStart + view.byteOffset + (accessor.byteOffset ?? 0)
          + vertex * (view.byteStride ?? components * bytes) + axis * bytes;
        values[vertex * components + axis] = accessor.componentType === 5126
          ? raw.readFloatLE(offset)
          : accessor.componentType === 5125 ? raw.readUInt32LE(offset) : raw.readUInt16LE(offset);
      }
    }
    return values;
  };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(readAccessor(primitive.attributes.POSITION), 3));
  geometry.setIndex(new THREE.BufferAttribute(readAccessor(primitive.indices), 1));
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
}

function influence(mesh, vertex, bone) {
  const boneIndex = mesh.skeleton.bones.indexOf(bone);
  const indices = mesh.geometry.getAttribute('skinIndex');
  const weights = mesh.geometry.getAttribute('skinWeight');
  let total = 0;
  for (let slot = 0; slot < 4; slot++) {
    if (indices.getComponent(vertex, slot) === boneIndex) total += weights.getComponent(vertex, slot);
  }
  return total;
}

test('Tusk GLB rigs its head, hands and legs without pulling a leg into the punch', async () => {
  const module = await import('./tuskRig.js').catch(() => ({}));
  assert.equal(typeof module.createTuskRig, 'function');
  const { mesh, bones } = module.createTuskRig(tuskSource());
  assert.ok(mesh.isSkinnedMesh);
  assert.equal(mesh.skeleton.bones.length, 7);
  assert.ok(influence(mesh, 772, bones.head) > .6);
  assert.ok(influence(mesh, 560, bones.rightArm) > .5);
  assert.ok(influence(mesh, 1449, bones.rightLeg) > .5);
  assert.ok(influence(mesh, 1449, bones.rightArm) < .05);
  const restHand = mesh.getVertexPosition(560, new THREE.Vector3()).clone();
  bones.rightArm.rotation.x = -1;
  mesh.updateMatrixWorld(true);
  const punchedHand = mesh.getVertexPosition(560, new THREE.Vector3());
  assert.ok(punchedHand.z > restHand.z + .08, `hand z: ${restHand.z} -> ${punchedHand.z}`);
});

test('Tusk shoulder stays closed while its right arm punches', async () => {
  const { createTuskRig } = await import('./tuskRig.js');
  const { mesh, bones } = createTuskRig(tuskSource());
  const position = mesh.geometry.getAttribute('position');
  const box = mesh.geometry.boundingBox;
  const height = box.max.y - box.min.y;
  const centerX = (box.min.x + box.max.x) / 2;
  const coincident = new Map();
  for (let vertex = 0; vertex < position.count; vertex++) {
    const x = position.getX(vertex) - centerX;
    const y = (position.getY(vertex) - box.min.y) / height;
    if (x < .05 || x > .34 || y < .42 || y > .8) continue;
    const key = [position.getX(vertex), position.getY(vertex), position.getZ(vertex)]
      .map(value => value.toFixed(5)).join(',');
    const group = coincident.get(key) ?? [];
    group.push(vertex);
    coincident.set(key, group);
  }
  bones.rightArm.rotation.x = -1.1;
  bones.rightArm.position.z = .07;
  mesh.updateMatrixWorld(true);
  let maxGap = 0;
  let checked = 0;
  for (const group of coincident.values()) {
    if (group.length < 2) continue;
    const first = mesh.getVertexPosition(group[0], new THREE.Vector3());
    for (const vertex of group.slice(1)) {
      maxGap = Math.max(maxGap, first.distanceTo(mesh.getVertexPosition(vertex, new THREE.Vector3())));
      checked++;
    }
  }
  assert.ok(checked > 0, 'the GLB has coincident shoulder seams to check');
  assert.ok(maxGap < .01, `shoulder seam opened by ${maxGap.toFixed(3)} model units`);
});

test('Tusk hovers without stepping while the player moves and punches when triggered', async () => {
  const rigModule = await import('./tuskRig.js').catch(() => ({}));
  const animationModule = await import('./tuskAnimator.js').catch(() => ({}));
  assert.equal(typeof rigModule.createTuskRig, 'function');
  assert.equal(typeof animationModule.createTuskAnimator, 'function');
  const { bones } = rigModule.createTuskRig(tuskSource());
  const animator = animationModule.createTuskAnimator(bones);
  animator.update(1000, 0, .1);
  assert.ok(Math.abs(bones.torso.rotation.z) > .001);
  for (const time of [1100, 1200, 1300]) {
    animator.update(time, 1, .1);
    assert.equal(bones.leftLeg.rotation.x, 0);
    assert.equal(bones.rightLeg.rotation.x, 0);
    assert.equal(bones.leftArm.rotation.x, 0);
    assert.ok(Math.abs(bones.rightArm.rotation.x) < 1e-8);
  }
  animator.triggerAttack(1300);
  animator.update(1440, 0, .14);
  assert.ok(bones.rightArm.rotation.x < -.6);
  animator.update(1800, 0, .36);
  assert.ok(bones.rightArm.rotation.x > -.4);
});
