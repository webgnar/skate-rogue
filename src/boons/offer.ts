// Draws the 1-of-3 boon offer. Seeded by run seed and floor, so a seed replays the same offers.
import { makeRng, randInt } from '../gen/rng';
import { BOONS, CURSES_FROM, stacksOf, type Boon, type BoonType, type RunView } from './defs';

export const OFFER = {
  curseChance: 1 / 3, // from floor 6, one offer in three swaps a card for a curse
  duoChance: 0.5, // when you hold a duo's two halves, how often it shows up as an extra card
};

// `type` limits the offer to one boon type (a boon street's sign); `reroll` draws a fresh offer. Curses and duos
// come on top of the normal draw: a curse replaces the last card, a duo is an extra one.
export function offerBoons(seed: number, run: RunView, count = 3, type?: BoonType, reroll = 0): Boon[] {
  const rng = makeRng(seed + run.floor * 104729 + reroll * 7841);
  const open = (b: Boon) => stacksOf(run.boons, b.id) < b.max && (b.when?.(run) ?? true);
  const lib = run.library;
  const pool = BOONS.filter((b) => !b.cursed && !b.duo && open(b) && (!lib || b.gear || lib.types.includes(b.type)));
  //a typed street deals its own type first; when that type has fewer cards left than the offer (the pool was cut
  //to 19 boons on 2026-11-06, then 16, so COOL and LUCK are small), the rest come from any type
  const typed = type ? pool.filter((b) => b.type === type) : [];
  const rest = type ? pool.filter((b) => b.type !== type) : pool;
  const picks: Boon[] = [];
  while (picks.length < count && typed.length > 0) picks.push(typed.splice(randInt(rng, typed.length), 1)[0]);
  while (picks.length < count && rest.length > 0) picks.push(rest.splice(randInt(rng, rest.length), 1)[0]);
  const curses = lib && !lib.curses ? [] : BOONS.filter((b) => b.cursed && open(b));
  if (run.floor >= CURSES_FROM && curses.length && picks.length > 1 && rng() < OFFER.curseChance) {
    picks[picks.length - 1] = curses[randInt(rng, curses.length)];
  }
  const duos = lib && !lib.duos ? [] : BOONS.filter((b) => b.duo && open(b) && b.duo.every((id) => stacksOf(run.boons, id) > 0));
  if (duos.length && rng() < OFFER.duoChance) picks.push(duos[randInt(rng, duos.length)]);
  return picks;
}
