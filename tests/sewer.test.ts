// The sewer route (src/gen/sewer.ts): zack (2026-10-31), "sky surface ground. these are the three routes our game
// should have". An open drain drops you into a tunnel under the street; an outlet ramp brings you back up.
import { describe, expect, it } from 'vitest';
import { validatedFloor } from '../src/gen/validate';
import { floorTwist } from '../src/gen/twists';
import { SEWER } from '../src/gen/sewer';
import { FloorSim } from '../src/sim/floor';
import { Pilot } from '../src/bot/pilot';
import { PHYS, TILE } from '../src/physics/constants';
import { isStreetAt, SEWER_ROOF, type Level } from '../src/physics/level';

const floorOf = (seed: number, floor: number): Level => validatedFloor(seed, floor, { twist: floorTwist(seed, floor), hills: true, danger: 2 }).level;

// roll up to the first sewer's drain and let the sim run, pressing on the given frames (held for 20)
function dropIn(level: Level, presses: number[] = [], frames = 900) {
  const w = level.sewers![0];
  const sim = new FloorSim({ ...level, startX: w.drain[0] - 3 * TILE, startY: level.streetY });
  const events: string[] = [];
  let top = Infinity;
  for (let f = 0; f < frames && sim.state === 'skate' && sim.skater.x < w.x1 + 2 * TILE; f++) {
    sim.step({ pressed: presses.includes(f), held: presses.some((p) => f >= p && f < p + 20) });
    for (const e of sim.events) events.push(e.type === 'sewer' ? `sewer:${e.down}` : e.type);
    if (sim.down && presses.length && f >= presses[0] && f < presses[0] + 40) top = Math.min(top, sim.skater.y);
  }
  return { sim, w, events, top };
}

describe('the sewer route', () => {
  it('floors with hills get one under a street chase, with its holes in the street', () => {
    //(about 1 layout in 13 has no stretch of unbroken street long enough for one: 7 of 90 floors, before and after the
    //sky route's level design pass, 2026-10-31)
    let floors = 0;
    let dug = 0;
    for (let s = 1; s <= 4; s++) {
      for (const floor of [1, 4, 7]) {
        const level = floorOf(s * 7919, floor);
        floors++;
        if (level.sewers?.length) dug++;
        for (const w of level.sewers ?? []) {
          expect(w.y).toBe(level.streetY + SEWER.depth);
          expect(isStreetAt(level, (w.drain[0] + w.drain[1]) / 2)).toBe(false);
          expect(isStreetAt(level, (w.outlet[0] + w.outlet[1]) / 2)).toBe(false);
          expect(isStreetAt(level, (w.drain[1] + w.outlet[0]) / 2)).toBe(true);
        }
      }
    }
    expect(dug).toBeGreaterThanOrEqual(floors - 2);
  });

  it('rolling into the drain drops you in, and the outlet ramp brings you back up without a slam', () => {
    const { sim, events } = dropIn(floorOf(7919, 1));
    expect(events).toContain('sewer:true');
    expect(events).toContain('sewer:false');
    expect(events).not.toContain('slam');
    expect(sim.state).toBe('skate');
    expect(sim.skater.y).toBe(sim.level.streetY);
  });

  it('the street is its roof: a quick double tap bumps your head', () => {
    const level = floorOf(7919, 1);
    const w = level.sewers![0];
    const sim = new FloorSim({ ...level, startX: w.drain[0] - 3 * TILE, startY: level.streetY });
    //roll in, and once down on the floor, pop and flip at once
    let at = -1;
    let top = Infinity;
    for (let f = 0; f < 600 && (at < 0 || f < at + 40); f++) {
      const sk = sim.skater;
      if (at < 0 && sim.down && sk.mode === 'roll' && sk.x > w.drain[1] + TILE) at = f + 30; // (past the landing's lockout)
      const press = at >= 0 && (f === at || f === at + 3);
      sim.step({ pressed: press, held: at >= 0 && f >= at && f < at + 20 });
      if (at >= 0 && f >= at) top = Math.min(top, sim.skater.y);
    }
    expect(at).toBeGreaterThan(0);
    expect(top).toBeCloseTo(level.streetY + SEWER_ROOF + PHYS.height, 0);
    expect(w.y - top).toBeLessThan(SEWER.depth);
  });

  it('down there the Heat cools', () => {
    const level = floorOf(7919, 1);
    const w = level.sewers![0];
    const sim = new FloorSim({ ...level, startX: w.drain[0] - 3 * TILE, startY: level.streetY });
    sim.heat.value = 60;
    let inside = -1;
    for (let f = 0; f < 600 && sim.skater.x < w.outlet[0]; f++) {
      sim.step({ pressed: false, held: false });
      if (sim.down && inside < 0) inside = sim.heat.value;
    }
    expect(inside).toBeGreaterThan(0);
    expect(sim.heat.value).toBeLessThan(inside - 10);
  });

  it('the sewer bot takes the drains and clears the floor', () => {
    let downs = 0;
    let sewers = 0;
    for (let s = 1; s <= 4; s++) {
      const level = floorOf(s * 7919, 4);
      if (!level.sewers) continue;
      sewers += level.sewers.length;
      const sim = new FloorSim(level);
      const pilot = new Pilot('sewer');
      for (let f = 0; f < 9000 && sim.state === 'skate'; f++) {
        sim.step(pilot.input(sim));
        downs += sim.events.filter((e) => e.type === 'sewer' && e.down).length;
      }
      expect(sim.state).toBe('exit');
    }
    //(it skips some, when it's still in the air from a grind or a hop before one)
    expect(downs).toBeGreaterThanOrEqual(sewers / 3);
  }, 60000);
});
