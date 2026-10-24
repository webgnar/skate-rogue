// What a phone keeps between runs: best score and the Stoken bank (spent on the unlock tree later).
// Browser storage can be missing or blocked, so every read and write is guarded.
const KEY = 'gnar-run-save';

export interface Save {
  best: number;
  stoken: number;
  wins: number; // runs that escaped the city
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Partial<Save>) : {};
    return { best: Number(s.best) || 0, stoken: Number(s.stoken) || 0, wins: Number(s.wins) || 0 };
  } catch {
    return { best: 0, stoken: 0, wins: 0 };
  }
}

export function writeSave(save: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    //a private window: the run still works, it just isn't remembered
  }
}
