import { describe, expect, it } from 'vitest';
import { beatOf, BULLET, BulletTime, chainGap, intensity, landCall } from '../src/game/bullet-time';
import { TimeWarp } from '../src/game/time-warp';
import { FLAT, levelOf } from './helpers';
import { Skater, type SkaterEvent } from '../src/physics/skater';

describe('bullet time', () => {
  it('calls a landing: a last-moment catch is a clutch, flush into a falling slope is flush, sketchy is neither', () => {
    expect(landCall('clean', 2, undefined)).toBe('clutch');
    expect(landCall('heavy', BULLET.clutchFrames, undefined)).toBe('clutch');
    expect(landCall('clean', BULLET.clutchFrames + 1, undefined)).toBeNull();
    expect(landCall('clean', undefined, 0.2)).toBe('flush');
    expect(landCall('clean', undefined, 0.6)).toBeNull();
    expect(landCall('sketchy', 1, 0.1)).toBeNull();
    expect(landCall('slam', 1, 0.1)).toBeNull();
  });

  it('only huge combos slow things down, once per milestone, and a new combo starts over', () => {
    const b = new BulletTime();
    const at: number[] = [];
    for (let n = 1; n <= 30; n++) {
      if (b.combo(n, 1)) at.push(n);
      b.update(BULLET.cooldown);
    }
    expect(at).toEqual([12, 18, 24, 30]);
    expect(b.combo(1, 1)).toBeNull();
    for (let n = 2; n < 12; n++) expect(b.combo(n, 1)).toBeNull();
    expect(b.combo(12, 1)).not.toBeNull();
  });

  it('a close call over a car is bullet time too, sharing the cooldown', () => {
    const b = new BulletTime();
    expect(b.near(0, 1)?.hold).toBeCloseTo(BULLET.nearHold);
    expect(b.near(0, 1)).toBeNull();
    expect(b.combo(12, 1)).toBeNull();
  });

  it('cools down so it stays rare, and goes deeper the bigger the combo', () => {
    const b = new BulletTime();
    const first = b.combo(12, 1)!;
    expect(first.slow).toBeCloseTo(BULLET.slow);
    expect(b.combo(18, 1)).toBeNull(); // cooling down
    b.update(BULLET.cooldown);
    b.combo(1, 1);
    for (let n = 2; n < 24; n++) b.combo(n, 1);
    const huge = b.combo(24, 3);
    expect(huge).toBeNull(); // x12 and x18 were passed on the way: x24 only fires once cooled
    expect(intensity(BULLET.comboFirst, 1)).toBe(0);
    expect(intensity(BULLET.comboFull, BULLET.speedFull)).toBe(1);
  });

  it('glides into the slow-mo instead of jolting, holds, then eases out', () => {
    const w = new TimeWarp();
    w.glide(0.3, 0.4, 0.5, 0.6);
    expect(w.scale).toBe(1);
    w.update(0.1);
    expect(w.scale).toBeLessThan(1);
    expect(w.scale).toBeGreaterThan(0.8); // gentle at first
    w.update(0.2);
    expect(w.scale).toBeCloseTo(0.4);
    w.update(0.4);
    expect(w.scale).toBeCloseTo(0.4); // holding
    w.update(0.3);
    expect(w.scale).toBeGreaterThan(0.4);
    w.update(0.5);
    expect(w.scale).toBe(1);
  });
});

describe('quick chains', () => {
  it('three beats of two kinds right on each other\'s heels is bullet time; spaced out, or all one kind, is not', () => {
    const b = new BulletTime();
    expect(b.beat('flip', 0, 1, 1, 1)).toBeNull();
    expect(b.beat('grind', 0.3, 1, 1, 2)).toBeNull();
    const s = b.beat('flip', 0.6, 1, 1, 0);
    expect(s).not.toBeNull();
    expect(s!.slow).toBeCloseTo(BULLET.chainSlow);
    expect(s!.enter).toBe(BULLET.enter);
    //cooling down
    b.beat('flip', 0.9, 1, 1, 4);
    b.beat('grind', 1.1, 1, 1, 5);
    expect(b.beat('flip', 1.3, 1, 1, 6)).toBeNull();
    b.update(BULLET.chainCooldown);
    //all flips: never
    const f = new BulletTime();
    for (let i = 0; i < 8; i++) expect(f.beat('flip', i * 0.3, 1, 1, i)).toBeNull();
    //a slow one in the middle starts the chain over
    const g = new BulletTime();
    g.beat('flip', 0, 1, 1, 1);
    g.beat('grind', 0.3, 1, 1, 2);
    expect(g.beat('flip', 0.3 + BULLET.chainGap + 0.1, 1, 1, 3)).toBeNull();
    expect(g.beat('grind', 0.3 + BULLET.chainGap + 0.3, 1, 1, 4)).toBeNull(); // 2 beats since the break
    expect(g.beat('flip', 0.3 + BULLET.chainGap + 0.5, 1, 1, 5)).not.toBeNull();
  });

  it('a manual landing counts as a beat but never fires it (no slow-mo on a landing), and a slam breaks the chain', () => {
    const b = new BulletTime();
    b.beat('flip', 0, 1, 1, 1);
    b.beat('grind', 0.3, 1, 1, 2);
    expect(b.beat('manual', 0.6, 1, 1, 3)).toBeNull();
    expect(b.beat('flip', 0.9, 1, 1, 4)).not.toBeNull();
    const c = new BulletTime();
    c.beat('flip', 0, 1, 1, 1);
    c.beat('grind', 0.3, 1, 1, 2);
    c.chainBreak();
    expect(c.beat('flip', 0.6, 1, 1, 3)).toBeNull();
  });

  it('dead flips are not beats, so spinning the board on a long fall cannot farm it', () => {
    expect(beatOf({ type: 'trick' })).toBe('flip');
    expect(beatOf({ type: 'trick', dead: true })).toBeNull();
    expect(beatOf({ type: 'land', manual: true })).toBe('manual');
    expect(beatOf({ type: 'land' })).toBeNull();
    expect(beatOf({ type: 'rail' })).toBe('grind');
    expect(beatOf({ type: 'hop' })).toBe('hop');
    expect(beatOf({ type: 'clack' })).toBeNull();
  });

  it('speed and a pulled-out camera give the beats more room, a close-up less, within limits', () => {
    expect(chainGap(1, 1)).toBeCloseTo(BULLET.chainGap);
    expect(chainGap(BULLET.speedFull, 1)).toBeCloseTo(BULLET.chainGap * (1 + BULLET.chainSpeed));
    expect(chainGap(1, 1.2)).toBeGreaterThan(chainGap(1, 1));
    expect(chainGap(1, 0.6)).toBeLessThan(chainGap(1, 1));
    expect(chainGap(1, 3)).toBeCloseTo(BULLET.chainGap * BULLET.chainCamMax);
    expect(chainGap(1, 0.1)).toBeCloseTo(BULLET.chainGap * BULLET.chainCamMin);
  });

  it('a chain shares the cooldown with combos and close calls', () => {
    const b = new BulletTime();
    expect(b.near(0, 1)).not.toBeNull();
    b.beat('flip', 0, 1, 1, 1);
    b.beat('grind', 0.3, 1, 1, 2);
    expect(b.beat('flip', 0.6, 1, 1, 3)).toBeNull();
    b.update(BULLET.chainCooldown);
    b.beat('flip', 10, 1, 1, 1);
    b.beat('grind', 10.3, 1, 1, 2);
    expect(b.beat('flip', 10.6, 1, 1, 3)).not.toBeNull();
    expect(b.combo(12, 1)).toBeNull(); // a combo milestone waits the full cooldown
  });
});

describe('landing tags for bullet time', () => {
  // touch down onto flat street, `t` frames into a flip that catches at frame 20 (or with no flip going)
  const land = (t: number | null) => {
    const sk = new Skater(levelOf(FLAT));
    sk.step({ pressed: false, held: false });
    sk.events.length = 0;
    sk.mode = 'air';
    sk.y = sk.level.streetY - 2;
    sk.vsp = 4;
    if (t !== null) {
      sk.trickCatch = 20;
      sk.trickT = t;
    }
    sk.step({ pressed: false, held: false });
    return sk.events.find((e): e is Extract<SkaterEvent, { type: 'land' }> => e.type === 'land')!;
  };

  it('a caught flip carries the frames it was caught with to spare; none for no flip or a late catch', () => {
    expect(land(22).spare).toBe(3); // the touchdown step counts too
    expect(land(40).spare).toBe(21);
    expect(land(15).spare).toBeUndefined();
    expect(land(null).spare).toBeUndefined();
    expect(land(null).flush).toBeUndefined(); // flat: no slope to be flush with
  });
});
