// Chinatown (src/gen/hills.ts CHINATOWN): cross traffic down the hill, a cab to skitch, and a kicker that only gets you
// up to the top route's power line at the cab's speed
import { describe, expect, it } from 'vitest';
import { PHYS, TILE } from '../src/physics/constants';
import { buildFloor } from '../src/gen/descent';
import { chinatownStretch } from '../src/gen/hills';
import { FloorSim } from '../src/sim/floor';
import { HILL_CROSS } from '../src/traffic/hill-cross';
import type { Level } from '../src/physics/level';

const floor = (seed: number, n = 5) => buildFloor(seed, n, undefined, { hills: true });

// skate the cab flat from just before the cab: optionally skitching it, ollie at the kicker's lip, flip at the top
function launch(l: Level, cab: boolean): { top: boolean; skitched: boolean; lipSpeed: number } {
  const sim = new FloorSim(l);
  const run = l.cabs![0];
  const sk = sim.skater;
  if (!cab) sim.traffic.cabs.length = 0;
  sim.traffic.hillCross.length = 0;
  sk.x = run.x - 6 * TILE;
  sk.y = run.y;
  sk.mode = 'roll' as typeof sk.mode;
  sk.surface = l.surfaces.find((s) => s.kind === 'roof' && s.y === run.y && s.x0 <= sk.x && s.x1 >= sk.x)!;
  let popped = false;
  let flipped = false;
  let skitched = false;
  let lipSpeed = 0;
  for (let f = 0; f < 60 * 8; f++) {
    let pressed = false;
    if (!popped && sk.mode === 'roll' && sk.surface?.kicker && sk.x >= run.lip.x - sk.hsp - 1) {
      pressed = popped = true;
      lipSpeed = sk.hsp;
    } else if (popped && !flipped && sk.mode === 'air' && sk.vsp >= 0) pressed = flipped = true;
    sim.step({ pressed, held: true });
    if (sk.skitching) skitched = true;
    if (sk.rail?.top) return { top: true, skitched, lipSpeed };
    if (popped && sk.mode !== 'air') break;
  }
  return { top: false, skitched, lipSpeed };
}

describe('chinatown', () => {
  it('is the stretch after the first cable car, once an act', () => {
    expect([1, 2, 3, 4, 6, 7].map(chinatownStretch)).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
    for (const n of [5, 8, 11, 14]) expect(chinatownStretch(n)).toBe(1);
    const l = floor(2026);
    expect(l.chinatown).toHaveLength(1);
    const [a, b] = l.chinatown![0];
    expect(l.hillCross!.length).toBeGreaterThanOrEqual(2);
    for (const c of l.hillCross!) expect(c.x > a && c.x < b).toBe(true);
    expect(l.cabs).toHaveLength(1);
    expect(floor(2026, 4).chinatown).toBeUndefined();
  });

  it('runs cross traffic through the lane at each intersection, readable a beat ahead', () => {
    const l = floor(2026);
    const sim = new FloorSim(l);
    const h = sim.traffic.hillCross[0];
    expect((-HILL_CROSS.farZ - HILL_CROSS.laneZ) / HILL_CROSS.speedZ / 60).toBeGreaterThan(1);
    let inLane = 0;
    for (let f = 0; f < 600; f++) {
      h.step(h.x - 10 * TILE);
      if (h.inLane.length) inLane++;
    }
    expect(inLane).toBeGreaterThan(40);
    expect(inLane).toBeLessThan(400);
    for (const box of h.inLane) expect(box.bottom).toBe(h.y);
  });

  it('only gets you up to the power line off the kicker at the cab speed', () => {
    for (const seed of [2026, 71, 142, 9]) {
      const l = floor(seed);
      const slow = launch(l, false);
      const fast = launch(l, true);
      expect(fast.skitched).toBe(true);
      expect(fast.lipSpeed).toBeGreaterThan(PHYS.baseSpeed * 1.8);
      expect(fast.top).toBe(true);
      expect(slow.top).toBe(false);
    }
  });
});
