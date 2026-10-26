// The buildings out on the street (ARCADE in src/traffic/traffic.ts): tall ones stand on pillars and traffic drives
// under them; a kiosk is too low, so traffic pulls out behind it; a cross street never comes out through either.
import { describe, expect, it } from 'vitest';
import { TILE } from '../src/physics/constants';
import { validatedFloor } from '../src/gen/validate';
import { crossPlan, CROSS } from '../src/traffic/cross';
import { ARCADE, isKiosk, streetBuilding, TRAFFIC, Traffic } from '../src/traffic/traffic';
import { FLAT, levelOf } from './helpers';

describe('street buildings', () => {
  it('a vehicle pulls out of the lane before a kiosk, and drives on under a tall building', () => {
    for (const [h, pulls] of [[1, true], [3, false]] as const) {
      const level = levelOf(FLAT);
      const x0 = 30 * TILE;
      level.surfaces.push({ kind: 'roof', x0, x1: x0 + 4 * TILE, y: level.streetY - h * TILE, row: -1 });
      expect(streetBuilding(level, level.surfaces.at(-1)!)).toBe(true);
      expect(isKiosk(level, level.surfaces.at(-1)!)).toBe(h < ARCADE.low);
      const traffic = new Traffic(level, [{ at: 0, kind: 'robotaxi', speed: 2 }]);
      traffic.step(0);
      const v = traffic.vehicles[0];
      v.x0 = x0 - 5 * TILE;
      v.x1 = v.x0 + TRAFFIC.carW;
      for (let f = 0; f < 120; f++) traffic.step(0);
      expect(v.x1).toBeGreaterThan(x0);
      expect(v.leaving).toBe(pulls);
    }
  });

  it('cross streets never come out through a building on the street', () => {
    for (let s = 1; s <= 8; s++) {
      const l = validatedFloor(s * 71, 9).level;
      const blocks = l.surfaces.filter((x) => streetBuilding(l, x));
      for (const i of crossPlan(l, l.layout.seed)) expect(blocks.some((b) => b.x1 > i.x - CROSS.clear && b.x0 < i.x + CROSS.w + CROSS.clear)).toBe(false);
    }
  });
});
