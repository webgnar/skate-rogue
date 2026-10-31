// The end-of-run slot machine (GDD: Spin tokens and the end-of-run payout). Each spin token found pulls a three-reel
// machine once when the run ends. Most pulls pay a little Stoken; three of a kind pays big: a pile of Stoken, a head
// start for the next run (cash, or a free boon), a free continue held for the next run, or now and then a grip
// colour. Every pull pays something, so a run that ends badly still pays. Pure: the game rolls, the save keeps it.
import { GRIPS, RANK_GRIPS, type GripId } from '../board/grips';
import { randInt } from '../gen/rng';

export type Reel = 'stoken' | 'cash' | 'boon' | 'heart' | 'star';
export const REELS: Reel[] = ['stoken', 'cash', 'boon', 'heart', 'star'];

export type Prize =
  | { kind: 'stoken'; n: number }
  | { kind: 'cash'; n: number } // cash at the start of the next run
  | { kind: 'boon' } // a free boon at the start of the next run
  | { kind: 'continue' } // a continue on top of the usual, next run
  | { kind: 'grip'; grip: GripId };

export interface Pull {
  reels: [Reel, Reel, Reel];
  prize: Prize;
}

export const SLOTS = {
  small: [2, 5], // Stoken a plain pull pays
  jackpot: 25, // three Stoken
  cash: 40, // three cash: the next run's head start
  maxContinues: 2, // continues held for the next run at most; past this three hearts pay Stoken
  heartsOver: 10, // Stoken instead of a continue, once you hold the most
  // the odds of each three of a kind (the rest is a small Stoken pull)
  odds: { stoken: 0.08, cash: 0.14, boon: 0.1, heart: 0.09, star: 0.04 } as Record<Reel, number>,
};

// what the next run starts with (the save's headStart)
export interface HeadStart {
  cash: number;
  boons: number;
  continues: number;
}
export const NO_HEAD_START: HeadStart = { cash: 0, boons: 0, continues: 0 };

export function cleanHeadStart(raw: unknown): HeadStart {
  const h = (raw ?? {}) as Partial<HeadStart>;
  const n = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
  return { cash: n(h.cash), boons: n(h.boons), continues: Math.min(SLOTS.maxContinues, n(h.continues)) };
}

// one pull: what the reels stop on and what it pays. held: the head start already won (for the continue cap);
// grip: the grip on the board now (a grip prize is always a new one)
export function pull(rng: () => number, held: HeadStart, grip: GripId): Pull {
  let r = rng();
  for (const sym of REELS) {
    r -= SLOTS.odds[sym];
    if (r >= 0) continue;
    const reels: [Reel, Reel, Reel] = [sym, sym, sym];
    switch (sym) {
      case 'stoken':
        return { reels, prize: { kind: 'stoken', n: SLOTS.jackpot } };
      case 'cash':
        return { reels, prize: { kind: 'cash', n: SLOTS.cash } };
      case 'boon':
        return { reels, prize: { kind: 'boon' } };
      case 'heart':
        return held.continues >= SLOTS.maxContinues ? { reels, prize: { kind: 'stoken', n: SLOTS.heartsOver } } : { reels, prize: { kind: 'continue' } };
      case 'star': {
        const pool = [...GRIPS, ...RANK_GRIPS].filter((g) => g.id !== grip);
        return { reels, prize: { kind: 'grip', grip: pool[randInt(rng, pool.length)].id } };
      }
    }
  }
  //a plain pull: never three of a kind; two Stoken symbols pay the top of the small range
  let reels: [Reel, Reel, Reel];
  do reels = [0, 1, 2].map(() => REELS[randInt(rng, REELS.length)]) as [Reel, Reel, Reel];
  while (reels[0] === reels[1] && reels[1] === reels[2]);
  const gems = reels.filter((s) => s === 'stoken').length;
  const [lo, hi] = SLOTS.small;
  const n = gems === 2 ? hi : lo + randInt(rng, hi - lo);
  return { reels, prize: { kind: 'stoken', n } };
}

// every pull at once, each seeing the head start the ones before it won
export function pullAll(rng: () => number, tokens: number, held: HeadStart, grip: GripId): { pulls: Pull[]; head: HeadStart; stoken: number; grip: GripId } {
  const head = { ...held };
  const pulls: Pull[] = [];
  let stoken = 0;
  for (let i = 0; i < tokens; i++) {
    const p = pull(rng, head, grip);
    pulls.push(p);
    const z = p.prize;
    if (z.kind === 'stoken') stoken += z.n;
    else if (z.kind === 'cash') head.cash += z.n;
    else if (z.kind === 'boon') head.boons++;
    else if (z.kind === 'continue') head.continues++;
    else grip = z.grip;
  }
  return { pulls, head, stoken, grip };
}

// what a prize says on the machine
export function prizeText(z: Prize, gripName: (id: GripId) => string): string {
  switch (z.kind) {
    case 'stoken':
      return `+◆${z.n}`;
    case 'cash':
      return `HEAD START $${z.n}`;
    case 'boon':
      return 'FREE BOON NEXT RUN';
    case 'continue':
      return 'SAVED CONTINUE';
    case 'grip':
      return `${gripName(z.grip).toUpperCase()} GRIP`;
  }
}
