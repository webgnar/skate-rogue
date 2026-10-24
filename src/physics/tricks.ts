// Which flip trick a tap in the air throws, and the stance it leaves you in. Lives in the sim so the score, the
// HUD and the rig all agree. A 180 turns the skater and board half a turn: ride away fakie (the other end leading)
// until the next 180 brings you back. Shove-its spin only the board, so they don't change stance.
export type TrickId = 'kickflip' | 'heelflip' | 'shuv1' | 'shuv2' | 'bs180' | 'fs180';

// tricks come round in this order (deterministic, like the rest of the floor); 180s are a quarter of them
export const TRICK_ROLL: TrickId[] = ['kickflip', 'heelflip', 'bs180', 'shuv1', 'kickflip', 'fs180', 'heelflip', 'shuv2'];

export const SPIN: Record<TrickId, 0 | 180> = { kickflip: 0, heelflip: 0, shuv1: 0, shuv2: 0, bs180: 180, fs180: 180 };

const NAMES: Record<TrickId, string> = {
  kickflip: 'KICKFLIP',
  heelflip: 'HEELFLIP',
  shuv1: 'SHUVIT',
  shuv2: '360 SHUVIT',
  bs180: 'BS 180',
  fs180: 'FS 180',
};

// the callout: tricks thrown riding fakie say so ("FAKIE KICKFLIP", "FAKIE FS 180" back to regular)
export function trickName(id: TrickId, fakie: boolean): string {
  return (fakie ? 'FAKIE ' : '') + NAMES[id];
}

export function rollTrick(n: number): TrickId {
  return TRICK_ROLL[n % TRICK_ROLL.length];
}
