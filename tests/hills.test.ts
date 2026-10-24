import { describe, expect, it } from 'vitest';
import { buildFloor } from '../src/gen/descent';
import { HILLS, recipe, RECIPES, stretches } from '../src/gen/hills';
import { isStreetAt, surfaceY, type Level } from '../src/physics/level';
import { Skater } from '../src/physics/skater';
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

  it('has a street chase partway down, then a cable car up the next stretch of hill', () => {
    for (let floor = 1; floor <= 15; floor++) {
      const l = chicago(floor * 3, floor);
      const n = stretches(floor * 3, floor).length;
      expect(n).toBeGreaterThanOrEqual(floor >= 6 ? 3 : 2);
      expect(l.hillSpans!.length).toBe(n);
      for (const [a, b] of l.hillSpans!.slice(1)) {
        //street before it, the climb at its foot, the street again after it
        expect(isStreetAt(l, a - TILE)).toBe(true);
        expect(isStreetAt(l, b + TILE)).toBe(true);
        const climb = l.surfaces.find((s) => s.tow && s.x0 >= a && s.x1 <= b)!;
        expect(climb.y).toBe(l.streetY);
        expect(climb.y1!).toBeLessThan(l.streetY - 8 * TILE);
        //each stretch comes back down to the street
        const ground = l.surfaces.filter((s) => s.x0 >= a && s.x1 <= b);
        expect(ground.some((s) => s.kind === 'stairs')).toBe(true);
        expect(Math.max(...ground.map((s) => s.x1))).toBe(b);
      }
    }
  });

  it('the cable car takes you up whatever your speed', () => {
    const l = chicago(9, 4);
    const climb = l.surfaces.find((s) => s.tow)!;
    const sk = new Skater({ ...l, startX: climb.x0 - 2 * TILE, startY: l.streetY } as Level);
    let top = false;
    for (let f = 0; f < 600 && !top; f++) {
      sk.step({ pressed: false, held: false });
      if (sk.x > climb.x1 + TILE && sk.y < climb.y1! + 4) top = true;
    }
    expect(top).toBe(true);
  });

  it('strings power lines low over some blocks, and an ollie and a flip get you grinding one', () => {
    let wires = 0;
    let level: Level | null = null;
    for (let seed = 1; seed <= 10; seed++) {
      const l = chicago(seed, 3);
      const w = l.rails.filter((r) => r.wire);
      wires += w.length;
      if (w.length && !level) level = l;
    }
    expect(wires).toBeGreaterThan(3);
    const l = level!;
    const wire = l.rails.find((r) => r.wire)!;
    const block = l.surfaces.find((s) => s.hill && s.x0 < wire.x0 && s.x1 > wire.x1)!;
    let reached = false;
    for (let start = 1; start <= 4 && !reached; start++) {
      for (let ollie = 0; ollie < 24 && !reached; ollie += 2) {
        for (let flip = 4; flip < 24 && !reached; flip += 2) {
          const sk = new Skater({ ...l, startX: block.x0 + start * TILE, startY: surfaceY(block, block.x0 + start * TILE) } as Level);
          for (let f = 0; f < 120; f++) {
            sk.step({ pressed: f === ollie || f === ollie + flip, held: f >= ollie });
            sk.events.length = 0;
            if (sk.rail?.wire) reached = true;
          }
        }
      }
    }
    expect(reached).toBe(true);
  });
});
