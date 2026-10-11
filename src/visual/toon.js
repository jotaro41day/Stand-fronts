import * as THREE from 'three';

const steps = new Uint8Array([
  70, 70, 70, 255,
  126, 126, 126, 255,
  205, 205, 205, 255,
  255, 255, 255, 255,
]);
const gradient = new THREE.DataTexture(steps, 4, 1, THREE.RGBAFormat);
gradient.minFilter = THREE.NearestFilter;
gradient.magFilter = THREE.NearestFilter;
gradient.needsUpdate = true;

export function toon(color, options = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...options });
}

export function outlinedMesh(geometry, color, options = {}) {
  const mesh = new THREE.Mesh(geometry, toon(color, options));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const outline = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: 0x1b1232,
    side: THREE.BackSide,
  }));
  outline.scale.setScalar(1.075);
  mesh.add(outline);
  return mesh;
}

export function addMesh(parent, geometry, color, x, y, z, rotationZ = 0) {
  const mesh = outlinedMesh(geometry, color);
  mesh.position.set(x, y, z);
  mesh.rotation.z = rotationZ;
  parent.add(mesh);
  return mesh;
}

export function addOutlineToModel(mesh) {
  const original = mesh.material;
  if (Array.isArray(original)) return;
  mesh.material = toon(original?.color ?? 0xffffff, {
    map: original?.map ?? null,
    transparent: original?.transparent ?? false,
    opacity: original?.opacity ?? 1,
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: 0x1b1232,
    side: THREE.BackSide,
  });
  let outline;
  if (mesh.isSkinnedMesh) {
    const geometry = mesh.geometry.clone();
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    if (normal) {
      geometry.computeBoundingBox();
      const thickness = (geometry.boundingBox.max.y - geometry.boundingBox.min.y) * .022;
      for (let vertex = 0; vertex < position.count; vertex++) {
        position.setXYZ(vertex,
          position.getX(vertex) + normal.getX(vertex) * thickness,
          position.getY(vertex) + normal.getY(vertex) * thickness,
          position.getZ(vertex) + normal.getZ(vertex) * thickness);
      }
    }
    outline = new THREE.SkinnedMesh(geometry, outlineMaterial);
    outline.bind(mesh.skeleton, mesh.bindMatrix);
    outline.frustumCulled = false;
  } else {
    outline = new THREE.Mesh(mesh.geometry, outlineMaterial);
    outline.scale.setScalar(1.055);
  }
  mesh.add(outline);
}
