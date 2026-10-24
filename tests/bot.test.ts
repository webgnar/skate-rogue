// The reference bot (src/gen/validate.ts) and the floor validator built on it.
import { describe, expect, it } from 'vitest';
import { makeLayout } from '../src/gen/layout';
import { botRun, validatedFloor } from '../src/gen/validate';
import { buildLevel } from '../src/physics/level';

describe('bot', () => {
  it('clears most raw generated floors 1-2 (tier 1 pieces)', () => {
    let cleared = 0;
    for (let seed = 1; seed <= 50; seed++) {
      for (let floor = 1; floor <= 2; floor++) {
        if (botRun(buildLevel(makeLayout(seed, floor))).result === 'exit') cleared++;
      }
    }
    expect(cleared / 100).toBeGreaterThan(0.8);
  });
});

describe('floor validation', () => {
  it('every validated floor 1-8 on 50 seeds is clearable', () => {
    let tries = 0;
    let drops = 0;
    const t0 = performance.now();
    for (let seed = 1; seed <= 50; seed++) {
      for (let floor = 1; floor <= 8; floor++) {
        const v = validatedFloor(seed, floor);
        expect(v.tierDrops, `seed ${seed} floor ${floor}`).toBeGreaterThanOrEqual(0);
        expect(botRun(v.level).result).toBe('exit');
        tries += v.tries;
        if (v.tierDrops > 0) drops++;
      }
    }
    const ms = (performance.now() - t0) / 400;
    console.log(`validator: ${(tries / 400).toFixed(2)} layouts per floor, ${drops}/400 tier drops, ${ms.toFixed(1)} ms per floor`);
  }, 60000);

  it('is deterministic', () => {
    expect(validatedFloor(7, 5).level.surfaces).toEqual(validatedFloor(7, 5).level.surfaces);
  });
});
