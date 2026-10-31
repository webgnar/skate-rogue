// Missions and Skater Rank (GDD: Missions, from Jetpack Joyride). Three missions are always showing; finishing one
// swaps in the next right away, even mid-run, and they carry over between runs until they're done. Every 3 done
// raise your Skater Rank, which pays Stoken and now and then a grip colour (no stat power: more variety, not more
// power). Any mission can be skipped for a little Stoken. Pure: the game feeds it stats, the save keeps its state.
import type { FloorEvent } from '../sim/floor';
import { boonById, type Held } from '../boons/defs';
import { makeRng, randInt } from '../gen/rng';
import type { GripId } from '../board/grips';

// what the game counts. Most are +1 each time; the 'best' ones carry a value (the biggest combo, the deepest floor)
export type Stat =
  | 'flip' | 'kickflip' | 'heelflip' | 'tre' | 'fakie' | 'nollie' | 'spin'
  | 'grind' | 'rail' | 'ledge' | 'manual' | 'perfect'
  | 'hop' | 'near' | 'doorSlam' | 'wreck' | 'kicker' | 'skitch' | 'slip' | 'firecracker'
  | 'smash' | 'stoken' | 'dodge' | 'drone'
  | 'combo' | 'bank' | 'floor' | 'act' | 'escape'
  | 'cleanFloor' | 'unbusted' | 'topRoute' | 'grindBoons' | 'popBoons' | 'cashOut';

// where a mission's count lives: one combo, one floor, one run, or across runs ('ever'); 'best' is a high-water mark
export type Scope = 'combo' | 'floor' | 'run' | 'ever' | 'best';

export interface MissionDef {
  id: string;
  text: string;
  stat: Stat;
  goal: number;
  scope: Scope;
  tier: number; // the rank it starts turning up at: early ranks get the easy ones
}

// each one teaches something the game already has (GDD: The pool)
export const MISSIONS: MissionDef[] = [
  // rank 0: the basics
  { id: 'flips10', text: 'Land 10 flip tricks', stat: 'flip', goal: 10, scope: 'ever', tier: 0 },
  { id: 'grinds10', text: 'Grind 10 rails or ledges', stat: 'grind', goal: 10, scope: 'ever', tier: 0 },
  { id: 'hops5', text: 'Car-hop 5 cars', stat: 'hop', goal: 5, scope: 'ever', tier: 0 },
  { id: 'smash10', text: 'Smash 10 props', stat: 'smash', goal: 10, scope: 'ever', tier: 0 },
  { id: 'stoken5', text: 'Grab 5 Stoken', stat: 'stoken', goal: 5, scope: 'ever', tier: 0 },
  { id: 'floor3', text: 'Reach floor 3', stat: 'floor', goal: 3, scope: 'best', tier: 0 },
  { id: 'combo4', text: 'Land a x4 combo', stat: 'combo', goal: 4, scope: 'best', tier: 0 },
  { id: 'manual3', text: 'Manual 3 pads', stat: 'manual', goal: 3, scope: 'ever', tier: 0 },
  // rank 1
  { id: 'rails3combo', text: 'Grind 3 rails in one combo', stat: 'rail', goal: 3, scope: 'combo', tier: 1 },
  { id: 'near3', text: 'Pull 3 close calls', stat: 'near', goal: 3, scope: 'ever', tier: 1 },
  { id: 'perfect3', text: 'Land 3 PERFECTs', stat: 'perfect', goal: 3, scope: 'ever', tier: 1 },
  { id: 'kickflip5', text: 'Land 5 kickflips', stat: 'kickflip', goal: 5, scope: 'run', tier: 1 },
  { id: 'heelflip5', text: 'Land 5 heelflips', stat: 'heelflip', goal: 5, scope: 'run', tier: 1 },
  { id: 'door1', text: 'Slam a car door shut', stat: 'doorSlam', goal: 1, scope: 'ever', tier: 1 },
  { id: 'smash10floor', text: 'Smash 10 props in one floor', stat: 'smash', goal: 10, scope: 'floor', tier: 1 },
  { id: 'clean1', text: 'Clear a floor without slamming', stat: 'cleanFloor', goal: 1, scope: 'ever', tier: 1 },
  { id: 'combo8', text: 'Land a x8 combo', stat: 'combo', goal: 8, scope: 'best', tier: 1 },
  // rank 2
  { id: 'fakie5', text: 'Land 5 fakie flips', stat: 'fakie', goal: 5, scope: 'ever', tier: 2 },
  { id: 'spin3', text: 'Land 3 180 flips', stat: 'spin', goal: 3, scope: 'run', tier: 2 },
  { id: 'hops4combo', text: 'Car-hop 4 cars in one combo', stat: 'hop', goal: 4, scope: 'combo', tier: 2 },
  { id: 'kicker1', text: 'Bomb off a tailgate', stat: 'kicker', goal: 1, scope: 'ever', tier: 2 },
  { id: 'floor6', text: 'Reach floor 6', stat: 'floor', goal: 6, scope: 'best', tier: 2 },
  { id: 'top1', text: 'Finish a floor on the top route', stat: 'topRoute', goal: 1, scope: 'ever', tier: 2 },
  { id: 'bank5k', text: 'Bank 5,000 in one combo', stat: 'bank', goal: 5000, scope: 'best', tier: 2 },
  { id: 'cashout3', text: 'Cash out 3 combos', stat: 'cashOut', goal: 3, scope: 'run', tier: 2 },
  // rank 3
  { id: 'nollie1', text: 'Land a nollie flip', stat: 'nollie', goal: 1, scope: 'ever', tier: 3 },
  { id: 'dodge5', text: 'Dodge 5 guard bullets', stat: 'dodge', goal: 5, scope: 'ever', tier: 3 },
  { id: 'wreck1', text: 'Wreck a car', stat: 'wreck', goal: 1, scope: 'ever', tier: 3 },
  { id: 'skitch1', text: 'Skitch a cab', stat: 'skitch', goal: 1, scope: 'ever', tier: 3 },
  { id: 'unbusted', text: 'Clear a floor without busting a part', stat: 'unbusted', goal: 1, scope: 'ever', tier: 3 },
  { id: 'grindBoons3', text: 'Hold 3 GRIND boons', stat: 'grindBoons', goal: 3, scope: 'best', tier: 3 },
  { id: 'combo15', text: 'Land a x15 combo', stat: 'combo', goal: 15, scope: 'best', tier: 3 },
  { id: 'act1', text: 'Escape act 1', stat: 'act', goal: 1, scope: 'best', tier: 3 },
  // rank 4 and up
  { id: 'tre3', text: 'Land 3 tre flips in one run', stat: 'tre', goal: 3, scope: 'run', tier: 4 },
  { id: 'drone3', text: 'Stomp 3 drones', stat: 'drone', goal: 3, scope: 'ever', tier: 4 },
  { id: 'clean3run', text: 'Clear 3 floors in a run without slamming', stat: 'cleanFloor', goal: 3, scope: 'run', tier: 4 },
  { id: 'popBoons4', text: 'Hold 4 POP boons', stat: 'popBoons', goal: 4, scope: 'best', tier: 4 },
  { id: 'slip2', text: 'Ride 2 slipstreams', stat: 'slip', goal: 2, scope: 'ever', tier: 4 },
  { id: 'firecracker1', text: 'Firecracker down a stair set', stat: 'firecracker', goal: 1, scope: 'ever', tier: 4 },
  { id: 'smash25run', text: 'Smash 25 props in one run', stat: 'smash', goal: 25, scope: 'run', tier: 4 },
  { id: 'bank20k', text: 'Bank 20,000 in one combo', stat: 'bank', goal: 20000, scope: 'best', tier: 5 },
  { id: 'act2', text: 'Escape act 2', stat: 'act', goal: 2, scope: 'best', tier: 5 },
  { id: 'combo25', text: 'Land a x25 combo', stat: 'combo', goal: 25, scope: 'best', tier: 6 },
  { id: 'escape', text: 'Escape the city', stat: 'escape', goal: 1, scope: 'ever', tier: 6 },
];

export const RANK = {
  per: 3, // missions done per rank
  pay: (rank: number) => Math.min(50, 10 + 5 * rank), // Stoken for reaching a rank
  skip: 3, // Stoken to skip a mission
  showing: 3,
};

// grip colours only a rank gives (src/board/grips.ts RANK_GRIPS): rank 2 the first, then every 2 ranks
export const RANK_GRIP_ORDER: GripId[] = ['gold', 'camo', 'navy', 'teal', 'chrome'];
export function rankGrip(rank: number): GripId | null {
  if (rank < 2 || rank % 2) return null;
  return RANK_GRIP_ORDER[rank / 2 - 1] ?? null;
}

// what the save keeps
export interface MissionSave {
  active: string[]; // the three showing
  progress: number[]; // their 'ever' and 'best' counts (the rest start over each combo, floor or run)
  done: number; // missions finished, all time
  seen: string[]; // finished or skipped, so they don't come round again until the pool runs dry
}

export const EMPTY_MISSIONS: MissionSave = { active: [], progress: [], done: 0, seen: [] };

export const missionDef = (id: string): MissionDef | undefined => MISSIONS.find((m) => m.id === id);
export const rankOf = (done: number): number => Math.floor(done / RANK.per);

export function cleanMissions(raw: unknown): MissionSave {
  const s = (raw ?? {}) as Partial<MissionSave>;
  const active = Array.isArray(s.active) ? s.active.filter((id) => typeof id === 'string' && missionDef(id)) : [];
  const progress = Array.isArray(s.progress) ? s.progress.map((n) => Number(n) || 0) : [];
  return {
    active,
    progress: active.map((_, i) => progress[i] ?? 0),
    done: Math.max(0, Math.floor(Number(s.done) || 0)),
    seen: Array.isArray(s.seen) ? s.seen.filter((id) => typeof id === 'string') : [],
  };
}

// what the screens draw
export interface MissionRow {
  text: string;
  count: number;
  goal: number;
  scope: Scope;
}
export interface MissionsView {
  rank: number;
  toNext: number; // missions done towards the next rank, 0..RANK.per-1
  rows: MissionRow[];
  skip: number; // the skip price
  bank: number; // Stoken banked, to see if a skip is affordable
}

// a mission finished, and what it paid if it finished a rank
export interface MissionDone {
  text: string;
  rank?: number; // the new rank, when this one raised it
  pay?: number; // Stoken for the rank
  grip?: GripId; // a rank grip
}

export class Missions {
  state: MissionSave;
  private live: number[]; // counts for this combo, floor or run (combo/floor/run missions)
  private rng: () => number;

  constructor(save: MissionSave, seed = Date.now()) {
    this.state = { ...save, active: [...save.active], progress: [...save.progress], seen: [...save.seen] };
    this.rng = makeRng((seed >>> 0) % 2147483647 || 1);
    this.live = this.state.active.map(() => 0);
    while (this.state.active.length < RANK.showing) this.add(this.state.active.length);
  }

  get rank(): number {
    return rankOf(this.state.done);
  }

  // the next mission for a slot: one the rank has opened, not showing, not done before (until they all have been)
  private draw(): string {
    const showing = new Set(this.state.active);
    const open = MISSIONS.filter((m) => m.tier <= this.rank && !showing.has(m.id));
    let fresh = open.filter((m) => !this.state.seen.includes(m.id));
    if (!fresh.length) {
      //the pool ran dry: everything comes round again
      this.state.seen = this.state.seen.filter((id) => showing.has(id));
      fresh = open;
    }
    //the newest tier first, half the time, so a rank-up brings its new missions in
    const top = Math.max(...fresh.map((m) => m.tier));
    const pick = this.rng() < 0.5 ? fresh.filter((m) => m.tier === top) : fresh;
    return pick[randInt(this.rng, pick.length)].id;
  }

  private add(i: number): void {
    this.state.active[i] = this.draw();
    this.state.progress[i] = 0;
    this.live[i] = 0;
  }

  private def(i: number): MissionDef {
    return missionDef(this.state.active[i])!;
  }

  // the count a mission shows: saved for 'ever' and 'best', this combo's, floor's or run's for the rest
  count(i: number): number {
    const d = this.def(i);
    return d.scope === 'ever' || d.scope === 'best' ? this.state.progress[i] : this.live[i];
  }

  // count a stat; returns the missions it finished (each swapped for a new one at once)
  add1(stat: Stat, n = 1): MissionDone[] {
    const done: MissionDone[] = [];
    for (let i = 0; i < this.state.active.length; i++) {
      const d = this.def(i);
      if (d.stat !== stat) continue;
      if (d.scope === 'best') this.state.progress[i] = Math.max(this.state.progress[i], n);
      else if (d.scope === 'ever') this.state.progress[i] += n;
      else this.live[i] += n;
      if (this.count(i) >= d.goal) done.push(this.finish(i));
    }
    return done;
  }

  private finish(i: number): MissionDone {
    const d = this.def(i);
    const before = this.rank;
    this.state.done++;
    this.state.seen.push(d.id);
    const out: MissionDone = { text: d.text };
    if (this.rank > before) {
      out.rank = this.rank;
      out.pay = RANK.pay(this.rank);
      const grip = rankGrip(this.rank);
      if (grip) out.grip = grip;
    }
    this.add(i);
    return out;
  }

  // skip one for Stoken: the bank after, or null if it can't be paid
  skip(i: number, bank: number): number | null {
    if (i < 0 || i >= this.state.active.length || bank < RANK.skip) return null;
    this.state.seen.push(this.state.active[i]);
    this.add(i);
    return bank - RANK.skip;
  }

  // a combo, floor or run over: its counts start again
  reset(scope: 'combo' | 'floor' | 'run'): void {
    for (let i = 0; i < this.state.active.length; i++) {
      const s = this.def(i).scope;
      if (s === scope || (scope === 'run' && (s === 'floor' || s === 'combo')) || (scope === 'floor' && s === 'combo')) this.live[i] = 0;
    }
  }

  // a floor's counts again from where they were at its start (a continue puts the floor back)
  snapshot(): number[] {
    return [...this.live];
  }

  view(bank: number): MissionsView {
    return {
      rank: this.rank,
      toNext: this.state.done % RANK.per,
      rows: this.state.active.map((_, i) => ({ text: this.def(i).text, count: Math.min(this.count(i), this.def(i).goal), goal: this.def(i).goal, scope: this.def(i).scope })),
      skip: RANK.skip,
      bank,
    };
  }
}

// what a floor event counts for (the game adds the ones only it knows: floors, acts, banks, boons)
export function statsOf(e: FloorEvent): Stat[] {
  switch (e.type) {
    case 'trick': {
      const s: Stat[] = ['flip'];
      if (e.name === 'kickflip') s.push('kickflip');
      if (e.name === 'heelflip') s.push('heelflip');
      if (e.name === 'tre') s.push('tre');
      if (e.fakie) s.push('fakie');
      if (e.nollie) s.push('nollie');
      if (e.spin === 180 && /Flip|Heel/.test(e.name)) s.push('spin');
      return s;
    }
    case 'grind':
      return e.perfect ? ['grind', 'ledge', 'perfect'] : ['grind', 'ledge'];
    case 'rail':
      return e.perfect ? ['grind', 'rail', 'perfect'] : ['grind', 'rail'];
    case 'land':
      if (e.manual) return ['manual'];
      return e.perfect ? ['perfect'] : [];
    case 'hop':
      return ['hop'];
    case 'near':
      return ['near'];
    case 'doorSlam':
      return ['doorSlam'];
    case 'dent':
      return e.stage === 3 ? ['wreck'] : [];
    case 'kicker':
      return ['kicker'];
    case 'skitch':
      return e.on ? ['skitch'] : [];
    case 'slip':
      return ['slip'];
    case 'firecracker':
      return ['firecracker'];
    case 'smash':
      return e.how === 'car' ? [] : ['smash'];
    case 'pickup':
      return e.kind === 'stoken' ? ['stoken'] : [];
    case 'dodge':
      return ['dodge'];
    case 'drone':
      return ['drone'];
    default:
      return [];
  }
}

// how many of the boons held are of a type
export function boonsOfType(held: readonly Held[], type: string): number {
  return held.filter((h) => boonById(h.id)?.type === type).length;
}
