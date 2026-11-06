// Act 2, the rooftops (GDD: How a run ends, and the Roadmap's climb, step a; src/gen/sky-beats.ts ROOFTOPS): floors
// 4-6 start up on a roof, each later stretch's roofs start an ollie up off the lip at the top of its cable car, and a
// good player can stay up there to the overpass past the gate. The street, the sewer and the sky over the roofs
// stay where they were.
import { describe, expect, it } from 'vitest';
import { validatedFloor } from '../src/gen/validate';
import { rollFork } from '../src/gen/roads';
import { lipOf } from '../src/gen/clouds';
import { rooftopFloor } from '../src/gen/sky-beats';
import { FloorSim } from '../src/sim/floor';
import { Pilot } from '../src/bot/pilot';
import { TILE } from '../src/physics/constants';
import type { Level } from '../src/physics/level';

const floorOf = (seed: number, floor: number): Level => validatedFloor(seed, floor, { hills: true, fork: rollFork(seed, floor) }).level;
const startRoof = (l: Level) => l.surfaces.find((s) => s.sky === 'roofs' && s.x0 <= l.startX && s.x1 > l.startX && Math.abs(s.y - l.startY) < 1);

describe('act 2, the rooftops', () => {
  it('is floors 4-6 only (Endless reuses acts 4 and 5)', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 10, 13, 16, 19, 22].map(rooftopFloor)).toEqual([false, false, false, true, true, true, false, false, false, false, false, false]);
  });

  it('starts up on a roof over the street; act 1 starts on the street', () => {
    for (let seed = 1; seed <= 3; seed++) {
      for (const f of [4, 5, 6]) {
        const l = floorOf(seed * 61, f);
        const roof = startRoof(l);
        expect(roof).toBeDefined();
        //(up over the hill's run-up, with room to roll before its end)
        expect(roof!.x1 - l.startX).toBeGreaterThan(8 * TILE);
      }
      expect(startRoof(floorOf(seed * 61, 2))).toBeUndefined();
    }
  }, 60000);

  it("every later stretch's roofs start an ollie up off its lip", () => {
    for (let seed = 1; seed <= 3; seed++) for (const f of [4, 5, 6]) {
      const l = floorOf(seed * 61, f);
      for (const [a, b] of l.hillSpans!.slice(1)) {
        const [lip, top] = lipOf(l, a, b);
        const first = l.surfaces.filter((s) => s.sky === 'roofs' && s.x0 >= lip).sort((p, q) => p.x0 - q.x0)[0];
        expect(first).toBeDefined();
        expect(first.x0 - lip).toBeLessThanOrEqual(3 * TILE);
        expect(top - first.y).toBeGreaterThan(0);
        expect(top - first.y).toBeLessThan(1.25 * TILE); // under a plain ollie's 1.56 tiles
      }
    }
  }, 60000);

  it('a good player stays up on the roofs and takes the overpass past the gate', () => {
    let high = 0;
    let n = 0;
    for (let seed = 1; seed <= 4; seed++) for (const f of [4, 5, 6]) {
      const l = floorOf(seed * 53, f);
      const sim = new FloorSim(l);
      const pilot = new Pilot('sky');
      let up = 0;
      let ground = 0;
      for (let k = 0; k < 60 * 150 && sim.state === 'skate'; k++) {
        sim.step(pilot.input(sim));
        const sk = sim.skater;
        if (sk.mode === 'air' || sk.x > l.hillSpans![0][1]) continue;
        if (sk.surface?.sky || sk.rail?.sky || sk.rail?.top || sim.sky.pieces.some((p) => p.ledge === sk.surface)) up++;
        else ground++;
      }
      n++;
      if (sim.state === 'exit' && sim.road === 'high') high++;
      //(down the first stretch, from the roof it starts on, mostly up there)
      expect(up / Math.max(1, up + ground)).toBeGreaterThan(0.6);
    }
    expect(high / n).toBeGreaterThan(0.6);
  }, 120000);
});
