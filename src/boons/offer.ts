// Draws the 1-of-3 boon offer. Seeded by run seed and floor, so a seed replays the same offers.
import { makeRng, randInt } from '../gen/rng';
import { BOONS, stacksOf, type Boon, type BoonType, type RunView } from './defs';

// `type` limits the offer to one boon type (a boon street's sign); `reroll` draws a fresh offer
export function offerBoons(seed: number, run: RunView, count = 3, type?: BoonType, reroll = 0): Boon[] {
  const rng = makeRng(seed + run.floor * 104729 + reroll * 7841);
  let pool = BOONS.filter((b) => stacksOf(run.boons, b.id) < b.max && (b.when?.(run) ?? true));
  //a typed street with that type maxed out falls back to any type
  if (type && pool.some((b) => b.type === type)) pool = pool.filter((b) => b.type === type);
  const picks: Boon[] = [];
  while (picks.length < count && pool.length > 0) picks.push(pool.splice(randInt(rng, pool.length), 1)[0]);
  return picks;
}
