// A skater stood off the board, dancing to the beat (zack 2026-11-02: "the skater doing a dance motion before you
// start"), from zack's boardspin sprite: the board stood on its tail at their lead side, the lead hand resting on
// the nose. A knee bounce on every beat, hips and shoulders swaying over two, head nodding, a step-touch, the free
// arm pumping. A bar of poses at quarter beats, each with the hand solved (SkaterRig.reach) to the top of the nose.
// Webster on the title (src/title/title-scene.ts) and the crew aboard the ship (src/ship/hub-scene.ts) use it.
import * as THREE from 'three';
import { BASE, BOARD, type Pose } from '../render/poses';
import type { SkaterRig } from '../render/skater-rig';

export const HAND_ARM = 0; // the lead (left, +x) arm holds the board
export const BOARD_AT = { x: 0.5, z: 0.08 }; // where the board stands, rig space: at the lead side
export const DANCE_KEYS = 16; // poses in a bar of dancing, a quarter beat apart

// `energy` scales the dance: 1 is Webster's, 0 stands still (the crew still asleep stand with their heads down)
export function dancePoses(rig: SkaterRig, energy = 1, asleep = false): Pose[] {
  const stand: Pose = {
    ...BASE,
    yaw: 0.1,
    hipY: 0.84,
    bend: 0.04,
    lean: -0.04,
    head: -0.1,
    nod: asleep ? 0.45 : 0.05,
    headTilt: -0.06,
    footFOn: 0,
    footBOn: 0,
    footFX: 0.15,
    footFY: 0,
    footFZ: 0.02,
    footBX: -0.15,
    footBY: 0,
    footBZ: -0.02,
    footFTurn: 0.25,
    footBTurn: -0.25,
    //the free (trailing) arm hangs loose, a little out from the side
    armRRaise: 0.35,
    armRFwd: 0.05,
    armRElbow: 0.3,
  };
  const e = energy;
  return Array.from({ length: DANCE_KEYS }, (_, i) => {
    const b = (i / DANCE_KEYS) * 4; // beats into the bar
    const hit = (1 + Math.cos(b * Math.PI * 2)) / 2; // 1 on the beat, 0 between
    const sway = Math.sin(b * Math.PI); // side to side over two beats
    const p: Pose = {
      ...stand,
      hipY: stand.hipY - hit * 0.05 * e,
      hipX: sway * 0.035 * e,
      yaw: stand.yaw + sway * 0.12 * e,
      lean: stand.lean + hit * 0.03 * e,
      bend: stand.bend + hit * 0.07 * e,
      nod: stand.nod + hit * 0.2 * e,
      headTilt: stand.headTilt + sway * 0.12 * e,
      head: stand.head + Math.sin((b * Math.PI) / 2) * 0.12 * e,
      footFY: Math.pow(Math.max(0, sway), 2) * 0.07 * e,
      footBY: Math.pow(Math.max(0, -sway), 2) * 0.07 * e,
      armRRaise: stand.armRRaise + hit * 0.25 * e,
      armRFwd: 0.05 + (0.15 + sway * 0.35) * e,
      armRElbow: 0.3 + (0.3 + hit * 0.6) * e,
    };
    //the board on its tail beside them, nose up: it pitches a quarter turn up about the tail, the tail on the ground
    p.boardPivot = -BOARD.tail;
    p.boardPitch = Math.PI / 2;
    p.boardX = BOARD_AT.x + BOARD.tail;
    p.boardY = -BOARD.deckTop + 0.02;
    p.boardZ = BOARD_AT.z;
    const hand = new THREE.Vector3(BOARD_AT.x - 0.02, BOARD.length + 0.05, BOARD_AT.z);
    Object.assign(p, rig.reach(p, HAND_ARM, hand));
    return p;
  });
}

// the pose at a moment of the bar: `beats` counted from the music's start, eased between the quarter-beat keys
export function danceAt(keys: Pose[], beats: number): Pose {
  const n = keys.length;
  const u = (((beats * n) / 4) % n + n) % n;
  const i = Math.floor(u);
  const f = u - i;
  const a = keys[i];
  const b = keys[(i + 1) % n];
  const p = { ...a };
  for (const key of Object.keys(a) as (keyof Pose)[]) p[key] = a[key] + (b[key] - a[key]) * f;
  return p;
}
