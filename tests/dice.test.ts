import { describe, expect, it } from 'vitest';
import { cleanHeadStart, comboOf, DICE, NO_HEAD_START, payout, roll, rollAll, rollName, rollsFor } from '../src/run/dice';
import { makeRng } from '../src/gen/rng';
import { buildFloor } from '../src/gen/descent';

describe('street dice', () => {
  it('the combo decides the pay: no dice a scrap, straights and sevens Stoken, elevens and doubles a head start, boxcars the MATCH', () => {
    const rng = makeRng(3);
    expect(comboOf(4, 2)).toBe('miss');
    expect(payout(4, 2, rng, NO_HEAD_START, 'black')).toEqual({ kind: 'stoken', n: DICE.miss });
    expect(payout(1, 3, rng, NO_HEAD_START, 'black')).toEqual({ kind: 'stoken', n: DICE.miss });
    expect(comboOf(1, 2)).toBe('straight');
    expect(payout(4, 5, rng, NO_HEAD_START, 'black')).toEqual({ kind: 'stoken', n: DICE.straight });
    expect(comboOf(3, 4)).toBe('seven');
    expect(payout(2, 5, rng, NO_HEAD_START, 'black')).toEqual({ kind: 'stoken', n: DICE.seven });
    expect(comboOf(6, 5)).toBe('eleven');
    expect(payout(6, 5, rng, NO_HEAD_START, 'black')).toEqual({ kind: 'cash', n: DICE.cash });
    expect(rollName({ dice: [4, 2], prize: { kind: 'stoken', n: 1 }, match: false })).toBe('NO DICE (6)');
    expect(DICE.miss).toBeLessThan(DICE.straight);
    expect(DICE.straight).toBeLessThan(DICE.seven);
    expect(payout(2, 2, rng, NO_HEAD_START, 'black')).toEqual({ kind: 'cash', n: DICE.cash });
    expect(payout(3, 3, rng, NO_HEAD_START, 'black')).toEqual({ kind: 'cash', n: DICE.cash });
    expect(payout(4, 4, rng, NO_HEAD_START, 'black')).toEqual({ kind: 'boon' });
    expect(payout(5, 5, rng, NO_HEAD_START, 'black')).toEqual({ kind: 'continue', n: 1 });
    expect(payout(6, 6, rng, NO_HEAD_START, 'black')).toEqual({ kind: 'continue', n: DICE.match });
    const snake = payout(1, 1, rng, NO_HEAD_START, 'black');
    expect(snake.kind).toBe('grip');
    if (snake.kind === 'grip') expect(snake.grip).not.toBe('black');
  });

  it('the MATCH and 5-5 pay Stoken once the most continues are held', () => {
    const full = { ...NO_HEAD_START, continues: DICE.maxContinues };
    expect(payout(6, 6, makeRng(1), full, 'black')).toEqual({ kind: 'stoken', n: DICE.matchOver });
    expect(payout(5, 5, makeRng(1), full, 'black')).toEqual({ kind: 'stoken', n: DICE.heldOver });
    expect(payout(6, 6, makeRng(1), { ...NO_HEAD_START, continues: 1 }, 'black')).toEqual({ kind: 'continue', n: 1 });
  });

  it('one free roll every run, one more per chip, up to the most', () => {
    expect(rollsFor(0)).toBe(1);
    expect(rollsFor(2)).toBe(3);
    expect(rollsFor(40)).toBe(DICE.maxRolls);
  });

  it('every roll pays, doubles come about 1 in 6, the MATCH about 1 in 36', () => {
    const rng = makeRng(9);
    const rolls = Array.from({ length: 36000 }, () => roll(rng, NO_HEAD_START, 'black'));
    for (const r of rolls) {
      expect(r.dice[0]).toBeGreaterThanOrEqual(1);
      expect(r.dice[1]).toBeLessThanOrEqual(6);
      if (r.prize.kind === 'stoken') expect(r.prize.n).toBeGreaterThan(0);
      expect(r.match).toBe(r.dice[0] === 6 && r.dice[1] === 6);
    }
    const doubles = rolls.filter((r) => r.dice[0] === r.dice[1]).length / rolls.length;
    const match = rolls.filter((r) => r.match).length / rolls.length;
    expect(doubles).toBeGreaterThan(0.15);
    expect(doubles).toBeLessThan(0.185);
    expect(match).toBeGreaterThan(0.022);
    expect(match).toBeLessThan(0.034);
    expect(rollName(rolls.find((r) => r.match)!)).toBe('BOXCARS!');
  });

  it('many rolls add up, and saved continues stop at the cap', () => {
    const won = rollAll(makeRng(5), 200, NO_HEAD_START, 'black');
    expect(won.rolls).toHaveLength(200);
    expect(won.head.continues).toBeLessThanOrEqual(DICE.maxContinues);
    expect(won.stoken).toBeGreaterThan(200 * 2 * 0.5);
  });

  it('a bad save cleans up', () => {
    expect(cleanHeadStart({ cash: '40', continues: 9 })).toEqual({ cash: 40, boons: 0, continues: DICE.maxContinues });
  });
});

describe('chips (spin tokens)', () => {
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

describe('3D dice', () => {
  it('every result lands with its face pointing at you', async () => {
    const THREE = await import('three');
    const { restingQuat, DICE3D } = await import('../src/render/dice3d');
    const normals: Record<number, [number, number, number]> = { 1: [0, 1, 0], 6: [0, -1, 0], 2: [1, 0, 0], 5: [-1, 0, 0], 3: [0, 0, 1], 4: [0, 0, -1] };
    for (const f of [1, 2, 3, 4, 5, 6] as const) {
      const n = new THREE.Vector3(...normals[f]).applyQuaternion(restingQuat(f, 0.3));
      expect(n.dot(DICE3D.view)).toBeGreaterThan(0.999);
    }
  });
});
