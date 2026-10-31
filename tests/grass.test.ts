import { describe, expect, it } from 'vitest';
import { buildFloor } from '../src/gen/descent';
import { validatedFloor } from '../src/gen/validate';
import { PHYS, TILE } from '../src/physics/constants';
import { freshGear, GEAR } from '../src/run/gear';
import { FloorSim } from '../src/sim/floor';
import { FLAT, levelOf } from './helpers';

describe('grass strips', () => {
  it('a floor has a few strips on flat street, clear of glass and parked cars', () => {
    let total = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const l = validatedFloor(seed * 17, 2).level;
      const grass = l.grass ?? [];
      total += grass.length;
      for (const g of grass) {
        expect(g.x1 - g.x0).toBeGreaterThanOrEqual(2 * TILE);
        expect(l.glass.some((x) => x.x1 > g.x0 && x.x0 < g.x1)).toBe(false);
        expect(l.cars.some((c) => c.x1 > g.x0 && c.x0 < g.x1)).toBe(false);
      }
    }
    expect(total / 6).toBeGreaterThanOrEqual(1);
    expect(buildFloor(3, 1).grass).toEqual(buildFloor(3, 1).grass); // the same for a seed
  });

  it('good wheels roll right over grass; worn wheels bog down on it', () => {
    const speedOn = (wheels: number) => {
      const l = levelOf(FLAT);
      l.grass = [{ x0: l.startX + 2 * TILE, x1: l.startX + 12 * TILE }];
      const sim = new FloorSim(l, undefined, 0, [], { ...freshGear(), wheels });
      sim.traffic.vehicles.length = 0;
      for (let f = 0; f < 60; f++) sim.step({ pressed: false, held: false });
      expect(sim.skater.onGrass).toBe(true);
      return sim.skater.hsp;
    };
    const fresh = speedOn(100);
    expect(speedOn(GEAR.roughFrom)).toBeCloseTo(fresh);
    expect(speedOn(0)).toBeCloseTo(fresh * (1 - GEAR.grassSlow) * (1 - GEAR.max.wheels), 2); // (dead wheels cost a little speed anywhere)
    expect(fresh).toBeGreaterThan(PHYS.baseSpeed * 0.99);
  });
});
