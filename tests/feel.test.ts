import { describe, expect, it } from 'vitest';
import { PHYS, TILE } from '../src/physics/constants';
import { BIOME_GRAVITY, FEEL, landQuality, normalImpact } from '../src/physics/feel';
import { CurvedRail, type Level, type Surface } from '../src/physics/level';
import { Skater, type SkaterEvent } from '../src/physics/skater';
import { TRICK_CATCH, TRICK_ROLL } from '../src/physics/tricks';
import { CLIPS, sample } from '../src/render/poses';
import { FLAT, levelOf, pressAt, run } from './helpers';

type Land = Extract<SkaterEvent, { type: 'land' }>;
const lands = (sk: Skater) => sk.events.filter((e): e is Land => e.type === 'land');

// the street, with extra surfaces and rails dropped on it
// (no street under the banks, so you roll onto them)
function withExtras(surfaces: Surface[], rails: CurvedRail[] = [], start?: { x: number; y: number }): Level {
  const base = levelOf(FLAT);
  const banks = surfaces.filter((s) => s.kind === 'bank');
  const street = base.street.map((on, c) => on && !banks.some((s) => (c + 1) * TILE > s.x0 && c * TILE < s.x1));
  return { ...base, street, surfaces: [...base.surfaces, ...surfaces], rails: [...base.rails, ...rails], startX: start?.x ?? base.startX, startY: start?.y ?? base.startY };
}

// rolling off a roof `tiles` up onto the street
function dropFrom(tiles: number): Skater {
  const street = levelOf(FLAT).streetY;
  const y = street - tiles * TILE;
  const sk = new Skater(withExtras([{ kind: 'roof', x0: 0, x1: 4 * TILE, y, row: -1 }], [], { x: TILE, y }));
  run(sk, 140);
  return sk;
}

describe('flip catch stays in sync with the rig', () => {
  it('every trick catches at the clip key where the board stops turning', () => {
    for (const name of new Set(TRICK_ROLL)) {
      const clip = CLIPS[name];
      const end = sample(clip, 99);
      const caught = clip.keys.find((k) => {
        const p = sample(clip, k.t);
        return Math.abs(p.boardRoll - end.boardRoll) < 1e-6 && Math.abs(p.boardYaw - end.boardYaw) < 1e-6;
      })!;
      expect(TRICK_CATCH[name], name).toBeCloseTo(caught.t, 5);
    }
  });
});

describe('landing impact and quality', () => {
  it('a flat ollie lands clean at about the ollie speed', () => {
    const sk = new Skater(levelOf(FLAT));
    run(sk, 60, pressAt(0, 60));
    const [l] = lands(sk);
    expect(l.quality).toBe('clean');
    expect(l.impact).toBeCloseTo(-PHYS.ollie, 0);
  });

  it('impact grows with the drop: a 1 tile drop is a kiss, 4 tiles heavy, 8 tiles sketchy', () => {
    const one = lands(dropFrom(1))[0];
    const four = lands(dropFrom(4))[0];
    const eight = lands(dropFrom(8))[0];
    expect(one.impact).toBeLessThan(FEEL.soft);
    expect(one.quality).toBe('clean');
    expect(four.quality).toBe('heavy');
    expect(eight.quality).toBe('sketchy');
  });

  it('a sketchy landing rocks the skater and the knees take more on bigger drops', () => {
    let peak = 0;
    let rock = 0;
    const sk = (() => {
      const street = levelOf(FLAT).streetY;
      const y = street - 8 * TILE;
      return new Skater(withExtras([{ kind: 'roof', x0: 0, x1: 4 * TILE, y, row: -1 }], [], { x: TILE, y }));
    })();
    for (let f = 0; f < 200; f++) {
      sk.step({ pressed: false, held: false });
      peak = Math.max(peak, sk.feel.squash);
      rock = Math.max(rock, Math.abs(sk.feel.wobble));
    }
    expect(peak).toBeGreaterThan(0.8);
    expect(rock).toBeGreaterThan(0.1);
    //and it all settles
    expect(sk.feel.squash).toBeLessThan(0.02);
    expect(Math.abs(sk.feel.wobble)).toBeLessThan(0.03);
  });

  it('heavy landings cost flow speed, never cruising speed', () => {
    const sk = dropFrom(6);
    expect(sk.hsp).toBeGreaterThanOrEqual(PHYS.baseSpeed - 1e-9);
  });

  it('landing a flip before it is caught: sketchy late in the catch, a slam early', () => {
    expect(landQuality(5, 1, false)).toBe('clean');
    expect(landQuality(5, 0.8, false)).toBe('sketchy');
    expect(landQuality(5, 0.3, false)).toBe('slam');
    expect(landQuality(10, 1, true)).toBe('heavy'); // a bank soaks up a huge drop
  });

  it('touching down mid-flip: sketchy late in the catch, a slam early, clean once caught', () => {
    const land = (t: number) => {
      const sk = new Skater(levelOf(FLAT));
      sk.step({ pressed: false, held: false });
      sk.events.length = 0;
      sk.mode = 'air';
      sk.y = sk.level.streetY - 2;
      sk.vsp = 4;
      sk.trickCatch = 20;
      sk.trickT = t;
      sk.step({ pressed: false, held: false });
      return { quality: lands(sk)[0].quality, slam: sk.events.some((e) => e.type === 'slam') };
    };
    expect(land(20)).toEqual({ quality: 'clean', slam: false });
    expect(land(15)).toEqual({ quality: 'sketchy', slam: false });
    expect(land(5)).toEqual({ quality: 'slam', slam: true });
  });
});

describe('slopes', () => {
  const street = levelOf(FLAT).streetY;
  //a bank falling 2 tiles over 4, from a roof to the street
  const roof: Surface = { kind: 'roof', x0: 0, x1: 4 * TILE, y: street - 2 * TILE, row: -1 };
  const down: Surface = { kind: 'bank', x0: 4 * TILE, x1: 8 * TILE, y: street - 2 * TILE, y1: street, row: -1 };

  it('impact is measured along the surface normal', () => {
    expect(normalImpact(0, 5, 0)).toBeCloseTo(5);
    expect(normalImpact(4, 5, 0.5)).toBeLessThan(normalImpact(4, 5, 0));
    expect(normalImpact(4, 5, -0.5)).toBeGreaterThan(normalImpact(4, 5, 0));
  });

  it('rolling down a bank gains flow speed from gravity', () => {
    const sk = new Skater(withExtras([roof, down], [], { x: TILE, y: roof.y }));
    let top = 0;
    for (let f = 0; f < 80; f++) {
      sk.step({ pressed: false, held: false });
      top = Math.max(top, sk.hsp);
    }
    expect(top).toBeGreaterThan(PHYS.baseSpeed + 0.5);
  });

  it('rolling up a bank eats flow speed but holds cruising speed', () => {
    const up: Surface = { kind: 'bank', x0: 4 * TILE, x1: 10 * TILE, y: street, y1: street - 3 * TILE, row: -1 };
    const roofUp: Surface = { kind: 'roof', x0: 10 * TILE, x1: 14 * TILE, y: street - 3 * TILE, row: -1 };
    const sk = new Skater(withExtras([up, roofUp]));
    sk.carry = 6;
    sk.hsp = 6;
    let low = Infinity;
    for (let f = 0; f < 60; f++) {
      sk.step({ pressed: false, held: false });
      if (sk.surface === up) low = Math.min(low, sk.carry);
    }
    expect(low).toBeLessThan(6 - 0.5);
    expect(sk.hsp).toBeGreaterThanOrEqual(PHYS.baseSpeed - 1e-9);
  });

  it('an ollie on an up bank launches higher than on flat ground', () => {
    const up: Surface = { kind: 'bank', x0: 4 * TILE, x1: 10 * TILE, y: street, y1: street - 3 * TILE, row: -1 };
    const peakOf = (level: Level, at: number) => {
      const sk = new Skater(level);
      let y0 = 0;
      let top = Infinity;
      run(sk, 70, (f) => {
        if (f === at) y0 = sk.y;
        if (f > at) top = Math.min(top, sk.y);
        return { pressed: f === at, held: f >= at };
      });
      return y0 - top;
    };
    expect(peakOf(withExtras([up]), 20)).toBeGreaterThan(peakOf(levelOf(FLAT), 20) + 5);
  });

  it('the board follows the ground under both trucks: level, tipping over the lip, on the slope', () => {
    const sk = new Skater(withExtras([roof, down], [], { x: TILE, y: roof.y }));
    const pitches: number[] = [];
    for (let f = 0; f < 60 && sk.x < 7 * TILE; f++) {
      sk.step({ pressed: false, held: false });
      pitches.push(sk.feel.pitch);
    }
    const slope = Math.atan2(-(down.y1! - down.y), down.x1 - down.x0);
    expect(pitches[0]).toBeCloseTo(0);
    expect(pitches[pitches.length - 1]).toBeCloseTo(slope, 2);
    //somewhere in between while the front truck is on the bank and the back one on the roof
    expect(pitches.some((p) => p < -0.05 && p > slope + 0.05)).toBe(true);
  });

  it('in the air the board eases back to level', () => {
    const sk = new Skater(levelOf(FLAT));
    sk.feel.pitch = 0.5;
    sk.step({ pressed: true, held: true });
    run(sk, 20, () => ({ pressed: false, held: true }));
    expect(Math.abs(sk.feel.pitch)).toBeLessThan(0.1);
  });
});

describe('rails', () => {
  it('a flat curved rail loses a little speed to friction; concrete bites harder than steel', () => {
    const street = levelOf(FLAT).streetY;
    const ride = (material: 'metal' | 'concrete') => {
      const rail = new CurvedRail(3 * TILE, street - 40, 30 * TILE, street - 40, 0);
      rail.material = material;
      const sk = new Skater(withExtras([], [rail], { x: 3 * TILE + 4, y: street - 60 }));
      sk.mode = 'air';
      sk.vsp = 1;
      run(sk, 10);
      expect(sk.mode).toBe('rail');
      const v0 = sk.railV;
      run(sk, 40);
      return v0 - sk.railV;
    };
    const steel = ride('metal');
    const concrete = ride('concrete');
    expect(steel).toBeGreaterThan(0);
    expect(concrete).toBeGreaterThan(steel);
  });

  it('coming down hard onto a rail rocks you more than kissing onto it', () => {
    const street = levelOf(FLAT).streetY;
    const rock = (vsp: number) => {
      const rail = new CurvedRail(3 * TILE, street - 40, 30 * TILE, street - 40, 0);
      const sk = new Skater(withExtras([], [rail], { x: 3 * TILE + 4, y: street - 40 - vsp - 1 }));
      sk.mode = 'air';
      sk.vsp = vsp;
      let w = 0;
      for (let f = 0; f < 30; f++) {
        sk.step({ pressed: false, held: false });
        w = Math.max(w, Math.abs(sk.feel.wobble));
      }
      return w;
    };
    expect(rock(9)).toBeGreaterThan(rock(2));
  });

  it('popping off a down handrail keeps the rail carrying you down', () => {
    const street = levelOf(FLAT).streetY;
    const rail = new CurvedRail(3 * TILE, street - 200, 20 * TILE, street - 40, 0);
    const sk = new Skater(withExtras([], [rail], { x: 3 * TILE + 4, y: street - 220 }));
    sk.mode = 'air';
    sk.vsp = 1;
    run(sk, 30);
    expect(sk.mode).toBe('rail');
    const t = rail.at(sk.railD);
    const down = sk.railV * t.ty;
    sk.step({ pressed: true, held: true });
    expect(sk.vsp).toBeCloseTo(PHYS.ollie + down + PHYS.grav, 1);
  });
});

describe('the lip', () => {
  it('an ollie at the very edge of a roof pops off the lip', () => {
    const street = levelOf(FLAT).streetY;
    const y = street - 3 * TILE;
    const roof: Surface = { kind: 'roof', x0: 0, x1: 6 * TILE, y, row: -1 };
    const at = (x: number) => {
      const sk = new Skater(withExtras([roof], [], { x, y }));
      sk.step({ pressed: true, held: true });
      return (sk.events.find((e) => e.type === 'ollie') as Extract<SkaterEvent, { type: 'ollie' }>).lip;
    };
    expect(at(6 * TILE - 8)).toBe(true);
    expect(at(2 * TILE)).toBe(false);
  });
});

describe('flying into a bank', () => {
  //a terrace with a bank climbing 3 tiles over 4 off its end, then a roof; nothing under any of it (a descent)
  const base = levelOf(FLAT);
  const y = base.streetY - 4 * TILE;
  const terrace: Surface = { kind: 'roof', x0: 0, x1: 6 * TILE, y, row: -1 };
  const bank: Surface = { kind: 'bank', x0: 6 * TILE, x1: 10 * TILE, y, y1: y - 3 * TILE, row: -1 };
  const top: Surface = { kind: 'roof', x0: 10 * TILE, x1: 20 * TILE, y: y - 3 * TILE, row: -1 };
  const level: Level = { ...base, street: base.street.map(() => false), surfaces: [terrace, bank, top], startX: TILE, startY: y };

  const fly = (vsp: number) => {
    const sk = new Skater(level);
    sk.step({ pressed: false, held: false });
    sk.mode = 'air';
    sk.surface = null;
    sk.x = 6 * TILE - 10;
    sk.y = y - 6;
    sk.hsp = 5;
    sk.vsp = vsp;
    for (let f = 0; f < 120 && (sk.mode as string) !== 'bail'; f++) sk.step({ pressed: false, held: false });
    return sk;
  };

  it('rising slower than the bank climbs: you land on it, not through it', () => {
    const sk = fly(-1.5);
    expect(sk.mode).not.toBe('bail');
    expect(sk.events.some((e) => e.type === 'land')).toBe(true);
    expect(sk.x).toBeGreaterThan(10 * TILE);
    expect(sk.y).toBeCloseTo(top.y);
  });

  it('falling into the face of the bank lands on it too', () => {
    const sk = fly(0.5);
    expect(sk.mode).not.toBe('bail');
    expect(sk.y).toBeCloseTo(top.y);
  });

  it('a full ollie off the terrace edge clears the bank and lands on it, never under it', () => {
    for (let at = 0; at < 40; at++) {
      const sk = new Skater(level);
      for (let f = 0; f < 200 && sk.mode !== 'bail'; f++) sk.step({ pressed: f === at, held: f >= at && f < at + 20 });
      expect(sk.mode, `ollie on frame ${at}`).not.toBe('bail');
    }
  });
});

describe('district gravity', () => {
  it("an ollie goes 1/g as high: Outer Space's 0.6 about 1.67x", () => {
    const apex = (gravity?: number) => {
      const sk = new Skater({ ...levelOf(FLAT), gravity });
      let top = sk.y;
      run(sk, 80, (f) => {
        top = Math.min(top, sk.y);
        return { pressed: f === 0, held: true };
      });
      return sk.level.streetY - top;
    };
    expect(apex(0.6) / apex()).toBeCloseTo(1 / 0.6, 1);
    expect(BIOME_GRAVITY.space).toBe(0.6);
    expect(BIOME_GRAVITY.atlantis).toBe(0.8);
  });

  it('the same drop lands softer in low gravity', () => {
    const street = levelOf(FLAT).streetY;
    const drop = (gravity?: number) => {
      const y = street - 4 * TILE;
      const base = withExtras([{ kind: 'roof', x0: 0, x1: 4 * TILE, y, row: -1 }], [], { x: TILE, y });
      const sk = new Skater({ ...base, gravity });
      run(sk, 140);
      return lands(sk)[0].impact!;
    };
    expect(drop(0.6)).toBeLessThan(drop() * 0.85);
  });
});

describe('worn gear', () => {
  it('worn wheels rock you more on a sketchy landing, worn trucks on a rail', () => {
    const street = levelOf(FLAT).streetY;
    const rockLanding = (speed: number) => {
      const y = street - 8 * TILE;
      const sk = new Skater(withExtras([{ kind: 'roof', x0: 0, x1: 4 * TILE, y, row: -1 }], [], { x: TILE, y }));
      sk.gear = { ollie: 1, trick: 1, grind: 1, speed };
      let w = 0;
      for (let f = 0; f < 200; f++) {
        sk.step({ pressed: false, held: false });
        w = Math.max(w, Math.abs(sk.feel.wobble));
      }
      return w;
    };
    expect(rockLanding(0.8)).toBeGreaterThan(rockLanding(1) * 1.2);
    const rockRail = (grind: number) => {
      const rail = new CurvedRail(3 * TILE, street - 40, 30 * TILE, street - 40, 0);
      const sk = new Skater(withExtras([], [rail], { x: 3 * TILE + 4, y: street - 50 }));
      sk.gear = { ollie: 1, trick: 1, grind, speed: 1 };
      sk.mode = 'air';
      sk.vsp = 8;
      let w = 0;
      for (let f = 0; f < 30; f++) {
        sk.step({ pressed: false, held: false });
        w = Math.max(w, Math.abs(sk.feel.wobble));
      }
      return w;
    };
    expect(rockRail(0.7)).toBeGreaterThan(rockRail(1) * 1.2);
  });
});

describe('bounces', () => {
  it('a car hop loads the knees; caught mid-flip it rocks you too', () => {
    const street = levelOf(FLAT).streetY;
    const hop = (midFlip: boolean) => {
      const base = levelOf(FLAT);
      const car = { x0: 5 * TILE, x1: 7 * TILE, roof: street - 40, bottom: street };
      const sk = new Skater({ ...base, cars: [car] });
      sk.step({ pressed: false, held: false });
      sk.mode = 'air';
      sk.x = 6 * TILE;
      sk.y = car.roof - 5;
      sk.vsp = 6;
      if (midFlip) {
        sk.trickCatch = 20;
        sk.trickT = 10;
      }
      let squash = 0;
      let rock = 0;
      for (let f = 0; f < 20; f++) {
        sk.step({ pressed: false, held: false });
        squash = Math.max(squash, sk.feel.squash);
        rock = Math.max(rock, Math.abs(sk.feel.wobble));
      }
      expect(sk.events.some((e) => e.type === 'hop')).toBe(true);
      return { squash, rock };
    };
    expect(hop(false).squash).toBeGreaterThan(0.3);
    expect(hop(false).rock).toBeLessThan(0.01);
    expect(hop(true).rock).toBeGreaterThan(0.1);
  });
});

describe('low ceilings', () => {
  it('bumping a ceiling folds the knees', () => {
    const base = levelOf(FLAT);
    const sk = new Skater({ ...base, ceiling: [{ x0: 0, x1: 20 * TILE, y: base.streetY - 30 - PHYS.height }] });
    let squash = 0;
    //up into it and still in the air, before any landing
    run(sk, 10, (f) => {
      squash = Math.max(squash, sk.feel.squash);
      return { pressed: f === 0, held: true };
    });
    expect(sk.mode).toBe('air');
    expect(squash).toBeGreaterThan(0.2);
  });
});
