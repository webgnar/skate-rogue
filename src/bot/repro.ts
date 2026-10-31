// The test URL for a floor the playtest bot skated: ?seed=&floor= with the boons it held, the road's traffic,
// an escape, a Gnar level or a pinned district. `?bot` makes the autopilot skate it; leave it off to try it yourself.
import { addBoon, BOONS, type BoonId, type Held } from '../boons/defs';

export interface Repro {
  seed: number;
  floor: number;
  boons?: Held[];
  danger?: number; // the road's traffic, 1 to 3 (the first road is 1)
  escape?: number; // the act whose escape this is
  gnar?: number;
  biome?: string;
  bot?: 'ref' | 'mash' | 'high' | 'sewer';
}

export function reproQuery(r: Repro): string {
  const q: string[] = [`seed=${r.seed}`];
  if (r.escape) q.push(`escape=${r.escape}`);
  else q.push(`floor=${r.floor}`);
  if (r.boons?.length) q.push(`boons=${formatBoons(r.boons)}`);
  if (r.danger && r.danger !== 1 && !r.escape) q.push(`danger=${r.danger}`);
  if (r.gnar) q.push(`gnar=${r.gnar}`);
  if (r.biome) q.push(`biome=${r.biome}`);
  //a fresh setup whatever the save holds: everything unlocked, Lou on the stock deck
  q.push('unlockall', 'skater=lou-gnar');
  if (r.bot) q.push(r.bot === 'ref' ? 'bot' : `bot=${r.bot}`);
  return '?' + q.join('&');
}

// bigPop,bigPop,railMagnet: a boon once per stack
export function formatBoons(boons: Held[]): string {
  return boons.flatMap((b) => Array.from({ length: b.stacks }, () => b.id)).join(',');
}

export function parseBoons(text: string | null): Held[] {
  let held: Held[] = [];
  for (const id of (text ?? '').split(',')) {
    if (BOONS.some((b) => b.id === id)) held = addBoon(held, id as BoonId);
  }
  return held;
}
