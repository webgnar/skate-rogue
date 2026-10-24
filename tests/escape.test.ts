import { describe, expect, it } from 'vitest';
import { ACTS, actOf, buildEscape, endsAct, ESCAPE, escapeKind, validatedEscape } from '../src/gen/escape';
import { label } from '../src/gen/roads';
import { botRun } from '../src/gen/validate';
import { PHYS, TILE } from '../src/physics/constants';
import { FloorSim } from '../src/sim/floor';

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

describe('the helicopter', () => {
  const setup = () => {
    const l = buildEscape(7, 2);
    const sim = new FloorSim(l, undefined, 0);
    sim.traffic.vehicles.length = 0;
    return { l, sim };
  };
  const roll = (sim: FloorSim, x: number) => Object.assign(sim.skater, { x, y: sim.level.streetY, surface: null, mode: 'roll' });

  it('act 2 is the helicopter, with L tracks overhead to hide under', () => {
    const { l } = setup();
    expect(escapeKind(2)).toBe('chopper');
    expect(l.escape!.covers.length).toBeGreaterThan(3);
    for (const c of l.escape!.covers) expect(l.streetY - c.y).toBeGreaterThan(2 * 50); // over an ollie and a flip
  });

  it('finds the skater, locks on, and the Heat climbs while lit', () => {
    const { l, sim } = setup();
    const c0 = l.escape!.covers[0];
    roll(sim, l.escape!.chopperFrom! + 2 * TILE);
    sim.chopper!.x = sim.skater.x - TILE;
    let lit = 0;
    for (let f = 0; f < 120 && sim.skater.x < c0.x0 - TILE; f++) {
      sim.step({ pressed: false, held: false });
      if (sim.chopper!.lit) lit++;
    }
    expect(sim.chopper!.state).toBe('lock');
    expect(lit).toBeGreaterThan(20);
    expect(sim.heat.value).toBeGreaterThan(3);
  });

  it('loses you under the L, and a faster skater pulls out of the light', () => {
    const { l, sim } = setup();
    const c0 = l.escape!.covers[0];
    roll(sim, c0.x0 - TILE);
    sim.chopper!.x = sim.skater.x;
    sim.chopper!.state = 'lock';
    for (let f = 0; f < 20; f++) sim.step({ pressed: false, held: false });
    expect(sim.chopper!.state).toBe('lost');
    expect(sim.chopper!.lit).toBe(false);

    const fast = setup().sim;
    roll(fast, l.escape!.chopperFrom! + 2 * TILE);
    fast.chopper!.x = fast.skater.x;
    fast.chopper!.state = 'lock';
    fast.skater.carry = fast.skater.hsp = PHYS.baseSpeed * 1.6;
    let freed = false;
    for (let f = 0; f < 150; f++) {
      fast.step({ pressed: false, held: false });
      if (fast.chopper!.state !== 'lock') freed = true;
    }
    expect(freed).toBe(true);
  });
});
