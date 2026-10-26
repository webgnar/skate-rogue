import { describe, expect, it } from 'vitest';
import { BULLET, BulletTime, intensity, landCall } from '../src/game/bullet-time';
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
