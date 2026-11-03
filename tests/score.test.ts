import { describe, expect, it } from 'vitest';
import { PHYS } from '../src/physics/constants';
import { RunScore, SCORE } from '../src/run/score';

describe('landing quality', () => {
  const combo = () => {
    const r = new RunScore();
    r.onEvent({ type: 'trick', index: 0, name: 'kickflip', spin: 0, fakie: false }, PHYS.baseSpeed);
    return r;
  };
  it('a sketchy landing banks half, a heavy one adds a big-drop bonus', () => {
    const clean = combo().onEvent({ type: 'land', quality: 'clean' }, PHYS.baseSpeed)!;
    const sketchy = combo().onEvent({ type: 'land', quality: 'sketchy' }, PHYS.baseSpeed)!;
    const heavy = combo().onEvent({ type: 'land', quality: 'heavy' }, PHYS.baseSpeed)!;
    expect(sketchy.points).toBe(Math.round(clean.points * SCORE.sketchy));
    expect(sketchy.how).toBe('sketchy');
    expect(heavy.points).toBeGreaterThan(clean.points);
    expect(heavy.how).toBe('big');
  });
  it('a big drop with no tricks still pays, and a lip pop is style', () => {
    expect(new RunScore().onEvent({ type: 'land', quality: 'heavy' }, PHYS.baseSpeed)?.points).toBe(SCORE.bigDrop);
    const r = new RunScore();
    r.onEvent({ type: 'ollie', spin: 0, lip: true }, PHYS.baseSpeed);
    expect(r.onEvent({ type: 'land', quality: 'clean' }, PHYS.baseSpeed)?.points).toBe(SCORE.lip);
  });
});

describe('slams and the stoke meter', () => {
  it('a slam empties the stoke meter', () => {
    const r = new RunScore();
    r.stoke = 0.8;
    r.onEvent({ type: 'slam' }, PHYS.baseSpeed);
    expect(r.stoke).toBe(0);
  });
  it('a slam in the gnar state ends it', () => {
    const r = new RunScore();
    r.gnarT = SCORE.gnarSecs;
    r.onEvent({ type: 'slam' }, PHYS.baseSpeed);
    expect(r.gnar).toBe(false);
    expect(r.stoke).toBe(0);
  });
  it('Slam Stoke still fills the meter on a slam', () => {
    const r = new RunScore();
    r.slamStoke = true;
    r.stoke = 0.5;
    r.onEvent({ type: 'slam' }, PHYS.baseSpeed);
    expect(r.stoke).toBeCloseTo(0.5 + SCORE.slamStoke);
  });
});
