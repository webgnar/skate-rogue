import { describe, expect, it } from 'vitest';
import { PHYS, TILE } from '../src/physics/constants';
import { botRun, validatedFloor } from '../src/gen/validate';
import { CROSS } from '../src/traffic/cross';
import { DOOR, STOP } from '../src/traffic/street';
import { FloorSim } from '../src/sim/floor';

const idle = { pressed: false, held: false };
const floors = (floor: number, n = 8) => Array.from({ length: n }, (_, s) => validatedFloor((s + 1) * 53, floor).level);

describe('bus stops', () => {
  it('come from floor 4, on open street clear of cars and cross streets', () => {
    for (const l of floors(3)) expect(l.busStops).toHaveLength(0);
    const deep = floors(7, 12).filter((l) => l.busStops.length);
    expect(deep.length).toBeGreaterThan(3);
    for (const l of deep) {
      const s = l.busStops[0];
      expect(l.cars.some((c) => c.x1 > s.x - STOP.clear && c.x0 < s.x + STOP.busW + STOP.clear)).toBe(false);
      expect(l.crossings.some((i) => i.x + CROSS.w > s.x && i.x < s.x + STOP.busW)).toBe(false);
    }
  });

  it('the bus signals in the back lane, pulls into the skate lane at the stop, waits, then drives off your way', () => {
    const l = floors(7, 12).find((l) => l.busStops.length)!;
    const stop = l.busStops[0];
    const sim = new FloorSim(l);
    const t = sim.traffic;
    t.vehicles.length = 0;
    t.step(stop.trigger);
    const bus = t.vehicles.find((v) => v.stop)!;
    expect(bus.kind).toBe('bus');
    expect(t.inLane).not.toContain(bus);
    expect(t.signalling).toContain(bus);
    for (let f = 0; f < STOP.pullFrames; f++) t.step(stop.trigger);
    expect(t.inLane).toContain(bus);
    expect(bus.x0).toBeCloseTo(stop.x);
    expect(bus.speed).toBeCloseTo(0);
    for (let f = 0; f < STOP.dwell + 60; f++) t.step(stop.trigger);
    expect(bus.stop).toBeUndefined();
    expect(bus.speed).toBeGreaterThan(0);
  });

  it('rolling into the stopped bus is a slam', () => {
    const l = floors(7, 12).find((l) => l.busStops.length)!;
    const stop = l.busStops[0];
    const sim = new FloorSim(l);
    sim.traffic.vehicles.length = 0;
    sim.traffic.step(stop.trigger);
    for (let f = 0; f < STOP.pullFrames; f++) sim.traffic.step(stop.trigger);
    //inside the stop's clear street (STOP.clear), so we roll straight in
    Object.assign(sim.skater, { x: stop.x - STOP.clear + 4, y: l.streetY, surface: null, mode: 'roll', hsp: PHYS.baseSpeed });
    let slam = false;
    for (let f = 0; f < 60; f++) {
      sim.step(idle);
      slam ||= sim.events.some((e) => e.type === 'slam');
    }
    expect(slam).toBe(true);
  });
});

describe('car doors', () => {
  it('are on cars parked in the back lane from floor 2, with a clear run up in your lane', () => {
    for (const l of floors(1)) expect(l.doors).toHaveLength(0);
    const ls = floors(4, 12);
    expect(ls.filter((l) => l.doors.length).length).toBeGreaterThan(1);
    for (const l of ls)
      for (const x of l.doors) {
        expect(l.doors.length).toBeLessThanOrEqual(DOOR.most);
        expect(l.cars.some((c) => c.x1 > x - 4 * TILE && c.x0 < x + DOOR.carW + TILE)).toBe(false);
      }
  });

  const withDoor = () => {
    const l = floors(4, 20).find((l) => l.doors.length)!;
    const sim = new FloorSim(l);
    sim.traffic.vehicles.length = 0;
    return { l, sim, door: sim.traffic.doors[0] };
  };

  it('warn with a "!" as you come up, then swing open and stay open', () => {
    const { sim, door } = withDoor();
    sim.traffic.step(door.car.x0 - DOOR.range - TILE);
    expect(door.warn).toBe(0);
    for (let f = 0; f < DOOR.warnFrames; f++) sim.traffic.step(door.car.x0 - DOOR.range);
    expect(door.warn).toBe(DOOR.warnFrames);
    expect(door.open).toBe(0);
    for (let f = 0; f < DOOR.swingFrames; f++) sim.traffic.step(door.car.x0 - DOOR.range);
    expect(door.open).toBe(1);
    expect(sim.traffic.doorBoxes).toContain(door.box);
    //only the door is in your lane: the car behind it never is
    expect(sim.traffic.doorBoxes).not.toContain(door.car);
  });

  it('is open before you get there, even coming in fast', () => {
    const fast = PHYS.baseSpeed * 2;
    expect((DOOR.warnFrames + DOOR.swingFrames / 2) * fast).toBeLessThan(DOOR.range - DOOR.carW);
  });

  it('rolling into an open door slams; landing on its edge pops you up', () => {
    let { l, sim, door } = withDoor();
    door.open = 1;
    Object.assign(sim.skater, { x: door.box.x0 - 2 * TILE, y: l.streetY, surface: null, mode: 'roll', hsp: PHYS.baseSpeed });
    let slam = false;
    for (let f = 0; f < 30; f++) {
      sim.step(idle);
      slam ||= sim.events.some((e) => e.type === 'slam');
    }
    expect(slam).toBe(true);

    ({ l, sim, door } = withDoor());
    door.open = 1;
    Object.assign(sim.skater, { x: door.box.x0 + 6, y: door.box.roof - 20, surface: null, mode: 'air', vsp: 2, hsp: 0.5 });
    let hop = false;
    for (let f = 0; f < 12; f++) {
      sim.step(idle);
      hop ||= sim.events.some((e) => e.type === 'hop');
    }
    expect(hop).toBe(true);
  });

  it('the no-boon bot still gets through floors with doors and bus stops', () => {
    for (const floor of [2, 4, 7]) for (const l of floors(floor, 6)) expect(botRun(l).result).toBe('exit');
  });
});
