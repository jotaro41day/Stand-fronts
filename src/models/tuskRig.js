import * as THREE from 'three';

const smoothstep = (start, end, value) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

function classifyPieces(geometry, centerX, minY, height, width) {
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
  for (let triangle = 0; triangle < triangles.count; triangle += 3) {
    const first = root(triangles.getX(triangle));
    parent[root(triangles.getX(triangle + 1))] = first;
    parent[root(triangles.getX(triangle + 2))] = first;
  }
  const stats = new Map();
  for (let vertex = 0; vertex < position.count; vertex++) {
    const id = root(vertex);
    const piece = stats.get(id) ?? { count: 0, x: 0, y: 0, lowY: 1, highY: 0 };
    const y = (position.getY(vertex) - minY) / height;
    piece.count++;
    piece.x += position.getX(vertex) - centerX;
    piece.y += y;
    piece.lowY = Math.min(piece.lowY, y);
    piece.highY = Math.max(piece.highY, y);
    stats.set(id, piece);
  }
  return Array.from(parent, (_, vertex) => {
    const piece = stats.get(root(vertex));
    const meanY = piece.y / piece.count;
    const meanX = Math.abs(piece.x / piece.count);
    if (piece.lowY < .16 && meanY < .40) return 'leg';
    if (piece.lowY > .60 && meanY > .75) return 'head';
    if (piece.lowY > .23 && meanX > width * .20 && meanY > .30 && meanY < .72) return 'arm';
    return null;
  });
}

export function createTuskRig(source) {
  const geometry = source.geometry.clone();
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const height = max.y - min.y;
  const width = max.x - min.x;
  if (height <= 0 || width <= 0) throw new Error('Tusk GLB has invalid proportions');
  const centerX = (min.x + max.x) / 2;
  const centerZ = (min.z + max.z) / 2;
  const hipY = min.y + height * .34;
  const shoulderY = min.y + height * .64;
  const neckY = min.y + height * .76;
  const bones = Object.fromEntries(
    ['hips', 'torso', 'head', 'leftLeg', 'rightLeg', 'leftArm', 'rightArm']
      .map(name => [name, new THREE.Bone()]),
  );
  for (const [name, bone] of Object.entries(bones)) bone.name = name;
  bones.hips.position.set(centerX, hipY, centerZ);
  bones.torso.position.y = shoulderY - hipY;
  bones.head.position.y = neckY - shoulderY;
  bones.leftLeg.position.x = -width * .23;
  bones.rightLeg.position.x = width * .23;
  bones.leftArm.position.x = -width * .30;
  bones.rightArm.position.x = width * .30;
  bones.hips.add(bones.torso, bones.leftLeg, bones.rightLeg);
  bones.torso.add(bones.head, bones.leftArm, bones.rightArm);

  const position = geometry.getAttribute('position');
  const pieces = classifyPieces(geometry, centerX, min.y, height, width);
  const indices = new Uint16Array(position.count * 4);
  const weights = new Float32Array(position.count * 4);
  for (let vertex = 0; vertex < position.count; vertex++) {
    const x = position.getX(vertex) - centerX;
    const y = (position.getY(vertex) - min.y) / height;
    const piece = pieces?.[vertex];
    const head = piece === 'head' ? 1 : piece === 'leg' ? 0
      : smoothstep(.69, .81, y);
    const leg = piece === 'leg' ? 1 : piece === 'arm' || piece === 'head' ? 0
      : (1 - head) * (1 - smoothstep(.25, .46, y));
    const armSide = smoothstep(width * .11, width * .30, Math.abs(x));
    const armHeight = smoothstep(.22, .36, y) * (1 - smoothstep(.69, .84, y));
    const arm = piece === 'leg' || piece === 'head' ? 0
      : (1 - head - leg) * armSide * armHeight;
    const torso = (1 - head - leg - arm) * smoothstep(.31, .52, y);
    const hips = 1 - head - leg - arm - torso;
    const side = smoothstep(-width * .035, width * .035, x);
    const influence = [
      [0, hips], [1, torso], [2, head],
      [3, leg * (1 - side)], [4, leg * side],
      [5, arm * (1 - side)], [6, arm * side],
    ].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = influence.reduce((sum, entry) => sum + entry[1], 0);
    for (let slot = 0; slot < 4; slot++) {
      indices[vertex * 4 + slot] = influence[slot]?.[0] ?? 0;
      weights[vertex * 4 + slot] = (influence[slot]?.[1] ?? 0) / total;
    }
  }
  // UV and material seams duplicate vertices at the same location. Give each
  // copy the same skinning so the shoulder cannot split during the punch.
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
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));

  const mesh = new THREE.SkinnedMesh(geometry, source.material);
  mesh.name = source.name;
  mesh.position.copy(source.position);
  mesh.quaternion.copy(source.quaternion);
  mesh.scale.copy(source.scale);
  mesh.frustumCulled = false;
  mesh.add(bones.hips);
  mesh.bind(new THREE.Skeleton(Object.values(bones)));
  return { mesh, bones };
}
