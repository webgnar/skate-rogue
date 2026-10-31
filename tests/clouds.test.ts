// The cloud layer (src/gen/clouds.ts): way up over the hills from floor 5, reached by a staircase of sky pieces
// (zack, 2026-10-31: "climb a staircase of sky pieces"), with clouds, thin clouds, rainbows and balloons up there.
import { describe, expect, it } from 'vitest';
import { buildFloor } from '../src/gen/descent';
import { CLOUDS } from '../src/gen/clouds';
import { TILE } from '../src/physics/constants';

const chicago = (seed: number, floor: number) => buildFloor(seed, floor, undefined, { hills: true });

describe('the cloud layer', () => {
  it('none before floor 5; from then a staircase up into clouds, rainbows and balloons', () => {
    let rainbows = 0;
    let balloons = 0;
    for (let seed = 1; seed <= 8; seed++) {
      expect(chicago(seed * 53, 4).surfaces.some((s) => s.sky === 'cloud')).toBe(false);
      const l = chicago(seed * 53, 7);
      expect(l.surfaces.filter((s) => s.sky === 'cloud').length).toBeGreaterThan(3);
      rainbows += l.rails.filter((r) => r.sky === 'rainbow').length;
      balloons += (l.skyMovers ?? []).filter((m) => m.kind === 'balloon').length;
      //each step of the staircase an ollie over the last, and its top as high as the clouds after it
      const steps = l.surfaces.filter((s) => s.sky === 'step' || s.sky === 'wisp').sort((a, b) => a.x0 - b.x0);
      expect(steps.length).toBeGreaterThan(4);
      for (let i = 1; i < steps.length; i++) {
        if (steps[i].x0 - steps[i - 1].x1 > 6 * TILE) continue; // the next stretch's staircase
        expect(steps[i - 1].y - steps[i].y).toBeLessThanOrEqual(CLOUDS.stairRise * TILE + 0.01);
      }
    }
    expect(rainbows).toBeGreaterThan(0);
    expect(balloons).toBeGreaterThan(0);
  });

  it('nothing lying about on the clouds, and rainbows arch up', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const l = chicago(seed * 53, 9);
      const clouds = l.surfaces.filter((s) => s.sky === 'cloud' || s.sky === 'thin');
      for (const p of l.props) expect(clouds.some((c) => p.x >= c.x0 && p.x <= c.x1 && Math.abs(p.y - c.y) < 2)).toBe(false);
      for (const r of l.rails.filter((x) => x.sky === 'rainbow')) expect(r.at(r.length / 2).y).toBeLessThan(r.ys[0] - TILE);
      expect(l.surfaces.filter((s) => s.sky === 'thin').every((s) => s.crumble)).toBe(true);
    }
  });
});
