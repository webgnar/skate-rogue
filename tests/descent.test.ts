import { describe, expect, it } from 'vitest';
import { buildFloor, startHeight } from '../src/gen/descent';
import { TILE } from '../src/physics/constants';
import type { Level, Surface } from '../src/physics/level';
import { Skater } from '../src/physics/skater';
import { FLAT, levelOf } from './helpers';

const idle = { pressed: false, held: false };

// a flat test level with rooftops and slopes added above a street that has been removed
function withSurfaces(surfaces: Surface[], startY: number): Level {
  const base = levelOf(FLAT);
  return { ...base, street: base.street.map(() => false), surfaces, startY, startX: 2 * TILE };
}

describe('descent floors', () => {
  it('floor 1 starts at least 12 tiles up and has a stair set and a handrail', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const l = buildFloor(seed, 1);
      expect(l.streetY - l.startY).toBeGreaterThanOrEqual(12 * TILE);
      expect(l.surfaces.some((s) => s.kind === 'stairs')).toBe(true);
      expect(l.rails.some((r) => r.x1 <= l.finaleX && r.y1 > r.y0)).toBe(true);
    }
  });

  it('gets longer and higher with depth', () => {
    expect(startHeight(6)).toBeGreaterThan(startHeight(1));
    const len = (floor: number) => {
      let total = 0;
      for (let seed = 1; seed <= 20; seed++) total += buildFloor(seed, floor).width;
      return total;
    };
    expect(len(6)).toBeGreaterThan(len(1));
  });

  it('is deterministic', () => {
    expect(buildFloor(5, 3).surfaces).toEqual(buildFloor(5, 3).surfaces);
  });

  it('starts the skater on the top roof', () => {
    const l = buildFloor(2, 2);
    const sk = new Skater(l);
    expect(sk.surface?.kind).toBe('roof');
    sk.step(idle);
    expect(sk.mode).toBe('roll');
  });
});

describe('stairs and banks', () => {
  const top = 100;
  it('rolling off the top of a stair set slams and rolls you to the bottom', () => {
    const l = withSurfaces([
      { kind: 'roof', x0: 0, x1: 6 * TILE, y: top, row: -1 },
      { kind: 'stairs', x0: 6 * TILE, x1: 14 * TILE, y: top, y1: top + 8 * 16, row: -1 },
      { kind: 'roof', x0: 14 * TILE, x1: 40 * TILE, y: top + 8 * 16, row: -1 },
    ], top);
    const sk = new Skater(l);
    const events: string[] = [];
    for (let f = 0; f < 240; f++) {
      sk.step(idle);
      events.push(...sk.events.map((e) => e.type));
      sk.events.length = 0;
    }
    expect(events).toContain('slam');
    expect(sk.mode).toBe('roll');
    expect(sk.y).toBe(top + 8 * 16);
    expect(sk.x).toBeGreaterThan(14 * TILE);
  });

  it('a bank that ends in open air kicks you upward', () => {
    const l = withSurfaces([
      { kind: 'roof', x0: 0, x1: 6 * TILE, y: top + 64, row: -1 },
      { kind: 'bank', x0: 6 * TILE, x1: 10 * TILE, y: top + 64, y1: top, row: -1 },
      { kind: 'roof', x0: 14 * TILE, x1: 40 * TILE, y: top, row: -1 },
    ], top + 64);
    const sk = new Skater(l);
    let kicked = false;
    for (let f = 0; f < 200 && !kicked; f++) {
      const before = sk.mode;
      sk.step(idle);
      if (before === 'roll' && sk.mode === 'air' && sk.x > 10 * TILE - 8) kicked = sk.vsp < 0;
    }
    expect(kicked).toBe(true);
  });

  it('rolls up a bank onto the higher roof', () => {
    const l = withSurfaces([
      { kind: 'roof', x0: 0, x1: 6 * TILE, y: top + 64, row: -1 },
      { kind: 'bank', x0: 6 * TILE, x1: 10 * TILE, y: top + 64, y1: top, row: -1 },
      { kind: 'roof', x0: 10 * TILE, x1: 40 * TILE, y: top, row: -1 },
    ], top + 64);
    const sk = new Skater(l);
    for (let f = 0; f < 150; f++) sk.step(idle);
    expect(sk.mode).toBe('roll');
    expect(sk.y).toBe(top);
  });
});
