// What a phone keeps between runs: best score, the Stoken bank and what it bought (src/run/meta.ts), and the
// skater and deck you ride. Browser storage can be missing or blocked, so every read and write is guarded.
import type { SkaterId } from '../render/skater-rig';
import { isGrip, type GripId } from '../board/grips';
import { isDeck, isSkaterId, isUnlockId, type DeckId, type UnlockId } from './meta';
import { cleanMissions, EMPTY_MISSIONS, type MissionSave } from './missions';
import { cleanHeadStart, NO_HEAD_START, type HeadStart } from './dice';
import { store } from '../net/portal';

const KEY = 'gnar-run-save';

export interface Save {
  best: number;
  stoken: number;
  wins: number; // runs that escaped the city
  unlocked: UnlockId[];
  skater: SkaterId;
  deck: DeckId;
  tape?: GripId; // the grip tape colour last bought in the shop (src/board/grips.ts); none: the starting black
  daily: { day: string; best: number }; // today's daily run best
  tag?: string; // the leaderboard name
  gnar: number; // the highest Gnar level won (src/run/gnar.ts)
  gnarPick: number; // the level the next run is at
  tutorialDone?: boolean; // the tutorial floor was cleared (or skipped by an old save)
  endingSeen?: boolean; // the Chapter 1 ending played in full once (src/ship/ending-scene.ts); later wins get the short one
  actBreaks?: number[]; // the act breaks seen (src/cutscene/act-breaks.ts): each plays once, the first time its act is cleared
  missions: MissionSave; // the three missions showing and Skater Rank (src/run/missions.ts)
  headStart: HeadStart; // what the street dice won for the next run (src/run/dice.ts)
  crew?: number; // the skater order the save was made under: 2 = Webster free, Lou Gnar last (2026-11-08)
}

const CREW = 2;

// Lou Gnar was the free starter before 2026-11-08 and Webster cost 30. A save made then keeps Lou (owned now, he's
// 60) and gets the 30 back if it had bought Webster, who's free now. Runs once: the save is marked with CREW.
export function moveCrew(s: Partial<Save>, unlocked: UnlockId[], stoken: number): { unlocked: UnlockId[]; stoken: number } {
  if ((Number(s.crew) || 0) >= CREW) return { unlocked, stoken };
  const kept = unlocked.filter((id) => id !== 'webster');
  return { unlocked: kept.includes('lou-gnar') ? kept : [...kept, 'lou-gnar'], stoken: stoken + (unlocked.includes('webster') ? 30 : 0) };
}

// Stoken as a whole number: a Gnar level pays 1.2 a pickup, so the run's count carries fractions (and float sums
// like 10.799999999999997); the HUD, the screens and the bank only ever see the whole Stoken
export const whole = (n: number): number => Math.floor(n + 1e-6);

export const EMPTY_SAVE: Save = { best: 0, stoken: 0, wins: 0, unlocked: [], skater: 'webster', deck: 'popsicle', daily: { day: '', best: 0 }, gnar: 0, gnarPick: 0, missions: EMPTY_MISSIONS, headStart: NO_HEAD_START, crew: CREW };

export function loadSave(): Save {
  try {
    const raw = store.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Partial<Save>) : { crew: CREW };
    const owned = Array.isArray(s.unlocked) ? s.unlocked.filter(isUnlockId) : [];
    const { unlocked, stoken } = moveCrew(s, owned, whole(Number(s.stoken) || 0));
    return {
      best: Number(s.best) || 0,
      stoken,
      wins: Number(s.wins) || 0,
      unlocked,
      skater: isSkaterId(s.skater) ? s.skater : 'webster',
      deck: isDeck(s.deck) ? s.deck : 'popsicle',
      daily: { day: String(s.daily?.day ?? ''), best: Number(s.daily?.best) || 0 },
      gnar: Number(s.gnar) || 0,
      gnarPick: Number(s.gnarPick) || 0,
      missions: cleanMissions(s.missions),
      headStart: cleanHeadStart(s.headStart),
      crew: CREW,
      ...(typeof s.tag === 'string' && s.tag ? { tag: s.tag } : {}),
      ...(s.tutorialDone ? { tutorialDone: true } : {}),
      ...(s.endingSeen ? { endingSeen: true } : {}),
      ...(Array.isArray(s.actBreaks) ? { actBreaks: s.actBreaks.filter((n) => [1, 2, 3, 4].includes(n)) } : {}),
      ...(isGrip(s.tape) ? { tape: s.tape } : {}),
    };
  } catch {
    return { ...EMPTY_SAVE, missions: cleanMissions(null) };
  }
}

export function writeSave(save: Save): void {
  try {
    store.setItem(KEY, JSON.stringify(save));
  } catch {
    //a private window: the run still works, it just isn't remembered
  }
}
