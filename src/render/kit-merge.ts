// Fewer draw calls for the street kit, on top of batchStatic. A building is a box with its own facade on the front
// and shared materials on the top and sides, so it cost a draw per material plus its outline. Here the top and
// sides split off to batch with everything else that looks the same, and every static outline in the kit merges
// into one mesh. A floor goes from about 150-220 draws to well under half that.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { inkNormals, outlineMaterial } from './toon';

// meshes that move, scale or hide their vertices keep their own outline
const live = (o: THREE.Object3D) => o.userData.gate || o.userData.forkSign || o.userData.keep;

function local(o: THREE.Object3D, root: THREE.Object3D): THREE.Matrix4 {
  return new THREE.Matrix4().multiplyMatrices(root.matrixWorld.clone().invert(), o.matrixWorld);
}

// split each multi-material mesh into one mesh per face group (marked noInk: the pieces of a box can't outline
// themselves). Returns the whole boxes, in root space, for mergeInk to outline.
export function splitSlabs(root: THREE.Object3D): THREE.BufferGeometry[] {
  root.updateMatrixWorld(true);
  const list: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && Array.isArray(o.material) && !(o instanceof THREE.InstancedMesh) && !(o instanceof THREE.SkinnedMesh) && !live(o) && o.geometry.groups.length && o.visible) list.push(o);
  });
  const whole: THREE.BufferGeometry[] = [];
  for (const mesh of list) {
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
      if (mesh.userData.track !== undefined) piece.userData.track = mesh.userData.track;
      parent.add(piece);
    }
    const box = geo.clone();
    box.clearGroups();
    box.userData.track = mesh.userData.track;
    whole.push(box.applyMatrix4(local(mesh, root)));
    mesh.removeFromParent();
    geo.dispose();
  }
  return whole;
}

// position and inkNormal only, baked into root space, always indexed
function hullGeometry(src: THREE.BufferGeometry, m: THREE.Matrix4 | null): THREE.BufferGeometry {
  inkNormals(src);
  const pos = src.getAttribute('position').clone();
  const nor = src.getAttribute('inkNormal').clone();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', pos);
  g.setAttribute('inkNormal', nor);
  if (src.index) g.setIndex(src.index.clone());
  else g.setIndex(Array.from({ length: pos.count }, (_, i) => i));
  if (m) {
    pos.applyMatrix4(m);
    nor.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(m));
  }
  return g;
}

// merge the kit's static outlines, and outlines for the split boxes, into one mesh (one a lane, where a floor has
// lanes: the lane the skater isn't in loses its outlines)
export function mergeInk(root: THREE.Object3D, whole: THREE.BufferGeometry[] = []): THREE.Mesh[] {
  root.updateMatrixWorld(true);
  const hulls: THREE.Mesh[] = [];
  root.traverse((o) => {
    const p = o.parent;
    if (!(o instanceof THREE.Mesh) || !o.userData.ink || o instanceof THREE.InstancedMesh || o instanceof THREE.SkinnedMesh) return;
    if (!p || p instanceof THREE.InstancedMesh || p instanceof THREE.SkinnedMesh || live(p) || !p.visible) return;
    hulls.push(o);
  });
  const lanes = new Map<string, THREE.BufferGeometry[]>();
  const put = (track: unknown, g: THREE.BufferGeometry) => {
    const k = String(track ?? '-');
    lanes.set(k, [...(lanes.get(k) ?? []), g]);
  };
  for (const h of hulls) put(h.parent!.userData.track, hullGeometry(h.geometry, local(h, root)));
  for (const g of whole) put(g.userData.track, hullGeometry(g, null));
  for (const g of whole) g.dispose();
  const out: THREE.Mesh[] = [];
  for (const [k, geos] of lanes) {
    const merged = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const ink = new THREE.Mesh(merged, outlineMaterial());
    ink.name = 'ink';
    ink.userData.ink = true;
    ink.userData.inkMerged = true;
    if (k !== '-') ink.userData.track = Number(k);
    ink.frustumCulled = false;
    out.push(ink);
  }
  if (!out.length) return out;
  for (const h of hulls) h.removeFromParent();
  root.add(...out);
  return out;
}
