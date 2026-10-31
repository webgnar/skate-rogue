// Wipe the phone's progress to play as a fresh player (zack, 2026-10-31): the save (best, Stoken, unlocks, skater
// and deck, grip tape, Skater Rank and missions, the slot machine's head start, the Gnar level, the tutorial, the
// leaderboard name). ?reset does it on load; ?reset=all also drops the settings, the effect settings and the dev
// switches. The animation and level editors' drafts are never touched. The pause card's DEV TOOLS has a button.
const PROGRESS = ['gnar-run-save'];
const EVERYTHING = [...PROGRESS, 'gnar-run-settings', 'gnar-run-fx', 'gnar-run-dev'];

export function wipe(all: boolean): void {
  for (const key of all ? EVERYTHING : PROGRESS) {
    try {
      localStorage.removeItem(key);
    } catch {
      //storage blocked: there is nothing saved to wipe
    }
  }
}

// ?reset in the link: wipe, then reload the same link without it so every module starts from the empty storage
// (a reload, not a replaceState: the settings are read when their modules load). Returns true while it reloads.
export function resetFromLink(): boolean {
  const q = new URLSearchParams(location.search);
  if (!q.has('reset')) return false;
  wipe(q.get('reset') === 'all');
  q.delete('reset');
  const search = q.toString().replace(/=(&|$)/g, '$1');
  location.replace(location.pathname + (search ? `?${search}` : '') + location.hash);
  return true;
}

// the button: back to the plain game link (no unlock-all, floor jump or daily left over), wiped on the way
export function resetAndReload(): void {
  location.replace(`${location.pathname}?reset`);
}
