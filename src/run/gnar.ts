// Gnar levels (GDD: How a run ends, like Hades' Heat or Slay the Spire's Ascension): harder runs, unlocked by
// winning. Level N has the first N rules, and each level pays more score and Stoken. Win at a level to unlock the
// next. Logged overnight (2026-10-24).
import type { Mods } from '../boons/mods';
import { ROADS } from '../gen/roads';

export const GNAR_RULES = [
  { name: 'RUSH HOUR TRAFFIC', text: 'Every floor has heavier traffic' },
  { name: 'HOT COPS', text: 'Heat rises 20% faster' },
  { name: 'LONG MEMORY', text: 'Three quarters of your Heat follows you to the next floor, not half' },
  { name: 'SLIM PICKINGS', text: 'One fewer boon card to pick from' },
  { name: 'CHEAP GEAR', text: 'Gear wears out 50% faster' },
];

export const MAX_GNAR = GNAR_RULES.length;

export const GNAR = {
  score: 0.15, // per level
  stoken: 0.2,
  heatRise: 1.2,
  carry: 0.75,
  wear: 1.5,
};

// the levels you can pick: none before your first win, then up to one past the highest you've won
export function gnarOpen(wins: number, beaten: number): number {
  return wins > 0 ? Math.min(MAX_GNAR, beaten + 1) : 0;
}

export function gnarDanger(danger: number, level: number): number {
  return level >= 1 ? Math.min(3, danger + 1) : danger;
}

export function gnarCarry(level: number): number {
  return level >= 3 ? GNAR.carry : ROADS.heatCarry;
}

export function gnarCards(cards: number, level: number): number {
  return level >= 4 ? Math.max(2, cards - 1) : cards;
}

// the run's mods at a level: the rules that work through them, and the payout
export function withGnar(m: Mods, level: number): Mods {
  if (level <= 0) return m;
  return {
    ...m,
    heatRise: m.heatRise * (level >= 2 ? GNAR.heatRise : 1),
    wearScale: m.wearScale * (level >= 5 ? GNAR.wear : 1),
    scoreScale: m.scoreScale * (1 + GNAR.score * level),
    stokenScale: m.stokenScale * (1 + GNAR.stoken * level),
  };
}
