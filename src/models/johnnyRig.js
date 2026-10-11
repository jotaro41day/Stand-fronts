import * as THREE from 'three';

const smoothstep = (start, end, value) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

function meshRegions(geometry, centerX, minY, height, width) {
  const triangles = geometry.getIndex();
  if (!triangles) return null;
  const position = geometry.getAttribute('position');
  const parent = Int32Array.from({ length: position.count }, (_, vertex) => vertex);
  const root = vertex => {
    while (parent[vertex] !== vertex) {
      parent[vertex] = parent[parent[vertex]];
      vertex = parent[vertex];
    }
    return vertex;
  };
  for (let i = 0; i < triangles.count; i += 3) {
    const first = root(triangles.getX(i));
    parent[root(triangles.getX(i + 1))] = first;
    parent[root(triangles.getX(i + 2))] = first;
  }
  const stats = new Map();
  for (let vertex = 0; vertex < position.count; vertex++) {
    const id = root(vertex);
    const record = stats.get(id) ?? { count: 0, x: 0, y: 0, lowY: 1, lowX: Infinity, highX: -Infinity };
    const y = (position.getY(vertex) - minY) / height;
    record.count++;
    record.x += position.getX(vertex) - centerX;
    record.y += y;
    record.lowY = Math.min(record.lowY, y);
    record.lowX = Math.min(record.lowX, position.getX(vertex));
    record.highX = Math.max(record.highX, position.getX(vertex));
    stats.set(id, record);
  }
  return Array.from(parent, (_, vertex) => {
    const region = stats.get(root(vertex));
    const meanX = Math.abs(region.x / region.count);
    const meanY = region.y / region.count;
    if (region.lowY < .16 && meanY < .34) return 'leg';
    if (region.lowY > .20 && meanX > width * .25 && meanY < .58) return 'arm';
    if (region.lowY < .20 && meanY > .34 && region.highX - region.lowX > width * .7) return 'body';
    return null;
  });
}

export function createJohnnyRig(source, options = {}) {
  const geometry = source.geometry.clone();
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const height = max.y - min.y;
  const width = max.x - min.x;
  if (height <= 0 || width <= 0) throw new Error('Johnny GLB has invalid proportions');
  const centerX = (min.x + max.x) / 2;
  const centerZ = (min.z + max.z) / 2;
  const hipY = min.y + height * (options.hip ?? .32);
  const shoulderY = min.y + height * (options.shoulder ?? .55);
  const neckY = min.y + height * (options.neck ?? .65);

  const bones = Object.fromEntries(
    ['hips', 'torso', 'head', 'leftLeg', 'rightLeg', 'leftArm', 'rightArm']
      .map(name => [name, new THREE.Bone()]),
  );
  for (const [name, bone] of Object.entries(bones)) bone.name = name;
  bones.hips.position.set(centerX, hipY, centerZ);
  bones.torso.position.y = shoulderY - hipY;
  bones.head.position.y = neckY - shoulderY;
  bones.leftLeg.position.x = -width * .16;
  bones.rightLeg.position.x = width * .16;
  bones.leftArm.position.x = -width * .28;
  bones.rightArm.position.x = width * .28;
  bones.hips.add(bones.torso, bones.leftLeg, bones.rightLeg);
  bones.torso.add(bones.head, bones.leftArm, bones.rightArm);

  const names = Object.keys(bones);
  const position = geometry.getAttribute('position');
  const regions = meshRegions(geometry, centerX, min.y, height, width);
  const indices = new Uint16Array(position.count * 4);
  const weights = new Float32Array(position.count * 4);
  for (let vertex = 0; vertex < position.count; vertex++) {
    const x = position.getX(vertex) - centerX;
    const y = (position.getY(vertex) - min.y) / height;
    const head = smoothstep(options.headStart ?? .60, options.headEnd ?? .70, y);
    // The hands reach farther out than the shoulders. A fixed side cutoff also
    // catches the trouser legs at low Y and stretches them during a punch.
    const shoulderReach = smoothstep(.23, .55, y);
    const armCenter = width * (.45 - .17 * shoulderReach);
    const armInner = armCenter - width * .09;
    const armSide = smoothstep(armInner, armInner + width * .07, Math.abs(x));
    const armHeight = smoothstep(.12, .25, y) * (1 - smoothstep(.54, .70, y));
    const arm = regions?.[vertex] === 'leg' || regions?.[vertex] === 'body' ? 0
      : regions?.[vertex] === 'arm' ? 1
        : (1 - head) * armSide * armHeight;
    const leg = (1 - head - arm) * (1 - smoothstep(.25, .42, y));
    const torso = (1 - head - arm - leg) * smoothstep(.28, .44, y);
    const hips = 1 - head - arm - leg - torso;
    const side = smoothstep(-width * .035, width * .035, x);
    const influences = [
      [0, hips], [1, torso], [2, head],
      [3, leg * (1 - side)], [4, leg * side],
      [5, arm * (1 - side)], [6, arm * side],
    ].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = influences.reduce((sum, influence) => sum + influence[1], 0);
    for (let slot = 0; slot < 4; slot++) {
      indices[vertex * 4 + slot] = influences[slot]?.[0] ?? 0;
      weights[vertex * 4 + slot] = (influences[slot]?.[1] ?? 0) / total;
    }
  }
  if (options.blendSeams) {
    // UV seams duplicate vertices. Matching their weights keeps Kira's jacket
    // and shoulder closed when the arm swings.
    const coincident = new Map();
    for (let vertex = 0; vertex < position.count; vertex++) {
      const key = [position.getX(vertex), position.getY(vertex), position.getZ(vertex)]
        .map(value => value.toFixed(5)).join(',');
      const group = coincident.get(key) ?? [];
      group.push(vertex);
      coincident.set(key, group);
    }
    for (const group of coincident.values()) {
      if (group.length < 2) continue;
      const averaged = new Float32Array(7);
      for (const vertex of group) {
        for (let slot = 0; slot < 4; slot++) {
          averaged[indices[vertex * 4 + slot]] += weights[vertex * 4 + slot] / group.length;
        }
      }
      const influence = Array.from(averaged, (weight, bone) => [bone, weight])
        .sort((a, b) => b[1] - a[1]).slice(0, 4);
      const total = influence.reduce((sum, [, weight]) => sum + weight, 0);
      for (const vertex of group) {
        for (let slot = 0; slot < 4; slot++) {
          indices[vertex * 4 + slot] = influence[slot][0];
          weights[vertex * 4 + slot] = influence[slot][1] / total;
        }
      }
    }
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));

  const mesh = new THREE.SkinnedMesh(geometry, source.material);
  mesh.name = source.name;
  mesh.position.copy(source.position);
  mesh.quaternion.copy(source.quaternion);
  mesh.scale.copy(source.scale);
  mesh.frustumCulled = false;
  mesh.add(bones.hips);
  const skeleton = new THREE.Skeleton(names.map(name => bones[name]));
  mesh.bind(skeleton);
  return { mesh, bones };
}
