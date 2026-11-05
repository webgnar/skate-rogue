// The city pigeon built with the blender bot (art/bot/pigeon.blend, .claude/skills/blender-bot/build_pigeon.py):
// a skinned model with walk, peck, fly and coo clips. Two ways to draw it:
// - posed: its skinning baked into a few still meshes (sat, bowed, and frames of a wingbeat), so a whole sky route
//   of flocks draws as one instanced mesh a pose (src/render/sky-view.ts). A skinned mesh can't be instanced, and a
//   draw a bird made the sky route the most draws in the game on a small iPhone;
// - rigged: a skinned copy with its own mixer, for the few pigeons on the title screen (src/title/life.ts).
// Loaded with the other models on the loading screen; if it fails, both fall back to the code-built pigeons.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { toon } from './toon';

export const PIGEON_FILE = 'bot/pigeon.glb';
// beak to tail, in world units, before whatever scale the caller puts on it (the code-built pigeons were about this)
const LENGTH = 0.5;
// frames of one wingbeat baked for the flocks: the fly clip beats three times a loop
export const FLAP_FRAMES = 6;

let gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] } | null = null;
let fit: THREE.Matrix4 | null = null; // model space -> a pigeon LENGTH long, feet on y 0, beak to +x
let mat: THREE.Material | null = null;
let poses: Poses | null = null;

export interface Poses {
  sit: THREE.BufferGeometry; // at rest, sat on a wire or a roof
  bow: THREE.BufferGeometry; // bowed, mid coo
  flap: THREE.BufferGeometry[]; // FLAP_FRAMES through one wingbeat
}

export async function loadPigeon(base: string): Promise<void> {
  try {
    const g = await new GLTFLoader().loadAsync(`${base}models/${PIGEON_FILE}`);
    gltf = { scene: g.scene, animations: g.animations };
  } catch (err) {
    console.warn('the pigeon model failed to load, using the built-in pigeons', err);
  }
}

function skinnedOf(root: THREE.Object3D): THREE.SkinnedMesh | null {
  let out: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    if (!out && (o as THREE.SkinnedMesh).isSkinnedMesh) out = o as THREE.SkinnedMesh;
  });
  return out;
}

// the pigeon's look: its painted texture, toon lit, sampled hard-edged as it was painted
export function pigeonMaterial(): THREE.Material | null {
  if (mat || !gltf) return mat;
  const mesh = skinnedOf(gltf.scene);
  const src = mesh?.material as THREE.MeshStandardMaterial | undefined;
  const map = src?.map ?? null;
  if (map) {
    map.magFilter = THREE.NearestFilter;
    map.colorSpace = THREE.SRGBColorSpace;
  }
  mat = toon({ map });
  return mat;
}

// model space to game space: scaled to LENGTH, turned so the beak points +x (the code-built birds' head), feet on 0
function fitMatrix(mesh: THREE.SkinnedMesh): THREE.Matrix4 {
  if (fit) return fit;
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < mesh.geometry.getAttribute('position').count; i++) box.expandByPoint(mesh.getVertexPosition(i, v));
  const size = box.getSize(new THREE.Vector3());
  const s = LENGTH / size.z; // built facing -Y in Blender, so beak to tail runs along z in glTF
  const turn = new THREE.Matrix4().makeRotationY(Math.PI / 2); // +z (the beak) to +x
  const centre = new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  fit = new THREE.Matrix4().makeScale(s, s, s).premultiply(turn).multiply(centre);
  return fit;
}

// the baked poses, or null when the model didn't load
export function pigeonPoses(): Poses | null {
  if (poses || !gltf) return poses;
  const scene = cloneSkinned(gltf.scene);
  const mesh = skinnedOf(scene);
  if (!mesh) return null;
  const mixer = new THREE.AnimationMixer(scene);
  const clip = (name: string) => gltf!.animations.find((a) => a.name === name);
  const at = (name: string, time: number): THREE.BufferGeometry => {
    mixer.stopAllAction();
    const c = clip(name) ?? clip('idle');
    if (c) {
      mixer.clipAction(c).play();
      mixer.setTime(time);
    }
    scene.updateMatrixWorld(true);
    mesh.skeleton.update();
    return bake(mesh);
  };
  // fit to the rest pose, so every pose shares one scale and the feet of the sat bird are on 0
  at('idle', 0);
  fitMatrix(mesh);
  const fly = clip('fly');
  const beat = (fly?.duration ?? 1) / 3;
  poses = {
    sit: at('idle', 0),
    bow: at('coo', (clip('coo')?.duration ?? 1) * 0.5),
    flap: Array.from({ length: FLAP_FRAMES }, (_, k) => at('fly', (beat * k) / FLAP_FRAMES)),
  };
  mixer.stopAllAction();
  return poses;
}

// the mesh as its bones pose it now, fitted to the game, as a still geometry (positions, normals, uvs)
function bake(mesh: THREE.SkinnedMesh): THREE.BufferGeometry {
  const src = mesh.geometry;
  const n = src.getAttribute('position').count;
  const pos = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  const m = fit ?? new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    mesh.getVertexPosition(i, v).applyMatrix4(m);
    pos[i * 3] = v.x;
    pos[i * 3 + 1] = v.y;
    pos[i * 3 + 2] = v.z;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const uv = src.getAttribute('uv');
  if (uv) g.setAttribute('uv', uv);
  if (src.index) g.setIndex(src.index);
  g.computeVertexNormals();
  return g;
}

export interface PigeonRig {
  root: THREE.Object3D; // a pigeon LENGTH long, feet on 0, beak to +x
  play(name: 'walk' | 'peck' | 'fly' | 'coo' | 'idle', fade?: number): void;
  update(dt: number): void;
}

// a skinned pigeon with its own mixer, or null when the model didn't load
export function pigeonRig(): PigeonRig | null {
  if (!gltf) return null;
  const scene = cloneSkinned(gltf.scene);
  const mesh = skinnedOf(scene);
  const m = pigeonMaterial();
  if (!mesh || !m) return null;
  mesh.material = m;
  mesh.frustumCulled = false;
  if (!fit) {
    scene.updateMatrixWorld(true);
    fitMatrix(mesh);
  }
  const root = new THREE.Group();
  scene.applyMatrix4(fit!);
  root.add(scene);
  const mixer = new THREE.AnimationMixer(scene);
  let now: THREE.AnimationAction | null = null;
  return {
    root,
    play(name, fade = 0.2) {
      const c = gltf!.animations.find((a) => a.name === name);
      if (!c) return;
      const next = mixer.clipAction(c);
      if (next === now) return;
      next.reset().play();
      if (now) next.crossFadeFrom(now, fade, false);
      now = next;
    },
    update(dt) {
      mixer.update(dt);
    },
  };
}
