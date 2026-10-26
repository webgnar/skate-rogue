import { describe, expect, it } from 'vitest';
import { BULLET, BulletTime, intensity } from '../src/game/bullet-time';
import { TimeWarp } from '../src/game/time-warp';
import { FLAT, levelOf } from './helpers';
import { Skater, type SkaterEvent } from '../src/physics/skater';

describe('bullet time', () => {
  it('reads a landing: a last-moment catch is a clutch, flush into a falling slope is flush, sketchy is neither', () => {
    const b = new BulletTime();
    expect(b.land('clean', 2, undefined)).toBe('clutch');
    expect(b.land('heavy', BULLET.clutchFrames, undefined)).toBe('clutch');
    expect(b.land('clean', BULLET.clutchFrames + 1, undefined)).toBeNull();
    expect(b.land('clean', undefined, 0.2)).toBe('flush');
    expect(b.land('clean', undefined, 0.6)).toBeNull();
    expect(b.land('sketchy', 1, 0.1)).toBeNull();
    expect(b.land('slam', 1, 0.1)).toBeNull();
  });

  it('marks combo milestones once each, and starts over with a new combo', () => {
    const b = new BulletTime();
    const hits = [];
    for (let n = 1; n <= 21; n++) hits.push(b.combo(n));
    expect(hits.filter(Boolean)).toHaveLength(2); // x10 and x20
    expect(b.combo(1)).toBeNull();
    for (let n = 2; n < 10; n++) b.combo(n);
    expect(b.combo(10)).toBe('combo');
  });

  it('only makes a close call bullet time inside a combo', () => {
    const b = new BulletTime();
    expect(b.near(0)).toBeNull();
    expect(b.near(BULLET.nearCombo)).toBe('near');
  });

  it('cools down so it stays rare, and goes deeper the more intense the run', () => {
    const b = new BulletTime();
    const calm = b.fire('clutch', 0, 1)!;
    expect(calm.slow).toBeCloseTo(BULLET.moments.clutch.slow);
    expect(b.fire('flush', 0, 1)).toBeNull();
    b.update(BULLET.cooldown - 0.1);
    expect(b.fire('flush', 0, 1)).toBeNull();
    b.update(0.2);
    const wild = b.fire('clutch', 20, 3)!;
    expect(wild.slow).toBeLessThan(calm.slow);
    expect(wild.hold).toBeGreaterThan(calm.hold);
    expect(intensity(0, 1)).toBe(0);
    expect(intensity(BULLET.comboFull, BULLET.speedFull)).toBe(1);
  });

  it('holds the slow-mo before easing out', () => {
    const w = new TimeWarp();
    w.hit(0, 0.3, 0.5, 0.4);
    w.update(0.3);
    expect(w.scale).toBeCloseTo(0.3);
    w.update(0.2); // 0.1 s into the ease
    expect(w.scale).toBeGreaterThan(0.3);
    expect(w.scale).toBeLessThan(1);
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
