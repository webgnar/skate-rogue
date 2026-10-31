import { describe, expect, it } from 'vitest';
import { crossed, freshGear, GEAR, gearScale, replace, wornness } from '../src/run/gear';
import { PHYS, TILE } from '../src/physics/constants';
import { FloorSim } from '../src/sim/floor';
import { FLAT, levelOf, pressAt, withExtras } from './helpers';
import { FEEL } from '../src/physics/feel';

const GLASS = [
  '................', '................', '................', '................', '................',
  '................', '................', '................', '......^^........', '################',
];

const RAIL = [
  '................', '................', '................', '................', '................',
  '................', '................', '................', '..============..', '################',
];

describe('gear wear', () => {
  it('fresh gear and gear down to half cost nothing; worn gear costs more the closer it gets to 0', () => {
    expect(gearScale(freshGear())).toEqual({ ollie: 1, trick: 1, grind: 1, speed: 1, grip: 1 });
    expect(wornness(GEAR.wornFrom)).toBe(0);
    expect(wornness(25)).toBeCloseTo(0.5);
    const dead = gearScale({ deck: 0, shoes: 0, trucks: 0, wheels: 0, bearings: 0 });
    expect(dead.ollie).toBeCloseTo(1 - GEAR.max.deck);
    expect(dead.speed).toBeCloseTo((1 - GEAR.max.wheels) * (1 - GEAR.max.bearings));
    expect(dead.grip).toBe(0);
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
    //one step in, the pop's gravity has had a frame (it snaps up: PHYS.popSnap)
    const g = PHYS.grav * PHYS.popSnap ** 2;
    expect(pop(0) - g).toBeCloseTo(PHYS.ollie * PHYS.popSnap * (1 - GEAR.max.deck));
    expect(pop(100) - g).toBeCloseTo(PHYS.ollie * PHYS.popSnap);
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

  it('bearings drive your speed far more than wheels do', () => {
    const speed = (g: Partial<ReturnType<typeof freshGear>>) => gearScale({ ...freshGear(), ...g }).speed;
    expect(1 - speed({ bearings: 0 })).toBeGreaterThan(2 * (1 - speed({ wheels: 0 })));
    expect(speed({ bearings: GEAR.wornFrom })).toBe(1);
  });

  it('rolling works grit into the bearings, slowly', () => {
    const sim = new FloorSim(levelOf(FLAT));
    for (let f = 0; f < 60; f++) sim.step({ pressed: false, held: false });
    expect(sim.gear.bearings).toBeCloseTo(100 - GEAR.rollSec, 5);
  });

  it('wheels at least half fresh roll over broken glass and take a chunk of wear; worn ones slam', () => {
    const over = (wheels: number) => {
      const sim = new FloorSim(levelOf(GLASS), undefined, 0, [], { ...freshGear(), wheels });
      const seen: string[] = [];
      //(levelOf repeats the layout: the first glass is 22 tiles in, the next 16 past it)
      for (let f = 0; f < 260; f++) {
        sim.step({ pressed: false, held: false });
        seen.push(...sim.skater.events.map((e) => e.type), ...sim.events.map((e) => e.type));
      }
      return { seen, wheels: sim.gear.wheels };
    };
    const fresh = over(100);
    expect(fresh.seen).toContain('glass');
    expect(fresh.seen).not.toContain('slam');
    expect(fresh.wheels).toBeCloseTo(100 - GEAR.glass, 5);
    const worn = over(GEAR.roughFrom - 1);
    expect(worn.seen).toContain('slam');
    expect(worn.seen).not.toContain('glass');
  });

  it('hard landings wear the deck the most, and more when they cost you speed', () => {
    const street = levelOf(FLAT).streetY;
    const drop = (tiles: number, hsp: number, carry: number) => {
      const y = street - tiles * TILE;
      const sim = new FloorSim(withExtras([{ kind: 'roof', x0: 0, x1: 2 * TILE, y, row: -1 }], [], { x: TILE, y }));
      sim.skater.hsp = hsp;
      sim.skater.carry = carry;
      let land: { impact?: number; lost?: number } | undefined;
      for (let f = 0; f < 240 && !land; f++) {
        sim.step({ pressed: false, held: false });
        land = sim.events.find((e) => e.type === 'land');
      }
      return { deck: 100 - sim.gear.deck, land: land! };
    };
    const small = drop(1, PHYS.baseSpeed, 0);
    const big = drop(6, PHYS.baseSpeed, 0);
    expect(small.land.impact!).toBeLessThan(FEEL.soft);
    expect(small.deck).toBeCloseTo(0);
    expect(big.deck).toBeGreaterThan(GEAR.ollie * 3); // one big drop beats three ollies
    //the same drop carrying rail speed: the landing scrubs it, and that wears the deck more
    const fast = drop(6, PHYS.bombSpeed, PHYS.bombSpeed);
    expect(fast.land.lost!).toBeGreaterThan(0);
    expect(fast.deck).toBeGreaterThan(big.deck);
  });

  it('smashing dusty or glassy props and rolling over broken glass grits the bearings', () => {
    const sim = new FloorSim(levelOf(GLASS));
    for (let f = 0; f < 260; f++) sim.step({ pressed: false, held: false });
    expect(100 - sim.gear.bearings).toBeCloseTo(GEAR.smashGrit + (260 * GEAR.rollSec) / 60, 1);
  });
});
