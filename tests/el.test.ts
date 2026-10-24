import { describe, expect, it } from 'vitest';
import { buildFloor } from '../src/gen/descent';
import { EL, ElTrain, elPlan, pathAt, pathLength } from '../src/traffic/el';
import { TILE } from '../src/physics/constants';
import { Skater } from '../src/physics/skater';
import { FloorSim } from '../src/sim/floor';
import type { Level } from '../src/physics/level';

const chicago = (seed: number, floor: number) => buildFloor(seed, floor, undefined, { hills: true });

describe('the L', () => {
  it('runs over every Chicago street floor, with a parked car under its start to hop up from', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const l = chicago(seed, 1 + (seed % 6));
      expect(l.el?.length).toBeGreaterThan(0);
      for (const s of l.el!) {
        expect(l.surfaces.some((r) => r.el && r.x0 === s.x0 && r.x1 === s.x1 && r.kind === 'rail')).toBe(true);
        expect(l.cars.some((c) => !c.model && c.x0 < s.x0 && c.x1 >= s.x0 - TILE)).toBe(true);
        expect(s.x0).toBeGreaterThan(l.finaleX);
        expect(s.x1).toBeLessThan(l.exitX);
      }
    }
  });

  it('is not on other districts, escapes or the tutorial', () => {
    expect(buildFloor(3, 2).el).toBeUndefined();
  });

  it('can be reached from the street: ollie onto the parked car, and its hop and a flip carry you up onto the rails', () => {
    const l = chicago(4, 2);
    const s = l.el![0];
    const car = l.cars.find((c) => !c.model && c.x0 < s.x0 && c.x1 >= s.x0 - TILE)!;
    let reached = false;
    //try the ollie a few frames apart, and the flip anywhere after the hop
    for (let ollie = 0; ollie < 30 && !reached; ollie += 2) {
      for (let flip = 4; flip < 40 && !reached; flip += 2) {
        const sk = new Skater({ ...l, startX: car.x0 - 4 * TILE, startY: l.streetY } as Level);
        let hopAt = -1;
        for (let f = 0; f < 160; f++) {
          sk.step({ pressed: f === ollie || (hopAt >= 0 && f === hopAt + flip), held: f >= ollie });
          if (hopAt < 0 && sk.events.some((e) => e.type === 'hop')) hopAt = f;
          sk.events.length = 0;
          if (sk.mode === 'grind' && sk.surface?.el) reached = true;
        }
      }
    }
    expect(reached).toBe(true);
  });

  it('a bus fits under it', () => {
    const l = chicago(4, 2);
    expect(l.streetY - l.el![0].under).toBeGreaterThan(72);
  });

  it("trains run its path: round the bend, along the stretch your way, round the far bend, then the next one", () => {
    const l = chicago(4, 2);
    const s = l.el![0];
    const t = new ElTrain(s);
    t.step(s.trigger - 1);
    expect(t.nose).toBeNull();
    let onStretch = 0;
    let seenAgain = false;
    let gone = false;
    for (let f = 0; f < EL.period * 2 + 10; f++) {
      t.step(s.trigger);
      const boxes = t.inLane;
      if (boxes.length) onStretch++;
      for (const b of boxes) {
        expect(b.x0).toBeGreaterThanOrEqual(s.x0);
        expect(b.x1).toBeLessThanOrEqual(s.x1);
        expect(b.bottom).toBe(s.y);
      }
      if (t.nose === null) gone = true;
      else if (gone) seenAgain = true;
    }
    expect(onStretch).toBeGreaterThan(60);
    expect(seenAgain).toBe(true);
  });

  it("its path joins up: the straight is the stretch, the bends lead back into the city", () => {
    const s = chicago(4, 2).el![0];
    const len = pathLength(s);
    let prev = pathAt(s, 0);
    for (let d = 0.25; d <= len; d += 0.25) {
      const p = pathAt(s, d);
      expect(Math.hypot(p.x - prev.x, p.z - prev.z)).toBeLessThan(0.3);
      prev = p;
    }
    expect(pathAt(s, 0).z).toBeLessThan(-8);
    expect(pathAt(s, len).z).toBeLessThan(-8);
    const mid = pathAt(s, len / 2);
    expect(mid.z).toBeCloseTo(EL.lane);
    expect(mid.heading).toBe(0);
  });

  it('the floor sim puts the trains in your way', () => {
    const l = chicago(4, 2);
    const sim = new FloorSim(l);
    expect(sim.trains.length).toBe(l.el!.length);
    elPlan; // planned at build time
  });
});
