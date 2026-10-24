import { describe, expect, it } from 'vitest';
import { ACTS, actOf, buildEscape, endsAct, ESCAPE, escapeKind, validatedEscape } from '../src/gen/escape';
import { label } from '../src/gen/roads';
import { botRun } from '../src/gen/validate';
import { PHYS } from '../src/physics/constants';

describe('acts and escapes', () => {
  it('a run is 5 acts of 3 floors; the third floor of each ends the act', () => {
    expect([1, 2, 3, 4, 6, 7, 15].map(actOf)).toEqual([1, 1, 1, 2, 2, 3, 5]);
    expect([3, 6, 9, 12, 15].every(endsAct)).toBe(true);
    expect([1, 2, 4, 5, 13, 14].some(endsAct)).toBe(false);
    expect(escapeKind(1)).toBe('roadblock');
    expect(escapeKind(ACTS)).toBe('finale');
    expect(label({ kind: 'escape', act: 5, danger: 3 })).toBe('THE LAST ROADBLOCK');
  });

  it('the roadblock: a car, a bus past a plain ollie, cruisers, a bus; the finale has two', () => {
    const l = buildEscape(4, 1);
    const block = l.cars.filter((c) => c.x0 >= l.escape!.x0);
    expect(block.map((c) => c.model ?? 'car')).toEqual(['car', 'bus', 'cruiser', 'cruiser', 'cruiser', 'cruiser', 'bus']);
    const ollie = (PHYS.ollie * PHYS.ollie) / (2 * PHYS.grav);
    expect(l.streetY - block[1].roof).toBeGreaterThan(ollie);
    expect(ESCAPE.busH).toBeLessThan(2 * ollie);
    expect(l.fork).toBeNull();
    expect(l.danger).toBe(3);
    const fin = buildEscape(4, 5);
    expect(fin.cars.filter((c) => c.model === 'bus')).toHaveLength(4);
    expect(fin.escape!.kind).toBe('finale');
    expect(fin.exitX).toBeGreaterThan(fin.escape!.x1);
  });

  it('the no-boon bot gets through every act escape', () => {
    for (let act = 1; act <= ACTS; act++) {
      for (let seed = 1; seed <= 4; seed++) expect(botRun(validatedEscape(seed * 101, act)).result).toBe('exit');
    }
  });
});
