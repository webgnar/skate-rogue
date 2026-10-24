// The editor's unsaved clips, kept in this browser so a reload doesn't lose them and the game can try them out
// (?drafts) before they're saved to the repo. Small on purpose: the game imports it without the editor.
import type { Clip } from '../render/poses';
import { isClip } from './clip-doc';

const KEY = 'gnar-run-clip-drafts';

export function loadDrafts(): Record<string, Clip> {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    return Object.fromEntries(Object.entries(all).filter((e): e is [string, Clip] => isClip(e[1])));
  } catch {
    return {};
  }
}

export function saveDrafts(drafts: Record<string, Clip>): void {
  try {
    if (Object.keys(drafts).length) localStorage.setItem(KEY, JSON.stringify(drafts));
    else localStorage.removeItem(KEY);
  } catch {
    // private mode or storage off: drafts just don't outlive the page
  }
}
