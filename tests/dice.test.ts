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

describe('physics dice', () => {
  it('opposite faces add up to 7, and the face up is read off how a die sits', async () => {
    const { FACE_NORMAL, faceUp } = await import('../src/run/dice-physics');
    const CANNON = await import('cannon-es');
    for (const f of [1, 2, 3, 4, 5, 6] as const) {
      const n = FACE_NORMAL[f];
      const o = FACE_NORMAL[(7 - f) as 1];
      expect(n.map((v, i) => v + o[i])).toEqual([0, 0, 0]);
      //turn the die so face f points up
      const q = new CANNON.Quaternion();
      q.setFromVectors(new CANNON.Vec3(...n), new CANNON.Vec3(0, 1, 0));
      expect(faceUp(q).face).toBe(f);
      expect(faceUp(q).up).toBeGreaterThan(0.999);
    }
  });

  it('thrown dice come to rest flat inside the street, every face about as often (they are fair)', async () => {
    const { DicePhysics, faceUp, DICE_PHYS } = await import('../src/run/dice-physics');
    const rng = makeRng(11);
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const throws = 240;
    let slowest = 0;
    for (let k = 0; k < throws; k++) {
      const bounds = { halfW: 3, back: -3.4, front: 3 };
      const p = new DicePhysics(bounds, rng);
      p.shuffle();
      p.hold({ x: 0, y: 2.1, z: 1.6 });
      p.throw({ x: (rng() - 0.5) * 8, y: 0, z: -8 - rng() * 18 });
      let t = 0;
      while (!p.advance(1 / 60) && t < 20) t += 1 / 60;
      slowest = Math.max(slowest, t);
      const faces = p.landed!;
      expect(faces).toBeTruthy();
      for (const [i, d] of p.dice.entries()) {
        expect(faceUp(d.quaternion).face).toBe(faces[i]);
        expect(Math.abs(d.position.x)).toBeLessThan(bounds.halfW);
        expect(d.position.z).toBeGreaterThan(bounds.back);
        expect(d.position.z).toBeLessThan(bounds.front);
      }
      for (const f of faces) counts[f]++;
    }
    expect(slowest).toBeLessThanOrEqual(DICE_PHYS.maxTime + 0.5);
    //480 dice: 80 a face on average; a fair die stays well inside 50-110
    for (let f = 1; f <= 6; f++) expect(counts[f]).toBeGreaterThan(50), expect(counts[f]).toBeLessThan(110);
  });

  it('a tap mid-tumble runs the same physics to the end at once', async () => {
    const { DicePhysics } = await import('../src/run/dice-physics');
    const p = new DicePhysics({ halfW: 3, back: -3.4, front: 3 }, makeRng(5));
    p.shuffle();
    p.hold({ x: 0, y: 2.1, z: 1.6 });
    p.throw({ x: 1, y: 0, z: -15 });
    p.advance(0.1);
    const faces = p.finish();
    expect(faces.every((f) => f >= 1 && f <= 6)).toBe(true);
  });

  it('a landed pair is paid as it landed, into the winnings', async () => {
    const { settle } = await import('../src/run/dice');
    const won = { head: { ...NO_HEAD_START }, stoken: 0, grip: 'black' as const };
    expect(settle([3, 4], makeRng(1), won).prize).toEqual({ kind: 'stoken', n: DICE.seven });
    expect(settle([5, 6], makeRng(1), won).prize).toEqual({ kind: 'cash', n: DICE.cash });
    expect(settle([6, 6], makeRng(1), won).match).toBe(true);
    expect(won).toMatchObject({ stoken: DICE.seven, head: { cash: DICE.cash, continues: DICE.match } });
  });
});
