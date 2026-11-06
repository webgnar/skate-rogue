// Gravity per act (GDD: The fantasy, the climb, step c): street gravity in the city acts, lighter at the top of the
// sky and in space. Act 1-3 floors must skate exactly as before; act 4 and 5 floors are built and bot-checked in
// their own gravity.
import { describe, expect, it } from 'vitest';
import { TILE } from '../src/physics/constants';
import { ACT_GRAVITY, actGravity } from '../src/physics/feel';
import { Skater } from '../src/physics/skater';
import { validatedFloor } from '../src/gen/validate';
import { floorTwist } from '../src/gen/twists';
import { floorLevel } from '../src/run/floor-level';
import { FULL_LIBRARY } from '../src/run/meta';
import { actOf } from '../src/gen/escape';
import { FLAT, levelOf, run } from './helpers';

declare const process: { env: Record<string, string | undefined>; stderr: { write(s: string): void } };

const road = { kind: 'boon', boonType: 'POP', danger: 2 } as const;

// an ollie held to its top and a flip at the top of it: how high (tiles) and how long in the air (s)
export function jump(gravity: number, flip: boolean): { tiles: number; secs: number } {
  const sk = new Skater({ ...levelOf(FLAT), gravity });
  const street = sk.level.streetY;
  let top = sk.y;
  let air = 0;
  let flipped = false;
  run(sk, 600, (f) => {
    top = Math.min(top, sk.y);
    if (sk.mode === 'air') air++;
    const atTop = flip && !flipped && sk.mode === 'air' && sk.vsp >= 0;
    if (atTop) flipped = true;
    return { pressed: f === 0 || atTop, held: true };
  });
  return { tiles: (street - top) / TILE, secs: air / 60 };
}

describe('act gravity', () => {
  it('street gravity through act 3, lighter in act 4, lightest in act 5 and Endless past it', () => {
    expect(ACT_GRAVITY).toEqual([1, 1, 1, 0.7, 0.3]);
    for (let f = 1; f <= 9; f++) expect(actGravity(actOf(f))).toBe(1);
    for (let f = 10; f <= 12; f++) expect(actGravity(actOf(f))).toBe(0.7);
    for (let f = 13; f <= 21; f++) expect(actGravity(actOf(f))).toBe(0.3);
  });

  it("a run's floors carry their act's gravity; acts 1-3 carry none (the tuned feel)", () => {
    for (const floor of [1, 5, 9]) expect(floorLevel({ seed: 3, floor, road, library: FULL_LIBRARY, gnar: 0 }).gravity).toBeUndefined();
    expect(floorLevel({ seed: 3, floor: 11, road, library: FULL_LIBRARY, gnar: 0 }).gravity).toBe(0.7);
    expect(floorLevel({ seed: 3, floor: 14, road, library: FULL_LIBRARY, gnar: 0 }).gravity).toBe(0.3);
    //acts 1-3's escapes keep street gravity; the ceiling and the beam-up skate in their act's (climb step d)
    expect(floorLevel({ seed: 3, floor: 9, road: { kind: 'escape', act: 3, danger: 3 }, library: FULL_LIBRARY, gnar: 0 }).gravity).toBeUndefined();
    expect(floorLevel({ seed: 3, floor: 12, road: { kind: 'escape', act: 4, danger: 3 }, library: FULL_LIBRARY, gnar: 0 }).gravity).toBe(0.7);
  }, 60000);

  it('jumps grow about 1/g high and 1/g long', () => {
    const base = jump(1, true);
    for (const g of [0.7, 0.3]) {
      const j = jump(g, true);
      expect(j.tiles / base.tiles).toBeGreaterThan(1 / g - 0.25);
      expect(j.tiles / base.tiles).toBeLessThan(1 / g + 0.25);
      expect(j.secs / base.secs).toBeGreaterThan(1 / g - 0.4);
    }
    if (process.env.GRAV_TABLE) {
      for (const g of [1, 0.7, 0.3]) {
        const o = jump(g, false);
        const f = jump(g, true);
        process.stderr.write(`g ${g}: ollie ${o.tiles.toFixed(1)} tiles ${o.secs.toFixed(2)} s, ollie+flip ${f.tiles.toFixed(1)} tiles ${f.secs.toFixed(2)} s\n`);
      }
    }
  });

  it('act 4 and 5 floors clear in their gravity without dropping a tier', () => {
    for (const floor of [11, 14]) {
      for (let s = 1; s <= 3; s++) {
        const seed = s * 7919;
        const v = validatedFloor(seed, floor, { twist: floorTwist(seed, floor), hills: true, gravity: actGravity(actOf(floor)) });
        expect(v.tierDrops, `floor ${floor} seed ${seed}`).toBe(0);
      }
    }
  }, 120000);
});
