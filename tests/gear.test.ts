import { describe, expect, it } from 'vitest';
import { crossed, freshGear, GEAR, gearScale, replace, wornness } from '../src/run/gear';
import { PHYS, TILE } from '../src/physics/constants';
import { FloorSim } from '../src/sim/floor';
import { FLAT, levelOf, pressAt } from './helpers';

const RAIL = [
  '................', '................', '................', '................', '................',
  '................', '................', '................', '..============..', '################',
];

describe('gear wear', () => {
  it('fresh gear and gear down to half cost nothing; worn gear costs more the closer it gets to 0', () => {
    expect(gearScale(freshGear())).toEqual({ ollie: 1, trick: 1, grind: 1, speed: 1 });
    expect(wornness(GEAR.wornFrom)).toBe(0);
    expect(wornness(25)).toBeCloseTo(0.5);
    const dead = gearScale({ deck: 0, shoes: 0, trucks: 0, wheels: 0 });
    expect(dead.ollie).toBeCloseTo(1 - GEAR.max.deck);
    expect(dead.speed).toBeCloseTo(1 - GEAR.max.wheels);
  });

  it('ollies wear the deck, flip tricks the shoes', () => {
    const sim = new FloorSim(levelOf(FLAT));
    for (let f = 0; f < 12; f++) sim.step({ pressed: f === 0 || f === 8, held: true });
    expect(sim.gear.deck).toBeCloseTo(100 - GEAR.ollie);
    expect(sim.gear.shoes).toBeCloseTo(100 - GEAR.flip);
    expect(sim.gear.trucks).toBe(100);
  });

  it('grinding wears the trucks', () => {
    const sim = new FloorSim(levelOf(RAIL));
    sim.skater.x = 17 * TILE;
    for (let f = 0; f < 60; f++) sim.step(pressAt(0, 40)(f));
    expect(sim.skater.mode).toBe('grind');
    expect(sim.gear.trucks).toBeLessThan(100);
  });

  it('going fast wears the wheels, cruising does not', () => {
    const sim = new FloorSim(levelOf(FLAT));
    for (let f = 0; f < 30; f++) sim.step({ pressed: false, held: false });
    expect(sim.gear.wheels).toBe(100);
    sim.skater.carry = PHYS.bombSpeed;
    sim.skater.hsp = PHYS.bombSpeed;
    for (let f = 0; f < 30; f++) sim.step({ pressed: false, held: false });
    expect(sim.gear.wheels).toBeLessThan(100);
  });

  it('a worn deck pops lower, and the floor starts from the gear you bring', () => {
    const pop = (deck: number) => {
      const sim = new FloorSim(levelOf(FLAT), undefined, 0, [], { ...freshGear(), deck });
      sim.step({ pressed: true, held: true });
      return sim.skater.vsp;
    };
    //one step in, gravity has had a frame
    expect(pop(0) - PHYS.grav).toBeCloseTo(PHYS.ollie * (1 - GEAR.max.deck));
    expect(pop(100) - PHYS.grav).toBeCloseTo(PHYS.ollie);
  });

  it('calls out a part when it wears past half and when it is nearly gone', () => {
    expect(crossed(51, 49)).toBe('worn');
    expect(crossed(16, 14)).toBe('busted');
    expect(crossed(40, 39)).toBeNull();
    const sim = new FloorSim(levelOf(FLAT), undefined, 0, [], { ...freshGear(), deck: GEAR.wornFrom + GEAR.ollie / 2 });
    sim.step({ pressed: true, held: true });
    expect(sim.events).toContainEqual({ type: 'wear', part: 'deck', level: 'worn' });
  });

  it('the shop replaces a worn part for its price, not a fresh one', () => {
    const worn = { ...freshGear(), shoes: 20 };
    expect(replace(worn, 100, 'shoes')).toEqual({ gear: freshGear(), cash: 100 - GEAR.price.shoes });
    expect(replace(worn, 5, 'shoes')).toBeNull();
    expect(replace(worn, 100, 'deck')).toBeNull();
  });
});
