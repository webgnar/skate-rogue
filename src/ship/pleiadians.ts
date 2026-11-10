// The Pleiadians, the ship's own crew (zack 2026-11-10: "we need to make a pleadian character for the ship scene.
// will be lots of them on board"). Built with the blender bot (.claude/skills/blender-bot/build_pleiadian.py, from
// zack's two references): tall, long blond hair, a blue bodysuit with the pink eight-point star, a pale blue cape,
// tall boots. Three looks (a: platinum hair and the orange sash, b: golden hair and the pink cuffs, c: a woman with
// white-gold hair to the waist), each one mesh of under 600 triangles and one 512 texture, with five idle clips:
// idle, greet (the raised palm), look (up at the stars), talk, nod.
//
// They stand about the back of the deck in little groups (CROWD), behind the skaters and clear of the run summary's
// column: talking in pairs, looking up through the dome, one or two nodding or raising a hand to you. So a deck full
// of them isn't one person cloned, each has its look, its own height, its clip, and its own phase and speed in it.
// Cheap on a phone: ~10 skinned meshes and their ink, one draw each, one mixer each, no shadows.
import * as THREE from 'three';
import { BotModel } from '../render/bot-model';
import { inkify } from '../render/toon';

export const PLEIADIANS = {
  a: new BotModel('bot/pleiadian-a.glb', 1),
  b: new BotModel('bot/pleiadian-b.glb', 1),
  c: new BotModel('bot/pleiadian-c.glb', 1),
};
type Look = keyof typeof PLEIADIANS;
export type PleiadianClip = 'idle' | 'greet' | 'look' | 'talk' | 'nod';

export function loadPleiadians(base: string): Promise<unknown> {
  return Promise.all(Object.values(PLEIADIANS).map((m) => m.load(base)));
}

// how tall one stands, in the hub's units (a skater is about 2.5): they're tall
export const PLEIADIAN_HEIGHT = 3.2;

// who stands where: x and z on the deck, which way they face (0 faces the camera, +z), their look, their height
// against PLEIADIAN_HEIGHT, and what they're doing. The core is at (0, -6.5); the skaters stand between z -3.6
// and 2.2
export const CROWD: { x: number; z: number; face: number; look: Look; tall: number; clip: PleiadianClip }[] = [
  // a pair talking by the core, stage left
  { x: -4.4, z: -8.2, face: 1.2, look: 'a', tall: 1.04, clip: 'talk' },
  { x: -2.9, z: -8.6, face: -1.7, look: 'c', tall: 0.95, clip: 'nod' },
  // three by the core, stage right: one explaining, two listening
  { x: 3.6, z: -9.4, face: -0.6, look: 'b', tall: 1.0, clip: 'talk' },
  { x: 5.3, z: -8.0, face: -2.4, look: 'a', tall: 1.08, clip: 'nod' },
  { x: 2.6, z: -7.6, face: 2.5, look: 'c', tall: 0.97, clip: 'idle' },
  // at the glass round the back, looking up at the stars
  { x: -9.6, z: -10.4, face: 2.6, look: 'b', tall: 1.02, clip: 'look' },
  { x: 9.8, z: -10.8, face: -2.7, look: 'c', tall: 0.96, clip: 'look' },
  { x: -6.6, z: -12.4, face: 0.3, look: 'a', tall: 1.06, clip: 'idle' },
  // out to the sides: one raising a hand to you, one taking it in
  { x: -8.2, z: -5.4, face: 0.7, look: 'c', tall: 0.98, clip: 'greet' },
  { x: 11.6, z: -5.2, face: -0.8, look: 'b', tall: 1.03, clip: 'idle' },
];

export interface Pleiadian {
  root: THREE.Group;
  update(dt: number): void;
}

// one of them: their own skinned copy, fitted to `height` with their feet on 0, facing +z, inked like the title's
// people, playing `clip` from `phase` (0 to 1 of the way in) at `speed` (null if the model didn't load)
export function pleiadian(look: Look, height: number, clip: PleiadianClip, phase: number, speed: number): Pleiadian | null {
  const model = PLEIADIANS[look];
  const c = model.copy();
  const mat = model.material();
  if (!c || !mat) return null;
  const { scene, mesh } = c;
  mesh.material = mat;
  mesh.frustumCulled = false;
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < mesh.geometry.getAttribute('position').count; i++) box.expandByPoint(mesh.getVertexPosition(i, v));
  const s = height / (box.max.y - box.min.y);
  scene.scale.setScalar(s);
  scene.position.set((-(box.min.x + box.max.x) / 2) * s, -box.min.y * s, (-(box.min.z + box.max.z) / 2) * s);
  const root = new THREE.Group();
  root.name = `pleiadian-${look}`;
  root.add(scene);
  inkify(root);
  const mixer = new THREE.AnimationMixer(scene);
  const anim = model.clip(clip) ?? model.clip('idle');
  if (anim) {
    const act = mixer.clipAction(anim);
    act.timeScale = speed;
    act.play();
    act.time = phase * anim.duration;
  }
  return { root, update: (dt) => mixer.update(dt) };
}
