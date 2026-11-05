// The four people on the title street, rebuilt with the blender bot (.claude/skills/blender-bot/build_human.py, from
// zack's references 2026-11-05): the homeless man, the hitchhiker, the crazy guy in the white suit and the dancer.
//
// life.ts poses them in code, on the same seven bones a code-built person has (peds.ts: root, hips, legs, arms,
// head), every turn in the person's own axes (y up, facing +z). So a bot person hands life.ts seven stand-in bones
// to set, and sync() puts those turns onto the model's own skeleton each frame:
// - a turn goes onto the model's bone in its own rest frame (basis = rest^-1 R rest), as the build keyed its
//   checking clips, so the poses the build checked for slop are the poses the street plays
// - the hips' turn is shared: the pelvis takes 0.35 of it and the chest the rest (one block bent the skin)
// - the code bobs the hips up and down on legs that stay put; on one skin that would push the pelvis into the
//   thighs, so the whole body drops instead and the knees bend just enough to keep the feet down. When the legs
//   drop with the hips (the sit) the body just drops
// When a model fails to load, life.ts keeps the code-built person.
import * as THREE from 'three';
import { BotModel } from '../render/bot-model';
import { inkify } from '../render/toon';

export const PEOPLE = {
  homeless: new BotModel('bot/homeless.glb', 1),
  hitch: new BotModel('bot/hitch.glb', 1),
  wild: new BotModel('bot/wild.glb', 1),
  dancer: new BotModel('bot/dancer.glb', 1),
};
export type Who = keyof typeof PEOPLE;

export function loadPeople(base: string): Promise<unknown> {
  return Promise.all(Object.values(PEOPLE).map((m) => m.load(base)));
}

const HIP_Y = 0.95; // a code-built person's hips (peds.ts), the height the stand-in hips start at
const HEIGHT = 1.85; // the model's height in the ped's units (a code-built person is about this tall)
const PELVIS = 0.35;
// the stand-in bones, in peds.ts's order
const HIPS = 1, LEG_L = 2, LEG_R = 3, ARM_L = 4, ARM_R = 5, HEAD = 6;

export interface BotPerson {
  mesh: THREE.Object3D; // placed, turned and scaled by life.ts like a code-built person's mesh
  bones: THREE.Bone[]; // the stand-ins life.ts poses
  hand: THREE.Object3D; // the left hand, for the hitchhiker's phone
  sync(): void;
}

interface Joint {
  bone: THREE.Bone;
  rest: THREE.Quaternion; // its rest local turn
  frame: THREE.Quaternion; // its rest turn in the skeleton's space
}

export function botPerson(who: Who): BotPerson | null {
  const model = PEOPLE[who];
  const c = model.copy();
  const mat = model.material();
  if (!c || !mat) return null;
  const { scene, mesh } = c;
  mesh.material = mat;
  mesh.frustumCulled = false;
  scene.updateMatrixWorld(true);
  const skel = mesh.skeleton.bones[0].parent!; // the armature node
  const skelQ = skel.getWorldQuaternion(new THREE.Quaternion()).invert();
  const joints: Record<string, Joint> = {};
  for (const bone of mesh.skeleton.bones) {
    joints[bone.name] = { bone, rest: bone.quaternion.clone(), frame: skelQ.clone().multiply(bone.getWorldQuaternion(new THREE.Quaternion())) };
  }
  const j = (n: string) => joints[n];
  const root = j('Root');
  if (!root || !j('Hips') || !j('LegL') || !j('ShinL') || !j('FootL') || !j('ArmL') || !j('HandL') || !j('Head')) return null;

  // fit: HEIGHT tall, feet on 0, centred, already facing +z (built facing -Y in Blender)
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < mesh.geometry.getAttribute('position').count; i++) box.expandByPoint(mesh.getVertexPosition(i, v));
  const s = HEIGHT / (box.max.y - box.min.y);
  scene.scale.setScalar(s);
  scene.position.set((-(box.min.x + box.max.x) / 2) * s, -box.min.y * s, (-(box.min.z + box.max.z) / 2) * s);
  const holder = new THREE.Group();
  holder.add(scene);
  inkify(holder); // the comic ink line the dog and cat wear
  scene.updateMatrixWorld(true);

  // the ped's units in the skeleton's: the code's hips are 0.95 up, the model's hips bone sits where it sits
  const at = (n: string) => skel.worldToLocal(j(n).bone.getWorldPosition(new THREE.Vector3()));
  const unit = at('Hips').y / HIP_Y; // built with its feet on the skeleton's 0
  const legLen = (at('LegL').distanceTo(at('ShinL')) + at('ShinL').distanceTo(at('FootL'))) / unit; // ped units
  const rootRest = root.bone.position.clone();

  const bones = Array.from({ length: 7 }, () => new THREE.Bone());
  bones[HIPS].position.y = bones[LEG_L].position.y = bones[LEG_R].position.y = HIP_Y;

  const R = new THREE.Quaternion();
  const e = new THREE.Euler();
  const turn = (n: string, x: number, y: number, z: number) => {
    const jt = joints[n];
    if (!jt) return;
    R.setFromEuler(e.set(x, y, z, 'XYZ'));
    // local = rest * frame^-1 * R * frame
    jt.bone.quaternion.copy(jt.rest).multiply(jt.frame.clone().invert().multiply(R).multiply(jt.frame));
  };

  return {
    mesh: holder,
    bones,
    hand: j('HandL').bone,
    sync() {
      const h = bones[HIPS].rotation;
      turn('Hips', h.x * PELVIS, h.y * PELVIS, h.z * PELVIS);
      turn('Chest', h.x * (1 - PELVIS), h.y * (1 - PELVIS), h.z * (1 - PELVIS));
      turn('Head', bones[HEAD].rotation.x, bones[HEAD].rotation.y, bones[HEAD].rotation.z);
      turn('ArmL', bones[ARM_L].rotation.x, bones[ARM_L].rotation.y, bones[ARM_L].rotation.z);
      turn('ArmR', bones[ARM_R].rotation.x, bones[ARM_R].rotation.y, bones[ARM_R].rotation.z);
      const d = bones[HIPS].position.y - HIP_Y;
      const legsDrop = bones[LEG_L].position.y - HIP_Y; // the sit moves the legs down with the hips
      root.bone.position.copy(rootRest);
      root.bone.position.y += d * unit; // the skeleton's y is up, as the code's is
      // the knees take a drop the legs didn't
      const knee = d < 0 && Math.abs(legsDrop - d) > 1e-3 ? Math.acos(Math.max(-1, 1 + d / legLen)) : 0;
      for (const [leg, side] of [[bones[LEG_L], 'L'], [bones[LEG_R], 'R']] as const) {
        turn('Leg' + side, leg.rotation.x - knee, leg.rotation.y, leg.rotation.z);
        turn('Shin' + side, 2 * knee, 0, 0);
        turn('Foot' + side, -knee, 0, 0);
      }
    },
  };
}
