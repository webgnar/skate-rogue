import { describe, expect, it } from 'vitest';
import { GRIP, GRIPS, RANK_GRIPS, gripCardColor, gripDef, gripFor, isGrip } from '../src/board/grips';
import { buyGrip, restock, type ShopState } from '../src/board/shop';

describe('grip colours', () => {
  it('a shop sells one colour, never the one on the board, and it changes through the run', () => {
    const seen = new Set<string>();
    for (const current of GRIPS.map((g) => g.id)) {
      for (let visit = 1; visit <= 12; visit++) {
        const g = gripFor(42, visit, current);
        expect(g).not.toBe(current);
        expect(isGrip(g)).toBe(true);
        seen.add(g);
      }
    }
    expect(seen.size).toBeGreaterThan(4);
  });

  it('buying takes the price and sells out; a restock keeps it sold', () => {
    const s: ShopState = { cash: GRIP.price + 5, board: [null], stock: [], restocks: 0, grip: 'lime' };
    const got = buyGrip(s)!;
    expect(got.cash).toBe(5);
    expect(got.grip).toBeNull();
    expect(buyGrip(got)).toBeNull();
    expect(buyGrip({ ...s, cash: GRIP.price - 1 })).toBeNull();
    expect(restock({ ...got, cash: 100 }, 1, 1)!.grip).toBeNull();
  });
});

describe('grip shop card colour', () => {
  const lum = (hex: number) => {
    const lin = (v: number) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin((hex >> 16) & 255) + 0.7152 * lin((hex >> 8) & 255) + 0.0722 * lin(hex & 255);
  };
  it('lifts classic black to a light grey the name reads in', () => {
    const c = gripCardColor(0x1c1c20);
    expect(lum(c)).toBeGreaterThanOrEqual(0.3);
    expect(c).not.toBe(0xffffff);
  });
  it('leaves bright grips their own colour', () => {
    for (const id of ['cyan', 'yellow', 'lime', 'white', 'pink', 'red', 'purple', 'orange'] as const) expect(gripCardColor(gripDef(id).color)).toBe(gripDef(id).color);
  });
  it('reads on the dark card for every grip', () => {
    for (const g of [...GRIPS, ...RANK_GRIPS]) expect(lum(gripCardColor(g.color)), g.id).toBeGreaterThanOrEqual(0.1);
  });
});
