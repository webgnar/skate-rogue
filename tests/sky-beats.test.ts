// The sky beats (src/gen/sky-beats.ts): a designed layer over the power line on later floors, from per-floor recipes
// the level editor can override.
import { afterEach, describe, expect, it } from 'vitest';
import { buildFloor } from '../src/gen/descent';
import { skyRecipe } from '../src/gen/sky-beats';
import { useLevelEdits, SAVED_EDITS } from '../src/gen/level-edits';
import { validatedFloor } from '../src/gen/validate';
import { floorTwist } from '../src/gen/twists';
import { FloorSim } from '../src/sim/floor';
import { Pilot } from '../src/bot/pilot';
import { isFloorEdit } from '../src/levels/drafts';

const chicago = (seed: number, floor: number) => buildFloor(seed, floor, undefined, { hills: true });
const skyOf = (l: ReturnType<typeof chicago>) => [...l.surfaces.filter((s) => s.sky), ...l.rails.filter((r) => r.sky)];

afterEach(() => useLevelEdits(SAVED_EDITS));

describe('sky beats', () => {
  it('none on act 1, a run of them over the hills from floor 4', () => {
    for (let seed = 1; seed <= 4; seed++) {
      expect(skyOf(chicago(seed * 53, 2))).toHaveLength(0);
      for (const f of [4, 8, 13]) expect(skyOf(chicago(seed * 53, f)).length).toBeGreaterThan(3);
    }
  });

  it('stays clear of the power line and never claims to be the top route', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const l = chicago(seed * 53, 10);
      const wires = l.rails.filter((r) => r.top || r.wire);
      for (const s of l.surfaces.filter((x) => x.sky)) {
        expect(s.top).toBeFalsy();
        for (const w of wires)
          for (let i = 0; i < w.xs.length; i++) if (w.xs[i] >= s.x0 && w.xs[i] <= s.x1) expect(Math.abs(w.ys[i] - s.y)).toBeGreaterThan(20);
      }
      //a crane boom never climbs
      for (const r of l.rails.filter((x) => x.sky)) for (let i = 1; i < r.ys.length; i++) expect(r.ys[i]).toBeGreaterThanOrEqual(r.ys[i - 1] - 0.01);
    }
  });

  it("the editor's sky recipe and dials win over the code's", () => {
    useLevelEdits({ floors: { '2': { sky: [['billboard']], skyStart: 0.2 }, '10': { sky: [] } } });
    expect(skyRecipe(2)).toEqual([['billboard']]);
    expect(skyOf(chicago(53, 2)).length).toBeGreaterThan(0);
    expect(skyOf(chicago(53, 2)).every((p) => p.sky === 'billboard')).toBe(true);
    expect(skyOf(chicago(53, 10))).toHaveLength(0);
    expect(isFloorEdit({ sky: [['roofs', 'crane'], ['gap']], skyHeight: 5 })).toBe(true);
    expect(isFloorEdit({ sky: [['spaceship']] })).toBe(false);
    expect(isFloorEdit({ sky: [[]] })).toBe(false);
  });

  it('the bots still clear floors with sky beats', () => {
    for (let s = 1; s <= 3; s++) {
      const seed = s * 7919;
      for (const f of [7, 12]) {
        const level = validatedFloor(seed, f, { twist: floorTwist(seed, f), hills: true, danger: 2 }).level;
        const sim = new FloorSim(level);
        const pilot = new Pilot('high');
        for (let n = 0; n < 7200 && sim.state === 'skate'; n++) sim.step(pilot.input(sim));
        expect(sim.state).toBe('exit');
      }
    }
  }, 90000);
});
