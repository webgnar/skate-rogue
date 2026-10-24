// Leaderboard rules shared by the game and the API (api/leaderboard.ts): which boards there are, how a score
// sorts on each, and what a fair entry looks like. No anti-cheat beyond sanity checks: it's a phone game's board.
export type BoardId = 'score' | 'floor' | 'daily';

export interface Entry {
  tag: string;
  score: number;
  floor: number;
  day?: string; // a daily run's UTC date, YYYY-MM-DD
}

export interface Row {
  rank: number;
  tag: string;
  score: number;
  floor: number;
}

export const BOARD = {
  keep: 100, // entries kept per board
  show: 10,
  maxScore: 50_000_000,
  maxFloor: 15, // 5 acts of 3
  dailyDays: 3, // a daily board expires after this many days
};

// a tag: 3 to 10 letters, digits or spaces, upper case, like an arcade
export function cleanTag(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 10);
  return t.length >= 3 ? t : null;
}

export function validEntry(raw: unknown, today: string): Entry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const tag = cleanTag(r.tag);
  const score = r.score;
  const floor = r.floor;
  if (!tag || !Number.isInteger(score) || !Number.isInteger(floor)) return null;
  if ((score as number) < 0 || (score as number) > BOARD.maxScore || (floor as number) < 1 || (floor as number) > BOARD.maxFloor) return null;
  const entry: Entry = { tag, score: score as number, floor: floor as number };
  if (r.day !== undefined) {
    //a daily run counts on today's board, or yesterday's for a run that started before midnight
    if (r.day !== today && r.day !== dayBefore(today)) return null;
    entry.day = r.day;
  }
  return entry;
}

export function dayBefore(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function boardKey(board: BoardId, day?: string): string {
  return board === 'daily' ? `gnar:daily:${day}` : `gnar:${board}`;
}

// the sort value on a board: deepest floor sorts by floor, then score
export function sortValue(board: BoardId, e: Entry): number {
  return board === 'floor' ? e.floor * 1e8 + e.score : e.score;
}

// the boards an entry goes on
export function boardsFor(e: Entry): { board: BoardId; key: string }[] {
  const out: { board: BoardId; key: string }[] = [
    { board: 'score', key: boardKey('score') },
    { board: 'floor', key: boardKey('floor') },
  ];
  if (e.day) out.push({ board: 'daily', key: boardKey('daily', e.day) });
  return out;
}
