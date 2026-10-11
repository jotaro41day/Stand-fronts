import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { addOutlineToModel } from '../visual/toon.js';
import { createJohnnyRig } from './johnnyRig.js';
import { createKiraRig } from './kiraRig.js';
import { createJohnnyAnimator } from './johnnyAnimator.js';
import { createTuskRig } from './tuskRig.js';
import { createTuskAnimator } from './tuskAnimator.js';

const urls = import.meta.glob('../assets/*.glb', { query: '?url', import: 'default', eager: true });
const loader = new GLTFLoader();
const templates = new Map();
const definitions = {
  hero: { rig: createJohnnyRig, animate: createJohnnyAnimator },
  kira: { rig: createKiraRig, animate: createJohnnyAnimator },
  stand: { rig: createTuskRig, animate: createTuskAnimator },
  killer_queen: { rig: createTuskRig, animate: createTuskAnimator },
};

async function buildTemplate(name, desiredHeight, url) {
  const gltf = await loader.loadAsync(url);
  const model = gltf.scene;
  let source = null;
  model.traverse(object => { if (!source && object.isMesh) source = object; });
  if (!source) throw new Error(`${name} GLB has no mesh`);
  const rig = definitions[name]?.rig(source);
  if (rig) {
    source.parent.add(rig.mesh);
    source.parent.remove(source);
  }
  model.rotation.y = Math.PI / 2;
  const meshes = [];
  model.traverse(object => { if (object.isMesh) meshes.push(object); });
  for (const mesh of meshes) addOutlineToModel(mesh);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  if (size.y < .001) throw new Error(`Modelo ${name} sem altura válida`);
  model.position.set(-center.x, -box.min.y, -center.z);
  const wrapper = new THREE.Group();
  wrapper.add(model);
  wrapper.scale.setScalar(desiredHeight / size.y);
  return wrapper;
}

export async function loadModelIfPresent(name, desiredHeight) {
  const url = urls[`../assets/${name}.glb`];
  if (!url) return null;
  const key = `${name}:${desiredHeight}`;
  if (!templates.has(key)) {
    const promise = buildTemplate(name, desiredHeight, url);
    templates.set(key, promise);
    promise.catch(() => templates.delete(key));
  }
  const model = cloneSkeleton(await templates.get(key));
  model.traverse(object => {
    if (!object.isMesh) return;
    object.material = Array.isArray(object.material)
      ? object.material.map(material => material.clone()) : object.material.clone();
  });
  let animator = null;
  if (definitions[name]) {
    let skeleton = null;
    model.traverse(object => { if (!skeleton && object.isSkinnedMesh) skeleton = object.skeleton; });
    if (!skeleton) throw new Error(`${name} GLB has no skinned mesh`);
    const bones = Object.fromEntries(skeleton.bones.map(bone => [bone.name, bone]));
    animator = definitions[name].animate(bones);
  }
  return { model, animator };
}
