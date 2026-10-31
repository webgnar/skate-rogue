import { describe, expect, it } from 'vitest';
import { cleanHeadStart, NO_HEAD_START, pull, pullAll, SLOTS } from '../src/run/slots';
import { makeRng } from '../src/gen/rng';
import { buildFloor } from '../src/gen/descent';

describe('slot machine', () => {
  it('every pull pays, and a plain pull is never three of a kind', () => {
    const rng = makeRng(3);
    for (let i = 0; i < 2000; i++) {
      const p = pull(rng, NO_HEAD_START, 'black');
      const three = p.reels[0] === p.reels[1] && p.reels[1] === p.reels[2];
      if (p.prize.kind === 'stoken' && !three) expect(p.prize.n).toBeGreaterThanOrEqual(SLOTS.small[0]);
      if (p.prize.kind !== 'stoken') expect(three).toBe(true);
      if (p.prize.kind === 'grip') expect(p.prize.grip).not.toBe('black');
    }
  });

  it('most pulls are small Stoken, and three of a kind turns up', () => {
    const rng = makeRng(9);
    const pulls = Array.from({ length: 4000 }, () => pull(rng, NO_HEAD_START, 'black'));
    const small = pulls.filter((p) => p.prize.kind === 'stoken' && p.prize.n <= SLOTS.small[1]).length / pulls.length;
    expect(small).toBeGreaterThan(0.45);
    for (const k of ['cash', 'boon', 'continue', 'grip']) expect(pulls.some((p) => p.prize.kind === k)).toBe(true);
  });

  it('many pulls add up, and saved continues stop at the cap', () => {
    const won = pullAll(makeRng(5), 200, NO_HEAD_START, 'black');
    expect(won.pulls).toHaveLength(200);
    expect(won.head.continues).toBeLessThanOrEqual(SLOTS.maxContinues);
    expect(won.stoken).toBeGreaterThan(200 * SLOTS.small[0] * 0.5);
  });

  it('a bad save cleans up', () => {
    expect(cleanHeadStart({ cash: '40', continues: 9 })).toEqual({ cash: 40, boons: 0, continues: SLOTS.maxContinues });
  });
});

describe('spin tokens', () => {
  it('turn up now and then across floors, in props or on the lines', () => {
    let pickups = 0;
    let props = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const level = buildFloor(seed, 3, undefined, { hills: true });
      pickups += level.pickups.filter((p) => p.kind === 'spin').length;
      props += level.props.filter((p) => p.loot === 'spin').length;
      expect(level.props.filter((p) => p.loot === 'spin').length).toBeLessThanOrEqual(1);
    }
    expect(pickups + props).toBeGreaterThan(3);
    expect(pickups + props).toBeLessThan(45);
  });
});
