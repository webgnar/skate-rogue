import { describe, expect, it } from 'vitest';
import { GRIP, GRIPS, gripFor, isGrip } from '../src/board/grips';
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
