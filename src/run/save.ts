// What a phone keeps between runs: best score, the Stoken bank and what it bought (src/run/meta.ts), and the
// skater and deck you ride. Browser storage can be missing or blocked, so every read and write is guarded.
import type { SkaterId } from '../render/skater-rig';
import { isDeck, isSkaterId, isUnlockId, type DeckId, type UnlockId } from './meta';
import { isDistrict } from './districts';
import type { BiomeId } from '../render/biomes';

const KEY = 'gnar-run-save';

export interface Save {
  best: number;
  stoken: number;
  wins: number; // runs that escaped the city
  unlocked: UnlockId[];
  skater: SkaterId;
  deck: DeckId;
  daily: { day: string; best: number }; // today's daily run best
  tag?: string; // the leaderboard name
  gnar: number; // the highest Gnar level won (src/run/gnar.ts)
  gnarPick: number; // the level the next run is at
  tutorialDone?: boolean; // the tutorial floor was cleared (or skipped by an old save)
  cleared: BiomeId[]; // districts escaped (src/run/districts.ts): each opens the next
  district: BiomeId; // the district the next run is in
}

export const EMPTY_SAVE: Save = { best: 0, stoken: 0, wins: 0, unlocked: [], skater: 'lou-gnar', deck: 'popsicle', daily: { day: '', best: 0 }, gnar: 0, gnarPick: 0, cleared: [], district: 'chicago' };

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Partial<Save>) : {};
    return {
      best: Number(s.best) || 0,
      stoken: Number(s.stoken) || 0,
      wins: Number(s.wins) || 0,
      unlocked: Array.isArray(s.unlocked) ? s.unlocked.filter(isUnlockId) : [],
      skater: isSkaterId(s.skater) ? s.skater : 'lou-gnar',
      deck: isDeck(s.deck) ? s.deck : 'popsicle',
      daily: { day: String(s.daily?.day ?? ''), best: Number(s.daily?.best) || 0 },
      gnar: Number(s.gnar) || 0,
      gnarPick: Number(s.gnarPick) || 0,
      //a save from before districts with a win escaped through Chicago (act 1) at least
      cleared: Array.isArray(s.cleared) ? s.cleared.filter(isDistrict) : Number(s.wins) > 0 ? ['chicago'] : [],
      district: isDistrict(s.district) ? s.district : 'chicago',
      ...(typeof s.tag === 'string' && s.tag ? { tag: s.tag } : {}),
      ...(s.tutorialDone ? { tutorialDone: true } : {}),
    };
  } catch {
    return { ...EMPTY_SAVE };
  }
}

export function writeSave(save: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    //a private window: the run still works, it just isn't remembered
  }
}
