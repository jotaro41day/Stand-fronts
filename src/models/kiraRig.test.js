import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createKiraRig } from './kiraRig.js';
import { createJohnnyAnimator } from './johnnyAnimator.js';
import { createTuskRig } from './tuskRig.js';
import { createTuskAnimator } from './tuskAnimator.js';

function sourceFromGlb(name) {
  const raw = readFileSync(new URL(`../assets/${name}.glb`, import.meta.url));
  const jsonLength = raw.readUInt32LE(12);
  const gltf = JSON.parse(raw.subarray(20, 20 + jsonLength).toString());
  const binaryStart = 20 + jsonLength + 8;
  const primitive = gltf.meshes[0].primitives[0];
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(gltf.accessors[primitive.attributes.POSITION].count * 3);
  const accessor = gltf.accessors[primitive.attributes.POSITION];
  const view = gltf.bufferViews[accessor.bufferView];
  for (let i = 0; i < accessor.count; i++) {
    for (let axis = 0; axis < 3; axis++) {
      positions[i * 3 + axis] = raw.readFloatLE(binaryStart + view.byteOffset +
        (accessor.byteOffset ?? 0) + i * (view.byteStride ?? 12) + axis * 4);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const indexAccessor = gltf.accessors[primitive.indices];
  const indexView = gltf.bufferViews[indexAccessor.bufferView];
  const indices = new Uint32Array(indexAccessor.count);
  for (let i = 0; i < indices.length; i++) {
    const at = binaryStart + indexView.byteOffset + (indexAccessor.byteOffset ?? 0) +
      i * (indexView.byteStride ?? (indexAccessor.componentType === 5125 ? 4 : 2));
    indices[i] = indexAccessor.componentType === 5125 ? raw.readUInt32LE(at) : raw.readUInt16LE(at);
  }
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
}

test('Kira GLB has a seven-bone chibi rig with normalized weights and closed seams', () => {
  const { mesh, bones } = createKiraRig(sourceFromGlb('kira'));
  const positions = mesh.geometry.getAttribute('position');
  const indices = mesh.geometry.getAttribute('skinIndex');
  const weights = mesh.geometry.getAttribute('skinWeight');
  assert.equal(mesh.skeleton.bones.length, 7);
  const max = { head: 0, leftLeg: 0, rightLeg: 0, leftArm: 0, rightArm: 0 };
  const coincident = new Map();
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const x = positions.getX(i);
    let sum = 0;
    for (let slot = 0; slot < 4; slot++) {
      const bone = mesh.skeleton.bones[indices.getComponent(i, slot)];
      const weight = weights.getComponent(i, slot);
      sum += weight;
      if (bone && max[bone.name] !== undefined) max[bone.name] = Math.max(max[bone.name], weight);
    }
    assert.ok(Math.abs(sum - 1) < 1e-5);
    if (y > .4 && y < .75 && Math.abs(x) > .17) {
      const key = [x, y, positions.getZ(i)].map(value => value.toFixed(5)).join(',');
      const group = coincident.get(key) ?? [];
      group.push(i);
      coincident.set(key, group);
    }
  }
  for (const bone of Object.keys(max)) assert.ok(max[bone] > .5, `${bone}: ${max[bone]}`);
  let seams = 0;
  for (const group of coincident.values()) {
    if (group.length < 2) continue;
    seams++;
    for (const i of group.slice(1)) for (let slot = 0; slot < 4; slot++) {
      assert.equal(indices.getComponent(i, slot), indices.getComponent(group[0], slot));
      assert.equal(weights.getComponent(i, slot), weights.getComponent(group[0], slot));
    }
  }
  assert.ok(seams > 0);
  const animator = createJohnnyAnimator(bones);
  animator.update(1000, 1, .1);
  assert.ok(bones.leftLeg.rotation.x * bones.rightLeg.rotation.x < 0);
  animator.triggerAttack(1000);
  animator.update(1140, 0, .14);
  assert.ok(bones.rightArm.rotation.x < -.6);
});

test('Killer Queen GLB uses the floating Stand rig and attacks without walking', () => {
  const { mesh, bones } = createTuskRig(sourceFromGlb('killer_queen'));
  assert.equal(mesh.skeleton.bones.length, 7);
  const animator = createTuskAnimator(bones);
  animator.update(1000, 1, .1);
  assert.equal(bones.leftLeg.rotation.x, 0);
  animator.triggerAttack(1000);
  animator.update(1150, 1, .15);
  assert.ok(bones.rightArm.rotation.x < -.6);
});
