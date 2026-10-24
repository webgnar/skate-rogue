// Gnar Run's leaderboards (GDD: Scoring and stoke), a Vercel function over a Redis store's REST API (Upstash, or
// Vercel's KV, which is Upstash). Ported from excaliburSkate's api/leaderboard.ts, without @vercel/kv.
// GET  /api/leaderboard?board=score|floor|daily[&day=YYYY-MM-DD]  -> the top 10 rows
// POST /api/leaderboard {tag, score, floor, day?}                  -> {ranks: {score, floor, daily?}}
// With no store connected it answers 503, and the game hides its board.
import { BOARD, boardKey, boardsFor, sortValue, validEntry, type BoardId, type Row } from '../src/net/board-rules';

declare const process: { env: Record<string, string | undefined> };

const URL_ = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function redis(commands: (string | number)[][]): Promise<unknown[]> {
  const res = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`store ${res.status}`);
  const out = (await res.json()) as { result?: unknown; error?: string }[];
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

const today = () => new Date().toISOString().slice(0, 10);
const isBoard = (b: string | null): b is BoardId => b === 'score' || b === 'floor' || b === 'daily';

export async function GET(req: Request): Promise<Response> {
  if (!URL_ || !TOKEN) return json({ error: 'no store' }, 503);
  const q = new URL(req.url).searchParams;
  const board = q.get('board');
  if (!isBoard(board)) return json({ error: 'bad board' }, 400);
  const day = q.get('day') ?? today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return json({ error: 'bad day' }, 400);
  try {
    const [raw] = await redis([['ZREVRANGE', boardKey(board, day), 0, BOARD.show - 1]]);
    const rows: Row[] = (raw as string[]).map((m, i) => {
      const e = JSON.parse(m) as { tag: string; score: number; floor: number };
      return { rank: i + 1, tag: e.tag, score: e.score, floor: e.floor };
    });
    return json(rows);
  } catch (err) {
    console.error('leaderboard read', err);
    return json({ error: 'store failed' }, 502);
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!URL_ || !TOKEN) return json({ error: 'no store' }, 503);
  const entry = validEntry(await req.json().catch(() => null), today());
  if (!entry) return json({ error: 'bad entry' }, 400);
  //the member carries a timestamp so two equal entries both stay
  const member = JSON.stringify({ ...entry, t: Date.now() });
  const boards = boardsFor(entry);
  const cmds: (string | number)[][] = [];
  for (const b of boards) {
    cmds.push(['ZADD', b.key, sortValue(b.board, entry), member]);
    cmds.push(['ZREMRANGEBYRANK', b.key, 0, -BOARD.keep - 1]);
    cmds.push(['ZREVRANK', b.key, member]);
    if (b.board === 'daily') cmds.push(['EXPIRE', b.key, BOARD.dailyDays * 86400]);
  }
  try {
    const out = await redis(cmds);
    const ranks: Record<string, number | null> = {};
    let i = 0;
    for (const b of boards) {
      const rank = out[i + 2];
      ranks[b.board] = typeof rank === 'number' ? rank + 1 : null; // null: it didn't make the top 100
      i += b.board === 'daily' ? 4 : 3;
    }
    return json({ ranks });
  } catch (err) {
    console.error('leaderboard write', err);
    return json({ error: 'store failed' }, 502);
  }
}
