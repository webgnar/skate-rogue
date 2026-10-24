import { describe, expect, it } from 'vitest';
import { validatedFloor } from '../src/gen/validate';
import { validatedEscape } from '../src/gen/escape';
import { BOUNTY, bountyPay } from '../src/run/bounty';

describe('wanted posters', () => {
  it('turn up on about a third of floors from 2, never on floor 1, stash floors or escapes', () => {
    expect(Array.from({ length: 10 }, (_, s) => validatedFloor(s * 13 + 1, 1).level.bounty).filter(Boolean)).toHaveLength(0);
    const n = Array.from({ length: 30 }, (_, s) => validatedFloor(s * 13 + 1, 4).level.bounty).filter(Boolean).length;
    expect(n).toBeGreaterThan(4);
    expect(n).toBeLessThan(18);
    for (let s = 1; s < 12; s++) expect(validatedFloor(s * 13, 5, { short: true }).level.bounty).toBeUndefined();
    expect(validatedEscape(5, 1).bounty).toBeUndefined();
  });

  it("pays the floor's Stoken again, at least 3, only when the gate is hot", () => {
    expect(bountyPay(5, BOUNTY.heat)).toBe(5);
    expect(bountyPay(0, 80)).toBe(BOUNTY.min);
    expect(bountyPay(9, BOUNTY.heat - 1)).toBe(0);
  });
});
