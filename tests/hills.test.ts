import { describe, expect, it } from 'vitest';
import { buildFloor } from '../src/gen/descent';
import { HILLS, recipe, RECIPES } from '../src/gen/hills';
import { clearable } from '../src/gen/validate';
import { TILE } from '../src/physics/constants';

const chicago = (seed: number, floor: number) => buildFloor(seed, floor, undefined, { hills: true });

describe('Chicago hills', () => {
  it('has a recipe for each of the 15 floors, each ending on a stairway', () => {
    expect(RECIPES.length).toBe(15);
    for (const r of RECIPES) expect(r[r.length - 1]).toEqual(['stairs']);
  });

  it('is a hillside: blocks of street falling away, a stairway with a handrail, solid ground to the street', () => {
    for (let floor = 1; floor <= 15; floor++) {
      const l = chicago(floor * 7, floor);
      expect(l.hills).toBe(true);
      const descent = l.surfaces.filter((s) => s.x0 < l.finaleX && !s.side);
      expect(descent.some((s) => s.hill && s.y1! > s.y)).toBe(true);
      expect(descent.some((s) => s.kind === 'stairs')).toBe(true);
      expect(l.rails.some((r) => r.x1 <= l.finaleX && r.y1 > r.y0)).toBe(true);
      //the last thing before the street is flat ground at street level
      const last = descent.filter((s) => s.kind === 'roof').sort((a, b) => b.x1 - a.x1)[0];
      expect(last.y).toBe(l.streetY);
      expect(last.x1 - last.x0).toBeGreaterThanOrEqual(HILLS.runOut * TILE);
    }
  });

  it('gets higher, steeper and longer through the run', () => {
    const avg = (floor: number, f: (l: ReturnType<typeof chicago>) => number) => {
      let t = 0;
      for (let seed = 1; seed <= 8; seed++) t += f(chicago(seed, floor));
      return t / 8;
    };
    const top = (l: ReturnType<typeof chicago>) => l.streetY - l.startY;
    expect(avg(5, top)).toBeGreaterThan(avg(1, top));
    expect(avg(12, (l) => l.width)).toBeGreaterThan(avg(1, (l) => l.width));
    expect(HILLS.grade(12)).toBeGreaterThan(HILLS.grade(1));
  });

  it('follows its recipe by seed, the same every time', () => {
    expect(recipe(5, 3)).toEqual(recipe(5, 3));
    expect(chicago(5, 3).surfaces).toEqual(chicago(5, 3).surfaces);
  });

  it('mostly clears first time with the reference bot', () => {
    let ok = 0;
    for (let seed = 1; seed <= 6; seed++) if (clearable(chicago(seed, 1))) ok++;
    expect(ok).toBeGreaterThanOrEqual(5);
  });
});
