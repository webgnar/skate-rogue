// Act 3's cloud line (zack, 2026-11-10: "build out the cloud route even more ... it has to be more fun not just an
// accent on the existing level. so rainbow Hubbas, S shaped rails, S shaped I Beam ... stomping the drones ... ramps
// that shoot you straight up, through a cloud, land on a big ass rail going down to a little flat then up again via
// quarterpipe"): src/gen/clouds.ts CLOUD_LINE and LAUNCH lay the sets, src/sim/floor.ts says when you've fallen.
import { describe, expect, it } from 'vitest';
import { validatedFloor } from '../src/gen/validate';
import { rollFork } from '../src/gen/roads';
import { CLOUD_LINE, CLOUDS } from '../src/gen/clouds';
import { thinBlink } from '../src/render/sky-pieces-view';
import { FloorSim } from '../src/sim/floor';
import { Pilot } from '../src/bot/pilot';
import { TILE } from '../src/physics/constants';
import type { Level } from '../src/physics/level';

const floorOf = (seed: number, floor: number): Level => validatedFloor(seed, floor, { hills: true, fork: rollFork(seed, floor) }).level;
const setsOf = (l: Level) => {
  const n: Record<string, number> = {};
  for (const r of l.rails) if (r.sky && ['hubba', 'srail', 'sbeam'].includes(r.sky)) n[r.sky] = (n[r.sky] ?? 0) + 1;
  n.launch = l.surfaces.filter((s) => s.sky === 'qp').length / 2;
  n.bridge = new Set((l.bridges ?? []).map((d) => d.base)).size;
  return n;
};

describe("act 3's cloud line", () => {
  it('lays every set across a few floors, never more of one than its cap', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 4; seed++) for (const f of [7, 8, 9]) {
      const n = setsOf(floorOf(seed * 37, f));
      for (const [k, v] of Object.entries(n)) {
        if (v > 0) seen.add(k);
        expect(v, `${k} on seed ${seed * 37} floor ${f}`).toBeLessThanOrEqual(CLOUD_LINE.most[k as keyof typeof CLOUD_LINE.most] ?? Infinity);
      }
    }
    expect([...seen].sort()).toEqual(['bridge', 'hubba', 'launch', 'sbeam', 'srail']);
    //(none of it below act 3)
    for (const f of [4, 5, 6]) expect(Object.values(setsOf(floorOf(37, f))).every((v) => v === 0)).toBe(true);
  }, 120000);

  it('a launch quarterpipe throws you up at its own speed, and the gap it crosses is never decked over', () => {
    for (let seed = 1; seed <= 12; seed++) for (const f of [7, 8, 9]) {
      const l = floorOf(seed * 37, f);
      const qp = l.surfaces.find((s) => s.sky === 'qp');
      if (!qp) continue;
      expect(qp.launch).toBeLessThan(0);
      expect(qp.launchHsp).toBeGreaterThan(0);
      const way = l.airways!.find(([a, b]) => qp.x1 >= a - TILE && qp.x1 <= b)!;
      expect(way).toBeDefined();
      //(nothing but the set's own pieces in the air it crosses: its pass-through cloud, the downrail and its flat)
      const decks = l.surfaces.filter((s) => s.sky && s.x0 > way[0] + TILE && s.x1 < way[1] - TILE && s.sky !== 'cloud' && s.sky !== 'qp');
      expect(decks).toHaveLength(0);
      //roll up it: thrown up at its hsp
      const sim = new FloorSim({ ...l, startX: qp.x0 + 4, startY: qp.y });
      let peak = Infinity;
      let launched = false;
      for (let k = 0; k < 90 && sim.state === 'skate'; k++) {
        sim.step({ pressed: false, held: false });
        if (sim.skater.mode === 'air' && sim.skater.x > qp.x1 - TILE) {
          launched = true;
          peak = Math.min(peak, sim.skater.y);
        }
      }
      expect(launched).toBe(true);
      expect(qp.y1! - peak).toBeGreaterThan(5 * TILE);
      return;
    }
    throw new Error('no launch found');
  }, 120000);

  it('a good player (the sky bot) clears most act 3 floors without touching the street', () => {
    let clean = 0;
    let n = 0;
    for (let seed = 1; seed <= 6; seed++) for (const f of [7, 8, 9]) {
      const sim = new FloorSim(floorOf(seed * 37, f));
      const pilot = new Pilot('sky');
      for (let k = 0; k < 60 * 200 && sim.state === 'skate'; k++) sim.step(pilot.input(sim));
      n++;
      if (!sim.fell && sim.state === 'exit') clean++;
    }
    expect(clean / n).toBeGreaterThan(0.7);
  }, 300000);

  it('clouds that blink out are rare: none on 3-1, a couple at most later, only in the back half of the floor', () => {
    for (let seed = 1; seed <= 6; seed++) for (const f of [7, 8, 9]) {
      const l = floorOf(seed * 37, f);
      const thin = l.surfaces.filter((s) => s.sky === 'thin');
      expect(thin.length).toBeLessThanOrEqual(f === 7 ? 0 : CLOUD_LINE.thinMost);
      for (const s of thin) expect(s.x0 - l.startX).toBeGreaterThan(0.4 * (l.exitX - l.startX));
    }
  }, 120000);

  it('a thin cloud blinks faster and faster once you land on it', () => {
    const T = CLOUDS.thinFrames;
    const flips: number[] = [];
    for (let left = T; left > 0; left--) if (thinBlink(T, left) !== thinBlink(T, left + 1)) flips.push(T - left);
    expect(thinBlink(T, T)).toBe(true);
    expect(flips.length).toBeGreaterThanOrEqual(8);
    //(each blink shorter than the last, near enough)
    const gaps = flips.slice(1).map((f, i) => f - flips[i]);
    expect(gaps.at(-1)!).toBeLessThan(gaps[0]);
  });
});
