import { describe, expect, it } from 'vitest';
import { validatedFloor } from '../src/gen/validate';
import { validatedEscape } from '../src/gen/escape';
import { placeProps, PROP_SIZE, PROPS } from '../src/gen/props';
import { TILE } from '../src/physics/constants';
import { FloorSim } from '../src/sim/floor';
import { FLAT, levelOf } from './helpers';

const idle = { pressed: false, held: false };

describe('smashables', () => {
  const floors = [1, 2, 3, 4].map((s) => validatedFloor(s * 31, 2 + s).level);

  it('every floor is dressed: scenery at the back, smashables in the lane, one golden prop', () => {
    for (const l of floors) {
      const smash = l.props.filter((p) => p.breaks);
      expect(smash.length).toBeGreaterThan(8);
      expect(l.props.some((p) => !p.breaks && p.z === PROPS.sceneryZ)).toBe(true);
      expect(smash.filter((p) => p.loot === 'stoken')).toHaveLength(1);
      for (const p of l.props) expect(PROP_SIZE[p.name]).toBeDefined();
      //never on a parked car, and street props stand on the street
      for (const p of smash) expect(l.cars.some((c) => p.x > c.x0 - TILE && p.x < c.x1 + TILE && p.y === l.streetY)).toBe(false);
      expect(placeProps(l)).toEqual(l.props);
    }
    expect(validatedEscape(5, 1).props.length).toBeGreaterThan(0);
  });

  it('skating through one smashes it; nothing ever slows or slams you', () => {
    const l = levelOf(FLAT);
    l.props = [{ name: 'Cone', x: l.startX + 5 * TILE, y: l.streetY, z: 0, yaw: 0, breaks: true, loot: 'cash' }];
    const sim = new FloorSim(l);
    sim.traffic.vehicles.length = 0;
    const ev: { type: string; how?: string; loot?: string }[] = [];
    for (let f = 0; f < 120; f++) {
      sim.step(idle);
      ev.push(...sim.events);
    }
    const s = ev.find((e) => e.type === 'smash');
    expect(s?.how).toBe('roll');
    expect(s?.loot).toBe('cash');
    expect(ev.filter((e) => e.type === 'smash')).toHaveLength(1);
    expect(ev.some((e) => e.type === 'slam')).toBe(false);
    expect(sim.skater.hsp).toBeGreaterThan(3);
  });

  it('a big landing breaks what is around you', () => {
    const l = levelOf(FLAT);
    const x = l.startX + 6 * TILE;
    l.props = [{ name: 'Bottle', x: x + 40, y: l.streetY, z: 0, yaw: 0, breaks: true }, { name: 'Can', x: x + 8 * TILE, y: l.streetY, z: 0, yaw: 0, breaks: true }];
    const sim = new FloorSim(l);
    sim.traffic.vehicles.length = 0;
    Object.assign(sim.skater, { x, y: l.streetY - 60, vsp: 9, mode: 'air', surface: null });
    const how: string[] = [];
    for (let f = 0; f < 10; f++) {
      sim.step(idle);
      for (const e of sim.events) if (e.type === 'smash') how.push(e.how);
    }
    expect(sim.broken).toEqual([true, false]);
    expect(how).toEqual(['land']);
  });

  it('the AI stuff cools Heat a little', () => {
    const l = levelOf(FLAT);
    l.props = [{ name: 'AIKiosk', x: l.startX + 3 * TILE, y: l.streetY, z: 0, yaw: 0, breaks: true, ai: true }];
    const sim = new FloorSim(l, undefined, 50);
    sim.traffic.vehicles.length = 0;
    for (let f = 0; f < 60; f++) sim.step(idle);
    expect(sim.broken[0]).toBe(true);
    expect(sim.heat.value).toBeLessThan(48);
  });
});
