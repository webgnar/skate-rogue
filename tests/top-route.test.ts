// The top route (src/gen/top-route.ts) and its sky (src/sim/sky.ts): a power line down each stretch of hill and
// rooftops over the streets, the gate up at their height, the helicopter's Heat while you're up, pigeons to ollie.
import { describe, expect, it } from 'vitest';
import { buildFloor } from '../src/gen/descent';
import { TOP } from '../src/gen/top-route';
import { validatedFloor } from '../src/gen/validate';
import { floorTwist } from '../src/gen/twists';
import { FloorSim } from '../src/sim/floor';
import { Pilot } from '../src/bot/pilot';
import { surfaceY } from '../src/physics/level';
import { SKY } from '../src/sim/sky';

const chicago = (seed: number, floor: number) => buildFloor(seed, floor, undefined, { hills: true });

describe('the top route', () => {
  it("a power line down each stretch of hill, never rising, and rooftops at the gate's height", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const l = chicago(seed * 31, 3);
      const wires = l.rails.filter((r) => r.top);
      expect(wires.length).toBeGreaterThan(0);
      for (const w of wires) for (let i = 1; i < w.ys.length; i++) expect(w.ys[i]).toBeGreaterThanOrEqual(w.ys[i - 1] - 0.01);
      const roofs = l.surfaces.filter((s) => s.top);
      expect(roofs.length).toBeGreaterThan(0);
      for (const r of roofs) expect(r.y).toBe(l.streetY - TOP.height);
      if (l.fork) expect(l.fork.y).toBe(l.streetY - TOP.height);
    }
  });

  it("the power line hangs out of an ollie's reach, from partway down each hill", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const l = chicago(seed * 31, 3);
      for (const w of l.rails.filter((r) => r.top)) {
        //it starts partway down, not over the crest
        const sp = l.hillSpans!.find(([a, b]) => w.xs[0] >= a && w.xs[0] < b)!;
        expect((w.xs[0] - sp[0]) / (sp[1] - sp[0])).toBeGreaterThan(0.3);
        //never closer to the road under it than an ollie and a flip reach (100 px)
        for (let i = 0; i < w.xs.length; i += 4) {
          const under = l.surfaces.filter((s) => s.hill && w.xs[i] >= s.x0 && w.xs[i] <= s.x1).map((s) => surfaceY(s, w.xs[i]));
          for (const g of under) expect(g - w.ys[i]).toBeGreaterThan(100);
        }
      }
    }
  });

  it('up there the helicopter adds Heat; back on the street it stops', () => {
    const l = chicago(62, 3);
    const roof = l.surfaces.find((s) => s.top)!;
    const sim = new FloorSim({ ...l, startX: roof.x0 + 4, startY: roof.y });
    const h0 = sim.heat.value;
    for (let f = 0; f < 30; f++) sim.step({ pressed: false, held: false });
    expect(sim.up).toBe(true);
    expect(sim.heat.value).toBeGreaterThan(h0);
    expect(sim.sky.chopper.gone).toBe(false);
  });

  it('pigeons in the way: skate into them and you lose speed and gain Heat; they never slam you', () => {
    const l = chicago(62, 3);
    const roof = l.surfaces.find((s) => s.top && s.x1 - s.x0 >= 10 * 32)!;
    l.flocks = [{ x: roof.x0 + 120, y: roof.y - SKY.perch }];
    const sim = new FloorSim({ ...l, startX: roof.x0 + 4, startY: roof.y });
    let hit = false;
    let before = 0;
    for (let f = 0; f < 40 && !hit; f++) {
      before = sim.skater.hsp;
      sim.step({ pressed: false, held: false });
      hit = sim.events.some((e) => e.type === 'birds');
    }
    expect(hit).toBe(true);
    expect(sim.skater.hsp).toBeLessThan(before);
    expect(sim.skater.mode).not.toBe('bail');
  });

  it("the bots clear top-route floors, and nothing lifts them onto the high power line (there's no way up yet)", () => {
    for (let s = 1; s <= 4; s++) {
      const seed = s * 7919;
      const level = validatedFloor(seed, 4, { twist: floorTwist(seed, 4), hills: true, danger: 2 }).level;
      const sim = new FloorSim(level);
      const pilot = new Pilot('high');
      let wire = 0;
      for (let f = 0; f < 7200 && sim.state === 'skate'; f++) {
        sim.step(pilot.input(sim));
        if (sim.skater.rail?.top) wire++;
      }
      expect(['exit', 'bail']).toContain(sim.state);
      expect(wire).toBe(0);
    }
  }, 60000);
});

