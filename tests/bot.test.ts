// A simple bot that ollies at canals and cars and flips when it's falling short. If it can clear generated floors,
// the QFS pieces work at auto-run speed.
import { describe, expect, it } from 'vitest';
import { makeLayout } from '../src/gen/layout';
import { TILE } from '../src/physics/constants';
import { buildLevel, isStreetAt, type Level } from '../src/physics/level';
import { Skater } from '../src/physics/skater';

function danger(level: Level, x: number): boolean {
  for (let dx = 20; dx <= 70; dx += 4) {
    if (!isStreetAt(level, x + dx)) return true;
    if (level.cars.some((c) => x + dx >= c.x0 && x + dx <= c.x1)) return true;
    if (level.glass.some((g) => x + dx >= g.x0 && x + dx <= g.x1)) return true;
  }
  return false;
}

export function botRun(seed: number, floor: number): { result: string; slams: number } {
  const level = buildLevel(makeLayout(seed, floor));
  const sk = new Skater(level);
  let hold = 0;
  let slams = 0;
  for (let f = 0; f < 60 * 120; f++) {
    let pressed = false;
    const onSurface = sk.mode === 'grind' || (sk.mode === 'roll' && sk.surface !== null);
    if (sk.mode === 'roll' && !sk.surface && danger(level, sk.x)) pressed = true;
    if (onSurface && sk.surface && sk.x > sk.surface.x1 - 24 && danger(level, sk.x)) pressed = true;
    if (sk.mode === 'rail' && sk.rail && sk.railD > sk.rail.length - 30) pressed = true;
    // falling with no street ahead: flip for more air
    if (sk.mode === 'air' && sk.vsp > 0.5 && sk.jumps > 0 && !isStreetAt(level, sk.x + 40)) pressed = true;
    if (pressed && sk.grounded) hold = 30;
    sk.step({ pressed, held: hold > 0 || pressed });
    if (hold > 0) hold--;
    slams += sk.events.filter((e) => e.type === 'slam').length;
    sk.events.length = 0;
    if (sk.mode === 'bail') return { result: `bail at col ${Math.floor(sk.x / TILE)}`, slams };
    if (sk.mode === 'exit') return { result: 'exit', slams };
  }
  return { result: 'timeout', slams };
}

describe('bot', () => {
  it('clears most generated floors 1-2 (tier 1 pieces)', () => {
    let cleared = 0;
    let total = 0;
    const fails: string[] = [];
    for (let seed = 1; seed <= 50; seed++) {
      for (let floor = 1; floor <= 2; floor++) {
        total++;
        const r = botRun(seed, floor);
        if (r.result === 'exit') cleared++;
        else fails.push(`seed ${seed} floor ${floor}: ${r.result} (${makeLayout(seed, floor).pieces.map((p) => p.name).join(', ')})`);
      }
    }
    if (cleared < total) console.log(`bot cleared ${cleared}/${total}\n` + fails.slice(0, 12).join('\n'));
    expect(cleared / total).toBeGreaterThan(0.8);
  });
});
