// Street dice (GDD: Street dice and the Match, zack 2026-11-03; replaced the slot machine). Every run ends with a roll
// of two dice on the curb, and each chip found on the run (a red casino chip, internally a 'spin' pickup) adds a
// roll. Every roll pays something, so a run that ends badly still pays: a few Stoken, or on doubles a head start for
// the next run. Boxcars (6-6) is the MATCH, like pinball's: rare (1 in 36) and big, the next run starts with two more
// hearts. Pure: the game rolls, the save keeps it.
import { GRIPS, RANK_GRIPS, type GripId } from '../board/grips';
import { randInt } from '../gen/rng';

export type Face = 1 | 2 | 3 | 4 | 5 | 6;

export type Prize =
  | { kind: 'stoken'; n: number }
  | { kind: 'cash'; n: number } // cash at the start of the next run
  | { kind: 'boon' } // a free boon at the start of the next run
  | { kind: 'continue'; n: number } // continues on top of the usual, next run
  | { kind: 'grip'; grip: GripId };

export interface Roll {
  dice: [Face, Face];
  prize: Prize;
  match: boolean; // boxcars: the MATCH
}

export const DICE = {
  // a plain roll pays the pips halved, rounded up: 2 to 6 Stoken
  cash: 40, // 2-2 or 3-3: the next run's head start
  match: 2, // boxcars: hearts on top of the usual 3, next run
  maxContinues: 2, // continues held for the next run at most (the match fills it)
  heldOver: 10, // Stoken instead of 5-5's continue, once you hold the most
  matchOver: 25, // Stoken instead of the match's hearts, once you hold the most
  maxRolls: 6, // the most rolls a run gets (the free one and five chips)
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
  return { cash: n(h.cash), boons: n(h.boons), continues: Math.min(DICE.maxContinues, n(h.continues)) };
}

// what two dice pay. held: the head start already won (for the continue cap); grip: the grip on the board now (a grip
// prize is always a new one)
export function payout(a: Face, b: Face, rng: () => number, held: HeadStart, grip: GripId): Prize {
  if (a !== b) return { kind: 'stoken', n: Math.ceil((a + b) / 2) };
  const room = DICE.maxContinues - held.continues;
  switch (a) {
    case 1: {
      //snake eyes: a grip colour
      const pool = [...GRIPS, ...RANK_GRIPS].filter((g) => g.id !== grip);
      return { kind: 'grip', grip: pool[randInt(rng, pool.length)].id };
    }
    case 2:
    case 3:
      return { kind: 'cash', n: DICE.cash };
    case 4:
      return { kind: 'boon' };
    case 5:
      return room > 0 ? { kind: 'continue', n: 1 } : { kind: 'stoken', n: DICE.heldOver };
    case 6:
      //the MATCH: as many hearts as there's room for, or a pile of Stoken when you hold the most
      return room > 0 ? { kind: 'continue', n: Math.min(DICE.match, room) } : { kind: 'stoken', n: DICE.matchOver };
  }
}

export function roll(rng: () => number, held: HeadStart, grip: GripId): Roll {
  const a = (1 + randInt(rng, 6)) as Face;
  const b = (1 + randInt(rng, 6)) as Face;
  return { dice: [a, b], prize: payout(a, b, rng, held, grip), match: a === 6 && b === 6 };
}

// the rolls a run gets: one free, plus one per chip found
export const rollsFor = (chips: number): number => Math.min(DICE.maxRolls, 1 + Math.max(0, chips));

// every roll at once, each seeing the head start the ones before it won
export function rollAll(rng: () => number, rolls: number, held: HeadStart, grip: GripId): { rolls: Roll[]; head: HeadStart; stoken: number; grip: GripId } {
  const head = { ...held };
  const out: Roll[] = [];
  let stoken = 0;
  for (let i = 0; i < rolls; i++) {
    const r = roll(rng, head, grip);
    out.push(r);
    const z = r.prize;
    if (z.kind === 'stoken') stoken += z.n;
    else if (z.kind === 'cash') head.cash += z.n;
    else if (z.kind === 'boon') head.boons++;
    else if (z.kind === 'continue') head.continues += z.n;
    else grip = z.grip;
  }
  return { rolls: out, head, stoken, grip };
}

// the roll's name, called out over the dice (craps slang), or '' for a plain roll
export function rollName(r: Roll): string {
  const [a, b] = r.dice;
  if (a !== b) return '';
  return ['', 'SNAKE EYES!', 'HARD FOUR!', 'HARD SIX!', 'HARD EIGHT!', 'HARD TEN!', 'BOXCARS!'][a];
}

// what a prize says under the dice
export function prizeText(z: Prize, gripName: (id: GripId) => string, match = false): string {
  switch (z.kind) {
    case 'stoken':
      return match ? `MATCH! +◆${z.n}` : `+◆${z.n}`;
    case 'cash':
      return `HEAD START $${z.n}`;
    case 'boon':
      return 'FREE BOON NEXT RUN';
    case 'continue':
      return match ? `MATCH! +${z.n} ♥ NEXT RUN` : `+${z.n} ♥ NEXT RUN`;
    case 'grip':
      return `${gripName(z.grip).toUpperCase()} GRIP`;
  }
}
