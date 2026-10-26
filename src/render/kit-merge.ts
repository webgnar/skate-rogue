// Fewer draw calls for the street kit, on top of batchStatic. A building is a box with its own facade on the front
// and shared materials on the top and sides, so it cost a draw per material plus its outline. Here the top and
// sides split off to batch with everything else that looks the same, and every static outline in the kit merges
// into one mesh. A floor goes from about 150-220 draws to well under half that.
import * as THREE from 'three';
import { inkNormalSteps, outlineMaterial } from './toon';
import { run, sliceDone } from './slice';

// meshes that move, scale or hide their vertices keep their own outline
const live = (o: THREE.Object3D) => o.userData.gate || o.userData.forkSign || o.userData.keep;

function local(o: THREE.Object3D, root: THREE.Object3D): THREE.Matrix4 {
  return new THREE.Matrix4().multiplyMatrices(root.matrixWorld.clone().invert(), o.matrixWorld);
}

// split each multi-material mesh into one mesh per face group (marked noInk: the pieces of a box can't outline
// themselves). Returns the whole boxes, in root space, for mergeInk to outline.
export function splitSlabs(root: THREE.Object3D): THREE.BufferGeometry[] {
  return run(splitSteps(root));
}

// splitSlabs a mesh at a time, yielding when the frame's slice is spent (slice.ts)
export function* splitSteps(root: THREE.Object3D): Generator<void, THREE.BufferGeometry[]> {
  root.updateMatrixWorld(true);
  const list: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && Array.isArray(o.material) && !(o instanceof THREE.InstancedMesh) && !(o instanceof THREE.SkinnedMesh) && !live(o) && o.geometry.groups.length && o.visible) list.push(o);
  });
  const whole: THREE.BufferGeometry[] = [];
  for (const mesh of list) {
    if (sliceDone()) yield;
    const geo = mesh.geometry;
    const mats = mesh.material as THREE.Material[];
    const parent = mesh.parent!;
    const index = geo.index;
    for (const g of geo.groups) {
      let sub: THREE.BufferGeometry;
      if (index) {
        sub = geo.clone();
        sub.clearGroups();
        sub.setIndex(Array.from(index.array.slice(g.start, g.start + g.count)));
      } else {
        //a draw range would be lost when batchStatic merges the piece: copy out just the group's vertices
        sub = new THREE.BufferGeometry();
        for (const [name, attr] of Object.entries(geo.attributes)) {
          const a = attr as THREE.BufferAttribute;
          const n = a.itemSize;
          sub.setAttribute(name, new THREE.BufferAttribute(a.array.slice(g.start * n, (g.start + g.count) * n), n, a.normalized));
        }
      }
      const piece = new THREE.Mesh(sub, mats[g.materialIndex ?? 0]);
      piece.position.copy(mesh.position);
      piece.quaternion.copy(mesh.quaternion);
      piece.scale.copy(mesh.scale);
      piece.renderOrder = mesh.renderOrder;
      piece.userData.noInk = true;
      parent.add(piece);
    }
    const box = geo.clone();
    box.clearGroups();
    whole.push(box.applyMatrix4(local(mesh, root)));
    mesh.removeFromParent();
    geo.dispose();
  }
  return whole;
}

// merge the kit's static outlines, and outlines for the split boxes, into one mesh
export function mergeInk(root: THREE.Object3D, whole: THREE.BufferGeometry[] = []): THREE.Mesh | null {
  return run(mergeInkSteps(root, whole));
}

const nmat = new THREE.Matrix3();
const v = new THREE.Vector3();

// mergeInk a hull at a time, yielding when the frame's slice is spent (slice.ts). Each hull's position and
// inkNormal are baked into root space straight into the merged arrays, always indexed
export function* mergeInkSteps(root: THREE.Object3D, whole: THREE.BufferGeometry[] = []): Generator<void, THREE.Mesh | null> {
  root.updateMatrixWorld(true);
  const hulls: THREE.Mesh[] = [];
  root.traverse((o) => {
    const p = o.parent;
    if (!(o instanceof THREE.Mesh) || !o.userData.ink || o instanceof THREE.InstancedMesh || o instanceof THREE.SkinnedMesh) return;
    if (!p || p instanceof THREE.InstancedMesh || p instanceof THREE.SkinnedMesh || live(p) || !p.visible) return;
    hulls.push(o);
  });
  const parts = [...hulls.map((h) => ({ src: h.geometry, m: local(h, root) as THREE.Matrix4 | null })), ...whole.map((g) => ({ src: g, m: null }))];
  if (!parts.length) return null;
  let verts = 0;
  let idx = 0;
  for (const p of parts) {
    if (sliceDone()) yield;
    yield* inkNormalSteps(p.src);
    const n = p.src.getAttribute('position').count;
    verts += n;
    idx += p.src.index ? p.src.index.count : n;
  }
  const pos = new Float32Array(verts * 3);
  const nor = new Float32Array(verts * 3);
  const index = verts - 1 >= 65535 ? new Uint32Array(idx) : new Uint16Array(idx);
  if (sliceDone()) yield;
  let v0 = 0;
  let i0 = 0;
  for (const { src, m } of parts) {
    if (sliceDone()) yield;
    const sp = src.getAttribute('position');
    const sn = src.getAttribute('inkNormal');
    const n = sp.count;
    if (m) nmat.getNormalMatrix(m);
    for (let i = 0; i < n; i++) {
      if ((i & 8191) === 8191 && sliceDone()) {
        yield;
        if (m) nmat.getNormalMatrix(m); // shared scratch: another merge may have used it in between
      }
      v.fromBufferAttribute(sp, i);
      if (m) v.applyMatrix4(m);
      pos[(v0 + i) * 3] = v.x;
      pos[(v0 + i) * 3 + 1] = v.y;
      pos[(v0 + i) * 3 + 2] = v.z;
      v.fromBufferAttribute(sn, i);
      if (m) v.applyNormalMatrix(nmat);
      nor[(v0 + i) * 3] = v.x;
      nor[(v0 + i) * 3 + 1] = v.y;
      nor[(v0 + i) * 3 + 2] = v.z;
    }
    if (src.index) {
      const a = src.index.array;
      for (let i = 0; i < a.length; i++) index[i0 + i] = a[i] + v0;
      i0 += a.length;
    } else {
      for (let i = 0; i < n; i++) index[i0 + i] = v0 + i;
      i0 += n;
    }
    v0 += n;
  }
  for (const g of whole) g.dispose();
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('inkNormal', new THREE.BufferAttribute(nor, 3));
  merged.setIndex(new THREE.BufferAttribute(index, 1));
  for (const h of hulls) h.removeFromParent();
  const ink = new THREE.Mesh(merged, outlineMaterial());
  ink.name = 'ink';
  ink.userData.ink = true;
  ink.userData.inkMerged = true;
  ink.frustumCulled = false;
  root.add(ink);
  return ink;
}
