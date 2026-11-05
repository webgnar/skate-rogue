// The city pigeon built with the blender bot (art/bot/pigeon.blend, .claude/skills/blender-bot/build_pigeon.py):
// a skinned model with walk, peck, fly and coo clips. Two ways to draw it:
// - posed: its skinning baked into a few still meshes (sat, bowed, and frames of a wingbeat), so a whole sky route
//   of flocks draws as one instanced mesh a pose (src/render/sky-view.ts). A skinned mesh can't be instanced, and a
//   draw a bird made the sky route the most draws in the game on a small iPhone;
// - rigged: a skinned copy with its own mixer, for the few pigeons on the title screen (src/title/life.ts).
// Loaded with the other models on the loading screen (bot-model.ts); if it fails, both fall back to the code-built
// pigeons.
import * as THREE from 'three';
import { BotModel, type BotRig } from './bot-model';

export const PIGEON_FILE = 'bot/pigeon.glb';
// beak to tail, in world units, before whatever scale the caller puts on it (the code-built pigeons were about this)
const LENGTH = 0.5;
// frames of one wingbeat baked for the flocks: the fly clip beats three times a loop
export const FLAP_FRAMES = 6;

const PIGEON = new BotModel(PIGEON_FILE, LENGTH);
let poses: Poses | null = null;

export interface Poses {
  sit: THREE.BufferGeometry; // at rest, sat on a wire or a roof
  bow: THREE.BufferGeometry; // bowed, mid coo
  flap: THREE.BufferGeometry[]; // FLAP_FRAMES through one wingbeat
}

export function loadPigeon(base: string): Promise<void> {
  return PIGEON.load(base);
}

// the pigeon's look: its painted texture, toon lit, sampled hard-edged as it was painted
export function pigeonMaterial(): THREE.Material | null {
  return PIGEON.material();
}

// the baked poses, or null when the model didn't load
export function pigeonPoses(): Poses | null {
  if (poses) return poses;
  const c = PIGEON.copy();
  if (!c) return null;
  const { scene, mesh } = c;
  const mixer = new THREE.AnimationMixer(scene);
  const at = (name: string, time: number): THREE.BufferGeometry => {
    mixer.stopAllAction();
    const clip = PIGEON.clip(name) ?? PIGEON.clip('idle');
    if (clip) {
      mixer.clipAction(clip).play();
      mixer.setTime(time);
    }
    scene.updateMatrixWorld(true);
    mesh.skeleton.update();
    return bake(mesh);
  };
  // fit to the rest pose, so every pose shares one scale and the feet of the sat bird are on 0
  at('idle', 0);
  PIGEON.fitTo(mesh);
  const beat = (PIGEON.clip('fly')?.duration ?? 1) / 3;
  poses = {
    sit: at('idle', 0),
    bow: at('coo', (PIGEON.clip('coo')?.duration ?? 1) * 0.5),
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
  const m = PIGEON.fit ?? new THREE.Matrix4();
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

export type PigeonRig = BotRig<'walk' | 'peck' | 'fly' | 'coo' | 'idle'>;

// a skinned pigeon with its own mixer, or null when the model didn't load
export function pigeonRig(): PigeonRig | null {
  return PIGEON.rig();
}
