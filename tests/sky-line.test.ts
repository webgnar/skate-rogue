// The sky line's level design (zack, 2026-10-31: "make sure sky layer is payed as much attention to with level design
// as the ground"): up on the sky route a good player can follow the line from the first piece on a stretch to its
// last, at cruising speed, with an ollie and a flip. The 'sky' bot (src/bot/pilot.ts) skates it the way a good player
// does: off the end of each piece, a flip when that's what makes the next one.
import { describe, expect, it } from 'vitest';
import { buildFloor } from '../src/gen/descent';
import { FloorSim } from '../src/sim/floor';
import { Pilot } from '../src/bot/pilot';
import { maxGap, piecesOf } from '../src/gen/sky-line';
import { cloudy } from '../src/gen/clouds';
import { TILE } from '../src/physics/constants';
import type { Level } from '../src/physics/level';

const chicago = (seed: number, floor: number) => buildFloor(seed, floor, undefined, { hills: true });

// how far along a stretch's sky line the bot gets (0-1), from its first deck
function skate(l: Level, [a, b]: [number, number], v: number): number | null {
  const decks = l.surfaces.filter((s) => s.sky && s.kind !== 'rail' && s.x0 >= a && s.x0 < b).sort((p, q) => p.x0 - q.x0);
  if (!decks.length) return null;
  const last = Math.max(...l.surfaces.filter((s) => s.sky && s.x0 >= a && s.x0 < b).map((s) => s.x0), ...l.rails.filter((r) => r.sky && r.xs[0] >= a && r.xs[0] < b).map((r) => r.xs[0]));
  const sim = new FloorSim({ ...l, startX: decks[0].x0 + 8, startY: decks[0].y });
  sim.skater.hsp = sim.skater.carry = v;
  const pilot = new Pilot('sky');
  let on = decks[0].x0;
  for (let f = 0; f < 4000 && sim.state === 'skate' && sim.skater.x < b; f++) {
    sim.step(pilot.input(sim));
    const sk = sim.skater;
    if (sk.surface?.sky || sk.rail?.sky || sim.sky.pieces.some((p) => p.ledge === sk.surface)) on = sk.x;
    if (sim.skyLine === 0 && sk.mode !== 'air' && f > 30) break;
  }
  return Math.min(1, (on - decks[0].x0) / Math.max(1, last - decks[0].x0));
}

describe('the sky line', () => {
  it('a flip carries you further the lower the next piece stands, within reason', () => {
    expect(maxGap(0)).toBeGreaterThan(4);
    expect(maxGap(2)).toBeGreaterThan(maxGap(0));
    expect(maxGap(-2)).toBeLessThan(maxGap(0));
    expect(maxGap(20)).toBeLessThanOrEqual(6.5);
  });

  it('nothing on the line is further than a flip from the piece before it', () => {
    for (let seed = 1; seed <= 6; seed++) for (let f = 5; f <= 12; f++) {
      const l = chicago(seed * 53, f);
      for (const [a, b] of l.hillSpans ?? []) {
        const line = piecesOf(l, a, b);
        for (let i = 1; i < line.length; i++) {
          const from = line.slice(0, i).sort((p, q) => q.x1 - p.x1)[0];
          if (from.x1 >= line[i].x0) continue; // one over another: either way on
          const gap = (line[i].x0 - from.x1) / TILE;
          expect(gap).toBeLessThanOrEqual(maxGap((line[i].y0 - from.y1) / TILE) + 1);
        }
      }
    }
  });

  it('the long first stretch climbs into the clouds; the ones after stay in the city sky', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const l = chicago(seed * 53, 7);
      expect(cloudy(l, 0)).toBe(true);
      expect(cloudy(l, 1)).toBe(false);
    }
  });

  it('a good player can skate the sky line from end to end on most stretches', () => {
    let made = 0;
    let runs = 0;
    for (let seed = 1; seed <= 5; seed++) for (const f of [5, 7, 9, 11]) {
      const l = chicago(seed * 53, f);
      for (const span of l.hillSpans ?? []) {
        const got = skate(l, span, 5);
        if (got === null) continue;
        runs++;
        if (got > 0.85) made++;
      }
    }
    expect(runs).toBeGreaterThan(20);
    expect(made / runs).toBeGreaterThan(0.75);
  }, 120000);
});
