// Acts 4 and 5 (GDD: How a run ends, and the Roadmap's climb, step d; src/gen/clouds.ts HIGH): above the clouds and
// space. The layer runs the whole floor as in act 3, higher, its gaps and rises grown for the act's lighter gravity,
// with blimps and skyscraper crowns in act 4. No city sky under it.
import { describe, expect, it } from 'vitest';
import { validatedFloor } from '../src/gen/validate';
import { rollFork } from '../src/gen/roads';
import { crestOf, HIGH, layerAct, layerScale, lipOf } from '../src/gen/clouds';
import { groundAt } from '../src/gen/top-route';
import { piecesOf } from '../src/gen/sky-line';
import { actOf } from '../src/gen/escape';
import { actGravity } from '../src/physics/feel';
import { FloorSim } from '../src/sim/floor';
import { Pilot } from '../src/bot/pilot';
import { TILE } from '../src/physics/constants';
import type { Level } from '../src/physics/level';

declare const process: { env: Record<string, string | undefined>; stderr: { write(s: string): void } };
const floorOf = (seed: number, floor: number): Level => validatedFloor(seed, floor, { hills: true, fork: rollFork(seed, floor), gravity: actGravity(actOf(floor)) }).level;
const LAYER = new Set(['cloud', 'thin', 'wisp', 'rainbow', 'balloon', 'spire', 'stairs', 'landing']);
const upOn = (sim: FloorSim): string | undefined => {
  const sk = sim.skater;
  return sk.surface?.sky ?? sk.rail?.sky ?? (sim.sky.pieces.some((p) => p.ledge === sk.surface) ? 'mover' : undefined);
};
const log = (s: string) => process.env.HIGH_LOG && process.stderr.write(s + '\n');

describe('acts 4 and 5, above the clouds and space', () => {
  it('are floors 10-12 and 13-15, their gaps grown 1 / gravity', () => {
    expect([7, 9, 10, 12, 13, 15, 16, 22].map(layerAct)).toEqual([3, 3, 4, 4, 5, 5, 0, 0]);
    expect(layerScale(8)).toBe(1);
    expect(layerScale(11)).toBeCloseTo(1 / 0.7);
    expect(layerScale(14)).toBeCloseTo(1 / 0.3);
  });

  it('start up on a cloud, the layer the whole way and higher than act 3; no city sky', () => {
    for (let seed = 1; seed <= 2; seed++) for (const f of [10, 11, 12, 13, 14, 15]) {
      const l = floorOf(seed * 61, f);
      const start = l.surfaces.find((s) => s.sky === 'cloud' && s.x0 <= l.startX && s.x1 > l.startX && Math.abs(s.y - l.startY) < 1);
      expect(start).toBeDefined();
      expect(l.surfaces.filter((s) => s.sky && !LAYER.has(s.sky) && s.sky !== 'step')).toHaveLength(0);
      const line = piecesOf(l, 0, l.width).filter((p) => p.cloud);
      expect(Math.max(...line.map((p) => p.x1))).toBeGreaterThan(l.exitX - 30 * layerScale(f) * TILE);
      //(up `over` tiles over the ground, once it's climbed there)
      const mid = line.filter((p) => p.x0 > l.width * 0.3 && p.x0 < l.width * 0.6);
      const over = mid.map((p) => ((groundAt(l, p.x0) ?? l.streetY) - p.y0) / TILE);
      log(`floor ${f}: ${line.length} pieces, median ${over.sort((a, b) => a - b)[over.length >> 1]?.toFixed(1)} tiles up`);
      expect(over.sort((a, b) => a - b)[over.length >> 1]).toBeGreaterThan(HIGH[actOf(f) as 4 | 5].over - 4);
    }
  }, 120000);

  it('act 4 has its blimps and spires, one set piece a floor', () => {
    let blimps = 0;
    let spires = 0;
    for (let seed = 1; seed <= 3; seed++) for (const f of [10, 11, 12]) {
      const l = floorOf(seed * 53, f);
      blimps += (l.skyMovers ?? []).filter((m) => m.kind === 'blimp').length;
      spires += l.surfaces.filter((s) => s.sky === 'spire').length;
      expect((l.skyMovers ?? []).filter((m) => m.cloud && (m.kind === 'rig' || m.kind === 'swing')).length).toBeLessThanOrEqual(1);
    }
    log(`act 4: ${blimps} blimps, ${spires} spires over 9 floors`);
    expect(blimps).toBeGreaterThan(9);
    expect(spires).toBeGreaterThan(9);
  }, 120000);

  it('a good player who falls climbs the girders back up', () => {
    for (const act of [4, 5]) {
      let made = 0;
      let n = 0;
      for (let seed = 1; seed <= 3; seed++) for (const f of act === 4 ? [10, 11, 12] : [13, 14, 15]) {
        const l = floorOf(seed * 53, f);
        for (const [a, b] of l.hillSpans!.slice(1)) {
          const [lip] = lipOf(l, a, b);
          const x = Math.max(crestOf(l, a, b), lip - 6 * TILE);
          const sim = new FloorSim({ ...l, startX: x, startY: groundAt(l, x)! });
          sim.skater.hsp = sim.skater.carry = 4;
          const pilot = new Pilot('sky');
          let up = false;
          for (let k = 0; k < 60 * 60 && sim.state === 'skate' && sim.skater.x < b + 60 * TILE && !up; k++) {
            sim.step(pilot.input(sim));
            up = sim.skater.mode !== 'air' && LAYER.has(upOn(sim) ?? '');
          }
          n++;
          if (up) made++;
        }
      }
      log(`act ${act}: climbed back ${made}/${n}`);
      expect(made / n).toBeGreaterThan(0.8);
    }
  }, 240000);

  it('a good player stays up the whole floor', () => {
    for (const act of [4, 5]) {
      let up = 0;
      let ground = 0;
      for (let seed = 1; seed <= 3; seed++) for (const f of act === 4 ? [10, 11, 12] : [13, 14, 15]) {
        const l = floorOf(seed * 53, f);
        const sim = new FloorSim(l);
        const pilot = new Pilot('sky');
        let u = 0;
        let g = 0;
        for (let k = 0; k < 60 * 240 && sim.state === 'skate'; k++) {
          sim.step(pilot.input(sim));
          if (sim.skater.mode === 'air') continue;
          if (upOn(sim)) u++;
          else g++;
        }
        log(`floor ${f} seed ${seed * 53}: ${sim.state}, up ${(u / (u + g)).toFixed(2)}`);
        expect(sim.state).not.toBe('skate');
        up += u;
        ground += g;
      }
      log(`act ${act}: up ${(up / (up + ground)).toFixed(2)}`);
      expect(up / (up + ground)).toBeGreaterThan(0.75);
    }
  }, 360000);
});
