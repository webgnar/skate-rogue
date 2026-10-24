import { describe, expect, it } from 'vitest';
import { PHYS, TILE } from '../src/physics/constants';
import { botRun, validatedFloor } from '../src/gen/validate';
import { ARRIVE, CROSS, crossPlan, TURN_AT } from '../src/traffic/cross';
import { FloorSim } from '../src/sim/floor';

const idle = { pressed: false, held: false };

describe('cross traffic', () => {
  const floors = (floor: number) => [1, 2, 3, 4, 5, 6].map((s) => validatedFloor(s * 71, floor).level);

  it('comes in from floor 5, on open street', () => {
    for (const l of floors(4)) expect(crossPlan(l, l.layout.seed)).toHaveLength(0);
    const deep = floors(8).flatMap((l) => crossPlan(l, l.layout.seed).map((i) => ({ l, i })));
    expect(deep.length).toBeGreaterThan(3);
    for (const { l, i } of deep) {
      expect(l.cars.some((c) => c.x1 > i.x - CROSS.clear && c.x0 < i.x + CROSS.w + CROSS.clear)).toBe(false);
      expect(i.trigger).toBeLessThan(i.x);
    }
  });

  it('shows in the back lanes for over a second before it reaches the skate lane, then turns onto your road', () => {
    expect(ARRIVE / 60).toBeGreaterThan(1);
    const l = floors(8).find((l) => crossPlan(l, l.layout.seed).length)!;
    const sim = new FloorSim(l);
    const c = sim.traffic.cross[0];
    c.step(c.at.trigger);
    expect(c.red).toBe(true);
    let inLane = 0;
    sim.traffic.vehicles.length = 0;
    for (let f = 0; f < CROSS.period; f++) {
      sim.traffic.step(c.at.trigger);
      if (c.inLane) inLane++;
    }
    //in the lane as it pulls out and swings round, then it's a car on the road, driving your way
    expect(inLane).toBeGreaterThan(30);
    expect(inLane).toBeLessThan(60);
    const car = sim.traffic.vehicles.find((v) => v.kind === 'car')!;
    expect(car).toBeDefined();
    expect(car.speed).toBeGreaterThan(0);
    expect(car.x1 - car.x0).toBe(2 * TILE);
    expect(car.x0).toBeGreaterThan(c.at.x - TILE);
  });

  it('a car that turned onto the road can be car-hopped', () => {
    const l = floors(8).find((l) => crossPlan(l, l.layout.seed).length)!;
    const sim = new FloorSim(l);
    const c = sim.traffic.cross[0];
    c.step(c.at.trigger);
    while (!sim.traffic.vehicles.some((v) => v.kind === 'car')) sim.traffic.step(c.at.trigger);
    sim.traffic.vehicles = sim.traffic.vehicles.filter((v) => v.kind === 'car');
    const car = sim.traffic.vehicles[0];
    Object.assign(sim.skater, { x: (car.x0 + car.x1) / 2, y: car.roof - 30, surface: null, mode: 'air', vsp: 2, hsp: PHYS.baseSpeed });
    let hop = false;
    for (let f = 0; f < 20; f++) {
      sim.step(idle);
      hop ||= sim.events.some((e) => e.type === 'hop');
    }
    expect(hop).toBe(true);
  });

  it('a car pulling out can be car-hopped too', () => {
    const l = floors(8).find((l) => crossPlan(l, l.layout.seed).length)!;
    const sim = new FloorSim(l);
    sim.traffic.vehicles.length = 0;
    const c = sim.traffic.cross[0];
    c.t = Math.round(TURN_AT);
    c.step(c.at.trigger);
    Object.assign(sim.skater, { x: (c.box.x0 + c.box.x1) / 2, y: c.box.roof - 20, surface: null, mode: 'air', vsp: 2, hsp: 0.5 });
    let hop = false;
    for (let f = 0; f < 10; f++) {
      sim.step(idle);
      hop ||= sim.events.some((e) => e.type === 'hop');
    }
    expect(hop).toBe(true);
  });

  it('a car crossing as you roll up is a slam unless you ollie it', () => {
    const l = floors(8).find((l) => crossPlan(l, l.layout.seed).length)!;
    const sim = new FloorSim(l);
    sim.traffic.vehicles.length = 0;
    const c = sim.traffic.cross[0];
    Object.assign(sim.skater, { x: c.box.x0 - 4 * TILE, y: l.streetY, surface: null, mode: 'roll', hsp: PHYS.baseSpeed });
    c.t = Math.round(ARRIVE - 20); // in the lane when we get there
    let slam = false;
    for (let f = 0; f < 60; f++) {
      sim.step(idle);
      slam ||= sim.events.some((e) => e.type === 'slam');
    }
    expect(slam).toBe(true);
  });

  it('each intersection is a cross street on the level, kept clear of street props', () => {
    for (const l of floors(8)) {
      expect(l.crossings).toEqual(crossPlan(l, l.layout.seed));
      for (const i of l.crossings) {
        const mid = i.x + CROSS.w / 2;
        expect(l.props.some((p) => Math.abs(p.x - mid) < CROSS.street * 32)).toBe(false);
      }
    }
  });

  it('the no-boon bot gets through floors with cross traffic', () => {
    for (const l of floors(9)) expect(botRun(l).result).toBe('exit');
  });
});
