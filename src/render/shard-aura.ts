// The gnar glow as shards (zack, 2026-10-30: "instead of curved lines, mimicking the model, it used only straight
// lines, but not 90 degree ones. sort of like a lower poly version of the model"). Each bone of the skater gets a
// low-poly hull of the vertices it moves (the extreme points along a handful of directions, wrapped in a convex
// hull), riding the bone; the board gets one too. Drawn as outlines pushed out behind the skater, the hulls' union
// is a faceted silhouette of straight edges: a glow in the gnar colours and a black ink edge round it.
//
// Three levels of it, finer to chunkier (zack: "alternate between the different poly types to the beat of the
// song"): the game steps it on each beat of the soundtrack, low, lower, lowest, lower, low...
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { glowMaterial, inkNormals, INK } from './toon';

export const SHARDS = {
  glow: 6.5, // CSS px the glow reaches past the hulls at full
  edge: 3, // and the black edge past that
  minVerts: 12, // bones that move fewer vertices than this get no shard of their own (fingers, toe tips)
};

const both = (axes: number[][]) =>
  axes.flatMap(([x, y, z]) => {
    const v = new THREE.Vector3(x, y, z).normalize();
    return [v, v.clone().negate()];
  });
const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const FACES = [[1, 1, 0], [1, -1, 0], [1, 0, 1], [1, 0, -1], [0, 1, 1], [0, 1, -1]];
const CORNERS = [[1, 1, 1], [1, 1, -1], [1, -1, 1], [-1, 1, 1]];

// the levels, finest first: the directions a hull takes its extreme points along (fewer directions, fewer and
// longer edges) and how much it's grown about its middle so the facets stand clear of the body. zack picked the
// finest of the three mockups as the look; it's where the glow starts and rests
export const LEVELS = [
  { dirs: both([...AXES, ...FACES, ...CORNERS]), swell: 1.08 },
  { dirs: both([...AXES, ...CORNERS]), swell: 1.15 },
  { dirs: both(CORNERS), swell: 1.3 },
];
// the order the beat steps through them
const STEPS = [0, 1, 2, 1];

// the low-poly hull of some points: the farthest along each direction
export function shardOf(points: THREE.Vector3[], level = LEVELS[0]): THREE.BufferGeometry | null {
  if (points.length < 4) return null;
  const picked = new Set<THREE.Vector3>();
  for (const d of level.dirs) {
    let best = points[0];
    let far = -Infinity;
    for (const p of points) {
      const k = p.dot(d);
      if (k > far) {
        far = k;
        best = p;
      }
    }
    picked.add(best);
  }
  if (picked.size < 4) return null;
  try {
    const mid = new THREE.Vector3();
    for (const p of picked) mid.add(p);
    mid.divideScalar(picked.size);
    const geo = new ConvexGeometry([...picked].map((p) => p.clone().sub(mid).multiplyScalar(level.swell).add(mid)));
    if (!geo.getAttribute('position')?.count) return null;
    inkNormals(geo);
    return geo;
  } catch {
    return null; // flat: the points all in a plane
  }
}

export class ShardAura {
  private readonly glow = glowMaterial(INK.width, 0xffd23f, 0.002);
  private readonly edge = glowMaterial(INK.width, INK.color, 0.004);
  private readonly hulls: THREE.Mesh[][] = LEVELS.map(() => []);
  private step = 0; // where in STEPS the beat has it

  // root: the skater rig's mesh; board: the group the board's meshes ride in
  constructor(root: THREE.Object3D, board: THREE.Object3D) {
    root.updateMatrixWorld(true);
    //the body's skinned parts (one merged mesh plus the few kept apart), all on one skeleton
    const parts: THREE.SkinnedMesh[] = [];
    root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh && !m.userData.ink && m.visible && m.name !== 'VisorGlint') parts.push(m);
    });
    if (parts.length) {
      const { bones } = parts[0].skeleton;
      const per: THREE.Vector3[][] = bones.map(() => []);
      for (const m of parts) if (m.skeleton.bones === bones || m.skeleton.bones.every((b, i) => b === bones[i])) this.points(m, per);
      per.forEach((pts, b) => {
        if (pts.length < SHARDS.minVerts) return;
        LEVELS.forEach((level, l) => {
          const geo = shardOf(pts, level);
          if (geo) this.add(bones[b], geo, l);
        });
      });
    }
    this.board(board);
  }

  // each vertex of a skinned part, in the space of the bone that moves it most
  private points(mesh: THREE.SkinnedMesh, per: THREE.Vector3[][]): void {
    const pos = mesh.geometry.getAttribute('position');
    const idx = mesh.geometry.getAttribute('skinIndex');
    const wt = mesh.geometry.getAttribute('skinWeight');
    if (!idx || !wt) return;
    const { boneInverses } = mesh.skeleton;
    for (let i = 0; i < pos.count; i++) {
      let b = idx.getX(i);
      let w = wt.getX(i);
      for (const [j, k] of [[idx.getY(i), wt.getY(i)], [idx.getZ(i), wt.getZ(i)], [idx.getW(i), wt.getW(i)]]) {
        if (k > w) {
          w = k;
          b = j;
        }
      }
      //into the bone's own space, as the skinning sees it at bind
      per[b]?.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mesh.bindMatrix).applyMatrix4(boneInverses[b]));
    }
  }

  // one shard round the whole board, in the board's own space
  private board(board: THREE.Object3D): void {
    board.updateMatrixWorld(true);
    const toBoard = board.matrixWorld.clone().invert();
    const pts: THREE.Vector3[] = [];
    const m = new THREE.Matrix4();
    board.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData.ink || !mesh.visible) return;
      m.multiplyMatrices(toBoard, mesh.matrixWorld);
      const pos = mesh.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) pts.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m));
    });
    LEVELS.forEach((level, l) => {
      const geo = shardOf(pts, level);
      if (geo) this.add(board, geo, l);
    });
  }

  private add(parent: THREE.Object3D, geo: THREE.BufferGeometry, level: number): void {
    for (const mat of [this.edge, this.glow]) {
      const hull = new THREE.Mesh(geo, mat);
      hull.userData.ink = true; // not a body part: the ink, rims and wear leave it alone
      hull.frustumCulled = false;
      hull.visible = false;
      hull.renderOrder = -1;
      parent.add(hull);
      this.hulls[level].push(hull);
    }
  }

  // on a beat: the next level (low, lower, lowest, lower, ...)
  beat(): void {
    this.step = (this.step + 1) % STEPS.length;
  }

  // amount 0..1 grows it in; t (seconds) cycles the colour gold, magenta, cyan (as the old Aura did)
  set(amount: number, t: number, pixelRatio: number): void {
    const on = amount > 0.01;
    if (!on) this.step = 0; // each gnar starts on the finest
    const level = STEPS[this.step];
    this.hulls.forEach((hulls, l) => {
      for (const h of hulls) h.visible = on && l === level;
    });
    if (!on) return;
    const glow = SHARDS.glow * amount * (0.85 + 0.15 * Math.sin(t * 12));
    this.glow.uniforms.uWidth.value = glow * pixelRatio;
    this.edge.uniforms.uWidth.value = (glow + SHARDS.edge * amount) * pixelRatio;
    (this.glow.uniforms.uColor.value as THREE.Color).setHSL((0.13 + t * 0.35) % 1, 1, 0.6);
  }
}
