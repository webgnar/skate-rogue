import { describe, expect, it } from 'vitest';
import { buildFloor } from '../src/gen/descent';
import { PHYS, TILE } from '../src/physics/constants';
import { puddleSpots } from '../src/render/puddles';
import { GEAR } from '../src/run/gear';
import { FloorSim } from '../src/sim/floor';

describe('puddles wear the deck', () => {
  const rolling = () => {
    const sim = new FloorSim(buildFloor(9, 1));
    sim.traffic.vehicles.length = 0;
    const sk = sim.skater;
    // a full puddle on the ground just ahead
    sim.puddles = [{ x: sk.x + 3 * TILE, y: sk.y, w: 1.5 * TILE, delay: -100, grow: 8, k: 1 }];
    sk.hsp = PHYS.baseSpeed;
    return sim;
  };

  it('rolling through a formed puddle soaks the deck once, with a puddle event', () => {
    const sim = rolling();
    const sk = sim.skater;
    const deck = sim.gear.deck;
    let splashes = 0;
    for (let i = 0; i < 90 && sk.mode === 'roll'; i++) {
      sim.step({ pressed: false, held: false });
      splashes += sim.events.filter((e) => e.type === 'puddle').length;
    }
    expect(sk.x).toBeGreaterThan(sim.puddles[0].x + sim.puddles[0].w); // rolled right through it
    expect(splashes).toBe(1);
    expect(deck - sim.gear.deck).toBeCloseTo(GEAR.puddle, 5);
  });

  it('a puddle still forming, or one you ollie over, does nothing', () => {
    const forming = rolling();
    forming.puddles[0].delay = 1000;
    const over = rolling();
    for (let i = 0; i < 90; i++) {
      forming.step({ pressed: false, held: false });
      over.step({ pressed: i === 0, held: i < 20 });
      expect([...forming.events, ...over.events].some((e) => e.type === 'puddle')).toBe(false);
    }
  });

  it("a rainy floor has 5 to 15 puddles: rolling through every one costs about a floor's worth of ollies", () => {
    let most = 0;
    for (let seed = 1; seed <= 8; seed++) for (let floor = 1; floor <= 4; floor++) {
      const level = buildFloor(seed, floor);
      most = Math.max(most, puddleSpots(level, seed, floor).length);
    }
    expect(most * GEAR.puddle).toBeLessThan(65); // 20 before the 2026-10-30 wear tuning made all wear about 3x
  });
});
