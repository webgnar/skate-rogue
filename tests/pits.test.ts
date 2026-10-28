import { describe, expect, it } from 'vitest';
import { buildFloor } from '../src/gen/descent';
import { NO_MODS } from '../src/boons/mods';
import { PIT, pits, type Level, type Pit } from '../src/physics/level';
import { FloorSim } from '../src/sim/floor';
import type { Mode } from '../src/physics/skater';
import { TILE } from '../src/physics/constants';

const chicago = (seed: number, floor: number) => buildFloor(seed, floor, undefined, { hills: true });

// roll off the near lip of a pit at cruising speed without popping (or with the given mods)
function rollOff(level: Level, p: Pit, mods = NO_MODS) {
  const sim = new FloorSim(level, mods);
  const sk = sim.skater;
  const near = level.surfaces.find((s) => s.x1 === p.x0 && !s.side)!;
  sk.x = p.x0 - 2 * TILE;
  sk.y = near.y1 ?? near.y;
  sk.surface = near;
  sk.mode = 'roll' as Mode;
  const slams: number[] = [];
  let past = false;
  let landed = false;
  for (let f = 0; f < 300 && sim.state === 'skate' && !landed; f++) {
    sim.step({ pressed: sk.walled && f % 7 === 0, held: false }); // mashing the button after the wall changes nothing
    if (sim.events.some((e) => e.type === 'slam')) slams.push(f);
    if (sk.mode === 'air' && sk.x > p.x1 && sk.boardY > p.lip) past = true;
    if (sk.mode === 'roll' && sk.x > p.x1 - TILE) landed = true; // cleared it just rolling off (the narrow ones)
  }
  return { sim, sk, slams, past, landed };
}

// zack, 2026-10-28: the crest jumps' pits on floor 2's downhill let you through their far wall, to fall glitching
// through the hill. Their far wall is solid now: short of the lip you slam into it and drop straight down to bail.
describe('pits on the hill', () => {
  it('finds the crest jumps as pits, their bottoms the cross street under the lower lip', () => {
    let n = 0;
    for (let floor = 2; floor <= 15; floor++) {
      const l = chicago(floor * 13, floor);
      for (const p of pits(l)) {
        n++;
        expect(p.x1 - p.x0).toBeGreaterThan(PIT.gap[0] * TILE);
        expect(p.floor).toBeGreaterThan(p.lip);
        expect(p.floor).toBeLessThan(l.streetY);
      }
    }
    expect(n).toBeGreaterThan(10);
  });

  it('rolling off into a pit: you slam into the far wall, never pass it, and bail at the bottom right under it', () => {
    let [walled, cleared] = [0, 0];
    for (let floor = 2; floor <= 15; floor++) {
      for (const seed of [3, 41]) {
        const l = chicago(seed * floor, floor);
        for (const p of pits(l)) {
          const { sim, sk, slams, past, landed } = rollOff(l, p);
          const at = `floor ${floor} seed ${seed * floor} pit ${p.x0}-${p.x1}`;
          expect(past, at).toBe(false);
          if (landed) {
            cleared++;
            continue;
          }
          walled++;
          expect(sim.state, at).toBe('bail');
          expect(slams.length, at).toBe(1);
          expect(sk.x, at).toBeLessThanOrEqual(p.x1);
          expect(sk.x, at).toBeGreaterThan(p.x1 - TILE);
          expect(sk.y, at).toBeCloseTo(p.floor);
        }
      }
    }
    expect(walled).toBeGreaterThan(10);
    expect(cleared).toBeLessThan(walled);
  });

  it('Tuck and Roll still bounces you up the wall and out', () => {
    const l = [2, 3, 4, 5].map((floor) => chicago(3 * floor, floor)).find((m) => pits(m).some((q) => !rollOff(m, q).landed))!;
    const p = pits(l).find((q) => !rollOff(l, q).landed)!;
    const { sim, sk } = rollOff(l, p, { ...NO_MODS, tuckAndRoll: 1 });
    expect(sim.state).toBe('skate');
    expect(sk.mode).toBe('roll');
    expect(sk.x).toBeGreaterThanOrEqual(p.x1);
  });
});
