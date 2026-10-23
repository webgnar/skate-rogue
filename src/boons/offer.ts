// Draws the 1-of-3 boon offer. Seeded by run seed and floor, so a seed replays the same offers.
import { makeRng, randInt } from '../gen/rng';
import { BOONS, stacksOf, type Boon, type RunView } from './defs';

export function offerBoons(seed: number, run: RunView, count = 3): Boon[] {
  const rng = makeRng(seed + run.floor * 104729);
  const pool = BOONS.filter((b) => stacksOf(run.boons, b.id) < b.max && (b.when?.(run) ?? true));
  const picks: Boon[] = [];
  while (picks.length < count && pool.length > 0) picks.push(pool.splice(randInt(rng, pool.length), 1)[0]);
  return picks;
}
