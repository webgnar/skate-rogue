// Poses and clips for the rigged skater, keyed from Lou Gnar's sprite frames (excaliburSkate public/images, 66 x 75)
// and from how the tricks really work. Pure data and math (no Three.js), so clips and the leg IK are testable.
//
// Space: the skater's own, in tiles. x = the way they skate (right on screen), y = up, z = toward the camera.
// Regular stance: left foot forward at +x, chest and toes toward the camera (+z), heels to the back (-z).
// y = 0 is under the wheels.
//
// The board is driven by the feet. While a foot is "on" (footFOn / footBOn = 1) its target is the point of the
// deck under it, so when the back foot snaps the tail the board pivots on the tail, and the front foot dragging up
// the grip levels it. Flips and shove-its happen with both feet off; the feet then catch it back first.

import clipEdits from './clip-edits.json';
import { NOSE_STANCES, nollieClip, SPIN, TRICK_CATCH, type TrickId } from '../physics/tricks';

export const BOARD = {
  length: 0.95,
  bolts: 0.27, // front and back truck bolts, from the centre
  tail: 0.475,
  deckTop: 0.12, // deck surface above the ground when flat (wheels + trucks, about a tenth of the board length)
  kick: 0.3, // nose and tail kick up at this angle from 0.33 out
};

export interface Pose {
  yaw: number; // body turn about y; + turns the chest toward the way you skate
  hipX: number;
  hipY: number;
  hipZ: number; // toward the camera (+)
  lean: number; // torso tilt in the screen plane (+ leans toward +x)
  bend: number; // torso pitch toward the camera (crouching over the toes)
  head: number; // head turn toward +x
  nod: number; // head pitch, + looks down
  headTilt: number; // head roll, + tips it toward the way they skate
  armLRaise: number; // lead (left, +x) arm: 0 hanging, 1.57 straight out sideways
  armLFwd: number; // swing toward the camera
  armLElbow: number;
  armRRaise: number; // trailing (right, -x) arm
  armRFwd: number;
  armRElbow: number;
  footFX: number; // front (left) foot along the board
  footFY: number; // used when the foot is off the board
  footFZ: number;
  footFOn: number; // 1 = standing on the deck
  footFTurn: number; // foot yaw: 0 across the board (stance), 1.4 pointing forward (pushing)
  footFPitch: number; // ankle bend about the ball of the foot: + lifts the heel (toes point down)
  footFToe: number; // toes bend at the ball: + curls them up (back down by footFPitch keeps them flat)
  footFRoll: number; // tips the shoe onto its outside edge (+), pivoting on that edge of the sole: a scrape
  footBX: number;
  footBY: number;
  footBZ: number;
  footBOn: number;
  footBTurn: number;
  footBPitch: number;
  footBToe: number;
  footBRoll: number;
  // knee pole targets: where each knee bends toward, moved by this much (rig space) from where it aims by itself
  // (toward the camera, a touch outward). 0 keeps the automatic bend.
  kneeFX: number;
  kneeFY: number;
  kneeFZ: number;
  kneeBX: number;
  kneeBY: number;
  kneeBZ: number;
  boardX: number;
  boardY: number; // lift of the pivot point
  boardZ: number; // sideways shift, to keep a truck on the rail when the board is turned
  boardPivot: number; // where the board pitches about, along x (tail = -BOARD.tail)
  boardPitch: number; // nose up (+)
  boardRoll: number; // long axis: kickflip (-), heelflip (+)
  boardYaw: number; // flat spin: backside shove-it (-)
  tumble: number; // whole body roll for slams
}

export const BASE: Pose = {
  yaw: 0.35,
  hipX: 0,
  hipY: 0.9,
  hipZ: 0,
  lean: 0.04,
  bend: 0.12,
  head: 0.5,
  nod: 0.1,
  headTilt: 0,
  armLRaise: 0.45,
  armLFwd: 0.15,
  armLElbow: 0.45,
  armRRaise: 0.45,
  armRFwd: 0.1,
  armRElbow: 0.45,
  footFX: BOARD.bolts,
  footFY: BOARD.deckTop,
  footFZ: 0,
  footFOn: 1,
  footFTurn: 0,
  footFPitch: 0,
  footFToe: 0,
  footFRoll: 0,
  footBX: -BOARD.bolts,
  footBY: BOARD.deckTop,
  footBZ: 0,
  footBOn: 1,
  footBTurn: 0,
  footBPitch: 0,
  footBToe: 0,
  footBRoll: 0,
  kneeFX: 0,
  kneeFY: 0,
  kneeFZ: 0,
  kneeBX: 0,
  kneeBY: 0,
  kneeBZ: 0,
  boardX: 0,
  boardY: 0,
  boardZ: 0,
  boardPivot: 0,
  boardPitch: 0,
  boardRoll: 0,
  boardYaw: 0,
  tumble: 0,
};

export type Key = Partial<Pose>;

export interface Clip {
  loop: boolean;
  keys: { t: number; pose: Key }[]; // t in seconds, first key at 0
}

const TAU = Math.PI * 2;
const TAIL = -BOARD.tail;
const NOSE_FOOT = 0.38; // where the front foot ends up after dragging up the grip
const TAIL_FOOT = -0.4; // back foot on the kicktail
const POP_Y = -(BOARD.deckTop + 0.014); // drops the tail pivot so the kicked-up tail tip touches the ground

// a pop off the tail: crouched (front foot back behind the front bolts, back foot on the tail), then the back foot
// snaps the tail down: the board tips back over the back wheels until the tail strikes the ground (0.58 rad with
// this deck height), and rises nose-first pivoting on the tail
const crouch: Key = {
  hipY: 0.6, bend: 0.5, nod: -0.1, footFX: 0.12, footBX: TAIL_FOOT,
  armLRaise: 0.3, armLFwd: 0.7, armLElbow: 0.3, armRRaise: 0.35, armRFwd: 0.55, armRElbow: 0.35,
};
const pop: Key = {
  hipY: 0.9, bend: 0.22, boardPivot: TAIL, boardPitch: 0.58, boardY: POP_Y, footBX: TAIL_FOOT, footFX: 0.22,
  armLRaise: 0.9, armLFwd: 0.4, armRRaise: 1.7, armRElbow: 0.4,
};
// The nollie is the ollie popped off the nose: the front foot snaps the nose down and the back foot drags forward up
// the grip, so the board pivots on the nose and rises tail first. Same body, the feet's jobs and the board's tip
// swapped end for end. Its switch twin (switchNollie) is the fakie ollie: the same pop off the end that leads.
function nosePop(k: Key, spinBoard = false): Key {
  const out: Key = { ...k };
  // the feet trade jobs end for end: everything the front foot did (step off, kick out, flick) the back foot does
  // at the tail, and the other way round
  for (const [f, b] of FOOT_PAIRS) {
    delete out[f];
    delete out[b];
    const sign = f === 'footFX' ? -1 : 1;
    const fv = k[f] ?? (f === 'footFX' ? BASE.footFX : undefined);
    const bv = k[b] ?? (b === 'footBX' ? BASE.footBX : undefined);
    if (bv !== undefined) out[f] = sign * bv;
    if (fv !== undefined) out[b] = sign * fv;
  }
  if (k.boardPivot !== undefined) out.boardPivot = -k.boardPivot;
  if (k.boardPitch !== undefined) out.boardPitch = -k.boardPitch;
  if (k.boardX !== undefined) out.boardX = -k.boardX;
  if (k.lean !== undefined) out.lean = -k.lean;
  // a shove-it scooped from the nose: the nose goes round the way the tail would have, so the board spins the other
  // way under the body (not for the 180s, where the board turns with the body)
  if (spinBoard && k.boardYaw !== undefined) out.boardYaw = -k.boardYaw;
  return out;
}
const FOOT_PAIRS = (['X', 'Y', 'Z', 'On', 'Turn', 'Pitch', 'Toe', 'Roll'] as const).map(
  (n) => [`footF${n}`, `footB${n}`] as [keyof Pose, keyof Pose],
);
// both feet off, knees up, for flips and shove-its
// hangers on the rail (their underside 0.09 below the deck), wheels hanging just below its top
const HANGER_Y = -(BOARD.deckTop - 0.09);
const G50: Key = { boardY: HANGER_Y };
// Backside smith (zack's photo): back truck locked on the edge, the front truck dipped down below it on the side
// the skater came from. A backside grind has the ledge behind (heel side, into the screen), so the nose comes
// toward the camera and down the ledge's face, the board rolled toe edge down (we see its bottom).
const SMITH_YAW = -0.3;
const SMITH: Key = {
  boardY: HANGER_Y, boardPivot: -BOARD.bolts * Math.cos(SMITH_YAW), boardPitch: -0.5, boardYaw: SMITH_YAW,
  boardZ: -BOARD.bolts * Math.sin(SMITH_YAW), boardRoll: 0.25,
};
// Backside feeble: back truck locked, the front truck hanging over the far side of the rail (heel side), the board
// crossing over the rail and pointing down
const FEEBLE_YAW = 0.3;
const FEEBLE: Key = {
  boardY: HANGER_Y, boardPivot: -BOARD.bolts * Math.cos(FEEBLE_YAW), boardPitch: -0.45, boardYaw: FEEBLE_YAW,
  boardZ: -BOARD.bolts * Math.sin(FEEBLE_YAW), boardRoll: -0.15,
};
// 5-0: back truck grinding, nose held up off the rail
const FIVE_O: Key = { boardY: HANGER_Y, boardPivot: -BOARD.bolts, boardPitch: 0.2 };
// nosegrind: front truck grinding, tail held up off the rail (a 5-0 the other way round)
const NOSEGRIND: Key = { boardY: HANGER_Y, boardPivot: BOARD.bolts, boardPitch: -0.2 };
// front truck locked, nose pressed on the rail, tail up and swung out toward the toe side
const CROOK_YAW = 0.35;
const CROOKED: Key = {
  boardY: HANGER_Y, boardPivot: BOARD.bolts * Math.cos(CROOK_YAW), boardPitch: -0.4, boardYaw: CROOK_YAW,
  boardZ: BOARD.bolts * Math.sin(CROOK_YAW), boardRoll: 0.3,
};
const BOARDSLIDE: Key = { yaw: 1.2, head: 0.2, boardYaw: Math.PI / 2, boardY: -(BOARD.deckTop - 0.03) };
// frontside: the rail came up on the toe side, so the nose went over it toward the camera and the body turned the
// other way: back to the way you're sliding, head turned over the lead shoulder to watch down the rail
const FS_BOARDSLIDE: Key = { yaw: -1.2, head: 1.4, boardYaw: -Math.PI / 2, boardY: -(BOARD.deckTop - 0.03) };
// side = -1 flicks off the heel side (kickflip), +1 kicks out the toe side (heelflip)
const flick = (side: 1 | -1): Key => ({
  hipY: 1.05, boardY: 0.3, bend: 0.3,
  footFOn: 0, footFX: 0.52, footFY: 0.5, footFZ: 0.14 * side,
  footBOn: 0, footBX: -0.38, footBY: 0.58,
});
const split = (side: 1 | -1): Key => ({
  hipY: 1.1, boardY: 0.2, lean: -0.08, bend: 0.38, nod: 0.6, head: 0.3,
  footFOn: 0, footFX: 0.78, footFY: 0.6, footFZ: 0.12 * side, footFTurn: 0.5,
  footBOn: 0, footBX: -0.42, footBY: 0.72, footBZ: 0.05,
  armRRaise: 2.7, armRFwd: -0.2, armRElbow: 0.3, armLRaise: 0.55, armLFwd: 0.65, armLElbow: 0.15,
});
// legs close over the board; the back foot lands on it first, the front foot still coming down
const catchBack: Key = {
  hipY: 1.02, boardY: 0.28, bend: 0.3, nod: 0.45, footBOn: 1, footBX: -0.3,
  footFOn: 0, footFX: 0.32, footFY: 0.52, armRRaise: 1.8, armLRaise: 0.9, armLFwd: 0.3,
};
const feetUp = (y: number, z = 0): Key => ({ footFOn: 0, footBOn: 0, footFY: y, footBY: y, footFZ: z, footBZ: z });

export const CLIPS: Record<string, Clip> = {
  // push: front foot turned forward over the front bolts, standing knee bends deep so the back foot reaches the
  // ground beside the board (toe side), plants by the front foot and kicks back along it, then swings forward again
  // (Lou Gnar push, 14 frames x 70 ms)
  push: {
    loop: true,
    keys: [
      { t: 0, pose: { yaw: 1.0, head: 0.2, lean: 0.12, hipY: 0.88, footFTurn: 1.4, footFX: 0.2, footBOn: 0, footBX: -0.05, footBY: 0.24, footBZ: 0.12 } },
      { t: 0.21, pose: { yaw: 1.1, head: 0.1, lean: 0.22, hipY: 0.8, footFTurn: 1.4, footFX: 0.2, footBOn: 0, footBX: 0.02, footBY: 0.0, footBZ: 0.14, armLFwd: 0.4, armRFwd: -0.3 } },
      { t: 0.56, pose: { yaw: 1.1, head: 0.1, lean: 0.3, bend: 0.25, hipY: 0.7, footFTurn: 1.4, footFX: 0.2, footBOn: 0, footBX: -0.62, footBY: 0.0, footBZ: 0.14, armLFwd: -0.3, armRFwd: 0.5 } },
      { t: 0.77, pose: { yaw: 1.0, head: 0.2, lean: 0.18, hipY: 0.84, footFTurn: 1.4, footFX: 0.2, footBOn: 0, footBX: -0.45, footBY: 0.3, footBZ: 0.12 } },
      { t: 0.98, pose: { yaw: 1.0, head: 0.2, lean: 0.12, hipY: 0.88, footFTurn: 1.4, footFX: 0.2, footBOn: 0, footBX: -0.05, footBY: 0.24, footBZ: 0.12 } },
    ],
  },
  // standing on the board while a menu is up (the shop, a pick): Lou Gnar's idle, 4 frames x 100 ms, slowed to a
  // breath: stood up taller, arms loose, looking up and down the street
  idle: {
    loop: true,
    keys: [
      { t: 0, pose: { hipY: 0.87, bend: 0.06, armLRaise: 0.25, armRRaise: 0.3, armLElbow: 0.35, armRElbow: 0.5 } },
      { t: 0.6, pose: { hipY: 0.86, bend: 0.08, head: 0.8, nod: 0.05, armLRaise: 0.28, armRRaise: 0.32, armLElbow: 0.4, armRElbow: 0.55 } },
      { t: 1.2, pose: { hipY: 0.87, bend: 0.06, head: 0.5, armLRaise: 0.25, armRRaise: 0.3, armLElbow: 0.35, armRElbow: 0.5 } },
      { t: 1.8, pose: { hipY: 0.86, bend: 0.08, head: 0.15, nod: 0.15, armLRaise: 0.28, armRRaise: 0.32, armLElbow: 0.4, armRElbow: 0.55 } },
      { t: 2.4, pose: { hipY: 0.87, bend: 0.06, armLRaise: 0.25, armRRaise: 0.3, armLElbow: 0.35, armRElbow: 0.5 } },
    ],
  },
  // BUSTED: the cruiser cuts in and Lou puts his hands up, head down, still stood on the board
  busted: {
    loop: true,
    keys: [
      { t: 0, pose: { hipY: 0.84, bend: 0.1, nod: 0.2 } },
      { t: 0.25, pose: { hipY: 0.88, bend: -0.04, nod: 0.35, head: 0.6, armLRaise: 2.5, armRRaise: 2.5, armLFwd: 0.35, armRFwd: 0.35, armLElbow: 1.0, armRElbow: 1.0 } },
      { t: 1.0, pose: { hipY: 0.87, bend: -0.02, nod: 0.4, head: 0.55, armLRaise: 2.45, armRRaise: 2.55, armLFwd: 0.3, armRFwd: 0.35, armLElbow: 1.05, armRElbow: 0.95 } },
      { t: 1.75, pose: { hipY: 0.88, bend: -0.04, nod: 0.35, head: 0.6, armLRaise: 2.5, armRRaise: 2.5, armLFwd: 0.35, armRFwd: 0.35, armLElbow: 1.0, armRElbow: 1.0 } },
    ],
  },
  // rolling fast: no pushing, a relaxed stance over the bolts
  ride: {
    loop: true,
    keys: [
      { t: 0, pose: { hipY: 0.82, bend: 0.18 } },
      { t: 0.7, pose: { hipY: 0.79, bend: 0.2, armLRaise: 0.55 } },
      { t: 1.4, pose: { hipY: 0.82, bend: 0.18 } },
    ],
  },
  // Ollie, keyed from zack's ollie sequence photo (2026-10-24), shot from the toe side like our camera:
  // 1. rolling into it in a deep crouch, torso folded forward, hands low by the knees, front foot mid-board;
  // 2. the back leg snaps the tail down and the body springs up, the back arm starts to swing up;
  // 3. the board stands up steeply (about 1 rad) pivoting on the tail while the front foot drags up the grip, so the
  //    front knee comes right up to the chest while the back leg is still long; back arm straight up overhead;
  // 4. at the top the board is level under the feet with both knees tucked high;
  // 5. coming down the front foot pushes the nose a little low, arms out wide for balance;
  // 6. legs reach for the ground and soak up the landing (the land clip).
  // Steps 1-4 play fast, in time with the sim's snapped-up pop (PHYS.popSnap: 90% of the height in 0.15 s, zack
  // 2026-10-30): tucked at the top by 0.27 s, through the hang, and down from 0.4 s as before.
  ollie: {
    loop: false,
    keys: [
      { t: 0, pose: { hipY: 0.84, footBX: TAIL_FOOT } },
      { t: 0.04, pose: { ...crouch } },
      { t: 0.08, pose: { ...pop } },
      {
        t: 0.15,
        pose: {
          hipY: 1.06, bend: 0.12, lean: -0.05, nod: 0.3, boardX: 0.12, boardY: POP_Y + 0.16, boardPivot: TAIL, boardPitch: 1.0,
          footFX: 0.3, footBX: TAIL_FOOT, armRRaise: 2.8, armRFwd: -0.1, armRElbow: 0.15, armLRaise: 1.1, armLFwd: 0.3,
        },
      },
      {
        t: 0.27,
        pose: {
          hipY: 1.14, bend: 0.32, nod: 0.35, boardY: 0.5, footFX: NOSE_FOOT, footBX: -0.34,
          armRRaise: 2.3, armRElbow: 0.3, armLRaise: 1.4, armLFwd: 0.35,
        },
      },
      {
        t: 0.54,
        pose: {
          hipY: 1.02, bend: 0.28, boardY: 0.32, boardPitch: -0.12, footFX: 0.32, footBX: -0.3,
          armLRaise: 1.55, armRRaise: 1.6, armLElbow: 0.3, armRElbow: 0.3,
        },
      },
      { t: 0.68, pose: { hipY: 0.94, bend: 0.22, boardY: 0.08, armLRaise: 1.2, armRRaise: 1.1 } },
    ],
  },
  // Nollie: the ollie off the nose (see nosePop). Lou pops out of nose grinds and nose manuals with it, and riding
  // switch it's the fakie ollie (zack, 2026-10-26)
  nollie: {
    loop: false,
    keys: [], // filled from the ollie below the table
  },
  // Boneless, for car hops (zack, 2026-10-25; a rough first pass for zack to tune in ?editor): crouched on the roof,
  // the back hand grabs the toe edge of the deck by the front bolts, the front foot steps off and plants on the
  // roof behind the board (heel side) and kicks off it while the back foot and hand lift the board up with the body;
  // the front foot comes back on top at the peak, the hand lets go and the arms go out for the way down.
  boneless: {
    loop: false,
    keys: [
      {
        t: 0,
        pose: {
          yaw: -0.4, hipY: 0.42, bend: 1.1, nod: -0.1, footBX: TAIL_FOOT, footFOn: 0, footFX: 0.2, footFY: 0.02, footFZ: -0.22, footFTurn: 0.5,
          armLRaise: 0.9, armLFwd: 0.3, armLElbow: 0.4, armRRaise: -0.26, armRFwd: 0.71, armRElbow: 0,
        },
      },
      {
        t: 0.12,
        pose: {
          yaw: -0.4, hipY: 0.72, bend: 1.15, nod: 0, footBX: TAIL_FOOT, footFOn: 0, footFX: 0.18, footFY: -0.12, footFZ: -0.22, footFTurn: 0.5,
          footFPitch: 0.5, boardY: 0.3, boardPitch: 0.2, armLRaise: 1.5, armLFwd: 0.2, armLElbow: 0.3, armRRaise: -0.26, armRFwd: 0.71, armRElbow: 0,
        },
      },
      {
        t: 0.24,
        pose: {
          yaw: -0.4, hipY: 0.96, bend: 1.2, nod: 0.1, footBX: -0.32, footFOn: 0, footFX: 0.3, footFY: 0.78, footFZ: -0.1, footFTurn: 0.3,
          boardY: 0.58, boardPitch: 0.15, armLRaise: 1.7, armLFwd: 0.1, armLElbow: 0.3, armRRaise: -0.26, armRFwd: 0.71, armRElbow: 0,
        },
      },
      {
        t: 0.36,
        pose: {
          yaw: -0.4, hipY: 0.96, bend: 1.2, nod: 0.1, boardY: 0.57, footFX: 0.3, footBX: -0.3,
          armLRaise: 1.6, armLFwd: 0.2, armLElbow: 0.3, armRRaise: -0.26, armRFwd: 0.71, armRElbow: 0,
        },
      },
      { t: 0.48, pose: { hipY: 1.0, bend: 0.3, boardY: 0.3, footFX: 0.3, footBX: -0.3, armLRaise: 1.4, armRRaise: 1.3, armLElbow: 0.3, armRElbow: 0.35 } },
      { t: 0.62, pose: { hipY: 0.94, bend: 0.22, boardY: 0.08, armLRaise: 1.2, armRRaise: 1.1 } },
    ],
  },
  // Kickflip, keyed from photos of tweaked kickflips (zack, 2026-10-24). The front foot slides up and flicks off the
  // heel-side corner of the nose; the board rolls toe edge up (heel edge down) while the body keeps rising away
  // from it. At the height of the flip the legs split wide over the board: front leg kicked out past the nose and
  // nearly straight, back knee pulled up with the foot hovering over the tail, the board turning in the gap below
  // the feet. The back arm is flung up overhead, the front arm reaches down toward the front foot, the torso leans
  // back a little and the head looks down at the board. Then the legs close, the back foot catches first, the
  // front foot stomps it level.
  kickflip: {
    loop: false,
    keys: [
      { t: 0, pose: { hipY: 1.0, boardY: 0.3, footFX: 0.34, footBX: TAIL_FOOT, bend: 0.25, armLRaise: 1.2, armRRaise: 1.0 } },
      { t: 0.05, pose: { ...flick(-1), boardRoll: -0.7, armRRaise: 1.9, armRElbow: 0.4, armLRaise: 0.9, armLFwd: 0.4, nod: 0.4 } },
      { t: 0.15, pose: { ...split(-1), boardRoll: -Math.PI * 1.15 } },
      { t: 0.25, pose: { ...split(-1), hipY: 1.08, boardY: 0.22, footFX: 0.72, footBY: 0.68, boardRoll: -Math.PI * 1.75 } },
      { t: 0.32, pose: { ...catchBack, boardRoll: -TAU } },
      { t: 0.42, pose: { hipY: 0.98, boardY: 0.26, boardRoll: -TAU, footFX: 0.28, footBX: -0.28, nod: 0.3, armLRaise: 1.0, armRRaise: 1.3 } },
    ],
  },
  // heelflip: the front heel kicks off the toe-side edge, out toward the camera, and the board rolls the other way
  // (toe edge down). Same lift and split as the kickflip with the front leg kicked out toward the toe side.
  heelflip: {
    loop: false,
    keys: [
      { t: 0, pose: { hipY: 1.0, boardY: 0.3, footFX: 0.3, footBX: TAIL_FOOT, bend: 0.2, armLRaise: 1.1, armRRaise: 1.2 } },
      { t: 0.06, pose: { ...flick(1), footFTurn: 0.5, boardRoll: 0.7, armRRaise: 1.9, armRElbow: 0.4, armLRaise: 0.9, armLFwd: 0.4, nod: 0.4 } },
      { t: 0.16, pose: { ...split(1), footFTurn: 0.6, boardRoll: Math.PI * 1.15 } },
      { t: 0.26, pose: { ...split(1), footFTurn: 0.6, hipY: 1.08, boardY: 0.22, footFX: 0.7, footBY: 0.68, boardRoll: Math.PI * 1.75 } },
      { t: 0.33, pose: { ...catchBack, boardRoll: TAU } },
      { t: 0.42, pose: { hipY: 0.98, boardY: 0.26, boardRoll: TAU, footFX: 0.28, footBX: -0.28, nod: 0.3, armLRaise: 1.0, armRRaise: 1.3 } },
    ],
  },
  // backside pop shove-it: back foot scoops the tail behind (toward the heels) and the board spins flat 180 under
  // the lifted feet; the nose comes round to the back
  shuv1: {
    loop: false,
    keys: [
      { t: 0, pose: { hipY: 1.0, boardY: 0.3, footBX: TAIL_FOOT, armLRaise: 1.1, armRRaise: 1.1 } },
      { t: 0.06, pose: { hipY: 1.02, boardY: 0.3, footBOn: 0, footBX: -0.2, footBY: 0.55, footBZ: -0.2, footFOn: 0, footFY: 0.62, boardYaw: -0.5 } },
      { t: 0.28, pose: { hipY: 1.04, boardY: 0.3, boardYaw: -Math.PI, ...feetUp(0.62), footFX: 0.28, footBX: -0.28 } },
      { t: 0.34, pose: { hipY: 1.0, boardY: 0.28, boardYaw: -Math.PI, footBOn: 1, footFOn: 1 } },
      { t: 0.42, pose: { hipY: 0.98, boardY: 0.26, boardYaw: -Math.PI } },
    ],
  },
  // 360 shove-it: a harder scoop, a full flat turn
  shuv2: {
    loop: false,
    keys: [
      { t: 0, pose: { hipY: 1.0, boardY: 0.3, footBX: TAIL_FOOT, armLRaise: 1.2, armRRaise: 1.2 } },
      { t: 0.06, pose: { hipY: 1.02, boardY: 0.3, footBOn: 0, footBX: -0.15, footBY: 0.55, footBZ: -0.25, footFOn: 0, footFY: 0.66, boardYaw: -0.8 } },
      { t: 0.32, pose: { hipY: 1.05, boardY: 0.32, boardYaw: -TAU, ...feetUp(0.68), footFX: 0.28, footBX: -0.28 } },
      { t: 0.37, pose: { hipY: 1.0, boardY: 0.28, boardYaw: -TAU, footBOn: 1, footFOn: 1 } },
      { t: 0.42, pose: { hipY: 0.98, boardY: 0.26, boardYaw: -TAU } },
    ],
  },
  // 360 flip (tre flip), keyed from zack's slow-mo clip (mirrored: it travels left, Lou rolls right). A 360
  // backside shove-it and a kickflip at once: the back foot scoops hard behind the heels while it pops, the front
  // foot flicks forward off the heel-side corner of the nose, the board pops up steep and spins and flips together
  // under knees pulled up high, the body square. Back foot catches first, then the front, stomp the bolts.
  tre: {
    loop: false,
    keys: [
      { t: 0, pose: { hipY: 1.0, boardY: 0.3, footFX: 0.2, footFTurn: 0.35, footBX: TAIL_FOOT, bend: 0.25, armLRaise: 1.1, armRRaise: 1.1 } },
      {
        t: 0.06,
        pose: {
          hipY: 1.04, boardY: 0.3, boardPivot: TAIL * 0.6, boardPitch: 0.75, boardYaw: -0.7, boardRoll: -0.4, bend: 0.3, nod: 0.4,
          footFOn: 0, footFX: 0.56, footFY: 0.5, footFZ: -0.12, footFTurn: 0.4,
          footBOn: 0, footBX: -0.22, footBY: 0.46, footBZ: -0.22, armRRaise: 1.8, armRElbow: 0.4, armLRaise: 1.0, armLFwd: 0.4,
        },
      },
      { t: 0.15, pose: { hipY: 1.12, boardY: 0.36, boardPitch: 0.45, boardYaw: -2.2, boardRoll: -2.0, bend: 0.36, nod: 0.55, ...feetUp(0.74), footFX: 0.36, footBX: -0.36, armRRaise: 1.9, armLRaise: 1.3, armLFwd: 0.5 } },
      { t: 0.24, pose: { hipY: 1.12, boardY: 0.32, boardPitch: 0.2, boardYaw: -4.3, boardRoll: -4.2, bend: 0.36, nod: 0.6, ...feetUp(0.74), footFX: 0.34, footBX: -0.34, armRRaise: 1.8, armLRaise: 1.3, armLFwd: 0.5 } },
      { t: 0.32, pose: { hipY: 1.08, boardY: 0.28, boardYaw: -5.9, boardRoll: -5.9, bend: 0.32, nod: 0.5, ...feetUp(0.66), footFX: 0.3, footBX: -0.3, armRRaise: 1.7, armLRaise: 1.1 } },
      { t: 0.37, pose: { ...catchBack, boardYaw: -TAU, boardRoll: -TAU } },
      { t: 0.46, pose: { hipY: 0.98, boardY: 0.26, boardYaw: -TAU, boardRoll: -TAU, footFX: 0.28, footBX: -0.28, nod: 0.3, armLRaise: 1.0, armRRaise: 1.3 } },
    ],
  },
  // Hardflip: a frontside pop shove-it and a kickflip at once. The back foot pops and pushes the tail frontside
  // (toward the toes), the front foot flicks down over the toe-side corner of the nose, and the board flips up
  // between the legs standing on end, nose up, so the legs spread wide and the front knee comes high to let it through
  hardflip: {
    loop: false,
    keys: [
      { t: 0, pose: { hipY: 1.0, boardY: 0.3, footFX: 0.24, footBX: TAIL_FOOT, bend: 0.22, armLRaise: 1.1, armRRaise: 1.1 } },
      {
        t: 0.06,
        pose: {
          hipY: 1.05, boardY: 0.3, boardPivot: TAIL * 0.5, boardPitch: 0.9, boardYaw: 0.5, boardRoll: -0.5, bend: 0.28, nod: 0.45,
          footFOn: 0, footFX: 0.5, footFY: 0.48, footFZ: 0.1, footBOn: 0, footBX: -0.3, footBY: 0.45, footBZ: 0.16,
          armRRaise: 1.9, armRElbow: 0.4, armLRaise: 1.0, armLFwd: 0.4,
        },
      },
      { t: 0.15, pose: { hipY: 1.12, boardY: 0.34, boardPitch: 1.35, boardYaw: 1.4, boardRoll: -2.6, bend: 0.3, nod: 0.6, ...feetUp(0.72, 0.04), footFX: 0.48, footBX: -0.44, footFY: 0.82, armRRaise: 2.2, armLRaise: 1.2, armLFwd: 0.5 } },
      { t: 0.25, pose: { hipY: 1.1, boardY: 0.3, boardPitch: 0.6, boardYaw: 2.6, boardRoll: -4.9, bend: 0.32, nod: 0.55, ...feetUp(0.7), footFX: 0.4, footBX: -0.4, armRRaise: 2.0, armLRaise: 1.2 } },
      { t: 0.33, pose: { ...catchBack, boardYaw: Math.PI, boardRoll: -TAU } },
      { t: 0.42, pose: { hipY: 0.98, boardY: 0.26, boardYaw: Math.PI, boardRoll: -TAU, footFX: 0.28, footBX: -0.28, nod: 0.3, armLRaise: 1.0, armRRaise: 1.3 } },
    ],
  },
  // varial kickflip: a backside pop shove-it with a kickflip; the board stays flatter than a tre and turns half
  varial: {
    loop: false,
    keys: [
      { t: 0, pose: { hipY: 1.0, boardY: 0.3, footFX: 0.3, footBX: TAIL_FOOT, bend: 0.24, armLRaise: 1.2, armRRaise: 1.0 } },
      { t: 0.06, pose: { ...flick(-1), boardYaw: -0.5, boardRoll: -0.8, footBZ: -0.18, armRRaise: 1.9, armRElbow: 0.4, armLRaise: 0.9, armLFwd: 0.4, nod: 0.4 } },
      { t: 0.16, pose: { ...feetUp(0.66), hipY: 1.1, boardY: 0.28, footFX: 0.36, footBX: -0.36, bend: 0.34, nod: 0.55, boardYaw: -1.6, boardRoll: -3.3, armRRaise: 1.9, armLRaise: 1.2 } },
      { t: 0.26, pose: { ...feetUp(0.64), hipY: 1.08, boardY: 0.26, footFX: 0.32, footBX: -0.32, bend: 0.32, nod: 0.5, boardYaw: -2.7, boardRoll: -5.6, armRRaise: 1.7, armLRaise: 1.1 } },
      { t: 0.32, pose: { ...catchBack, boardYaw: -Math.PI, boardRoll: -TAU } },
      { t: 0.42, pose: { hipY: 0.98, boardY: 0.26, boardYaw: -Math.PI, boardRoll: -TAU, footFX: 0.28, footBX: -0.28, nod: 0.3, armLRaise: 1.0, armRRaise: 1.3 } },
    ],
  },
  // varial heelflip: a frontside shove-it with a heelflip (the back foot scoops toward the toes)
  varialHeel: {
    loop: false,
    keys: [
      { t: 0, pose: { hipY: 1.0, boardY: 0.3, footFX: 0.3, footBX: TAIL_FOOT, bend: 0.2, armLRaise: 1.1, armRRaise: 1.2 } },
      { t: 0.06, pose: { ...flick(1), footFTurn: 0.5, boardYaw: 0.5, boardRoll: 0.8, footBZ: 0.18, armRRaise: 1.9, armRElbow: 0.4, armLRaise: 0.9, armLFwd: 0.4, nod: 0.4 } },
      { t: 0.16, pose: { ...feetUp(0.66), hipY: 1.1, boardY: 0.28, footFX: 0.36, footBX: -0.36, bend: 0.3, nod: 0.55, boardYaw: 1.6, boardRoll: 3.3, armRRaise: 1.9, armLRaise: 1.2 } },
      { t: 0.26, pose: { ...feetUp(0.64), hipY: 1.08, boardY: 0.26, footFX: 0.32, footBX: -0.32, bend: 0.3, nod: 0.5, boardYaw: 2.7, boardRoll: 5.6, armRRaise: 1.7, armLRaise: 1.1 } },
      { t: 0.32, pose: { ...catchBack, boardYaw: Math.PI, boardRoll: TAU } },
      { t: 0.42, pose: { hipY: 0.98, boardY: 0.26, boardYaw: Math.PI, boardRoll: TAU, footFX: 0.28, footBX: -0.28, nod: 0.3, armLRaise: 1.0, armRRaise: 1.3 } },
    ],
  },
  // frontside pop shove-it: the back foot scoops the tail forward toward the toes and the board spins flat 180 the
  // other way (tail swings out toward the camera)
  fsShuv: {
    loop: false,
    keys: [
      { t: 0, pose: { hipY: 1.0, boardY: 0.3, footBX: TAIL_FOOT, armLRaise: 1.1, armRRaise: 1.1 } },
      { t: 0.06, pose: { hipY: 1.02, boardY: 0.3, footBOn: 0, footBX: -0.2, footBY: 0.55, footBZ: 0.2, footFOn: 0, footFY: 0.62, boardYaw: 0.5 } },
      { t: 0.28, pose: { hipY: 1.04, boardY: 0.3, boardYaw: Math.PI, ...feetUp(0.62), footFX: 0.28, footBX: -0.28 } },
      { t: 0.34, pose: { hipY: 1.0, boardY: 0.28, boardYaw: Math.PI, footBOn: 1, footFOn: 1 } },
      { t: 0.42, pose: { hipY: 0.98, boardY: 0.26, boardYaw: Math.PI } },
    ],
  },
  // Backside 180: the skater and board turn half round together, back leading, and roll away fakie (back foot
  // first). Shoulders wind frontside first, then lead the turn; feet stay on the board, knees up. The clip ends a
  // half turn round in the switch stance (its yaw mirrored, -BASE.yaw), so when the rig flips to fakie and plays the
  // switch twins nothing turns back (zack, 2026-10-28: the fs 180s ended 40 degrees past it and unwound on landing).
  // The tuck opens up as it comes round, so the hand over to the air clip is short (a deep crouch seen from behind
  // pinched the seat of the suit).
  bs180: {
    loop: false,
    keys: [
      { t: 0, pose: { hipY: 1.0, boardY: 0.3, yaw: 0.65, head: 0.6, bend: 0.22, armLRaise: 1.1, armRRaise: 1.0, armLFwd: -0.3, armRFwd: 0.5 } },
      { t: 0.12, pose: { hipY: 1.08, boardY: 0.32, yaw: -0.9, head: 0.1, boardYaw: -0.9, bend: 0.3, nod: 0.35, armLRaise: 1.3, armRRaise: 1.2, armLFwd: 0.6, armRFwd: -0.3 } },
      { t: 0.26, pose: { hipY: 1.06, boardY: 0.3, yaw: -2.45, head: -0.1, boardYaw: -2.5, bend: 0.28, nod: 0.35, armLRaise: 1.2, armRRaise: 1.3, armLFwd: 0.4, armRFwd: -0.2 } },
      { t: 0.36, pose: { hipY: 1.0, boardY: 0.16, yaw: -BASE.yaw - Math.PI, head: 0.4, boardYaw: -Math.PI, bend: 0.22, armLRaise: 1.1, armRRaise: 1.1 } },
    ],
  },
  // Frontside 180: the chest opens toward the way they roll and keeps turning; lands fakie looking at the landing
  fs180: {
    loop: false,
    keys: [
      { t: 0, pose: { hipY: 1.0, boardY: 0.3, yaw: 0.05, head: 0.3, bend: 0.22, armLRaise: 1.0, armRRaise: 1.1, armLFwd: 0.5, armRFwd: -0.3 } },
      { t: 0.12, pose: { hipY: 1.08, boardY: 0.32, yaw: 1.2, head: 0.5, boardYaw: 0.9, bend: 0.28, nod: 0.3, armLRaise: 1.3, armRRaise: 1.2, armLFwd: -0.3, armRFwd: 0.6 } },
      { t: 0.26, pose: { hipY: 1.06, boardY: 0.3, yaw: 2.4, head: 0.6, boardYaw: 2.5, bend: 0.26, nod: 0.35, armLRaise: 1.2, armRRaise: 1.3, armLFwd: -0.2, armRFwd: 0.4 } },
      { t: 0.36, pose: { hipY: 1.0, boardY: 0.16, yaw: -BASE.yaw + Math.PI, head: 0.5, boardYaw: Math.PI, bend: 0.22, armLRaise: 1.1, armRRaise: 1.1 } },
    ],
  },
  // 50-50: both trucks' hangers locked on the rail (wheels either side of it), board in line with it, knees bent,
  // arms out for balance (grind1)
  grind1: {
    loop: true,
    keys: [
      { t: 0, pose: { ...G50, hipY: 0.72, bend: 0.22, lean: -0.04, armLRaise: 1.4, armRRaise: 1.3, armLElbow: 0.3, armRElbow: 0.45 } },
      { t: 0.3, pose: { ...G50, hipY: 0.7, bend: 0.24, lean: -0.07, armLRaise: 1.5, armRRaise: 1.2, armLElbow: 0.35, armRElbow: 0.35 } },
      { t: 0.6, pose: { ...G50, hipY: 0.72, bend: 0.22, lean: -0.04, armLRaise: 1.4, armRRaise: 1.3, armLElbow: 0.3, armRElbow: 0.45 } },
    ],
  },
  // backside boardslide: the nose went over the rail on the heel side, so the board is across it (nose away from
  // the camera) sliding on the middle of the deck between the trucks, chest turned to face down the rail, feet over
  // the bolts either side of it, toes pointing down the rail (grind2)
  grind2: {
    loop: true,
    keys: [
      { t: 0, pose: { ...BOARDSLIDE, hipY: 0.72, bend: 0.12, lean: -0.1, armLRaise: 1.3, armRRaise: 1.4, armLElbow: 0.4, armRElbow: 0.3 } },
      { t: 0.3, pose: { ...BOARDSLIDE, hipY: 0.69, bend: 0.14, lean: -0.13, armLRaise: 1.4, armRRaise: 1.3, armLElbow: 0.3, armRElbow: 0.4 } },
      { t: 0.6, pose: { ...BOARDSLIDE, hipY: 0.72, bend: 0.12, lean: -0.1, armLRaise: 1.3, armRRaise: 1.4, armLElbow: 0.4, armRElbow: 0.3 } },
    ],
  },
  // frontside boardslide: the same slide on the middle of the deck, but the rail was on the toe side, so the nose
  // crossed it toward the camera and Lou slides backward, his back leading down the rail, looking back over his
  // lead shoulder to see where it ends; toes point up the rail (fsBoardslide)
  fsBoardslide: {
    loop: true,
    keys: [
      { t: 0, pose: { ...FS_BOARDSLIDE, hipY: 0.72, bend: 0.14, lean: 0.1, armLRaise: 1.4, armRRaise: 1.2, armLElbow: 0.35, armRElbow: 0.4 } },
      { t: 0.3, pose: { ...FS_BOARDSLIDE, hipY: 0.69, bend: 0.16, lean: 0.13, armLRaise: 1.3, armRRaise: 1.3, armLElbow: 0.4, armRElbow: 0.3 } },
      { t: 0.6, pose: { ...FS_BOARDSLIDE, hipY: 0.72, bend: 0.14, lean: 0.1, armLRaise: 1.4, armRRaise: 1.2, armLElbow: 0.35, armRElbow: 0.4 } },
    ],
  },
  // landing: feet over the bolts, knees soak it up, stand back up (impact, 7 x 50 ms)
  land: {
    loop: false,
    keys: [
      { t: 0, pose: { hipY: 0.84, bend: 0.2 } },
      { t: 0.1, pose: { hipY: 0.58, bend: 0.34, armLRaise: 0.9, armRRaise: 0.8, armLElbow: 0.8, armRElbow: 0.8 } },
      { t: 0.35, pose: { hipY: 0.88 } },
    ],
  },
  // a small drop (an ollie or a flip on flat): a quick dip at the knees, arms barely move. The rig stretches each
  // landing clip to the sim's ollie lockout for it (the 'land' event's lock), so the knees are back up when you can
  // ollie again (zack, 2026-10-27: three impacts scaled to the drop)
  landSmall: {
    loop: false,
    keys: [
      { t: 0, pose: { hipY: 0.86, bend: 0.16 } },
      { t: 0.06, pose: { hipY: 0.74, bend: 0.24, armLRaise: 0.5, armRRaise: 0.45, armLElbow: 0.4, armRElbow: 0.4 } },
      { t: 0.2, pose: { hipY: 0.88 } },
    ],
  },
  // a big drop (a roof): sinks deep into a full squat, arms flung up and out, head down, holds the compression, then
  // stands back up slowly
  landBig: {
    loop: false,
    keys: [
      { t: 0, pose: { hipY: 0.82, bend: 0.25 } },
      { t: 0.1, pose: { hipY: 0.48, bend: 0.52, nod: 0.35, armLRaise: 1.4, armRRaise: 1.3, armLElbow: 1.0, armRElbow: 0.95, armLFwd: 0.4, armRFwd: 0.3 } },
      { t: 0.3, pose: { hipY: 0.52, bend: 0.46, nod: 0.3, armLRaise: 1.1, armRRaise: 1.0, armLElbow: 0.9, armRElbow: 0.85, armLFwd: 0.3, armRFwd: 0.25 } },
      { t: 0.6, pose: { hipY: 0.88 } },
    ],
  },
  // backside smith grind (zack's photo): weight on the back leg over the locked back truck, front knee bent
  // pressing the nose down past the far side, torso upright and a little back, back arm up high, head down
  smith: {
    loop: true,
    keys: [
      { t: 0, pose: { ...SMITH, hipX: -0.1, hipY: 0.76, bend: 0.2, lean: -0.1, nod: 0.45, footBX: -0.3, footFX: 0.15, armRRaise: 2.6, armRElbow: 0.2, armLRaise: 0.6, armLFwd: 0.35 } },
      { t: 0.35, pose: { ...SMITH, boardPitch: -0.55, hipX: -0.12, hipY: 0.74, bend: 0.22, lean: -0.12, nod: 0.45, footBX: -0.3, footFX: 0.15, armRRaise: 2.5, armRElbow: 0.3, armLRaise: 0.7, armLFwd: 0.3 } },
      { t: 0.7, pose: { ...SMITH, hipX: -0.1, hipY: 0.76, bend: 0.2, lean: -0.1, nod: 0.45, footBX: -0.3, footFX: 0.15, armRRaise: 2.6, armRElbow: 0.2, armLRaise: 0.6, armLFwd: 0.35 } },
    ],
  },
  // backside feeble: weight on the back leg over the locked back truck, front leg pushing the front truck down over
  // the far side of the rail, arms out
  feeble: {
    loop: true,
    keys: [
      { t: 0, pose: { ...FEEBLE, hipX: -0.08, hipY: 0.76, bend: 0.18, lean: -0.08, nod: 0.4, footBX: -0.3, footFX: 0.18, armRRaise: 1.9, armRElbow: 0.3, armLRaise: 1.2, armLFwd: 0.3 } },
      { t: 0.35, pose: { ...FEEBLE, boardPitch: -0.5, hipX: -0.1, hipY: 0.74, bend: 0.2, lean: -0.1, nod: 0.4, footBX: -0.3, footFX: 0.18, armRRaise: 1.8, armRElbow: 0.35, armLRaise: 1.3, armLFwd: 0.25 } },
      { t: 0.7, pose: { ...FEEBLE, hipX: -0.08, hipY: 0.76, bend: 0.18, lean: -0.08, nod: 0.4, footBX: -0.3, footFX: 0.18, armRRaise: 1.9, armRElbow: 0.3, armLRaise: 1.2, armLFwd: 0.3 } },
    ],
  },
  // 5-0: grinding on the back truck with the nose held up, like a manual on the rail; weight back over the tail,
  // front foot light over the front bolts, arms out
  fiveO: {
    loop: true,
    keys: [
      { t: 0, pose: { ...FIVE_O, hipX: -0.14, hipY: 0.8, bend: 0.16, lean: -0.12, nod: 0.3, footBX: -0.34, footFX: 0.22, armLRaise: 1.5, armRRaise: 1.3, armLElbow: 0.3, armRElbow: 0.4 } },
      { t: 0.35, pose: { ...FIVE_O, boardPitch: 0.24, hipX: -0.16, hipY: 0.78, bend: 0.18, lean: -0.15, nod: 0.3, footBX: -0.34, footFX: 0.22, armLRaise: 1.6, armRRaise: 1.2, armLElbow: 0.35, armRElbow: 0.35 } },
      { t: 0.7, pose: { ...FIVE_O, hipX: -0.14, hipY: 0.8, bend: 0.16, lean: -0.12, nod: 0.3, footBX: -0.34, footFX: 0.22, armLRaise: 1.5, armRRaise: 1.3, armLElbow: 0.3, armRElbow: 0.4 } },
    ],
  },
  // nosegrind: grinding on the front truck with the tail held up; weight forward over the nose, back foot light over
  // the back bolts, arms out
  noseGrind: {
    loop: true,
    keys: [
      { t: 0, pose: { ...NOSEGRIND, hipX: 0.14, hipY: 0.8, bend: 0.24, lean: 0.12, nod: 0.35, footFX: 0.34, footBX: -0.22, armLRaise: 1.3, armRRaise: 1.5, armLElbow: 0.4, armRElbow: 0.3 } },
      { t: 0.35, pose: { ...NOSEGRIND, boardPitch: -0.24, hipX: 0.16, hipY: 0.78, bend: 0.26, lean: 0.15, nod: 0.35, footFX: 0.34, footBX: -0.22, armLRaise: 1.2, armRRaise: 1.6, armLElbow: 0.35, armRElbow: 0.35 } },
      { t: 0.7, pose: { ...NOSEGRIND, hipX: 0.14, hipY: 0.8, bend: 0.24, lean: 0.12, nod: 0.35, footFX: 0.34, footBX: -0.22, armLRaise: 1.3, armRRaise: 1.5, armLElbow: 0.4, armRElbow: 0.3 } },
    ],
  },
  // manual: rolling on the back wheels, nose up, weight over the tail, arms out balancing (bus roofs). The board
  // tips about the back axle, so the back wheels stay on the ground.
  manual: {
    loop: true,
    keys: [
      { t: 0, pose: { boardPivot: -BOARD.bolts, boardY: -0.01, boardPitch: 0.2, hipX: -0.12, hipY: 0.82, lean: -0.1, bend: 0.14, nod: 0.25, footBX: -0.34, footFX: 0.2, armLRaise: 1.4, armRRaise: 1.2, armLFwd: 0.3, armRFwd: 0.2 } },
      { t: 0.5, pose: { boardPivot: -BOARD.bolts, boardY: -0.01, boardPitch: 0.24, hipX: -0.14, hipY: 0.8, lean: -0.13, bend: 0.16, nod: 0.25, footBX: -0.34, footFX: 0.2, armLRaise: 1.5, armRRaise: 1.1, armLFwd: 0.35, armRFwd: 0.15 } },
      { t: 1.0, pose: { boardPivot: -BOARD.bolts, boardY: -0.01, boardPitch: 0.2, hipX: -0.12, hipY: 0.82, lean: -0.1, bend: 0.14, nod: 0.25, footBX: -0.34, footFX: 0.2, armLRaise: 1.4, armRRaise: 1.2, armLFwd: 0.3, armRFwd: 0.2 } },
    ],
  },
  // nose manual: the same on the front wheels, weight forward over the nose
  noseManual: {
    loop: true,
    keys: [
      { t: 0, pose: { boardPivot: BOARD.bolts, boardY: -0.01, boardPitch: -0.2, hipX: 0.12, hipY: 0.82, lean: 0.12, bend: 0.2, nod: 0.35, footFX: 0.34, footBX: -0.2, armLRaise: 1.2, armRRaise: 1.5, armLFwd: 0.3, armRFwd: 0.2 } },
      { t: 0.5, pose: { boardPivot: BOARD.bolts, boardY: -0.01, boardPitch: -0.24, hipX: 0.14, hipY: 0.8, lean: 0.15, bend: 0.22, nod: 0.35, footFX: 0.34, footBX: -0.2, armLRaise: 1.1, armRRaise: 1.6, armLFwd: 0.35, armRFwd: 0.15 } },
      { t: 1.0, pose: { boardPivot: BOARD.bolts, boardY: -0.01, boardPitch: -0.2, hipX: 0.12, hipY: 0.82, lean: 0.12, bend: 0.2, nod: 0.35, footFX: 0.34, footBX: -0.2, armLRaise: 1.2, armRRaise: 1.5, armLFwd: 0.3, armRFwd: 0.2 } },
    ],
  },
  // crooked grind (zack's photo): weight forward over the front truck and nose, front knee bent, back leg reaching up
  // to the raised tail, arms out wide
  crooked: {
    loop: true,
    keys: [
      { t: 0, pose: { ...CROOKED, hipX: 0.12, hipY: 0.88, bend: 0.2, lean: 0.1, nod: 0.3, footFX: 0.3, footBX: -0.3, armLRaise: 1.5, armRRaise: 1.55, armLElbow: 0.25, armRElbow: 0.3 } },
      { t: 0.35, pose: { ...CROOKED, boardPitch: -0.44, hipX: 0.14, hipY: 0.86, bend: 0.22, lean: 0.12, nod: 0.3, footFX: 0.3, footBX: -0.3, armLRaise: 1.6, armRRaise: 1.45, armLElbow: 0.3, armRElbow: 0.25 } },
      { t: 0.7, pose: { ...CROOKED, hipX: 0.12, hipY: 0.88, bend: 0.2, lean: 0.1, nod: 0.3, footFX: 0.3, footBX: -0.3, armLRaise: 1.5, armRRaise: 1.55, armLElbow: 0.25, armRElbow: 0.3 } },
    ],
  },
  // firecracker (the Firecracker boon): riding a stair set down in a manual, the tail clacking on each step. The board
  // rides tipped back on its tail with the tail tip on the step; each clack (the sim's 'clack' event restarts the clip)
  // slaps the tail down, the knees soak it up and the arms bounce, then it tips back up ready for the next step
  firecracker: {
    loop: true,
    keys: [
      { t: 0, pose: { boardPivot: TAIL, boardPitch: 0.36, boardY: POP_Y, hipX: -0.12, hipY: 0.74, lean: -0.12, bend: 0.22, nod: 0.35, footBX: TAIL_FOOT, footFX: 0.18, armLRaise: 1.6, armRRaise: 1.45, armLElbow: 0.3, armRElbow: 0.35, armLFwd: 0.3, armRFwd: 0.2 } },
      { t: 0.06, pose: { boardPivot: TAIL, boardPitch: 0.24, boardY: POP_Y, hipX: -0.1, hipY: 0.7, lean: -0.1, bend: 0.28, nod: 0.4, footBX: TAIL_FOOT, footFX: 0.18, armLRaise: 1.75, armRRaise: 1.6, armLElbow: 0.25, armRElbow: 0.3, armLFwd: 0.35, armRFwd: 0.25 } },
      { t: 0.16, pose: { boardPivot: TAIL, boardPitch: 0.32, boardY: POP_Y, hipX: -0.12, hipY: 0.76, lean: -0.13, bend: 0.2, nod: 0.35, footBX: TAIL_FOOT, footFX: 0.18, armLRaise: 1.5, armRRaise: 1.4, armLElbow: 0.35, armRElbow: 0.4, armLFwd: 0.3, armRFwd: 0.2 } },
      { t: 0.24, pose: { boardPivot: TAIL, boardPitch: 0.36, boardY: POP_Y, hipX: -0.12, hipY: 0.74, lean: -0.12, bend: 0.22, nod: 0.35, footBX: TAIL_FOOT, footFX: 0.18, armLRaise: 1.6, armRRaise: 1.45, armLElbow: 0.3, armRElbow: 0.35, armLFwd: 0.3, armRFwd: 0.2 } },
    ],
  },
  // towed up a hill by the cable car (zack, 2026-10-26): crouched, hips shifted toward the car in the lane behind,
  // the front arm reaching out to grab the pole at its back end (the game pins that hand to the pole with arm IK,
  // src/render/skater-rig.ts reach), the back arm out for balance
  towed: {
    loop: true,
    keys: [
      { t: 0, pose: { yaw: 0.7, hipY: 0.8, hipZ: -0.1, lean: 0.15, bend: 0.15, head: 0.2, nod: 0.05, armLRaise: 0.84, armLFwd: -1.84, armLElbow: 1.2, armRRaise: 0.9, armRFwd: 0.3, armRElbow: 0.5 } },
      { t: 0.8, pose: { yaw: 0.7, hipY: 0.78, hipZ: -0.11, lean: 0.17, bend: 0.16, head: 0.2, nod: 0.05, armLRaise: 0.84, armLFwd: -1.84, armLElbow: 1.2, armRRaise: 1.0, armRFwd: 0.35, armRElbow: 0.45 } },
      { t: 1.6, pose: { yaw: 0.7, hipY: 0.8, hipZ: -0.1, lean: 0.15, bend: 0.15, head: 0.2, nod: 0.05, armLRaise: 0.84, armLFwd: -1.84, armLElbow: 1.2, armRRaise: 0.9, armRFwd: 0.3, armRElbow: 0.5 } },
    ],
  },
  // airborne off a drop or after a trick: standing on the board, knees soft, arms up for balance
  air: {
    loop: true,
    keys: [
      { t: 0, pose: { hipY: 0.92, bend: 0.2, armLRaise: 1.1, armRRaise: 0.95, armLElbow: 0.5, armRElbow: 0.6 } },
      { t: 0.5, pose: { hipY: 0.9, bend: 0.22, armLRaise: 1.2, armRRaise: 0.9, armLElbow: 0.45, armRElbow: 0.65 } },
      { t: 1.0, pose: { hipY: 0.92, bend: 0.2, armLRaise: 1.1, armRRaise: 0.95, armLElbow: 0.5, armRElbow: 0.6 } },
    ],
  },
  // slam: a landing that doesn't stick. The board squirts out ahead, the feet slip with it and the skater sits down
  // hard on their butt, head whipping back, hands behind to break it; then they rock forward over their feet, take
  // a running step and hop back on as the board rolls back under them (about 0.9 s)
  slam: {
    loop: false,
    keys: [
      { t: 0, pose: { hipY: 0.8, bend: 0.3 } },
      // the board squirts out ahead from under the feet; they slip forward with it, hips drop, head whips back
      { t: 0.08, pose: { tumble: 0.45, hipX: -0.08, hipY: 0.58, bend: 0.1, nod: -0.6, head: 0.2, ...feetUp(0.22, 0.05), footFX: 0.5, footBX: 0.1, armLRaise: 1.9, armLFwd: 0.9, armLElbow: 0.3, armRRaise: 2.2, armRFwd: 0.6, armRElbow: 0.4, boardX: 0.55, boardPivot: TAIL, boardPitch: 0.35, boardY: 0.05 } },
      // down on the butt, legs out in front, hands back on the ground to break the fall
      { t: 0.22, pose: { tumble: 0.85, hipX: -0.2, hipY: 0.22, bend: 0.45, nod: -0.2, head: 0.3, ...feetUp(0.06, 0.1), footFX: 0.55, footBX: 0.35, armLRaise: 0.7, armLFwd: -1.1, armLElbow: 0.1, armRRaise: 0.8, armRFwd: -1.2, armRElbow: 0.1, boardX: 1.5, boardYaw: 0.35 } },
      // the bounce: rocked forward over the feet, hands pushing off the knees
      { t: 0.42, pose: { tumble: 0.15, hipX: -0.05, hipY: 0.45, bend: 0.85, nod: 0.25, ...feetUp(0.02, 0.06), footFX: 0.22, footBX: -0.18, armLRaise: 0.4, armLFwd: 1.0, armLElbow: 0.9, armRRaise: 0.45, armRFwd: 0.9, armRElbow: 0.9, boardX: 1.2, boardYaw: 0.2 } },
      // a running step to catch the board up, the back foot swinging onto it
      { t: 0.65, pose: { hipX: 0.06, hipY: 0.82, bend: 0.4, nod: 0.3, footFOn: 1, footBOn: 0, footBX: -0.35, footBY: 0.28, footBZ: 0.06, armLRaise: 0.9, armRRaise: 0.8, boardX: 0.35 } },
      { t: 0.9, pose: { tumble: 0, hipY: 0.84, bend: 0.25 } },
    ],
  },
  // freefall: off the board and dropping, arms windmilling, legs running in the air, the board tumbling away
  freefall: {
    loop: true,
    keys: [
      { t: 0, pose: { hipY: 0.9, nod: -0.3, ...feetUp(0.42, 0.1), footFX: 0.35, footBX: -0.25, footFY: 0.3, boardX: 0.4, boardY: 0.6, boardRoll: 0.5, boardPitch: 0.4, armLRaise: 2.6, armLFwd: 0.6, armLElbow: 0.4, armRRaise: 1.0, armRFwd: -0.6, armRElbow: 0.6 } },
      { t: 0.15, pose: { hipY: 0.9, nod: -0.2, ...feetUp(0.3, 0.1), footFX: 0.15, footBX: -0.05, footBY: 0.45, boardX: 0.45, boardY: 0.62, boardRoll: 0.9, boardPitch: 0.25, armLRaise: 1.6, armLFwd: 1.4, armLElbow: 0.7, armRRaise: 2.4, armRFwd: -0.1, armRElbow: 0.3 } },
      { t: 0.3, pose: { hipY: 0.9, nod: -0.3, ...feetUp(0.42, 0.1), footFX: 0.35, footBX: -0.25, footFY: 0.3, boardX: 0.4, boardY: 0.6, boardRoll: 0.5, boardPitch: 0.4, armLRaise: 2.6, armLFwd: 0.6, armLElbow: 0.4, armRRaise: 1.0, armRFwd: -0.6, armRElbow: 0.6 } },
    ],
  },
};

// Switch (zack): riding with your back to the camera. The rig shows it turned half round (src/render/skater-rig.ts),
// so a regular clip played there would push, pop and flick the wrong way, toward where you're going. Each clip has
// a switch twin, 'switchPush' for 'push' and so on, that starts out as its mirror image along the board: the other
// foot pushes and pops, the other arm leads, the board turns and pitches the other way. Each twin is a clip of its
// own, so the editor can key it apart from the regular one.
const NO_SWITCH = new Set(['idle', 'busted']); // held poses under a menu or a bust, never seen turned round
export const switchName = (name: string): string => `switch${name[0].toUpperCase()}${name.slice(1)}`;
export const isSwitch = (name: string): boolean => /^switch[A-Z]/.test(name);

// a pose mirrored along the board (x): the legs and the arms trade roles, so the left leg still stands on the left
export function mirrorPose(p: Pose): Pose {
  return {
    ...p,
    yaw: -p.yaw,
    hipX: -p.hipX,
    lean: -p.lean,
    head: -p.head,
    headTilt: -p.headTilt,
    armLRaise: p.armRRaise,
    armLFwd: p.armRFwd,
    armLElbow: p.armRElbow,
    armRRaise: p.armLRaise,
    armRFwd: p.armLFwd,
    armRElbow: p.armLElbow,
    footFX: -p.footBX,
    footFY: p.footBY,
    footFZ: p.footBZ,
    footFOn: p.footBOn,
    footFTurn: -p.footBTurn,
    footFPitch: p.footBPitch,
    footFToe: p.footBToe,
    footFRoll: p.footBRoll,
    footBX: -p.footFX,
    footBY: p.footFY,
    footBZ: p.footFZ,
    footBOn: p.footFOn,
    footBTurn: -p.footFTurn,
    footBPitch: p.footFPitch,
    footBToe: p.footFToe,
    footBRoll: p.footFRoll,
    kneeFX: -p.kneeBX,
    kneeFY: p.kneeBY,
    kneeFZ: p.kneeBZ,
    kneeBX: -p.kneeFX,
    kneeBY: p.kneeFY,
    kneeBZ: p.kneeFZ,
    boardX: -p.boardX,
    boardPivot: -p.boardPivot,
    boardPitch: -p.boardPitch,
    boardYaw: -p.boardYaw,
    tumble: -p.tumble,
  };
}

// a key mirrored: everything the pose sets once mirrored, minus what's still the base
export function mirrorKey(k: Key): Key {
  const m = mirrorPose({ ...BASE, ...k });
  const out: Key = {};
  for (const f of Object.keys(m) as (keyof Pose)[]) if (Math.abs(m[f] - BASE[f]) > 1e-9) out[f] = +m[f].toFixed(4);
  return out;
}

export function mirrorClip(c: Clip): Clip {
  return { loop: c.loop, keys: c.keys.map((k) => ({ t: k.t, pose: mirrorKey(k.pose) })) };
}

// The 180 flips (bsFlip, fsFlip, bsHeel, fsHeel): the kickflip or heelflip under the feet while the body and board
// turn half round as in the 180. The flip's keys, slowed to be caught with the spin (TRICK_CATCH), with the 180's
// turn, head and arms at each (zack, 2026-10-28). An edit in ?editor of the flip or the 180 carries over.
const SPIN_FLIPS: Record<string, [string, string]> = {
  bsFlip: ['bs180', 'kickflip'],
  fsFlip: ['fs180', 'kickflip'],
  bsHeel: ['bs180', 'heelflip'],
  fsHeel: ['fs180', 'heelflip'],
};
const SPIN_FIELDS = ['yaw', 'head', 'boardYaw', 'armLRaise', 'armLFwd', 'armLElbow', 'armRRaise', 'armRFwd', 'armRElbow'] as const;
for (const [id, [spinId, flipId]] of Object.entries(SPIN_FLIPS)) {
  const edited = (n: string) => ((clipEdits as Record<string, Clip>)[n]?.keys?.length ? (clipEdits as Record<string, Clip>)[n] : CLIPS[n]);
  const spin = edited(spinId);
  const flip = edited(flipId);
  const slow = TRICK_CATCH[id as TrickId] / TRICK_CATCH[flipId as TrickId];
  CLIPS[id] = {
    loop: false,
    keys: flip.keys.map((k) => {
      const t = +(k.t * slow).toFixed(4);
      const turn = sample(spin, t);
      const pose: Key = { ...k.pose };
      for (const f of SPIN_FIELDS) pose[f] = turn[f];
      if (pose.footFX !== undefined) pose.footFX = Math.min(pose.footFX, 0.6); // the front foot kicks less far, the hips turned away from it
      return { t, pose };
    }),
  };
}

// the nollie: the ollie's keys (as edited) popped off the nose
{
  const ollie = (clipEdits as Record<string, Clip>).ollie?.keys?.length ? (clipEdits as Record<string, Clip>).ollie : CLIPS.ollie;
  CLIPS.nollie.keys = ollie.keys.map((k) => ({ t: k.t, pose: nosePop(k.pose) }));
}
// Nollie flip tricks (nollieKickflip, nollieBs180, ...): each flip's keys (as edited) popped off the nose. The back
// foot does the flicking off the tail's corner while the front foot rides the nose up, the flip turning the same way
// under the rider; shove-its are scooped by the front foot, so their board spin turns the other way. An edit in
// ?editor wins.
for (const id of Object.keys(TRICK_CATCH) as TrickId[]) {
  const flip = (clipEdits as Record<string, Clip>)[id]?.keys?.length ? (clipEdits as Record<string, Clip>)[id] : CLIPS[id];
  const spinBoard = !SPIN[id]; // a 180's board turns with the body
  if (flip) CLIPS[nollieClip(id)] = { loop: flip.loop, keys: flip.keys.map((k) => ({ t: k.t, pose: nosePop(k.pose, spinBoard) })) };
}
// clips that ride the nose (switch twins included): popping out of them is a nollie (a fakie ollie riding switch)
export const onNose = (name: string): boolean => NOSE_STANCES.has(name.replace(/^switch([A-Z])/, (_, c: string) => c.toLowerCase()));

// the twins come from the regular clips as edited, unless a twin is edited itself (applyClipEdits, below)
for (const name of Object.keys(CLIPS)) {
  if (NO_SWITCH.has(name)) continue;
  const edited = (clipEdits as Record<string, Clip>)[name];
  CLIPS[switchName(name)] = mirrorClip(edited?.keys?.length ? edited : CLIPS[name]);
}

// Towed riding switch: Lou's back is to the camera, so the cable car in the lane behind is in front of his chest and
// he reaches forward for it with his leading (right) arm, not back as the mirrored clip would
CLIPS.switchTowed = {
  loop: true,
  keys: [0, 0.8, 1.6].map((t, i) => ({
    t,
    pose: {
      yaw: 0, hipY: i === 1 ? 0.68 : 0.7, hipZ: 0.1, lean: -0.15, bend: 0.3, head: -0.2, nod: 0.05,
      armRRaise: -0.17, armRFwd: 1.2, armRElbow: 1.16, armLRaise: i === 1 ? 1.0 : 0.9, armLFwd: 0.3, armLElbow: 0.5,
    },
  })),
};

// Clips keyed in the animation editor (?editor, src/editor) win over the ones above. It saves them to
// clip-edits.json; the code clips stay as they were, so reverting a clip there brings the code one back.
export const CODE_CLIPS: Record<string, Clip> = { ...CLIPS };
export const EDITED = new Set<string>(); // these play from their keys, not a Blender action baked from an older version

export function applyClipEdits(edits: Record<string, Clip>): void {
  for (const [name, clip] of Object.entries(edits)) {
    if (!clip?.keys?.length) continue;
    CLIPS[name] = clip;
    EDITED.add(name);
  }
}

applyClipEdits(clipEdits as Record<string, Clip>);

export function clipLength(clip: Clip): number {
  return clip.keys[clip.keys.length - 1].t;
}

// the grinds take turns in the sim (src/physics/tricks.ts), which knows from them when it's on the nose
export { LEDGE_GRINDS, RAIL_GRINDS } from '../physics/tricks';
export const GRIND_NAMES: Record<string, string> = {
  grind1: '50-50',
  crooked: 'CROOKED GRIND',
  fiveO: '5-0',
  noseGrind: 'NOSEGRIND',
  smith: 'BS SMITH',
  feeble: 'BS FEEBLE',
  grind2: 'BS BOARDSLIDE',
  fsBoardslide: 'FS BOARDSLIDE',
};
for (const [name, call] of Object.entries(GRIND_NAMES)) GRIND_NAMES[switchName(name)] = `SWITCH ${call}`;
// spins that leave the skater riding the other way round (fakie): the clip ends turned this far
export const SPINS: Record<string, number> = {};
for (const id of ['bs180', 'fs180', 'bsFlip', 'fsFlip', 'bsHeel', 'fsHeel'] as const) {
  SPINS[id] = id.startsWith('bs') ? -Math.PI : Math.PI;
  SPINS[switchName(id)] = -SPINS[id];
  const n = nollieClip(id);
  SPINS[n] = SPINS[id];
  SPINS[switchName(n)] = SPINS[switchName(id)];
}

// The yaw of a clip's stance, that the knees bend from: BASE.yaw riding regular, mirrored riding switch. A 180 hands
// over from one to the other as the board comes round, as it ends in the other stance, so its knees keep bending the
// way the stance does all through the spin and turn round with it (zack, 2026-10-28: the legs crossed at the end of
// a backside 180).
export function stanceYaw(name: string, p: Pose): number {
  const from = isSwitch(name) ? -BASE.yaw : BASE.yaw;
  const spin = SPINS[name];
  if (!spin) return from;
  return from * (1 - 2 * Math.min(Math.max(p.boardYaw / spin, 0), 1));
}

// The half turn (an odd multiple of pi) to take out of a board yaw a clip ended on when the board is left mostly
// turned round under the feet (a shove-it, a varial, a hardflip), else 0. Past 110 degrees: a boardslide's quarter
// turn (exactly 90) always turns back the way it came. The rig keeps the board turned instead (SkaterRig faceBoard).
export function boardHalfTurn(yaw: number): number {
  if (Math.abs(Math.atan2(Math.sin(yaw), Math.cos(yaw))) <= Math.PI / 2 + 0.35) return 0;
  return Math.round((yaw - Math.PI) / (2 * Math.PI)) * 2 * Math.PI + Math.PI;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

// the pose at time t (seconds) in a clip; missing values come from BASE
export function sample(clip: Clip, t: number): Pose {
  const len = clipLength(clip);
  const tt = clip.loop && len > 0 ? ((t % len) + len) % len : Math.min(Math.max(t, 0), len);
  let i = 0;
  while (i < clip.keys.length - 2 && clip.keys[i + 1].t <= tt) i++;
  const a = clip.keys[i];
  const b = clip.keys[Math.min(i + 1, clip.keys.length - 1)];
  const span = b.t - a.t;
  const k = span > 0 ? smooth(Math.min(1, Math.max(0, (tt - a.t) / span))) : 1;
  const out = { ...BASE };
  for (const key of Object.keys(BASE) as (keyof Pose)[]) {
    const va = a.pose[key] ?? BASE[key];
    const vb = b.pose[key] ?? BASE[key];
    out[key] = va + (vb - va) * k;
  }
  return out;
}

// Board spins that look the same a turn apart: a full flip, and half a flat spin (nose and tail are alike). Blends
// between clips take the short way round, so a flip that ended at -TAU doesn't unwind on the landing.
const PERIOD: Partial<Record<keyof Pose, number>> = { boardRoll: TAU, boardYaw: Math.PI };

export function mix(a: Pose, b: Pose, k: number): Pose {
  const out = { ...a };
  for (const key of Object.keys(a) as (keyof Pose)[]) {
    let from = a[key];
    const period = PERIOD[key];
    if (period) from = b[key] + wrap(from - b[key], period);
    out[key] = from + (b[key] - from) * k;
  }
  return out;
}

const wrap = (d: number, period: number) => d - Math.round(d / period) * period;

export interface Vec {
  x: number;
  y: number;
  z: number;
}

// A point on the deck surface at deck position x. The board turns (yaw) about its centre, then pitches about its
// pivot, then lifts; roll leaves points on the long axis where they are. The renderer builds the board the same way.
export function deckPoint(p: Pose, x: number): Vec {
  const ax = x * Math.cos(p.boardYaw) - p.boardPivot;
  const c = Math.cos(p.boardPitch);
  const s = Math.sin(p.boardPitch);
  return {
    x: p.boardX + p.boardPivot + ax * c,
    y: p.boardY + BOARD.deckTop + ax * s,
    z: p.boardZ - x * Math.sin(p.boardYaw),
  };
}

// The board's turn as the feet see it. Nose and tail are alike, so after a shove-it (the board turned half round
// under the skater) the feet land where they were, on what is now the other end. Only a turn of the body too (a 180)
// takes the feet round with the board.
export function feetYaw(p: Pose): number {
  const body = p.yaw - BASE.yaw;
  return body + wrap(p.boardYaw - body, Math.PI);
}

// where a foot's sole goes: on the deck, or its free target, blended by its "on" weight. The toe/heel value (Z)
// counts in both: on the deck it's across the board
export function footTarget(p: Pose, front: boolean): Vec {
  const on = front ? p.footFOn : p.footBOn;
  const fx = front ? p.footFX : p.footBX;
  const free = { x: fx, y: front ? p.footFY : p.footBY, z: front ? p.footFZ : p.footBZ };
  // on the deck the toe/heel value shifts the foot across the board (feet hang off the toe or heel edge)
  const yaw = feetYaw(p);
  const deck = deckPoint({ ...p, boardYaw: yaw }, fx);
  deck.x += free.z * Math.sin(yaw);
  deck.z += free.z * Math.cos(yaw);
  return { x: free.x + (deck.x - free.x) * on, y: free.y + (deck.y - free.y) * on, z: free.z + (deck.z - free.z) * on };
}

// which way a foot's toes point (yaw about y, 0 = toward the camera): its own turn, plus the board's spin while on it
export function footYaw(p: Pose, front: boolean): number {
  return (front ? p.footFTurn : p.footBTurn) + (front ? p.footFOn : p.footBOn) * feetYaw(p);
}

// Two-bone IK: where the knee goes for a hip and an ankle, bending toward `pole` (the way the toes point). The leg
// straightens when the ankle is out of reach.
export function kneePoint(hip: Vec, ankle: Vec, thigh: number, shin: number, pole: Vec): Vec {
  const d = { x: ankle.x - hip.x, y: ankle.y - hip.y, z: ankle.z - hip.z };
  const len = Math.hypot(d.x, d.y, d.z) || 1e-6;
  const reach = Math.min(len, thigh + shin - 1e-4);
  const dir = { x: d.x / len, y: d.y / len, z: d.z / len };
  const along = (thigh * thigh - shin * shin + reach * reach) / (2 * reach);
  const h = Math.sqrt(Math.max(0, thigh * thigh - along * along));
  const pd = pole.x * dir.x + pole.y * dir.y + pole.z * dir.z;
  let n = { x: pole.x - dir.x * pd, y: pole.y - dir.y * pd, z: pole.z - dir.z * pd };
  const nl = Math.hypot(n.x, n.y, n.z);
  n = nl > 1e-6 ? { x: n.x / nl, y: n.y / nl, z: n.z / nl } : { x: 0, y: 0, z: 1 };
  return { x: hip.x + dir.x * along + n.x * h, y: hip.y + dir.y * along + n.y * h, z: hip.z + dir.z * along + n.z * h };
}
