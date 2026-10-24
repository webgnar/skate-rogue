import { describe, expect, it } from 'vitest';
import { floorLength, makeLayout, maxTier } from '../src/gen/layout';
import { EXIT_PIECE, PIECES, START_PIECE } from '../src/gen/pieces';
import { buildLevel } from '../src/physics/level';

describe('piece library', () => {
  it('every piece is 16 x 10 and starts and ends on street', () => {
    for (const p of [...PIECES, START_PIECE, EXIT_PIECE]) {
      expect(p.rows, p.name).toHaveLength(10);
      for (const r of p.rows) expect(r, p.name).toHaveLength(16);
      const street = p.rows[9];
      expect(street[0], p.name).toBe('#');
      expect(street[15], p.name).toBe('#');
    }
  });

  it('every curved rail has a pair of ends', () => {
    for (const p of PIECES) {
      const n = p.rows.join('').split('r').length - 1;
      expect(n % 2, p.name).toBe(0);
    }
  });
});

describe('layout', () => {
  it('is deterministic for a seed and floor', () => {
    expect(makeLayout(1234, 3)).toEqual(makeLayout(1234, 3));
  });

  it('differs between seeds', () => {
    expect(makeLayout(1, 5).grid).not.toEqual(makeLayout(2, 5).grid);
  });

  it('floor 1 is 6 pieces, 96 columns', () => {
    const l = makeLayout(7, 1);
    expect(l.pieces).toHaveLength(6);
    expect(l.cols).toBe(96);
    expect(l.pieces[0]).toBe(START_PIECE);
    expect(l.pieces[5]).toBe(EXIT_PIECE);
  });

  it('follows the QFS length and tier curves', () => {
    expect([1, 2, 5, 9, 20].map(floorLength)).toEqual([4, 5, 8, 12, 12]);
    expect([1, 2, 3, 4, 5, 9].map(maxTier)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('floors 1 and 2 only use tier 1 pieces', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const floor of [1, 2]) {
        const l = makeLayout(seed, floor);
        for (const p of l.pieces.slice(1, -1)) expect(p.tier).toBe(1);
      }
    }
  });

  it('never repeats a piece back to back', () => {
    for (let seed = 0; seed < 50; seed++) {
      const ps = makeLayout(seed, 6).pieces;
      for (let i = 2; i < ps.length - 1; i++) expect(ps[i]).not.toBe(ps[i - 1]);
    }
  });
});

describe('level parsing', () => {
  it('turns a pair of r marks into one curved rail with the piece bow', () => {
    const rail = PIECES.find((p) => p.name === 'rail canal')!;
    const level = buildLevel(makeLayout(1, 3, [rail]));
    expect(level.rails).toHaveLength(6); // floor 3: 6 copies
    expect(level.rails[0].curve).toBe(48);
  });

  it('finds cars, flat rails and canals', () => {
    const l = buildLevel(makeLayout(1, 5, PIECES.filter((p) => p.name === 'canal rail' || p.name === 'traffic jam')));
    expect(l.cars.length).toBeGreaterThan(0);
    expect(l.surfaces.some((s) => s.kind === 'rail')).toBe(true);
    expect(l.street.some((s) => !s)).toBe(true);
  });
});
