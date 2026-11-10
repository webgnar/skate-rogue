// The set editor's unsaved sets, kept in this browser so a reload doesn't lose them and the game can play them
// (?setdrafts) before they're saved to the repo. Small on purpose: the game imports it without the editor.
import { isHandSets, type HandSets } from '../gen/hand-sets';

const KEY = 'gnar-run-set-drafts';

export function loadSetDrafts(): HandSets | null {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown;
    return isHandSets(d) ? d : null;
  } catch {
    return null;
  }
}

export function saveSetDrafts(sets: HandSets | null): void {
  try {
    if (sets) localStorage.setItem(KEY, JSON.stringify(sets));
    else localStorage.removeItem(KEY);
  } catch {
    // private mode or storage off: drafts just don't outlive the page
  }
}
