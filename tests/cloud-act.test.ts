// Act 3, the cloud act (GDD: How a run ends, and the Roadmap's climb, step b; src/gen/clouds.ts CLOUD_ACT): floors
// 7-9 start on a cloud and the cloud layer is the floor, on over the whole floor to just before the gate. No city sky
// under it; fall off and every later stretch has a girder staircase up off its lip, back into the layer. Act 2's
// floors are rooftops all the way, with no clouds over them.
import { describe, expect, it } from 'vitest';
import { validatedFloor } from '../src/gen/validate';
import { rollFork } from '../src/gen/roads';
import { cloudFloor, crestOf, lipOf } from '../src/gen/clouds';
import { groundAt } from '../src/gen/top-route';
import { maxGap, piecesOf } from '../src/gen/sky-line';
import { FloorSim } from '../src/sim/floor';
import { Pilot } from '../src/bot/pilot';
import { TILE } from '../src/physics/constants';
import type { Level } from '../src/physics/level';

const floorOf = (seed: number, floor: number): Level => validatedFloor(seed, floor, { hills: true, fork: rollFork(seed, floor) }).level;
const CLOUD = new Set(['cloud', 'thin', 'wisp', 'rainbow', 'balloon']);
const startCloud = (l: Level) => l.surfaces.find((s) => s.sky === 'cloud' && s.x0 <= l.startX && s.x1 > l.startX && Math.abs(s.y - l.startY) < 1);
// what the skater's riding, if it's up in the sky
const upOn = (sim: FloorSim): string | undefined => {
  const sk = sim.skater;
  return sk.surface?.sky ?? sk.rail?.sky ?? (sim.sky.pieces.some((p) => p.ledge === sk.surface) ? 'mover' : undefined);
};

describe('act 3, the cloud act', () => {
  it('is floors 7-9 only (Endless reuses acts 4 and 5)', () => {
    expect([1, 4, 6, 7, 8, 9, 10, 13, 16, 19, 22].map(cloudFloor)).toEqual([false, false, false, true, true, true, false, false, false, false, false]);
  });

  it('starts up on a cloud with the layer the whole way; no city sky under it; no clouds over act 2', () => {
    for (let seed = 1; seed <= 3; seed++) {
      for (const f of [7, 8, 9]) {
        const l = floorOf(seed * 61, f);
        const start = startCloud(l);
        expect(start).toBeDefined();
        expect(start!.x1 - l.startX).toBeGreaterThan(8 * TILE);
        //(the city's sky beats stay below, in acts 2 and 4: up here it's the clouds, and the girders up into them)
        expect(l.surfaces.filter((s) => s.sky && !CLOUD.has(s.sky) && s.sky !== 'step')).toHaveLength(0);
        //(the layer runs on to near the gate)
        const clouds = piecesOf(l, 0, l.width).filter((p) => p.cloud);
        expect(Math.max(...clouds.map((p) => p.x1))).toBeGreaterThan(l.exitX - 40 * TILE);
      }
      for (const f of [5, 6]) expect(floorOf(seed * 61, f).surfaces.some((s) => s.sky === 'cloud')).toBe(false);
    }
  }, 60000);

  it("every later stretch has a girder staircase off its lip, a flip a step, that meets the layer", () => {
    for (let seed = 1; seed <= 3; seed++) for (const f of [7, 8, 9]) {
      const l = floorOf(seed * 61, f);
      const layer = piecesOf(l, 0, l.width).filter((p) => p.cloud);
      for (const [a, b] of l.hillSpans!.slice(1)) {
        const [lip, top] = lipOf(l, a, b);
        const steps = l.surfaces.filter((s) => s.sky === 'step' && s.x0 >= lip && s.x0 < b).sort((p, q) => p.x0 - q.x0);
        expect(steps.length).toBeGreaterThan(2);
        //(the first an ollie and a flip off the lip)
        expect(steps[0].x0 - lip).toBeLessThanOrEqual(3 * TILE);
        expect(top - steps[0].y).toBeLessThanOrEqual(1.75 * TILE);
        for (let i = 1; i < steps.length; i++) {
          if (steps[i].x0 > steps[i - 1].x1 + 12 * TILE) break; // the next stretch's
          expect(steps[i - 1].y - steps[i].y).toBeLessThanOrEqual(1.75 * TILE);
          expect(steps[i].x0 - steps[i - 1].x1).toBeLessThanOrEqual(maxGap((steps[i].y - steps[i - 1].y) / TILE) * TILE + 1);
        }
        //(and from one of them, a cloud ahead in reach)
        expect(steps.some((s) => layer.some((p) => p.x0 >= s.x1 - TILE && p.y0 >= s.y - 1.5 * TILE && p.x0 - s.x1 <= maxGap((p.y0 - s.y) / TILE) * TILE))).toBe(true);
      }
    }
  }, 60000);

  it("one set piece a floor up in the clouds: the blimp, the crane's jib or the window washer's rig", () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 6; seed++) for (const f of [7, 8, 9]) {
      const l = floorOf(seed * 53, f);
      const up = (l.skyMovers ?? []).filter((m) => m.cloud);
      expect(up).toHaveLength(1);
      kinds.add(up[0].kind);
      //(on the layer's line, in reach of the cloud before it)
      const line = piecesOf(l, 0, l.width).filter((p) => p.cloud).sort((p, q) => p.x0 - q.x0);
      const at = line.findIndex((p) => p.x0 >= up[0].x0 - 2 * TILE && p.x1 <= up[0].x1 + 2 * TILE);
      expect(at).toBeGreaterThan(0);
      const from = line.slice(0, at).sort((p, q) => q.x1 - p.x1)[0];
      expect(line[at].x0 - from.x1).toBeLessThanOrEqual(maxGap((line[at].y0 - from.y1) / TILE) * TILE + 1);
    }
    expect([...kinds].sort()).toEqual(['blimp', 'rig', 'swing']);
    //the rig drops under you up there too
    const l = floorOf(53, 7);
    const m = l.skyMovers!.find((k) => k.cloud && k.kind === 'rig')!;
    const sim = new FloorSim({ ...l, startX: m.x0 + 8, startY: m.y - 4 });
    const rig = sim.sky.pieces.find((p) => p.site === m)!;
    sim.skater.mode = 'air'; // (dropped onto it: a floor's start would roll on at startY)
    let landed = false;
    for (let k = 0; k < 40; k++) {
      sim.step({ pressed: false, held: false });
      landed ||= sim.skater.surface === rig.ledge;
    }
    expect(landed).toBe(true);
    expect(rig.y).toBeGreaterThan(m.y + TILE);
  }, 60000);

  it('a good player who falls climbs the girders back up into the clouds', () => {
    let made = 0;
    let n = 0;
    for (let seed = 1; seed <= 4; seed++) for (const f of [7, 8, 9]) {
      const l = floorOf(seed * 53, f);
      for (const [a, b] of l.hillSpans!.slice(1)) {
        const [lip] = lipOf(l, a, b);
        const x = Math.max(crestOf(l, a, b), lip - 6 * TILE);
        const sim = new FloorSim({ ...l, startX: x, startY: groundAt(l, x)! });
        sim.skater.hsp = sim.skater.carry = 4;
        const pilot = new Pilot('sky');
        let up = false;
        for (let k = 0; k < 60 * 40 && sim.state === 'skate' && sim.skater.x < b && !up; k++) {
          sim.step(pilot.input(sim));
          up = sim.skater.mode !== 'air' && CLOUD.has(upOn(sim) ?? '');
        }
        n++;
        if (up) made++;
      }
    }
    expect(made / n).toBeGreaterThan(0.85);
  }, 120000);

  it('a good player stays up in the clouds most of the floor', () => {
    let up = 0;
    let ground = 0;
    for (let seed = 1; seed <= 4; seed++) for (const f of [7, 8, 9]) {
      const l = floorOf(seed * 53, f);
      const sim = new FloorSim(l);
      const pilot = new Pilot('sky');
      for (let k = 0; k < 60 * 200 && sim.state === 'skate'; k++) {
        sim.step(pilot.input(sim));
        if (sim.skater.mode === 'air') continue;
        if (upOn(sim)) up++;
        else ground++;
      }
      expect(sim.state).not.toBe('skate');
    }
    expect(up / (up + ground)).toBeGreaterThan(0.75);
  }, 180000);
});
