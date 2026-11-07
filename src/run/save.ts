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
  missions: MissionSave; // the three missions showing and Skater Rank (src/run/missions.ts)
  headStart: HeadStart; // what the street dice won for the next run (src/run/dice.ts)
}

// Stoken as a whole number: a Gnar level pays 1.2 a pickup, so the run's count carries fractions (and float sums
// like 10.799999999999997); the HUD, the screens and the bank only ever see the whole Stoken
export const whole = (n: number): number => Math.floor(n + 1e-6);

export const EMPTY_SAVE: Save = { best: 0, stoken: 0, wins: 0, unlocked: [], skater: 'lou-gnar', deck: 'popsicle', daily: { day: '', best: 0 }, gnar: 0, gnarPick: 0, missions: EMPTY_MISSIONS, headStart: NO_HEAD_START };

export function loadSave(): Save {
  try {
    const raw = store.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Partial<Save>) : {};
    return {
      best: Number(s.best) || 0,
      stoken: whole(Number(s.stoken) || 0),
      wins: Number(s.wins) || 0,
      unlocked: Array.isArray(s.unlocked) ? s.unlocked.filter(isUnlockId) : [],
      skater: isSkaterId(s.skater) ? s.skater : 'lou-gnar',
      deck: isDeck(s.deck) ? s.deck : 'popsicle',
      daily: { day: String(s.daily?.day ?? ''), best: Number(s.daily?.best) || 0 },
      gnar: Number(s.gnar) || 0,
      gnarPick: Number(s.gnarPick) || 0,
      missions: cleanMissions(s.missions),
      headStart: cleanHeadStart(s.headStart),
      ...(typeof s.tag === 'string' && s.tag ? { tag: s.tag } : {}),
      ...(s.tutorialDone ? { tutorialDone: true } : {}),
      ...(s.endingSeen ? { endingSeen: true } : {}),
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
