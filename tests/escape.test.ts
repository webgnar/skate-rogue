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

describe('the drone swarm', () => {
  const setup = (seed = 9) => {
    const l = buildEscape(seed, 4);
    const sim = new FloorSim(l, undefined, 0);
    sim.traffic.vehicles.length = 0;
    return { l, sim };
  };
  const roll = (sim: FloorSim, x: number) => Object.assign(sim.skater, { x, y: sim.level.streetY, surface: null, mode: 'roll' });

  it('act 4 is the drone swarm: waves over flat street, a single and a pair first', () => {
    const { l } = setup();
    expect(escapeKind(4)).toBe('drones');
    expect(label({ kind: 'escape', act: 4, danger: 3 })).toBe('DRONE SWARM');
    const d = l.escape!.drones!;
    expect(d.length).toBeGreaterThan(5);
    expect(d.slice(0, 3).map((s) => s.h)).toEqual([40, 40, 40]);
    for (const s of d) {
      expect(s.x).toBeGreaterThanOrEqual(l.escape!.x0);
      expect(s.x).toBeLessThan(l.exitX);
    }
  });

  it('dives in ahead of the skater and hovers across the lane', () => {
    const { l, sim } = setup();
    const s0 = l.escape!.drones![0];
    roll(sim, s0.x - 14 * TILE);
    const d = sim.swarm!.drones[0];
    expect(d.state).toBe('wait');
    let dove = false;
    for (let f = 0; f < 90 && d.state !== 'hover'; f++) {
      sim.step({ pressed: false, held: false });
      if (d.state === 'dive') dove = true;
    }
    expect(dove).toBe(true);
    expect(d.state).toBe('hover');
    expect(sim.skater.x).toBeLessThan(s0.x);
    expect(Math.abs(l.streetY - d.box.roof - s0.h)).toBeLessThan(2);
  });

  it('ride into one and you slam; stomp it and it goes down', () => {
    const a = setup();
    const s0 = a.l.escape!.drones![0];
    roll(a.sim, s0.x - 14 * TILE);
    let slams = 0;
    for (let f = 0; f < 300; f++) {
      a.sim.step({ pressed: false, held: false });
      slams += a.sim.events.filter((e) => e.type === 'slam').length;
    }
    expect(slams).toBeGreaterThan(0);

    const b = setup();
    roll(b.sim, s0.x - 14 * TILE);
    let downs = 0;
    let hold = 0;
    for (let f = 0; f < 300; f++) {
      //ollie a little before it, and hold for full height
      const pressed = b.sim.skater.mode === 'roll' && b.sim.skater.x > s0.x - 90 && b.sim.skater.x < s0.x;
      if (pressed) hold = 30;
      b.sim.step({ pressed, held: hold-- > 0 });
      downs += b.sim.events.filter((e) => e.type === 'drone').length;
    }
    expect(downs).toBeGreaterThan(0);
    expect(b.sim.swarm!.drones[0].state).toBe('down');
    expect(b.sim.swarm!.boxes).not.toContain(b.sim.swarm!.drones[0].box);
  });
});
