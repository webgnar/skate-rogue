// Supply pickups (GDD: Gear and wear, zack 2026-11-06): a fixed part, spinning ahead, only for gear that's sat busted
import { describe, expect, it } from 'vitest';
import { GEAR, freshGear } from '../src/run/gear';
import { FloorSim } from '../src/sim/floor';
import { noBustedTime, overdue, SUPPLY, supplyChance } from '../src/sim/supply';
import { validatedFloor } from '../src/gen/validate';
import { floorTwist } from '../src/gen/twists';
import { Pilot } from '../src/bot/pilot';
import { FLAT, levelOf } from './helpers';

const busted = { deck: 0, shoes: 100, trucks: 100, wheels: 100, bearings: 100 };

describe('supply pickups', () => {
  it('only a busted part is overdue, the one busted longest first', () => {
    expect(overdue(freshGear(), { ...noBustedTime(), deck: 99 })).toBeNull();
    expect(overdue({ ...busted, wheels: 10 }, { ...noBustedTime(), deck: 20, wheels: 50 })).toBe('wheels');
    expect(supplyChance(0)).toBe(0);
    expect(supplyChance(SUPPLY.fullAfter / 2)).toBeCloseTo(SUPPLY.perSecond / 2);
    expect(supplyChance(SUPPLY.fullAfter * 3)).toBeCloseTo(SUPPLY.perSecond);
  });

  it('the clock runs while a part is busted and stops when it is not', () => {
    const sim = new FloorSim(levelOf(FLAT), undefined, 0, [], busted);
    for (let f = 0; f < 120; f++) sim.step({ pressed: false, held: false });
    expect(sim.bustedSec.deck).toBeCloseTo(2, 1);
    expect(sim.bustedSec.shoes).toBe(0);
  });

  //a floor's run with a busted deck, carried from the floor before: the bot rides past them all, so count spawns
  const spawns = (gear: typeof busted, sec: number) => {
    let n = 0;
    for (let s = 1; s <= 8; s++) {
      const seed = s * 7919;
      const sim = new FloorSim(validatedFloor(seed, 7, { twist: floorTwist(seed, 7), hills: true, danger: 2 }).level, undefined, 0, [], gear);
      sim.bustedSec = { ...noBustedTime(), deck: sec };
      const pilot = new Pilot('ref', seed);
      let had = false;
      for (let f = 0; f < 60 * 90 && sim.state === 'skate'; f++) {
        sim.step(pilot.input(sim));
        if (sim.supply && !had) {
          n++;
          expect(sim.supply.part).toBe('deck');
          expect(sim.supply.x).toBeGreaterThan(sim.skater.x); // ahead, where you can see it coming
        }
        had = !!sim.supply;
      }
    }
    return n;
  };

  it('turns up for gear left busted, about once a floor, and never for good gear', () => {
    expect(spawns(freshGear(), 0)).toBe(0);
    const n = spawns(busted, 2 * SUPPLY.fullAfter);
    expect(n).toBeGreaterThan(2);
    expect(n).toBeLessThan(20);
  }, 120000);

  it('grabbing it fits that part fresh and resets its clock', () => {
    const sim = new FloorSim(levelOf(FLAT), undefined, 0, [], busted);
    sim.bustedSec = { ...noBustedTime(), deck: 30 };
    const sk = sim.skater;
    sim.supply = { part: 'deck', x: sk.x + 2, y: sk.y - 24 };
    sim.step({ pressed: false, held: false });
    expect(sim.events.some((e) => e.type === 'supply' && e.part === 'deck')).toBe(true);
    expect(sim.gear.deck).toBe(100);
    expect(sim.bustedSec.deck).toBe(0);
    expect(sim.supply).toBeNull();
    expect(GEAR.busted).toBeGreaterThan(0);
  });
});
