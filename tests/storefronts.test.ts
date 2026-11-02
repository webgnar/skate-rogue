import { describe, expect, it } from 'vitest';
import { validatedFloor } from '../src/gen/validate';
import { TILE } from '../src/physics/constants';
import { inHill } from '../src/physics/level';
import { STOREFRONT_SPREAD, STOREFRONTS, storefrontSpan, storefrontSpots } from '../src/render/storefronts';

describe('storefronts along the street', () => {
  const floors = [[1201, 2], [31, 3], [62, 4], [93, 5], [7, 6], [8, 9], [9, 12], [44, 14]].map(([s, f]) => validatedFloor(s, f).level);

  it('stand on plain street, clear of what is blocked and of buildings out on the street, a kind never twice running', () => {
    let total = 0;
    for (const l of floors) {
      const first = Math.round(l.finaleX / TILE);
      const blocked: [number, number][] = [[first + 20, first + 30]];
      const spots = storefrontSpots(l, first, blocked);
      expect(storefrontSpots(l, first, blocked)).toEqual(spots); // the same every time
      total += spots.length;
      spots.forEach((s, i) => {
        const [a, b] = storefrontSpan(s);
        expect(b - a).toBe(STOREFRONTS[s.kind].w);
        expect(Number.isInteger(a) && Number.isInteger(b)).toBe(true); // the wall cuts on whole tiles
        expect(a).toBeGreaterThanOrEqual(first);
        expect(b).toBeLessThanOrEqual(l.exitX / TILE - STOREFRONT_SPREAD.gate);
        expect(b <= blocked[0][0] - 1 || a >= blocked[0][1] + 1).toBe(true);
        for (let c = a; c < b; c++) expect(l.street[c] && !inHill(l, (c + 0.5) * TILE)).toBe(true);
        for (const sf of l.surfaces) {
          if (sf.kind === 'rail' || sf.sky || sf.sewer) continue;
          expect(b <= sf.x0 / TILE - 1 || a >= sf.x1 / TILE + 1).toBe(true);
        }
        if (i > 0) {
          expect(s.kind).not.toBe(spots[i - 1].kind);
          expect(a).toBeGreaterThanOrEqual(storefrontSpan(spots[i - 1])[1]);
        }
      });
    }
    expect(total).toBeGreaterThan(floors.length); // most floors get some
  });
});
