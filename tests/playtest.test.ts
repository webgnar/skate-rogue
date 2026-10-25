// The playtest bot's runs in the sim (src/bot): whole runs, boons and all, checked on every step. In `npm test` a
// couple of runs must come back clean; `npm run playtest` (PLAYTEST=1) skates many more and writes
// playtest-report/sim-N.json for the report.
import { describe, expect, it } from 'vitest';
import { playRun, type FloorReport } from '../src/bot/run-sim';
import { FloorChecks } from '../src/bot/checks';
import { validatedFloor } from '../src/gen/validate';
import { FloorSim } from '../src/sim/floor';
import { parseBoons, reproQuery } from '../src/bot/repro';

declare const process: { env: Record<string, string | undefined> };

describe('playtest bot (sim)', () => {
  it('catches a skater dropping through a roof, and a stuck one', () => {
    const level = validatedFloor(5, 4).level;
    const sim = new FloorSim(level);
    const checks = new FloorChecks(sim);
    const roof = level.surfaces.find((s) => s.kind === 'roof' && s.y1 === undefined && s.y < level.streetY - 40)!;
    //a step that starts above the roof in the air and ends under it
    Object.assign(sim.skater, { mode: 'air', x: roof.x0 + 20, y: roof.y - 3, surface: null });
    checks.before();
    Object.assign(sim.skater, { x: roof.x0 + 24, y: roof.y + 6 });
    checks.after();
    expect(checks.findings.map((f) => f.kind)).toEqual(['fell-through']);
    //nailed in place
    const stuck = new FloorChecks(sim);
    for (let f = 0; f < 5 * 60; f++) {
      stuck.before();
      stuck.after();
    }
    expect(stuck.findings.some((f) => f.kind === 'stuck')).toBe(true);
  });

  it('test URLs carry the boons, road and escape', () => {
    const boons = parseBoons('bigPop,bigPop,grease,nope');
    expect(boons).toEqual([{ id: 'bigPop', stacks: 2 }, { id: 'grease', stacks: 1 }]);
    expect(reproQuery({ seed: 7, floor: 4, boons, danger: 2, bot: 'ref' })).toBe('?seed=7&floor=4&boons=bigPop,bigPop,grease&danger=2&unlockall&skater=lou-gnar&bot');
    expect(reproQuery({ seed: 7, floor: 6, escape: 2, danger: 3 })).toBe('?seed=7&escape=2&unlockall&skater=lou-gnar');
  });

  it('two whole runs come back with no physics findings', () => {
    const found = [1, 2].flatMap((seed) => playRun({ seed: seed * 4241, pilot: seed === 1 ? 'ref' : 'mash', keepGoing: true }))
      .flatMap((r) => r.findings.map((f) => `${r.label} ${r.url}: ${f.kind} ${f.message} at col ${f.col}`));
    expect(found).toEqual([]);
  }, 60000);

  it.runIf(process.env.PLAYTEST)('sweep: many runs for the report', async () => {
    const seeds = Number(process.env.PLAYTEST_SEEDS) || 20;
    //PLAYTEST_SHARD=1/4: this process skates every fourth seed (scripts/playtest/run.mjs runs one per core)
    const [shard, shards] = (process.env.PLAYTEST_SHARD ?? '0/1').split('/').map(Number);
    const t0 = performance.now();
    const runs: { seed: number; pilot: string; gnar: number; floors: FloorReport[] }[] = [];
    for (let i = 1; i <= seeds; i++) {
      if ((i - 1) % shards !== shard) continue;
      const seed = i * 7919;
      //the reference line and a button-masher on every seed; every few seeds at a Gnar level too
      for (const pilot of ['ref', 'mash'] as const) runs.push({ seed, pilot, gnar: 0, floors: playRun({ seed, pilot, keepGoing: true }) });
      if (i % 5 === 0) runs.push({ seed, pilot: 'ref', gnar: 3, floors: playRun({ seed, pilot: 'ref', gnar: 3, keepGoing: true }) });
    }
    const fsId = 'node:fs';
    const { mkdirSync, writeFileSync } = (await import(/* @vite-ignore */ fsId)) as {
      mkdirSync(p: string, o: { recursive: boolean }): void;
      writeFileSync(p: string, data: string): void;
    };
    mkdirSync('playtest-report', { recursive: true });
    writeFileSync(`playtest-report/sim-${shard}.json`, JSON.stringify({ at: new Date().toISOString(), seconds: (performance.now() - t0) / 1000, runs }, null, 1));
  }, 900000);
});
