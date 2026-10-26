// Merge a static group's meshes that look the same (same kind of material, texture, colour and flags) into one
// mesh each, so a floor's street kit costs a few dozen draw calls instead of hundreds. Older iPhones are
// limited by draw calls far more than by triangles. Facade materials stay separate: each gets its own window map.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { run, sliceDone } from './slice';

function key(mesh: THREE.Mesh): string | null {
  const m = mesh.material;
  if (Array.isArray(m) || m.userData.facade || mesh.userData.gate || mesh.userData.keep || mesh.userData.forkSign) return null;
  const g = mesh.geometry;
  const c = (m as THREE.MeshLambertMaterial).color;
  const flags = [m.type, (m as THREE.MeshLambertMaterial).map?.uuid ?? '-', c ? c.getHexString() : '-', (m as THREE.MeshLambertMaterial).emissive?.getHexString() ?? '-', m.transparent, m.alphaTest, m.side, m.vertexColors, m.opacity];
  const attrs = Object.keys(g.attributes).sort().join(',');
  return `${flags.join('|')}|${attrs}|${g.index ? 'i' : 'n'}`;
}

const mat = new THREE.Matrix4();
const nmat = new THREE.Matrix3();

// the meshes' geometries baked into root space and merged, straight into the merged arrays (the same result as
// cloning each, applyMatrix4 and mergeGeometries, without the copies: that took most of a floor's build).
// null when they're not plain attributes of one kind (interleaved, morphs): the caller merges the slow way
export function bakeMerge(list: THREE.Mesh[], inv: THREE.Matrix4): THREE.BufferGeometry | null {
  return run(bakeSteps(list, inv));
}

// bakeMerge a mesh at a time, yielding when the frame's slice is spent (slice.ts)
function* bakeSteps(list: THREE.Mesh[], inv: THREE.Matrix4): Generator<void, THREE.BufferGeometry | null> {
  const first = list[0].geometry;
  const names = Object.keys(first.attributes);
  const indexed = first.index !== null;
  let verts = 0;
  let idx = 0;
  for (const mesh of list) {
    const g = mesh.geometry;
    if (Object.keys(g.morphAttributes).length || (g.index !== null) !== indexed) return null;
    for (const n of names) {
      const a = g.attributes[n] as THREE.BufferAttribute;
      const f = first.attributes[n] as THREE.BufferAttribute;
      if (!a || (a as unknown as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute || a.itemSize !== f.itemSize || a.normalized !== f.normalized || a.array.constructor !== f.array.constructor) return null;
    }
    verts += g.attributes.position.count;
    if (indexed) idx += g.index!.count;
  }
  const out = new THREE.BufferGeometry();
  const arrays: Record<string, THREE.TypedArray> = {};
  for (const n of names) {
    const f = first.attributes[n] as THREE.BufferAttribute;
    const Ctor = f.array.constructor as new (n: number) => THREE.TypedArray;
    arrays[n] = new Ctor(verts * f.itemSize);
  }
  const index = indexed ? (verts - 1 >= 65535 ? new Uint32Array(idx) : new Uint16Array(idx)) : null;
  let v0 = 0;
  let i0 = 0;
  for (const mesh of list) {
    if (sliceDone()) yield;
    const g = mesh.geometry;
    const count = g.attributes.position.count;
    mat.multiplyMatrices(inv, mesh.matrixWorld);
    const e = mat.elements;
    nmat.getNormalMatrix(mat);
    const ne = nmat.elements;
    for (const n of names) {
      const src = (g.attributes[n] as THREE.BufferAttribute).array;
      const dst = arrays[n];
      const size = (g.attributes[n] as THREE.BufferAttribute).itemSize;
      const at = v0 * size;
      if (n === 'position' && size === 3) {
        for (let i = 0; i < count * 3; i += 3) {
          const x = src[i];
          const y = src[i + 1];
          const z = src[i + 2];
          const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
          dst[at + i] = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
          dst[at + i + 1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
          dst[at + i + 2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
        }
      } else if (n === 'normal' && size === 3) {
        for (let i = 0; i < count * 3; i += 3) {
          const x = src[i];
          const y = src[i + 1];
          const z = src[i + 2];
          const nx = ne[0] * x + ne[3] * y + ne[6] * z;
          const ny = ne[1] * x + ne[4] * y + ne[7] * z;
          const nz = ne[2] * x + ne[5] * y + ne[8] * z;
          const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          dst[at + i] = nx / l;
          dst[at + i + 1] = ny / l;
          dst[at + i + 2] = nz / l;
        }
      } else if (n === 'tangent' && size === 4) {
        for (let i = 0; i < count * 4; i += 4) {
          const x = src[i];
          const y = src[i + 1];
          const z = src[i + 2];
          const tx = e[0] * x + e[4] * y + e[8] * z;
          const ty = e[1] * x + e[5] * y + e[9] * z;
          const tz = e[2] * x + e[6] * y + e[10] * z;
          const l = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
          dst[at + i] = tx / l;
          dst[at + i + 1] = ty / l;
          dst[at + i + 2] = tz / l;
          dst[at + i + 3] = src[i + 3];
        }
      } else dst.set(src.subarray(0, count * size), at);
    }
    if (index) {
      const src = g.index!.array;
      for (let i = 0; i < src.length; i++) index[i0 + i] = src[i] + v0;
      i0 += src.length;
    }
    v0 += count;
  }
  for (const n of names) {
    const f = first.attributes[n] as THREE.BufferAttribute;
    out.setAttribute(n, new THREE.BufferAttribute(arrays[n], f.itemSize, f.normalized));
  }
  if (index) out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}

// the slow way, for what bakeMerge can't take
function cloneMerge(list: THREE.Mesh[], inv: THREE.Matrix4): THREE.BufferGeometry | null {
  const geos = list.map((mesh) => mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld)));
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return merged;
}

// returns how many meshes were merged away
export function batchStatic(root: THREE.Object3D): number {
  return run(batchSteps(root));
}

// batchStatic a merge at a time, yielding when the frame's slice is spent (slice.ts)
export function* batchSteps(root: THREE.Object3D): Generator<void, number> {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const groups = new Map<string, THREE.Mesh[]>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || o instanceof THREE.SkinnedMesh || !o.visible) return;
    const k = key(o);
    if (!k) return;
    const list = groups.get(k);
    if (list) list.push(o);
    else groups.set(k, [o]);
  });
  let saved = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    if (sliceDone()) yield;
    const merged = (yield* bakeSteps(list, inv)) ?? cloneMerge(list, inv);
    if (!merged) continue;
    const material = list[0].material as THREE.Material;
    for (const mesh of list) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      if (mesh.material !== material) (mesh.material as THREE.Material).dispose();
    }
    const out = new THREE.Mesh(merged, material);
    out.name = 'batch';
    root.add(out);
    saved += list.length - 1;
  }
  return saved;
}
