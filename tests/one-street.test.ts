// One street (zack, 2026-10-24): floors join end to end, and the skater rolls from one into the next at the speed
// and height they crossed at, with no stop and no restart at the top.
import { describe, expect, it } from 'vitest';
import { Pilot } from '../src/bot/pilot';
import { FIRST_ROAD, type Road } from '../src/gen/roads';
import { TILE } from '../src/physics/constants';
import { floorLevel, type FloorSpec } from '../src/run/floor-level';
import { FULL_LIBRARY } from '../src/run/meta';
import { FloorPrefetch, specKey } from '../src/run/prefetch';
import { FloorSim } from '../src/sim/floor';
import type { Level } from '../src/physics/level';

const spec = (floor: number, road: Road = FIRST_ROAD): FloorSpec => ({ seed: 2026, floor, road, library: FULL_LIBRARY, gnar: 0 });

// the ref bot skates `level` from where `from` left it (or the start) to the floor's end, rolling on past the gate
function skate(level: Level, from?: { sim: FloorSim; dx: number; dy: number }): { sim: FloorSim; exitAt: number } {
  const sim = new FloorSim(level);
  sim.rollOn = true;
  if (from) sim.skater.carryOn(from.sim.skater, from.dx, from.dy);
  const pilot = new Pilot('ref');
  let exitAt = -1;
  for (let f = 0; f < 60 * 150 && sim.skater.x < level.width; f++) {
    sim.step(pilot.input(sim));
    if (sim.state === 'exit' && exitAt < 0) exitAt = f;
    expect(sim.state === 'skate' || sim.state === 'exit').toBe(true);
  }
  return { sim, exitAt };
}

describe('one street', () => {
  it('through the gate the skater rolls on to the end of the floor, and the floor is only cleared once', () => {
    const level = floorLevel(spec(1));
    const { sim, exitAt } = skate(level);
    expect(exitAt).toBeGreaterThan(0);
    expect(sim.state).toBe('exit');
    expect(sim.skater.x).toBeGreaterThanOrEqual(level.width);
    expect(sim.skater.mode).not.toBe('exit');
    expect(Math.abs(sim.skater.hsp)).toBeGreaterThan(1);
  });

  it('the next floor picks up where the last one ended: same speed, on its first roof, and it skates through', () => {
    let level = floorLevel(spec(1));
    let run = skate(level);
    for (const floor of [2, 3]) {
      const next = floorLevel(spec(floor));
      const before = run.sim.skater;
      const dx = -level.width;
      const dy = next.startY - level.streetY;
      const after = skate(next, { sim: run.sim, dx, dy });
      //the handover itself: same speed, and standing on the next floor's top at the same height on screen
      const sk = new FloorSim(next).skater;
      sk.carryOn(before, dx, dy);
      expect(sk.hsp).toBe(before.hsp);
      expect(sk.x).toBeCloseTo(before.x - level.width);
      expect(sk.x).toBeLessThan(next.startX);
      if (before.mode === 'roll') {
        expect(sk.mode).toBe('roll');
        expect(sk.y).toBe(next.startY);
      }
      expect(after.exitAt).toBeGreaterThan(0);
      level = next;
      run = after;
    }
  });

  it('a floor joins on flat to an escape or the tutorial (street level to street level)', () => {
    const third = floorLevel(spec(3));
    const escape = floorLevel(spec(3, { kind: 'escape', act: 1, danger: 3 }));
    expect(escape.startY).toBe(escape.streetY);
    const run = skate(third);
    const next = skate(escape, { sim: run.sim, dx: -third.width, dy: escape.startY - third.streetY });
    expect(next.exitAt).toBeGreaterThan(0);
  });

  it('in the air at the join, the skater stays in the air and lands on the next floor', () => {
    const level = floorLevel(spec(1));
    const next = floorLevel(spec(2));
    const sim = new FloorSim(level);
    sim.rollOn = true;
    sim.skater.x = level.width - 4;
    sim.skater.y = level.streetY - 30;
    sim.skater.mode = 'air';
    sim.skater.vsp = -2;
    sim.skater.hsp = 5;
    sim.skater.surface = null;
    const on = new FloorSim(next);
    on.skater.carryOn(sim.skater, -level.width, next.startY - level.streetY);
    expect(on.skater.mode).toBe('air');
    expect(on.skater.y).toBeCloseTo(next.startY - 30);
    for (let f = 0; f < 120 && on.skater.mode === 'air'; f++) on.step({ pressed: false, held: false });
    expect(on.skater.mode).toBe('roll');
    expect(on.skater.y).toBe(next.startY);
  });

  it('floors come from the prefetch exactly as floorLevel builds them (no worker in tests: built on the spot)', () => {
    const pf = new FloorPrefetch(false);
    const s = spec(4, { kind: 'cash', danger: 2 });
    const key = pf.want(s);
    expect(key).toBe(specKey(s));
    expect(pf.ready(s)).toBeNull();
    const level = pf.get(s);
    expect(level.width).toBe(floorLevel(s).width);
    expect(pf.ready(s)).toBe(level);
    pf.keep([]);
    expect(pf.ready(s)).toBeNull();
    expect(level.width / TILE).toBeGreaterThan(50);
  });
});
