// The game's side of the leaderboards (api/leaderboard.ts). Every call resolves to null when there's no board to
// talk to (local dev, no store connected, offline), and the game just hides it.
import type { BoardId, Entry, Row } from './board-rules';

const API = '/api/leaderboard';

export async function topRows(board: BoardId, day?: string): Promise<Row[] | null> {
  try {
    const q = new URLSearchParams({ board, ...(day ? { day } : {}) });
    const res = await fetch(`${API}?${q}`);
    if (!res.ok) return null;
    const rows = (await res.json()) as unknown;
    return Array.isArray(rows) ? (rows as Row[]) : null;
  } catch {
    return null;
  }
}

export async function postScore(entry: Entry): Promise<Partial<Record<BoardId, number | null>> | null> {
  try {
    const res = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry) });
    if (!res.ok) return null;
    return ((await res.json()) as { ranks: Partial<Record<BoardId, number | null>> }).ranks;
  } catch {
    return null;
  }
}
