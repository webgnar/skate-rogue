// Street dice (GDD: Street dice and the Match, zack 2026-11-03; replaced the slot machine). Every run ends with a roll
// of two dice on the curb, and each chip found on the run (a red casino chip, internally a 'spin' pickup) adds a
// roll. Every roll pays something, so a run that ends badly still pays, and the combo decides how much: no combo a
// single Stoken, a straight or a seven more, an eleven or doubles a head start for the next run. Boxcars (6-6) is the MATCH, like pinball's: rare (1 in 36) and big, the next run starts with two more
// hearts. Pure: the dice are thrown with real physics (src/render/dice3d.ts), how they land is the roll, the save keeps it.
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
  held?: number; // continues held for the next run once this roll's paid (rollAll fills it)
}

export const DICE = {
  // what each combo pays (zack, 2026-11-08: a plain roll's pay meant nothing; combos have to mean something)
  miss: 1, // NO DICE: no combo, a single Stoken
  straight: 4, // STRAIGHT: two in a row (1-2, 2-3, 4-5), Stoken
  seven: 8, // LUCKY SEVEN: any 7, Stoken
  cash: 40, // YO-LEVEN (5-6), 2-2 and 3-3: the next run's head start
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
// what a roll is, as a street craps player would call it
export type Combo = 'miss' | 'straight' | 'seven' | 'eleven' | 'doubles' | 'match';
export function comboOf(a: Face, b: Face): Combo {
  if (a === b) return a === 6 ? 'match' : 'doubles';
  if (a + b === 7) return 'seven';
  if (a + b === 11) return 'eleven';
  if (Math.abs(a - b) === 1) return 'straight';
  return 'miss';
}

export function payout(a: Face, b: Face, rng: () => number, held: HeadStart, grip: GripId): Prize {
  const combo = comboOf(a, b);
  if (combo === 'miss') return { kind: 'stoken', n: DICE.miss };
  if (combo === 'straight') return { kind: 'stoken', n: DICE.straight };
  if (combo === 'seven') return { kind: 'stoken', n: DICE.seven };
  if (combo === 'eleven') return { kind: 'cash', n: DICE.cash };
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

// what the street dice have won so far: Stoken, the next run's head start, the grip on the board
export interface Winnings {
  head: HeadStart;
  stoken: number;
  grip: GripId;
}

// two dice as they landed (src/render/dice3d.ts throws them with real physics), paid into the winnings
export function settle(dice: [Face, Face], rng: () => number, won: Winnings): Roll {
  const [a, b] = dice;
  const r: Roll = { dice, prize: payout(a, b, rng, won.head, won.grip), match: a === 6 && b === 6 };
  const z = r.prize;
  if (z.kind === 'stoken') won.stoken += z.n;
  else if (z.kind === 'cash') won.head.cash += z.n;
  else if (z.kind === 'boon') won.head.boons++;
  else if (z.kind === 'continue') won.head.continues += z.n;
  else won.grip = z.grip;
  r.held = won.head.continues;
  return r;
}

// every roll at once, each seeing the head start the ones before it won (the bot and the tests; a player's dice land
// one pair at a time, through settle)
export function rollAll(rng: () => number, rolls: number, held: HeadStart, grip: GripId): { rolls: Roll[]; head: HeadStart; stoken: number; grip: GripId } {
  const won: Winnings = { head: { ...held }, stoken: 0, grip };
  const out: Roll[] = [];
  for (let i = 0; i < rolls; i++) {
    const a = (1 + randInt(rng, 6)) as Face;
    const b = (1 + randInt(rng, 6)) as Face;
    out.push(settle([a, b], rng, won));
  }
  return { rolls: out, ...won };
}

// the roll's name, called out over the dice (craps slang), so you know why it paid what it did
export function rollName(r: Roll): string {
  const [a, b] = r.dice;
  switch (comboOf(a, b)) {
    case 'miss':
      return `NO DICE (${a + b})`;
    case 'straight':
      return 'STRAIGHT!';
    case 'seven':
      return 'LUCKY SEVEN!';
    case 'eleven':
      return 'YO-LEVEN!';
    default:
      return ['', 'SNAKE EYES!', 'HARD FOUR!', 'HARD SIX!', 'HARD EIGHT!', 'HARD TEN!', 'BOXCARS!'][a];
  }
}

// what a prize says under the dice, spelled out: an icon, what you got, and what it's for. hearts: how many hearts the
// next run starts with, counting this roll's
export type PrizeIcon = 'stoken' | 'cash' | 'boon' | 'heart' | 'grip';
export interface PrizeLabel {
  icon: PrizeIcon;
  main: string;
  sub: string;
}

export function prizeLabel(z: Prize, gripName: (id: GripId) => string, match: boolean, hearts: number): PrizeLabel {
  switch (z.kind) {
    case 'stoken':
      return match
        ? { icon: 'stoken', main: `MATCH! +${z.n} STOKEN`, sub: 'hearts maxed, so Stoken for unlocks' }
        : { icon: 'stoken', main: `+${z.n} STOKEN`, sub: z.n <= DICE.miss ? 'no combo, just a scrap' : 'banked, for unlocks' };
    case 'cash':
      return { icon: 'cash', main: `$${z.n} HEAD START`, sub: 'cash for the shop, next run' };
    case 'boon':
      return { icon: 'boon', main: 'FREE BOON', sub: 'you start your next run with one' };
    case 'continue':
      return {
        icon: 'heart',
        main: match ? `MATCH! +${z.n} HEARTS` : `+${z.n} HEART${z.n > 1 ? 'S' : ''}`,
        sub: `next run starts with ${hearts} ♥`,
      };
    case 'grip':
      return { icon: 'grip', main: `${gripName(z.grip).toUpperCase()} GRIP`, sub: 'new grip tape, on your board now' };
  }
}
