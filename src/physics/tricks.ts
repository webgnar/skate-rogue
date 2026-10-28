// Which flip trick a tap in the air throws, and the stance it leaves you in. Lives in the sim so the score, the
// HUD and the rig all agree. A 180 turns the skater and board half a turn: ride away fakie (the other end leading)
// until the next 180 brings you back. Shove-its spin only the board, so they don't change stance.
export type TrickId =
  | 'kickflip'
  | 'heelflip'
  | 'shuv1'
  | 'shuv2'
  | 'bs180'
  | 'fs180'
  | 'tre'
  | 'hardflip'
  | 'varial'
  | 'varialHeel'
  | 'fsShuv'
  | 'bsFlip'
  | 'fsFlip'
  | 'bsHeel'
  | 'fsHeel';

// tricks come round in this order (deterministic, like the rest of the floor); 180s are a quarter of them
export const TRICK_ROLL: TrickId[] = [
  'kickflip', 'heelflip', 'bs180', 'shuv1', 'tre', 'fs180', 'varial', 'hardflip',
  'kickflip', 'bs180', 'fsShuv', 'heelflip', 'fs180', 'shuv2', 'varialHeel', 'tre',
  // the 180 flips: a kickflip or heelflip under the skater as they turn half round (zack, 2026-10-28)
  'kickflip', 'heelflip', 'bsFlip', 'shuv1', 'tre', 'fsFlip', 'varial', 'hardflip',
  'kickflip', 'bsHeel', 'fsShuv', 'heelflip', 'fsHeel', 'shuv2', 'varialHeel', 'tre',
];

export const SPIN: Record<TrickId, 0 | 180> = {
  kickflip: 0, heelflip: 0, shuv1: 0, shuv2: 0, bs180: 180, fs180: 180, tre: 0, hardflip: 0, varial: 0, varialHeel: 0, fsShuv: 0,
  bsFlip: 180, fsFlip: 180, bsHeel: 180, fsHeel: 180,
};

// When each flip is caught: the time (s) in its clip (src/render/poses.ts) where the board stops turning and the
// feet are back on it. The sim and the rig share it: land before the catch and it's sketchy, well before and the
// board isn't under you (a slam). tests/feel.test.ts checks these against the clips.
export const TRICK_CATCH: Record<TrickId, number> = {
  kickflip: 0.32,
  heelflip: 0.33,
  shuv1: 0.28,
  shuv2: 0.32,
  bs180: 0.36,
  fs180: 0.36,
  tre: 0.37,
  hardflip: 0.33,
  varial: 0.32,
  varialHeel: 0.32,
  fsShuv: 0.28,
  bsFlip: 0.36,
  fsFlip: 0.36,
  bsHeel: 0.36,
  fsHeel: 0.36,
};

const NAMES: Record<TrickId, string> = {
  kickflip: 'KICKFLIP',
  heelflip: 'HEELFLIP',
  shuv1: 'SHUVIT',
  shuv2: '360 SHUVIT',
  bs180: 'BS 180',
  fs180: 'FS 180',
  tre: '360 FLIP',
  hardflip: 'HARDFLIP',
  varial: 'VARIAL KICKFLIP',
  varialHeel: 'VARIAL HEELFLIP',
  fsShuv: 'FS SHUVIT',
  bsFlip: 'BS 180 KICKFLIP',
  fsFlip: 'FS 180 KICKFLIP',
  bsHeel: 'BS 180 HEELFLIP',
  fsHeel: 'FS 180 HEELFLIP',
};

// the callout: tricks thrown riding fakie say so ("FAKIE KICKFLIP", "FAKIE FS 180" back to regular), and so do
// tricks popped off the nose ("NOLLIE HEELFLIP")
export function trickName(id: TrickId, fakie: boolean, nollie = false): string {
  return (fakie ? 'FAKIE ' : nollie ? 'NOLLIE ' : '') + NAMES[id];
}

// the nollie version of a trick's clip (src/render/poses.ts): nollieKickflip, nollieBs180, ...
export const nollieClip = (id: TrickId): string => 'nollie' + id[0].toUpperCase() + id.slice(1);

// Grinds take turns. Rails (flat bars and handrails) get every grind, both boardslides among them; anything that
// isn't a rail (a parked car's roof) gets every grind but the boardslides, which only work across a rail (zack).
// The sim picks them, so it knows when it's on the nose; the rig plays the clip of the same name.
export const LEDGE_GRINDS = ['grind1', 'crooked', 'fiveO', 'noseGrind', 'smith', 'feeble'] as const;
export const RAIL_GRINDS = ['grind2', 'grind1', 'fsBoardslide', 'fiveO', 'smith', 'grind2', 'crooked', 'fsBoardslide', 'noseGrind', 'feeble'] as const;
// manual pads take turns too: a manual, then a nose manual
export const MANUALS = ['manual', 'noseManual'] as const;
// riding these, the weight's on the nose: an ollie out of them is a nollie
export const NOSE_STANCES = new Set<string>(['crooked', 'noseGrind', 'noseManual']);

export function rollTrick(n: number): TrickId {
  return TRICK_ROLL[n % TRICK_ROLL.length];
}
