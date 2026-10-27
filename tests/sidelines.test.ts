import { describe, expect, it } from 'vitest';
import { PHYS, TILE } from '../src/physics/constants';
import { botRun, validatedFloor } from '../src/gen/validate';
import { SIDE } from '../src/gen/sidelines';
import { FloorSim } from '../src/sim/floor';

const floors = (floor: number, n = 10) => Array.from({ length: n }, (_, s) => validatedFloor((s + 1) * 97, floor).level);

describe('side lines', () => {
  it('turn up on most floors from floor 2, clear of anything tall, with a Stoken at the top', () => {
    for (const l of floors(1)) expect(l.surfaces.some((s) => s.side)).toBe(false);
    const ls = floors(5, 20); // (12 was too few: which roll of a floor validates shifts with the feel, 2026-10-27)
    const withLine = ls.filter((l) => l.surfaces.some((s) => s.side));
    expect(withLine.length).toBeGreaterThan(6);
    for (const l of withLine) {
      const line = l.surfaces.filter((s) => s.side);
      expect(line).toHaveLength(SIDE.steps.length);
      const x0 = line[0].x0;
      const x1 = line[line.length - 1].x1;
      expect(l.cars.some((c) => c.x1 > x0 && c.x0 < x1 && (c.model || c.roof < l.streetY - SIDE.clear))).toBe(false);
      expect(l.pickups.some((p) => p.kind === 'stoken' && p.x > x0 && p.x < x1 && p.y < line[line.length - 1].y)).toBe(true);
    }
  });

  it('an ollie and a flip from the street gets you onto it, and plain ollies take you along it', () => {
    const l = floors(5, 12).find((l) => l.surfaces.some((s) => s.side))!;
    const line = l.surfaces.filter((s) => s.side);
    let best = 0;
    for (let d = 0; d <= 8 * TILE && best < line.length; d += 8) {
      const sim = new FloorSim(l);
      sim.traffic.vehicles.length = 0;
      Object.assign(sim.skater, { x: line[0].x0 - d, y: l.streetY, surface: null, mode: 'roll', hsp: PHYS.baseSpeed });
      let reached = 0;
      let wasAir = false;
      for (let f = 0; f < 600 && sim.skater.x < line[line.length - 1].x1; f++) {
        const sk = sim.skater;
        const on = line.indexOf(sk.surface!);
        if (on >= 0) reached = Math.max(reached, on + 1);
        //the ollie at once (and at each ledge's end), the flip at the top of it
        const press = f === 0 || (on >= 0 && sk.x > sk.surface!.x1 - 12 && sk.mode === 'roll') || (sk.mode === 'air' && wasAir && sk.vsp >= 0 && sk.jumps > 0 && reached === 0);
        wasAir = sk.mode === 'air';
        sim.step({ pressed: press, held: true });
      }
      best = Math.max(best, reached);
    }
    expect(best).toBe(line.length);
  });

  it('the no-boon bot still clears floors with them', () => {
    for (const l of floors(5, 6)) expect(botRun(l).result).toBe('exit');
  });
});
