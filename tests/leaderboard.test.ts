import { beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanTag, dayBefore, validEntry } from '../src/net/board-rules';

// an in-memory stand-in for the Redis REST pipeline
const sets = new Map<string, Map<string, number>>();
const sorted = (k: string) => [...(sets.get(k) ?? new Map()).entries()].sort((a, b) => b[1] - a[1]);
function run(cmd: (string | number)[]): unknown {
  const [op, key] = cmd as [string, string];
  const set = sets.get(key) ?? new Map<string, number>();
  sets.set(key, set);
  switch (op) {
    case 'ZADD':
      set.set(cmd[3] as string, cmd[2] as number);
      return 1;
    case 'ZREMRANGEBYRANK': {
      //keep the top N: ranks 0..-N-1 counted from the lowest
      const keep = -(cmd[3] as number) - 1;
      const asc = sorted(key).reverse();
      asc.slice(0, Math.max(0, asc.length - keep)).forEach(([m]) => set.delete(m));
      return 0;
    }
    case 'ZREVRANK': {
      const i = sorted(key).findIndex(([m]) => m === cmd[2]);
      return i < 0 ? null : i;
    }
    case 'ZREVRANGE':
      return sorted(key).slice(cmd[2] as number, (cmd[3] as number) + 1).map(([m]) => m);
    default:
      return 1;
  }
}

declare const process: { env: Record<string, string | undefined> };

let api: typeof import('../api/leaderboard');
beforeAll(async () => {
  process.env.KV_REST_API_URL = 'https://store.test';
  process.env.KV_REST_API_TOKEN = 't';
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => new Response(JSON.stringify((JSON.parse(init.body as string) as (string | number)[][]).map((c) => ({ result: run(c) })))));
  api = await import('../api/leaderboard');
});

const post = (body: unknown) => api.POST(new Request('https://x/api/leaderboard', { method: 'POST', body: JSON.stringify(body) }));
const get = async (q: string) => (await api.GET(new Request(`https://x/api/leaderboard?${q}`))).json();

describe('leaderboards', () => {
  it('cleans tags and refuses silly entries', () => {
    expect(cleanTag('  lou <b>gnar</b>!! ')).toBe('LOU BGNARB');
    expect(cleanTag('ab')).toBeNull();
    const today = '2026-10-25';
    expect(validEntry({ tag: 'ZACK', score: 1200, floor: 4 }, today)).toEqual({ tag: 'ZACK', score: 1200, floor: 4 });
    expect(validEntry({ tag: 'ZACK', score: 1.5, floor: 4 }, today)).toBeNull();
    expect(validEntry({ tag: 'ZACK', score: 10, floor: 99 }, today)).toBeNull();
    expect(validEntry({ tag: 'ZACK', score: 10, floor: 2, gnar: 3 }, today)?.gnar).toBe(3);
    expect(validEntry({ tag: 'ZACK', score: 10, floor: 2, gnar: 9 }, today)).toBeNull();
    expect(validEntry({ tag: 'ZACK', score: 10, floor: 2, day: dayBefore(today) }, today)?.day).toBe('2026-10-24');
    expect(validEntry({ tag: 'ZACK', score: 10, floor: 2, day: '2026-10-01' }, today)).toBeNull();
  });

  it('posts a run to the score and floor boards, and ranks it', async () => {
    expect((await post({ tag: 'ZACK', score: 5000, floor: 3 })).status).toBe(200);
    const r = await (await post({ tag: 'ROXY', score: 9000, floor: 2 })).json();
    expect(r.ranks).toEqual({ score: 1, floor: 2 });
    expect((await get('board=score')).map((x: { tag: string }) => x.tag)).toEqual(['ROXY', 'ZACK']);
    //deepest first, then score
    expect((await get('board=floor')).map((x: { tag: string }) => x.tag)).toEqual(['ZACK', 'ROXY']);
    expect((await post({ tag: 'x', score: 1, floor: 1 })).status).toBe(400);
  });

  it("a daily run also goes on that day's board", async () => {
    const day = new Date().toISOString().slice(0, 10);
    const r = await (await post({ tag: 'KEANU', score: 300, floor: 1, day })).json();
    expect(r.ranks.daily).toBe(1);
    expect(await get(`board=daily&day=${day}`)).toEqual([{ rank: 1, tag: 'KEANU', score: 300, floor: 1 }]);
  });

  it('keeps the top 100', async () => {
    for (let i = 0; i < 120; i++) await post({ tag: 'BOT', score: 10 + i, floor: 1 });
    expect(sets.get('gnar:score')!.size).toBe(100);
  });
});
