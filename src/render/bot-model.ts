// A skinned model built with the blender bot (.claude/skills/blender-bot/, art/bot/<name>.blend): one mesh painted
// with one texture, an armature, and a clip per action. Every one is built facing -Y in Blender (+z in glTF) with
// its feet on the ground, so they all fit the game the same way: scaled to a length beak (or nose) to tail, turned
// to face +x (the way the code-built animals faced), feet on y 0.
// Loaded with the other models on the loading screen; when one fails, its caller falls back to what it drew before.
import * as THREE from 'three';
import { gltfLoader } from './gltf';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { toon } from './toon';

export interface BotRig<Clip extends string = string> {
  root: THREE.Object3D; // the model at its length, feet on 0, facing +x
  // cross-fade to a clip (no-op when it is already playing), at a speed (1 = as authored)
  play(name: Clip, fade?: number, speed?: number): void;
  update(dt: number): void;
}

export class BotModel {
  gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] } | null = null;
  fit: THREE.Matrix4 | null = null; // model space -> the game: `length` long, feet on y 0, facing +x
  private mat: THREE.Material | null = null;

  constructor(
    readonly file: string, // under public/models/
    readonly length: number, // nose to tail, in world units, before whatever scale the caller puts on it
  ) {}

  async load(base: string): Promise<void> {
    try {
      const g = await gltfLoader().loadAsync(`${base}models/${this.file}`);
      this.gltf = { scene: g.scene, animations: g.animations };
    } catch (err) {
      console.warn(`${this.file} failed to load, using the built-in one`, err);
    }
  }

  // the model's look: its painted texture, toon lit, sampled hard-edged as it was painted
  material(): THREE.Material | null {
    if (this.mat || !this.gltf) return this.mat;
    const src = skinnedOf(this.gltf.scene)?.material as THREE.MeshStandardMaterial | undefined;
    const map = src?.map ?? null;
    if (map) {
      map.magFilter = THREE.NearestFilter;
      map.colorSpace = THREE.SRGBColorSpace;
    }
    this.mat = toon({ map });
    return this.mat;
  }

  clip(name: string): THREE.AnimationClip | undefined {
    return this.gltf?.animations.find((a) => a.name === name);
  }

  // model space to game space, measured off the mesh as its bones pose it now (the rest pose, on first use)
  fitTo(mesh: THREE.SkinnedMesh): THREE.Matrix4 {
    if (this.fit) return this.fit;
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (let i = 0; i < mesh.geometry.getAttribute('position').count; i++) box.expandByPoint(mesh.getVertexPosition(i, v));
    const size = box.getSize(new THREE.Vector3());
    const s = this.length / size.z; // built facing -Y in Blender, so nose to tail runs along z in glTF
    const turn = new THREE.Matrix4().makeRotationY(Math.PI / 2); // +z (the nose) to +x
    const centre = new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    this.fit = new THREE.Matrix4().makeScale(s, s, s).premultiply(turn).multiply(centre);
    return this.fit;
  }

  // a fresh skinned copy and its mesh, for posing or for a rig
  copy(): { scene: THREE.Group; mesh: THREE.SkinnedMesh } | null {
    if (!this.gltf) return null;
    const scene = cloneSkinned(this.gltf.scene) as THREE.Group;
    const mesh = skinnedOf(scene);
    return mesh ? { scene, mesh } : null;
  }

  // a skinned copy with its own mixer, or null when the model didn't load
  rig<Clip extends string = string>(): BotRig<Clip> | null {
    const c = this.copy();
    const m = this.material();
    if (!c || !m) return null;
    const { scene, mesh } = c;
    mesh.material = m;
    mesh.frustumCulled = false;
    if (!this.fit) {
      scene.updateMatrixWorld(true);
      this.fitTo(mesh);
    }
    const root = new THREE.Group();
    scene.applyMatrix4(this.fit!);
    root.add(scene);
    const mixer = new THREE.AnimationMixer(scene);
    let now: THREE.AnimationAction | null = null;
    return {
      root,
      play: (name, fade = 0.2, speed = 1) => {
        const c = this.clip(name);
        if (!c) return;
        const next = mixer.clipAction(c);
        next.timeScale = speed;
        if (next === now) return;
        next.reset().play();
        if (now) next.crossFadeFrom(now, fade, false);
        now = next;
      },
      update: (dt) => mixer.update(dt),
    };
  }
}

export function skinnedOf(root: THREE.Object3D): THREE.SkinnedMesh | null {
  let out: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    if (!out && (o as THREE.SkinnedMesh).isSkinnedMesh) out = o as THREE.SkinnedMesh;
  });
  return out;
}

// the title screen's stray dog and tuxedo cat (src/title/life.ts)
export const DOG = new BotModel('bot/dog.glb', 2.0);
export const CAT = new BotModel('bot/cat.glb', 1.3);
export type DogClip = 'walk' | 'run' | 'sit' | 'sniff' | 'shake' | 'idle';
export type CatClip = 'walk' | 'run' | 'sit' | 'jump' | 'idle';

// the sewer's rats, in packs that run at the skater (src/render/sewer-view.ts)
export const RAT = new BotModel('bot/rat.glb', 1.2);
export type RatClip = 'run' | 'walk' | 'sniff' | 'hop' | 'idle';
