// The level editor's unsaved edits, kept in this browser so a reload doesn't lose them and the game can try them
// (?leveldrafts) before they're saved to the repo. Small on purpose: the game imports it without the editor.
import type { Beat } from '../gen/hills';
import type { FloorEdit, LevelEdits } from '../gen/level-edits';
import type { SkyBeat } from '../gen/sky-beats';

const KEY = 'gnar-run-level-drafts';

export const BEATS: Beat[] = ['hill', 'railHill', 'stairs', 'drop', 'gap', 'kicker', 'chase'];

export const SKY_BEAT_LIST: SkyBeat[] = ['roofs', 'billboard', 'tower', 'crane', 'scaffold', 'gap'];

const isPair = (v: unknown) => Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && isFinite(n));
const isNum = (v: unknown) => typeof v === 'number' && isFinite(v);

export function isFloorEdit(e: unknown): e is FloorEdit {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
  const f = e as Record<string, unknown>;
  if (f.recipe !== undefined) {
    const ok = Array.isArray(f.recipe) && f.recipe.length > 0 &&
      f.recipe.every((slot) => Array.isArray(slot) && slot.length > 0 && slot.every((b) => BEATS.includes(b as Beat)));
    if (!ok) return false;
  }
  //the sky recipe may be empty (no sky beats on the floor)
  if (f.sky !== undefined) {
    const ok = Array.isArray(f.sky) && f.sky.every((slot) => Array.isArray(slot) && slot.length > 0 && slot.every((b) => SKY_BEAT_LIST.includes(b as SkyBeat)));
    if (!ok) return false;
  }
  for (const k of ['top', 'grade', 'finalSet', 'street', 'climbTop', 'chasePieces', 'topStart', 'flocks', 'skyHeight', 'skyStart']) if (f[k] !== undefined && !isNum(f[k])) return false;
  for (const k of ['run', 'crest', 'gap', 'midSet', 'roofGap']) if (f[k] !== undefined && !isPair(f[k])) return false;
  return true;
}

export function isLevelEdits(e: unknown): e is LevelEdits {
  if (!e || typeof e !== 'object') return false;
  const floors = (e as { floors?: unknown }).floors;
  return !!floors && typeof floors === 'object' && !Array.isArray(floors) && Object.values(floors).every(isFloorEdit);
}

export function loadLevelDrafts(): LevelEdits | null {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown;
    return isLevelEdits(d) ? d : null;
  } catch {
    return null;
  }
}

export function saveLevelDrafts(edits: LevelEdits | null): void {
  try {
    if (edits) localStorage.setItem(KEY, JSON.stringify(edits));
    else localStorage.removeItem(KEY);
  } catch {
    // private mode or storage off: drafts just don't outlive the page
  }
}

// the file as it's saved: floors in order, empty floors dropped
export function formatLevelEdits(edits: LevelEdits): string {
  const floors: Record<string, FloorEdit> = {};
  for (const k of Object.keys(edits.floors).sort((a, b) => Number(a) - Number(b))) {
    if (Object.keys(edits.floors[k]).length) floors[k] = edits.floors[k];
  }
  return `${JSON.stringify({ floors }, null, 2)}\n`;
}
