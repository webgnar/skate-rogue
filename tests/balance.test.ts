// The balance pass: the no-boon bot skates a whole run's floors (with their twists, as the game builds them)
// and its escapes, and the numbers are held to the targets. `npm run balance` prints the table.
import { describe, expect, it } from 'vitest';
import { botRun, validatedFloor, type BotRun } from '../src/gen/validate';
import { validatedEscape } from '../src/gen/escape';
import { floorTwist } from '../src/gen/twists';

declare const process: { env: Record<string, string | undefined>; stderr: { write(s: string): void } };

const SEEDS = 6;
const wornest = (r: BotRun) => 100 - Math.min(...Object.values(r.gear));
const avg = (rs: BotRun[], f: (r: BotRun) => number) => rs.reduce((n, r) => n + f(r), 0) / rs.length;

function floorRuns(floor: number): BotRun[] {
  return Array.from({ length: SEEDS }, (_, s) => {
    const seed = (s + 1) * 7919;
    return botRun(validatedFloor(seed, floor, { twist: floorTwist(seed, floor), hills: true, danger: 2 }).level);
  });
}

describe('balance (bot runs)', () => {
  it('floors: cleared, 15 to 35 seconds, about 4 floors to half-worn gear, Heat in hand', () => {
    const checks: { sec: number; worn: number; heat: number }[] = [];
    const rows: string[] = ['floor   sec  coins  stoken  slams  maxHeat  wornest'];
    for (let floor = 1; floor <= 15; floor++) {
      const rs = floorRuns(floor);
      for (const r of rs) expect(r.result).toBe('exit');
      const row = { sec: avg(rs, (r) => r.frames / 60), coins: avg(rs, (r) => r.cash), stoken: avg(rs, (r) => r.stoken), slams: avg(rs, (r) => r.slams), heat: avg(rs, (r) => r.maxHeat), worn: avg(rs, wornest) };
      rows.push(`${floor}`.padEnd(6) + Object.values(row).map((v) => v.toFixed(1).padStart(7)).join(' '));
      checks.push(row);
    }
    if (process.env.BALANCE) process.stderr.write(rows.join('\n') + '\n');
    for (const row of checks) {
      expect(row.sec).toBeGreaterThan(15);
      expect(row.sec).toBeLessThan(35);
      expect(row.worn).toBeLessThan(18); // the worst part: half-worn takes about 3 floors or more
      expect(row.heat).toBeLessThan(60);
    }
  }, 120000);

  it('escapes: cleared in 20 to 50 seconds', () => {
    for (let act = 1; act <= 5; act++) {
      const rs = Array.from({ length: SEEDS }, (_, s) => botRun(validatedEscape((s + 1) * 7919, act)));
      for (const r of rs) expect(r.result).toBe('exit');
      const sec = avg(rs, (r) => r.frames / 60);
      if (process.env.BALANCE) process.stderr.write(`escape ${act}: ${sec.toFixed(1)} s, ${avg(rs, (r) => r.slams).toFixed(1)} slams, max Heat ${avg(rs, (r) => r.maxHeat).toFixed(0)}\n`);
      expect(sec).toBeGreaterThan(20);
      expect(sec).toBeLessThan(50);
    }
  }, 60000);
});
