// Merge a static group's meshes that look the same (same kind of material, texture, colour and flags) into one
// mesh each, so a floor's street kit costs a few dozen draw calls instead of hundreds. Older iPhones are
// limited by draw calls far more than by triangles. Facade materials stay separate: each gets its own window map.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function key(mesh: THREE.Mesh): string | null {
  const m = mesh.material;
  if (Array.isArray(m) || m.userData.facade || mesh.userData.gate || mesh.userData.keep || mesh.userData.forkSign) return null;
  const g = mesh.geometry;
  const c = (m as THREE.MeshLambertMaterial).color;
  const flags = [m.type, (m as THREE.MeshLambertMaterial).map?.uuid ?? '-', c ? c.getHexString() : '-', (m as THREE.MeshLambertMaterial).emissive?.getHexString() ?? '-', m.transparent, m.alphaTest, m.side, m.vertexColors, m.opacity];
  const attrs = Object.keys(g.attributes).sort().join(',');
  return `${flags.join('|')}|${attrs}|${g.index ? 'i' : 'n'}|${mesh.userData.track ?? '-'}`; // (lanes batch apart)
}

// returns how many meshes were merged away
export function batchStatic(root: THREE.Object3D): number {
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
    const geos = list.map((mesh) => mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld)));
    const merged = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const material = list[0].material as THREE.Material;
    for (const mesh of list) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      if (mesh.material !== material) (mesh.material as THREE.Material).dispose();
    }
    const out = new THREE.Mesh(merged, material);
    out.name = 'batch';
    if (list[0].userData.track !== undefined) out.userData.track = list[0].userData.track;
    root.add(out);
    saved += list.length - 1;
  }
  return saved;
}
