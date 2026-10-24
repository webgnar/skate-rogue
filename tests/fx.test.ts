import { applyParams } from '../src/render/fx-settings';
import { describe, expect, it } from 'vitest';
import { TimeWarp } from '../src/game/time-warp';
import { FixedStep } from '../src/game/loop';
import { ParticlePool } from '../src/render/particle-pool';

describe('time warp', () => {
  it('freezes, then slows, then returns to full speed', () => {
    const w = new TimeWarp();
    expect(w.scale).toBe(1);
    w.hit(0.09, 0.3, 0.5);
    expect(w.scale).toBe(0);
    w.update(0.05);
    expect(w.scale).toBe(0);
    w.update(0.05); // 0.01 s into the slow-mo
    expect(w.scale).toBeGreaterThan(0.29);
    expect(w.scale).toBeLessThan(0.35);
    w.update(0.25);
    const mid = w.scale;
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(1);
    w.update(0.3);
    expect(w.scale).toBe(1);
  });

  it('runs no physics steps while frozen, fewer while slow, and all of them after', () => {
    const w = new TimeWarp();
    const loop = new FixedStep();
    const steps = (secs: number) => {
      let n = 0;
      for (let t = 0; t < secs - 1e-9; t += 1 / 60) {
        loop.advance((1 / 60) * w.scale, () => n++);
        w.update(1 / 60);
      }
      return n;
    };
    w.hit(0.1, 0.3, 0.5);
    expect(steps(0.1)).toBe(0);
    const slow = steps(0.5);
    expect(slow).toBeGreaterThan(5);
    expect(slow).toBeLessThan(27);
    expect(steps(1)).toBeGreaterThanOrEqual(59);
  });
});

describe('particle pool', () => {
  it('never grows past its size and reuses the oldest slot', () => {
    const pool = new ParticlePool(4);
    const slots = Array.from({ length: 6 }, () => pool.alloc());
    expect(slots).toEqual([0, 1, 2, 3, 0, 1]);
  });

  it('frees particles when their life runs out', () => {
    const pool = new ParticlePool(8);
    const i = pool.alloc();
    pool.life[i] = 0.2;
    pool.age[i] = 0;
    pool.step(0.1);
    expect(pool.alive(i)).toBe(true);
    pool.step(0.15);
    expect(pool.alive(i)).toBe(false);
  });

  it('applies gravity and drag', () => {
    const pool = new ParticlePool(2);
    const i = pool.alloc();
    pool.life[i] = 1;
    pool.vx[i] = 2;
    pool.drag[i] = 1;
    pool.grav[i] = 10;
    pool.step(0.1);
    expect(pool.vy[i]).toBeLessThan(0);
    expect(pool.vx[i]).toBeLessThan(2);
    expect(pool.px[i]).toBeGreaterThan(0);
  });
});

import { MOODS, clockFor, moodAt, rainsOn } from '../src/render/atmosphere';

describe('time of day', () => {
  it('runs from afternoon on floor 1 to night by act 5, and stays night in Endless', () => {
    expect(clockFor(1)).toBe(0);
    expect(moodAt(clockFor(1)).skyTop).toBe(MOODS.afternoon.skyTop);
    expect(moodAt(clockFor(13)).skyTop).toBe(MOODS.night.skyTop);
    expect(moodAt(clockFor(40)).stars).toBe(1);
    // gets steadily darker
    const sun = [1, 4, 7, 10, 13].map((f) => moodAt(clockFor(f)).hemi);
    for (let i = 1; i < sun.length; i++) expect(sun[i]).toBeLessThanOrEqual(sun[i - 1]);
  });

  it('rains on some floors, never the first, the same for a seed', () => {
    const floors = Array.from({ length: 200 }, (_, i) => rainsOn(1234, i + 1));
    expect(floors[0]).toBe(false);
    const share = floors.filter(Boolean).length / floors.length;
    expect(share).toBeGreaterThan(0.12);
    expect(share).toBeLessThan(0.4);
    expect(rainsOn(1234, 7)).toBe(rainsOn(1234, 7));
  });
});

import { puddleGrowth, puddleSpots, PUDDLE } from '../src/render/puddles';
import { rainLevel, RAIN } from '../src/render/atmosphere';
import { buildFloor } from '../src/gen/descent';

describe('puddles', () => {
  const level = buildFloor(5, 6);
  const spots = puddleSpots(level, 5, 6);

  it('lands on flat ground, clear of cars and glass, the same for a seed', () => {
    expect(spots.length).toBeGreaterThan(3);
    for (const p of spots) {
      for (const c of level.cars) expect(p.x + p.w <= c.x0 / 32 - 1 || p.x - p.w >= c.x1 / 32 + 1).toBe(true);
    }
    expect(puddleSpots(level, 5, 6)).toEqual(spots);
  });

  it('forms over the first ~20 s of the floor', () => {
    expect(spots.every((p) => puddleGrowth(p, 0) === 0)).toBe(true);
    expect(spots.every((p) => puddleGrowth(p, PUDDLE.lastStart + PUDDLE.grow) === 1)).toBe(true);
  });

  it('rolls drizzle, rain or downpour only on rainy floors', () => {
    const levels = new Set<number>();
    for (let f = 1; f < 300; f++) levels.add(rainLevel(77, f));
    expect([...levels].sort()).toEqual([0, RAIN.drizzle, RAIN.rain, RAIN.downpour].sort());
    expect(rainLevel(77, 1)).toBe(0);
  });
});

describe('effect settings from the URL', () => {
  const base = { quality: 'auto', reduceMotion: false, reduceFlashing: false, heatCue: false } as const;
  const q = (s: string) => applyParams({ ...base }, new URLSearchParams(s));
  it('calm turns on both accessibility switches, calm=0 turns them off', () => {
    expect(q('calm')).toMatchObject({ reduceMotion: true, reduceFlashing: true });
    expect(applyParams({ ...base, reduceMotion: true, reduceFlashing: true }, new URLSearchParams('calm=0'))).toMatchObject({ reduceMotion: false, reduceFlashing: false });
  });
  it('sets the tier and single switches', () => {
    expect(q('fx=low').quality).toBe('low');
    expect(q('fx=nonsense').quality).toBe('auto');
    expect(q('noflash')).toMatchObject({ reduceMotion: false, reduceFlashing: true });
    expect(q('heatcue').heatCue).toBe(true);
  });
});
