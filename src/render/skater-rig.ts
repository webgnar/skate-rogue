// The rigged 3D skater: Lou Gnar's astronaut (white suit, black visor, flag patch, black shoes, red deck, cream
// wheels) as rigid low-poly parts on a joint hierarchy, posed from the clips in poses.ts. The legs are solved with
// IK to the feet, and the feet ride the board, so the deck's pop, flip and spin come from where the feet are.
// Same interface as the sprite it replaces: play, onEvent, update and a mesh to place.
// When the Blender model (public/models/lou-gnar.glb, built by art/lou_gnar.py) loads, the parts are hidden and
// become drivers: each frame the model's bones copy the joints, so the clips pose the skinned suit the same way.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon } from './toon';
import { wearBoard, wearShoes } from './wear';
import { GEAR_PARTS, type Gear } from '../run/gear';
import { PHYS } from '../physics/constants';
import type { Skater, SkaterEvent } from '../physics/skater';
import { BASE, BOARD, CLIPS, EDITED, GRIND_NAMES, LEDGE_GRINDS, RAIL_GRINDS, SPINS, type Clip, type Pose, type Vec, clipLength, footTarget, footYaw, kneePoint, mix, sample } from './poses';

// the leg bones the playtest bot measures for stretch, hip to toe
const LEG_BONES = (['Left', 'Right'] as const).flatMap((s) => [[`${s}UpLeg`, `${s}Leg`], [`${s}Leg`, `${s}Foot`], [`${s}Foot`, `${s}ToeBase`]] as const);
const SCALE = 1.15; // the poses are in a ~1.8 tile tall skater; the sprite stood about 2 tiles
const THIGH = 0.4;
const SHIN = 0.4;
const ANKLE = 0.075; // sole to ankle
const HIP_W = 0.11;
const FADE = 0.08; // crossfade between clips, seconds
const PUSH_FADE = 0.2;
const PUSH_FOR = 2; // pushes before a rest
const RIDE_FOR = 1.3; // seconds of rolling between pushes

const COLORS = {
  suit: 0xf1f0ea,
  suitShade: 0xd5d6dc,
  visor: 0x0d0d14,
  trim: 0x8a93a6,
  shoe: 0x17171b,
  sole: 0xeeeeee,
  grip: 0x1c1c20,
  deck: 0xc8312b,
  truck: 0xa7adb6,
  wheel: 0xf3e6c4,
};

const GRINDS = new Set(Object.keys(GRIND_NAMES));
const ON_GROUND = new Set(['push', 'ride', ...GRINDS]); // clips that make no sense in the air
const DOWN = new THREE.Vector3(0, -1, 0);
// the sim's body response (the physics feel thread's src/physics/feel.ts), when it has one
interface Feel {
  squash?: number;
  lean?: number;
  wobble?: number;
}
const BASE_HIP_Y = 0.9; // pelvis height in the model's bind pose
const SLOPE_DROP = 0.35; // on a slope the hips sink by this times the sine of the angle, so the low leg still reaches
const SQUASH_DROP = 0.18; // how far a full landing squash sinks the hips

export const SKATERS = ['lou-gnar', 'webster', 'keanu', 'roxy', 'goldie'] as const;
export type SkaterId = (typeof SKATERS)[number];
export const isSkater = (s: string | null): s is SkaterId => SKATERS.includes(s as SkaterId);

export class SkaterRig {
  readonly mesh = new THREE.Group();
  private readonly mats: THREE.MeshToonMaterial[] = [];
  private readonly lambert = (color: number) => {
    const m = toon({ color });
    this.mats.push(m);
    return m;
  };

  // joints
  private readonly pelvis = new THREE.Group();
  private readonly spine = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly shoulders: [THREE.Group, THREE.Group];
  private readonly elbows: [THREE.Group, THREE.Group];
  private readonly hips: [THREE.Object3D, THREE.Object3D];
  private readonly thighs: [THREE.Group, THREE.Group];
  private readonly shins: [THREE.Group, THREE.Group];
  private readonly feet: [THREE.Group, THREE.Group];
  private readonly boardRoot = new THREE.Group();
  private readonly boardPivot = new THREE.Group();
  private readonly boardSpin = new THREE.Group();

  private clip: Clip = CLIPS.ride;
  private clipName = 'ride';
  private t = 0;
  private from: Pose = { ...BASE };
  private fade = 0;
  private fadeLen = FADE;
  private pose: Pose = { ...BASE };
  private flash = 0;
  private pushes = 0;
  private rideT = 0;
  private ledgeGrinds = 0;
  private railGrinds = 0;
  private sk: Skater | null = null; // the skater as of the last update, for what an event landed on
  private fakie = false; // shown riding fakie: the whole skater and board turned half round

  // skinned model bones and the joints they follow
  private bound: { bone: THREE.Bone; driver: THREE.Object3D; offset: THREE.Matrix4; local: THREE.Matrix4 }[] = [];
  private board: THREE.Object3D | null = null; // the Blender board, which shows gear wear
  private worn = '';
  private held: 'idle' | 'busted' | null = null; // the gear the wear was last drawn for, in steps of 5
  // the bones and board as the clip posed them, before the slope; crossfades start from these
  private raw: { pos: THREE.Vector3[]; rot: THREE.Quaternion[]; board: THREE.Matrix4 } | null = null;
  // Clips keyed in Blender (lou-gnar.glb's animations, art/lou_gnar.py): sampled straight onto the bones, and they
  // win over the code clip of the same name. The board follows the model's Board bone.
  private readonly baked = new Map<string, { bone: THREE.Bone; pos?: THREE.Interpolant; rot?: THREE.Interpolant }[]>();
  private boardBone: THREE.Bone | null = null;
  private boardRest = new THREE.Matrix4(); // the Board bone's rest pose (rig space), inverted
  // the bones and board where a crossfade starts from (skinned model only)
  private snap: { pos: THREE.Vector3[]; rot: THREE.Quaternion[]; board: THREE.Matrix4 } | null = null;

  constructor(model?: THREE.Object3D, board?: THREE.Object3D, clips: THREE.AnimationClip[] = []) {
    const m = this.mesh;
    m.scale.setScalar(SCALE);
    m.position.z = 0.25;

    // --- board ---
    this.buildBoard();
    m.add(this.boardRoot);
    this.boardRoot.add(this.boardPivot);
    this.boardPivot.add(this.boardSpin);

    // --- body ---
    const suit = this.lambert(COLORS.suit);
    const shade = this.lambert(COLORS.suitShade);
    const trim = this.lambert(COLORS.trim);
    m.add(this.pelvis);
    const hipsMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.18, 8), shade);
    hipsMesh.scale.z = 0.7;
    this.pelvis.add(hipsMesh);
    this.hips = [new THREE.Object3D(), new THREE.Object3D()];
    this.hips[0].position.set(HIP_W, -0.04, 0); // left = front foot (+x)
    this.hips[1].position.set(-HIP_W, -0.04, 0);
    this.pelvis.add(...this.hips);

    this.spine.position.y = 0.06;
    this.pelvis.add(this.spine);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.5, 8).translate(0, 0.27, 0), suit);
    torso.scale.z = 0.68;
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.14).translate(0, 0.3, -0.19), shade);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04).translate(0, 0.32, 0.15), trim);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.06, 8).translate(0, 0.54, 0), trim);
    this.spine.add(torso, pack, panel, collar);

    // helmet with the black visor wrapped round the front
    this.head.position.y = 0.58;
    this.spine.add(this.head);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.215, 10, 8).translate(0, 0.17, 0), suit);
    const visorMat = new THREE.MeshPhongMaterial({ color: COLORS.visor, shininess: 90, specular: 0x8899ff, flatShading: true });
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.222, 10, 6, Math.PI / 2 - 0.95, 1.9, 0.95, 0.85).translate(0, 0.17, 0),
      visorMat,
    );
    this.head.add(helmet, visor);

    // arms: shoulder raises out sideways, swings toward the camera, elbow bends forward
    const arm = (side: 1 | -1): [THREE.Group, THREE.Group] => {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.25 * side, 0.46, 0);
      shoulder.rotation.order = 'XYZ';
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.2, 2, 6).translate(0, -0.14, 0), suit);
      const elbow = new THREE.Group();
      elbow.position.y = -0.29;
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.18, 2, 6).translate(0, -0.13, 0), suit);
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 5).translate(0, -0.28, 0), shade);
      elbow.add(fore, glove);
      shoulder.add(upper, elbow);
      this.spine.add(shoulder);
      return [shoulder, elbow];
    };
    const [sl, el] = arm(1);
    const [sr, er] = arm(-1);
    this.shoulders = [sl, sr];
    this.elbows = [el, er];
    // flag patch on the outside of the lead (left) arm, the side the camera sees
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.065), new THREE.MeshBasicMaterial({ map: flagTexture() }));
    flag.position.set(0.068, -0.1, 0.012);
    flag.rotation.y = Math.PI / 2 - 0.2;
    sl.add(flag);

    // legs: thigh and shin segments placed by the IK each frame
    const seg = (len: number, r: number) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.CapsuleGeometry(r, len - 2 * r, 2, 6).translate(0, -len / 2, 0), suit));
      m.add(g);
      return g;
    };
    this.thighs = [seg(THIGH, 0.08), seg(THIGH, 0.08)];
    this.shins = [seg(SHIN + 0.02, 0.07), seg(SHIN + 0.02, 0.07)];

    // shoes: origin at the sole under the ball of the foot, toes toward +z
    const shoeMat = this.lambert(COLORS.shoe);
    const soleMat = this.lambert(COLORS.sole);
    const shoe = () => {
      const g = new THREE.Group();
      g.rotation.order = 'ZYX';
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.27).translate(0, 0.05, 0.01), shoeMat);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.02, 0.28).translate(0, 0.01, 0.01), soleMat);
      g.add(upper, sole);
      m.add(g);
      return g;
    };
    this.feet = [shoe(), shoe()];
    if (model) this.bind(model);
    if (board) this.fitBoard(board);
    if (model) this.loadBaked(clips);
    this.applyPose(BASE);
  }

  // the QFS skaters (art/skaters.py) share Lou's rig and play his clips, from lou-gnar.glb
  static async create(base: string, skater: SkaterId = 'lou-gnar'): Promise<SkaterRig> {
    const load = (file: string) =>
      new GLTFLoader().loadAsync(`${base}models/${file}`).catch((err) => {
        console.warn(`${file} failed to load, using the built-in one`, err);
        return undefined;
      });
    const [lou, board, own] = await Promise.all([
      load('lou-gnar.glb'),
      load('board.glb'),
      skater === 'lou-gnar' ? undefined : load(`${skater}.glb`),
    ]);
    const model = own ?? lou;
    return new SkaterRig(model?.scene, board?.scene, lou?.animations);
  }

  private loadBaked(clips: THREE.AnimationClip[]): void {
    const bones = new Map(this.bound.map((b) => [b.bone.name, b.bone]));
    if (this.boardBone) bones.set('Board', this.boardBone);
    for (const clip of clips) {
      if (!CLIPS[clip.name]) continue; // timing, looping and the rig's logic come from the code clip of that name
      const byBone = new Map<THREE.Bone, { bone: THREE.Bone; pos?: THREE.Interpolant; rot?: THREE.Interpolant }>();
      for (const track of clip.tracks) {
        const [node, prop] = track.name.split('.');
        const bone = bones.get(node);
        if (!bone || (prop !== 'position' && prop !== 'quaternion')) continue;
        const entry = byBone.get(bone) ?? { bone };
        if (prop === 'position') entry.pos = new THREE.LinearInterpolant(track.times, track.values, 3, new Float32Array(3));
        else entry.rot = new THREE.QuaternionLinearInterpolant(track.times, track.values, 4, new Float32Array(4));
        byBone.set(bone, entry);
      }
      if (byBone.size) this.baked.set(clip.name, [...byBone.values()]);
    }
  }

  // The Blender board (art/board.py) has its origin at the middle of the deck's top, like boardSpin.
  private fitBoard(board: THREE.Object3D): void {
    for (const part of this.boardSpin.children) part.visible = false;
    this.board = board;
    this.boardSpin.add(board);
    this.toonMaterials(board);
  }

  // the model's materials as the rig's own, so they blink on slams and take the toon ramp
  private toonMaterials(root: THREE.Object3D): void {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false; // bind-pose bounds don't follow flips and slams
      const swap = (src: THREE.Material) => {
        const std = src as THREE.MeshStandardMaterial;
        mesh.userData.mat = std.name; // the Blender material's name, for the gear wear (wear.ts)
        if (std.name === 'VisorGlint') {
          // a streak of light across the visor; the effects drive its opacity with the night's neon
          mesh.name = 'VisorGlint';
          return new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
        }
        if (std.name === 'visor') {
          return new THREE.MeshPhongMaterial({ color: COLORS.visor, shininess: 90, specular: 0x8899ff, flatShading: true });
        }
        const mat = this.lambert(std.color.getHex());
        mat.map = std.map;
        return mat;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    });
    this.mergeFlat(root);
  }

  // A glTF model comes in as one mesh per material: 18 draws for Lou and his board, twice that with outlines. Parts
  // with a plain colour (no texture, not the shiny visor) merge into one mesh per parent, coloured per vertex.
  private mergeFlat(root: THREE.Object3D): void {
    const groups = new Map<THREE.Object3D, THREE.Mesh[]>();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const mat = mesh.material as THREE.MeshToonMaterial;
      if (!mesh.isMesh || Array.isArray(mat) || !(mat instanceof THREE.MeshToonMaterial) || mat.map || !mesh.parent) return;
      if (String(mesh.userData.mat).startsWith('Wear')) return; // wear decals stay their own, hidden till worn
      groups.set(mesh.parent, [...(groups.get(mesh.parent) ?? []), mesh]);
    });
    for (const [parent, meshes] of groups) {
      if (meshes.length < 2) continue;
      const skinned = meshes[0] as THREE.SkinnedMesh;
      if (meshes.some((m) => !!(m as THREE.SkinnedMesh).isSkinnedMesh !== !!skinned.isSkinnedMesh)) continue;
      const keep = skinned.isSkinnedMesh ? ['position', 'normal', 'skinIndex', 'skinWeight'] : ['position', 'normal'];
      const geos = meshes.map((m) => {
        const g = m.geometry.clone();
        if (!skinned.isSkinnedMesh) g.applyMatrix4(m.matrix); // into the parent's space
        for (const name of Object.keys(g.attributes)) if (!keep.includes(name)) g.deleteAttribute(name);
        const c = (m.material as THREE.MeshToonMaterial).color;
        const n = g.attributes.position.count;
        const col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        return g.index ? g : g.toNonIndexed();
      });
      const parts = geos.every((g) => g.index) ? geos : geos.map((g) => (g.index ? g.toNonIndexed() : g));
      const geo = mergeGeometries(parts);
      if (!geo) continue;
      // which vertices came from which material, for the gear wear
      let start = 0;
      geo.userData.parts = parts.map((g, i) => {
        const part = { mat: String(meshes[i].userData.mat ?? ''), start, count: g.attributes.position.count };
        start += part.count;
        return part;
      });
      const mat = this.lambert(0xffffff);
      mat.vertexColors = true;
      let merged: THREE.Mesh;
      if (skinned.isSkinnedMesh) {
        const sm = new THREE.SkinnedMesh(geo, mat);
        sm.bind(skinned.skeleton, skinned.bindMatrix);
        sm.position.copy(skinned.position);
        sm.quaternion.copy(skinned.quaternion);
        sm.scale.copy(skinned.scale);
        merged = sm;
      } else {
        merged = new THREE.Mesh(geo, mat);
      }
      merged.name = `${meshes[0].name}_flat`;
      merged.frustumCulled = false;
      for (const m of meshes) {
        parent.remove(m);
        const i = this.mats.indexOf(m.material as THREE.MeshToonMaterial);
        if (i >= 0) this.mats.splice(i, 1);
      }
      parent.add(merged);
    }
  }

  // Hide the built-in body and hang the model's bones off its joints. Both are in the bind pose here: every joint
  // at zero, legs and arms straight down (see openspec/changes/m6-skinned-skater/design.md).
  private bind(model: THREE.Object3D): void {
    const drivers: Record<string, THREE.Object3D> = {
      Hips: this.pelvis,
      Spine: this.spine,
      Spine1: this.spine,
      Neck: this.spine,
      Head: this.head,
    };
    (['Left', 'Right'] as const).forEach((side, i) => {
      drivers[`${side}Arm`] = this.shoulders[i];
      drivers[`${side}ForeArm`] = drivers[`${side}Hand`] = this.elbows[i];
      drivers[`${side}UpLeg`] = this.thighs[i];
      drivers[`${side}Leg`] = this.shins[i];
      drivers[`${side}Foot`] = drivers[`${side}ToeBase`] = this.feet[i];
    });
    for (const child of this.mesh.children) {
      if (child === this.boardRoot) continue;
      child.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.visible = false;
      });
    }

    // drivers in the bind pose
    this.pelvis.position.set(0, BASE_HIP_Y, 0);
    this.pelvis.rotation.set(0, 0, 0);
    this.spine.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    for (const i of [0, 1]) {
      const hip = this.hips[i].position.clone().add(this.pelvis.position);
      this.shoulders[i].rotation.set(0, 0, 0);
      this.elbows[i].rotation.set(0, 0, 0);
      this.thighs[i].position.copy(hip);
      this.thighs[i].quaternion.identity();
      this.shins[i].position.set(hip.x, hip.y - THIGH, hip.z);
      this.shins[i].quaternion.identity();
      this.feet[i].position.set(hip.x, hip.y - THIGH - SHIN - ANKLE, 0.05);
      this.feet[i].rotation.set(0, 0, 0);
    }
    this.mesh.add(model);
    this.mesh.updateMatrixWorld(true);
    const toRig = this.mesh.matrixWorld.clone().invert();
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) this.bindPos.set(o.name, new THREE.Vector3().setFromMatrixPosition(o.matrixWorld));
    });
    model.traverse((o) => {
      const bone = o as THREE.Bone;
      if (bone.isBone && drivers[bone.name]) {
        const driver = drivers[bone.name];
        const d = toRig.clone().multiply(driver.matrixWorld);
        const b = toRig.clone().multiply(bone.matrixWorld);
        this.bound.push({ bone, driver, offset: d.invert().multiply(b), local: new THREE.Matrix4() });
      }
    });
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone && o.name === 'Board') this.boardBone = o as THREE.Bone;
    });
    if (this.boardBone) this.boardRest.copy(this.inRig(this.boardBone)).invert();
    this.toonMaterials(model);
  }

  // For the playtest bot: each foot's ball (the ToeBase bone) in the deck's own space (x along the deck, y up off
  // its top, z across it, in rig units), and how far each leg bone has stretched from its bind length (1 = not at
  // all). Lou's feet should sit on the deck while riding, and bones never stretch. Skinned model only.
  footCheck(): { clip: string; fading: boolean; feet: { side: string; along: number; up: number; across: number }[]; stretch: number } | null {
    if (!this.bound.length) return null;
    this.mesh.updateMatrixWorld(true);
    const bones = new Map(this.bound.map((b) => [b.bone.name, b.bone]));
    const pos = (name: string) => {
      const b = bones.get(name);
      return b ? new THREE.Vector3().setFromMatrixPosition(b.matrixWorld) : null;
    };
    if (!this.legBind) {
      this.legBind = new Map();
      for (const [a, b] of LEG_BONES) {
        const pa = this.bindPos.get(a);
        const pb = this.bindPos.get(b);
        if (pa && pb) this.legBind.set(`${a}>${b}`, pa.distanceTo(pb));
      }
    }
    let stretch = 1;
    for (const [a, b] of LEG_BONES) {
      const pa = pos(a);
      const pb = pos(b);
      const rest = this.legBind.get(`${a}>${b}`);
      if (pa && pb && rest) stretch = Math.max(stretch, pa.distanceTo(pb) / rest);
    }
    const deck = this.boardSpin.matrixWorld.clone().invert();
    const feet = (['Left', 'Right'] as const).flatMap((side) => {
      const p = pos(`${side}ToeBase`) ?? pos(`${side}Foot`);
      if (!p) return [];
      p.applyMatrix4(deck);
      return [{ side, along: p.x, up: p.y, across: p.z }];
    });
    return { clip: this.clipName, fading: this.fade > 0, feet, stretch };
  }
  private legBind: Map<string, number> | null = null;
  private readonly bindPos = new Map<string, THREE.Vector3>(); // bone positions in world units at bind

  // an object's transform in the rig's own space (this.mesh), from the local transforms up the tree
  private inRig(o: THREE.Object3D): THREE.Matrix4 {
    o.updateMatrix();
    const m = o.matrix.clone();
    for (let p = o.parent; p && p !== this.mesh; p = p.parent) {
      p.updateMatrix();
      m.premultiply(p.matrix);
    }
    return m;
  }

  // the board's transform in rig space (what boardRoot, boardPivot and boardSpin add up to)
  private boardMatrix(): THREE.Matrix4 {
    return this.inRig(this.boardSpin);
  }

  private setBoard(m: THREE.Matrix4): void {
    m.decompose(this.boardRoot.position, this.boardRoot.quaternion, this.boardRoot.scale);
    this.boardPivot.position.set(0, 0, 0);
    this.boardPivot.rotation.set(0, 0, 0);
    this.boardSpin.position.set(0, 0, 0);
    this.boardSpin.rotation.set(0, 0, 0);
  }

  // a Blender clip at time t: bones straight from its keys, the board riding the Board bone
  private applyBaked(tracks: { bone: THREE.Bone; pos?: THREE.Interpolant; rot?: THREE.Interpolant }[], t: number): void {
    for (const { bone, pos, rot } of tracks) {
      if (pos) bone.position.fromArray(pos.evaluate(t));
      if (rot) bone.quaternion.fromArray(rot.evaluate(t));
    }
    if (this.boardBone) {
      // at rest the board sits on the bone with its origin at the deck top, over the middle of the feet
      const deck = new THREE.Matrix4().makeTranslation(0, BOARD.deckTop, 0);
      this.setBoard(this.inRig(this.boardBone).multiply(this.boardRest).multiply(deck));
    }
  }

  // remember the bones and board for a crossfade; `spin` turns them back round after a 180 hands over to fakie
  private snapshot(spin: number): void {
    if (!this.bound.length) return;
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -spin);
    const pos: THREE.Vector3[] = [];
    const rot: THREE.Quaternion[] = [];
    const raw = this.raw;
    this.bound.forEach(({ bone }, i) => {
      pos.push((raw ? raw.pos[i] : bone.position).clone());
      rot.push((raw ? raw.rot[i] : bone.quaternion).clone());
      if (bone.name === 'Hips' && spin) {
        pos[i].applyQuaternion(turn); // the root bone is in rig space: turn it about the vertical
        rot[i].premultiply(turn);
      }
    });
    const board = raw ? raw.board.clone() : this.boardMatrix();
    if (spin) board.premultiply(new THREE.Matrix4().makeRotationFromQuaternion(turn));
    this.snap = { pos, rot, board };
  }

  // blend from the snapshot toward the pose just applied, k from 0 (snapshot) to 1
  private blendSnap(k: number): void {
    const s = this.snap;
    if (!s) return;
    this.bound.forEach(({ bone }, i) => {
      bone.position.lerpVectors(s.pos[i], bone.position, k);
      bone.quaternion.slerpQuaternions(s.rot[i], bone.quaternion.clone(), k);
    });
    const a = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
    const b = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
    s.board.decompose(a.p, a.q, a.s);
    this.boardMatrix().decompose(b.p, b.q, b.s);
    this.setBoard(new THREE.Matrix4().compose(a.p.lerp(b.p, k), a.q.slerp(b.q, k), a.s.lerp(b.s, k)));
  }

  // bones copy their joints: world = joint · offset, then back into each bone's parent space
  private followJoints(): void {
    if (!this.bound.length) return;
    this.mesh.updateMatrixWorld(true);
    const toRig = this.mesh.matrixWorld.clone().invert();
    const parentInv = new THREE.Matrix4();
    const placed = new Map<THREE.Object3D, THREE.Matrix4>();
    for (const b of this.bound) {
      const target = b.local.copy(toRig).multiply(b.driver.matrixWorld).multiply(b.offset);
      const parent = b.bone.parent!;
      const parentRig = placed.get(parent) ?? toRig.clone().multiply(parent.matrixWorld);
      placed.set(b.bone, target.clone());
      parentInv.copy(parentRig).invert();
      parentInv.multiply(target).decompose(b.bone.position, b.bone.quaternion, b.bone.scale);
    }
  }

  // deck with kicked nose and tail, trucks and wheels. The deck's top surface is at y = 0 of boardSpin.
  private buildBoard(): void {
    const grip = this.lambert(COLORS.grip);
    const deck = this.lambert(COLORS.deck);
    const truck = this.lambert(COLORS.truck);
    const wheel = this.lambert(COLORS.wheel);
    const W = 0.22;
    const T = 0.03;
    const flatHalf = 0.33;
    const kickLen = (BOARD.tail - flatHalf) / Math.cos(BOARD.kick);
    const plank = (len: number) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.006, W).translate(0, -0.003, 0), grip));
      g.add(new THREE.Mesh(new THREE.BoxGeometry(len, T - 0.006, W).translate(0, -0.006 - (T - 0.006) / 2, 0), deck));
      return g;
    };
    this.boardSpin.add(plank(flatHalf * 2));
    for (const side of [1, -1]) {
      const k = plank(kickLen);
      k.children.forEach((c) => (c as THREE.Mesh).geometry.translate(kickLen / 2, 0, 0));
      k.position.x = flatHalf * side;
      k.rotation.set(0, side > 0 ? 0 : Math.PI, BOARD.kick); // the tail is the nose turned round, grip still up
      this.boardSpin.add(k);
    }
    const wheelGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8).rotateX(Math.PI / 2);
    for (const bx of [BOARD.bolts, -BOARD.bolts]) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.06).translate(bx, -T - 0.015, 0), truck);
      const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.2).translate(bx, -BOARD.deckTop + 0.045, 0), truck);
      this.boardSpin.add(base, hanger);
      for (const z of [0.11, -0.11]) {
        const w = new THREE.Mesh(wheelGeo, wheel);
        w.position.set(bx, -BOARD.deckTop + 0.045, z);
        this.boardSpin.add(w);
      }
    }
  }

  play(name: string, fade = FADE): void {
    const spin = this.settleSpin();
    this.snapshot(spin);
    this.from = { ...this.pose };
    this.fade = fade;
    this.fadeLen = fade;
    this.clipName = name;
    this.clip = CLIPS[name];
    this.t = 0;
    if (name === 'push') this.pushes = 0;
  }

  // Leaving a 180 (finished or cut short by the landing): the skater now rides the other way round, so turn the
  // whole rig to fakie (or back) and take the half turn back out of the pose. It looks the same, and a cut-short spin
  // finishes its turn in the crossfade.
  private settleSpin(): number {
    const spin = SPINS[this.clipName];
    if (!spin) return 0;
    this.fakie = !this.fakie;
    this.pose = { ...this.pose, yaw: this.pose.yaw - spin, boardYaw: this.pose.boardYaw - spin };
    this.clipName = '';
    return spin;
  }

  get current(): string {
    return this.clipName;
  }

  // what the HUD calls the grind being shown
  get grindName(): string {
    return GRIND_NAMES[this.clipName] ?? '50-50';
  }

  onEvent(e: SkaterEvent): void {
    switch (e.type) {
      case 'ollie':
      case 'hop':
      case 'kicker':
        this.play('ollie');
        break;
      case 'trick':
        //180s have no clip of their own yet: they read as an ollie until the models thread adds them
        this.play(e.name in CLIPS ? e.name : 'ollie');
        break;
      case 'land':
        this.play('land');
        break;
      case 'grind': // flat bars are rails; a parked car's roof (row -1, physics roofLedge) is not
        if (this.sk?.surface?.row === -1) this.play(LEDGE_GRINDS[this.ledgeGrinds++ % LEDGE_GRINDS.length]);
        else this.play(RAIL_GRINDS[this.railGrinds++ % RAIL_GRINDS.length]);
        break;
      case 'rail': // handrails
        this.play(RAIL_GRINDS[this.railGrinds++ % RAIL_GRINDS.length]);
        break;
      case 'slam':
        this.flash = 0.6;
        this.play('slam', 0.04);
        break;
      case 'bail':
        this.play('freefall');
        break;
    }
  }

  // the animation editor: show a pose as it is, no clip logic, crossfade or slope
  preview(p: Pose): void {
    this.pose = p;
    this.fade = 0;
    this.raw?.pos.forEach((q, i) => this.bound[i].bone.position.copy(q));
    this.raw?.rot.forEach((q, i) => this.bound[i].bone.quaternion.copy(q));
    this.applyPose(p);
    this.mesh.rotation.set(0, 0, 0);
    if (this.bound.length) this.absorb(0);
  }

  // hold a pose clip whatever the skater is doing ('idle' under a menu, 'busted' when caught); null lets go
  hold(name: 'idle' | 'busted' | null): void {
    this.held = name;
  }

  update(dtMs: number, sk: Skater, angle: number): void {
    this.sk = sk;
    const dt = dtMs / 1000;
    const len = clipLength(this.clip);
    const done = !this.clip.loop && this.t >= len;
    const grinding = sk.mode === 'grind' || sk.mode === 'rail';

    if (this.held) {
      if (this.clipName !== this.held) this.play(this.held, 0.25);
    } else if (this.clipName === 'idle' || this.clipName === 'busted') {
      this.play(sk.mode === 'air' ? 'air' : 'ride', 0.2);
    } else if (sk.mode === 'roll') {
      if (done || this.clipName === 'air' || this.clipName === 'freefall' || GRINDS.has(this.clipName)) {
        this.play(this.wantsPush(sk) ? 'push' : 'ride');
      } else if (this.clipName === 'push') {
        // finish the stroke, with the back foot back near the board, before rolling
        const phase = (this.t % len) / len;
        if (this.t >= len * (this.pushes + 1)) this.pushes++;
        if ((!this.wantsPush(sk) || this.pushes >= PUSH_FOR) && phase > 0.9) {
          this.rideT = 0;
          this.play('ride', PUSH_FADE);
        }
      } else if (this.clipName === 'ride') {
        this.rideT += dt;
        if (this.wantsPush(sk) && this.rideT > RIDE_FOR) this.play('push', PUSH_FADE);
      }
    } else if (sk.mode === 'air' && (done || ON_GROUND.has(this.clipName))) {
      this.play('air', 0.15);
    } else if (grinding && !GRINDS.has(this.clipName)) {
      this.play('grind1');
    }

    // the sim's stance wins, except while a 180 is turning the rig round
    if (!SPINS[this.clipName]) this.fakie = sk.fakie;

    this.t += dt;
    let pose = sample(this.clip, this.t);
    const k = this.fade > 0 ? 1 - (this.fade = Math.max(0, this.fade - dt)) / this.fadeLen : 1;
    // a clip edited since the GLB was baked plays from its keys
    const baked = EDITED.has(this.clipName) ? undefined : this.baked.get(this.clipName);
    if (this.bound.length) {
      // the skinned model: pose it from the Blender clip or the code clip, then crossfade bone by bone
      this.pose = pose;
      // start from the clip's own pose, not last frame's slope
      this.raw?.pos.forEach((p, i) => this.bound[i].bone.position.copy(p));
      this.raw?.rot.forEach((q, i) => this.bound[i].bone.quaternion.copy(q));
      if (baked) {
        const len = clipLength(this.clip);
        this.applyBaked(baked, this.clip.loop && len > 0 ? ((this.t % len) + len) % len : Math.min(this.t, len));
      } else {
        this.applyPose(pose);
      }
      if (k < 1) this.blendSnap(k);
    } else {
      if (k < 1) pose = mix(this.from, pose, k);
      this.pose = pose;
      this.applyPose(pose);
    }
    // turned half round about the vertical first, then tilted with the slope: the skinned model tilts only its
    // board, and its legs soak up the slope with the torso kept upright over the board
    if (this.bound.length) {
      this.mesh.rotation.set(0, this.fakie ? Math.PI : 0, 0);
      const feel = (sk as { feel?: Feel }).feel;
      const turn = this.fakie ? -1 : 1;
      this.absorb(turn * angle, feel?.squash ?? 0, turn * (feel?.lean ?? 0), feel?.wobble ?? 0);
    } else {
      this.mesh.rotation.set(0, this.fakie ? Math.PI : 0, angle, 'ZYX');
    }

    if (this.flash > 0) this.flash -= dt;
    const blink = this.flash > 0 && Math.floor(this.flash * 20) % 2 === 0;
    for (const mat of this.mats) mat.emissive.setRGB(blink ? 0.75 : 0, 0, 0);
  }

  // Tilt the board to the slope about the wheels' contact under the rig's origin, keep the feet planted on it, and
  // re-aim each leg (two-bone IK from the hip) at its foot. The hips sink a little so the downhill leg still reaches;
  // the torso stays upright and centred. `slope` is in rig space, + = nose up. The physics feel (when the sim has it)
  // sinks the hips by `squash` (0..1) and leans the body over the planted feet by `lean` (forward/back) and `wobble`
  // (side to side), radians.
  private absorb(slope: number, squash = 0, lean = 0, wobble = 0): void {
    this.raw = {
      pos: this.bound.map(({ bone }) => bone.position.clone()),
      rot: this.bound.map(({ bone }) => bone.quaternion.clone()),
      board: this.boardMatrix(),
    };
    if (Math.abs(slope) < 1e-3 && !squash && !lean && !wobble) return;
    const tilt = new THREE.Matrix4().makeRotationZ(slope);
    this.setBoard(tilt.clone().multiply(this.raw.board));
    const bone = (name: string) => this.bound.find((b) => b.bone.name === name)?.bone;
    const legs = (['Left', 'Right'] as const).map((side) => [bone(`${side}UpLeg`), bone(`${side}Leg`), bone(`${side}Foot`)]);
    // where the feet go: where the clip put them, tilted with the board
    const feet = legs.map(([, , foot]) => (foot ? tilt.clone().multiply(this.inRig(foot)) : null));
    const hips = bone('Hips');
    if (hips) {
      const m = this.inRig(hips);
      const at = new THREE.Vector3().setFromMatrixPosition(m);
      const drop = SLOPE_DROP * Math.abs(Math.sin(slope)) + SQUASH_DROP * squash;
      const body = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(wobble, 0, -lean));
      const about = new THREE.Matrix4().makeTranslation(at.x, at.y - drop, at.z);
      m.premultiply(new THREE.Matrix4().makeTranslation(-at.x, -at.y, -at.z)).premultiply(body).premultiply(about);
      this.setInRig(hips, m);
    }
    const at = (o: THREE.Object3D) => new THREE.Vector3().setFromMatrixPosition(this.inRig(o));
    legs.forEach(([up, low, foot], i) => {
      const target = feet[i];
      if (!up || !low || !foot || !target) return;
      const hip = at(up);
      const knee = at(low);
      const ankle = at(foot);
      const goal = new THREE.Vector3().setFromMatrixPosition(target);
      const thigh = knee.distanceTo(hip);
      const shin = ankle.distanceTo(knee);
      // knees bend toward the camera, splayed out from the middle of the stance (see kneePole), turned with the
      // body when the clip has it turned (the clip's knees, flattened, steer it; a straight leg has none to give)
      const p = kneePole(goal.x >= 0);
      const bend = knee.clone().sub(hip.clone().add(ankle).multiplyScalar(0.5)).setY(0).multiplyScalar(8);
      const pole = new THREE.Vector3(p.x, p.y, p.z).add(bend);
      const k = kneePoint(hip, goal, thigh, shin, pole);
      this.aim(up, hip, knee, new THREE.Vector3(k.x, k.y, k.z));
      this.aim(low, at(low), at(foot), goal);
      this.setInRig(foot, target.setPosition(at(foot)));
    });
  }

  // turn a bone about its head so the point `from` swings to `to`
  private aim(b: THREE.Object3D, head: THREE.Vector3, from: THREE.Vector3, to: THREE.Vector3): void {
    const a = from.clone().sub(head);
    const c = to.clone().sub(head);
    if (a.lengthSq() < 1e-10 || c.lengthSq() < 1e-10) return;
    const turn = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(a.normalize(), c.normalize()));
    const m = this.inRig(b);
    const about = new THREE.Matrix4().makeTranslation(head.x, head.y, head.z);
    this.setInRig(b, about.clone().multiply(turn).multiply(about.invert()).multiply(m));
  }

  // set an object's local transform from a transform in rig space
  private setInRig(o: THREE.Object3D, m: THREE.Matrix4): void {
    const parent = o.parent && o.parent !== this.mesh ? this.inRig(o.parent) : new THREE.Matrix4();
    parent.invert().multiply(m).decompose(o.position, o.quaternion, o.scale);
  }

  // show how worn the deck, trucks, wheels and shoes are (wear.ts); redrawn only when a part crosses a step of 5
  setGear(g: Gear): void {
    const key = GEAR_PARTS.map((p) => Math.round(g[p] / 5)).join();
    if (key === this.worn) return;
    this.worn = key;
    if (this.board) wearBoard(this.board, g);
    wearShoes(this.mesh, g.shoes);
  }

  // push at cruising speed, roll when carrying extra speed from rails or drops
  private wantsPush(sk: Skater): boolean {
    return sk.hsp < PHYS.baseSpeed + 0.3;
  }

  private applyPose(p: Pose): void {
    // board: lift, pitch about its pivot, then spin about its centre (roll applied after yaw)
    this.boardRoot.position.set(p.boardX, p.boardY + BOARD.deckTop, p.boardZ);
    this.boardRoot.quaternion.identity(); // a crossfade or a slope may have left it turned (setBoard)
    this.boardRoot.scale.setScalar(1);
    this.boardPivot.position.x = p.boardPivot;
    this.boardPivot.rotation.z = p.boardPitch;
    this.boardSpin.position.x = -p.boardPivot;
    this.boardSpin.rotation.set(p.boardRoll, p.boardYaw, 0, 'YXZ');

    // body
    this.pelvis.position.set(p.hipX, p.hipY, 0);
    this.pelvis.rotation.set(0, p.yaw, p.tumble, 'ZYX');
    this.spine.rotation.set(p.bend, 0, -p.lean);
    this.head.rotation.set(p.nod, p.head, 0, 'YXZ');
    const arms: [number, number, number][] = [
      [p.armLRaise, p.armLFwd, p.armLElbow],
      [p.armRRaise, p.armRFwd, p.armRElbow],
    ];
    arms.forEach(([raise, fwd, elbow], i) => {
      this.shoulders[i].rotation.set(-fwd, 0, i === 0 ? raise : -raise);
      this.elbows[i].rotation.x = -elbow;
    });

    // legs: hips from the posed pelvis, ankles over the feet, knees toward the toes and a little outward
    this.pelvis.updateMatrix();
    for (const i of [0, 1]) {
      const front = i === 0;
      const sole = footTarget(p, front);
      const yaw = footYaw(p, front);
      const pitch = (front ? p.footFOn : p.footBOn) * p.boardPitch;
      const foot = this.feet[i];
      foot.position.set(sole.x, sole.y, sole.z);
      foot.rotation.set(0, yaw, pitch);
      const ankle = new THREE.Vector3(0, ANKLE, -0.05).applyEuler(foot.rotation).add(foot.position);
      const hip = this.hips[i].position.clone().applyMatrix4(this.pelvis.matrix);
      const knee = kneePoint(hip, ankle, THIGH, SHIN, kneePole(front, p.yaw - BASE.yaw));
      const k = new THREE.Vector3(knee.x, knee.y, knee.z);
      place(this.thighs[i], hip, k);
      place(this.shins[i], k, ankle);
    }
    this.followJoints();
  }
}

// Knees bend the way the chest faces, which in the riding stance is toward the camera (+z in the rig), a touch
// outward from the stance's middle, whatever the feet do, so a squash, a slope or a landing never folds a knee
// backward or sideways (zack). turn: the body's yaw away from the stance (a boardslide turns it down the rail).
const KNEE_SPLAY = 0.15;
function kneePole(front: boolean, turn = 0): Vec {
  const x = front ? KNEE_SPLAY : -KNEE_SPLAY;
  return { x: x * Math.cos(turn) + Math.sin(turn), y: 0, z: Math.cos(turn) - x * Math.sin(turn) };
}

// point a segment that hangs down its local -y from a to b
function place(seg: THREE.Group, a: THREE.Vector3, b: THREE.Vector3): void {
  seg.position.copy(a);
  const dir = b.clone().sub(a);
  if (dir.lengthSq() < 1e-8) return;
  seg.quaternion.setFromUnitVectors(DOWN, dir.normalize());
}

// a tiny stars and stripes for the arm patch
function flagTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 19;
  c.height = 13;
  const g = c.getContext('2d')!;
  for (let r = 0; r < 13; r++) {
    g.fillStyle = r % 2 === 0 ? '#c22a2a' : '#ffffff';
    g.fillRect(0, r, 19, 1);
  }
  g.fillStyle = '#2b3a8c';
  g.fillRect(0, 0, 8, 7);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
