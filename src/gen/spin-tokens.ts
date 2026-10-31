// Spin tokens (GDD: Spin tokens and the end-of-run payout): rare finds that each pull the slot machine once when the
// run ends. They turn up in a smashed prop now and then, at the end of a side line, and on the top route. Placed
// after the rest of the floor, from their own seed, so they never move anything else.
import type { Level } from '../physics/level';
import { makeRng } from './rng';

export const SPIN = {
  smash: 0.15, // chance a floor has one prop with a token inside
  side: 0.25, // chance the side line's prize at the top is a token, not a Stoken
  top: 0.15, // chance each of the top route's Stoken is a token instead (one a floor at most)
};

// the pickups each line added, as [from, to) indexes into level.pickups
export interface SpinSpots {
  side: [number, number];
  top: [number, number];
}

export function addSpinTokens(level: Level, spots: SpinSpots): void {
  const rng = makeRng(level.layout.seed * 131 + level.layout.floor * 7919 + 17);
  const swap = ([a, b]: [number, number], chance: number) => {
    for (let i = a; i < b; i++) {
      const p = level.pickups[i];
      if (p.kind === 'stoken' && rng() < chance) {
        p.kind = 'spin';
        return;
      }
    }
  };
  swap(spots.side, SPIN.side);
  swap(spots.top, SPIN.top);
  if (rng() < SPIN.smash) {
    const plain = level.props.filter((p) => p.breaks && p.loot !== 'stoken' && p.loot !== 'gear');
    if (plain.length) plain[Math.floor(rng() * plain.length)].loot = 'spin';
  }
}
