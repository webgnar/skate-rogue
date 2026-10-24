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
  | 'fsShuv';

// tricks come round in this order (deterministic, like the rest of the floor); 180s are a quarter of them
export const TRICK_ROLL: TrickId[] = [
  'kickflip', 'heelflip', 'bs180', 'shuv1', 'tre', 'fs180', 'varial', 'hardflip',
  'kickflip', 'bs180', 'fsShuv', 'heelflip', 'fs180', 'shuv2', 'varialHeel', 'tre',
];

export const SPIN: Record<TrickId, 0 | 180> = {
  kickflip: 0, heelflip: 0, shuv1: 0, shuv2: 0, bs180: 180, fs180: 180, tre: 0, hardflip: 0, varial: 0, varialHeel: 0, fsShuv: 0,
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
};

// the callout: tricks thrown riding fakie say so ("FAKIE KICKFLIP", "FAKIE FS 180" back to regular)
export function trickName(id: TrickId, fakie: boolean): string {
  return (fakie ? 'FAKIE ' : '') + NAMES[id];
}

export function rollTrick(n: number): TrickId {
  return TRICK_ROLL[n % TRICK_ROLL.length];
}
