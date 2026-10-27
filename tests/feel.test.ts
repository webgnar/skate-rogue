import { describe, expect, it } from 'vitest';
import { PHYS, TILE } from '../src/physics/constants';
import { BIOME_GRAVITY, FEEL, landQuality, MOMENTUM, normalImpact, type MomentumMode } from '../src/physics/feel';
import { CurvedRail, type Level, type Surface } from '../src/physics/level';
import { impactTier, Skater, type SkaterEvent } from '../src/physics/skater';
import { RIG_SCALE } from '../src/physics/tuck';
import { SCALE } from '../src/render/skater-rig';
import { TRICK_CATCH, TRICK_ROLL } from '../src/physics/tricks';
import { CLIPS, sample } from '../src/render/poses';
import { FLAT, levelOf, pressAt, run } from './helpers';
import { addBoon } from '../src/boons/defs';
import { NO_MODS, skaterMods } from '../src/boons/mods';

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

  it("passing under a rail's start doesn't lift you onto it; coming down onto it past the start does", () => {
    const street = levelOf(FLAT).streetY;
    //a high power line: you ollie in under its start, well below it
    const rail = new CurvedRail(6 * TILE, street - 160, 30 * TILE, street - 160, 0);
    const under = new Skater(withExtras([], [rail], { x: 6 * TILE - 8, y: street - 50 }));
    under.mode = 'air';
    under.vsp = -2;
    let snapped = false;
    for (let f = 0; f < 40; f++) {
      under.step({ pressed: false, held: false });
      if ((under.mode as string) === 'rail' || under.y < street - 100) snapped = true;
    }
    expect(snapped).toBe(false);
    //and from just over it, at its start, you land on it
    const over = new Skater(withExtras([], [rail], { x: 6 * TILE - 2, y: street - 170 }));
    over.mode = 'air';
    over.vsp = 1;
    run(over, 20);
    expect(over.mode).toBe('rail');
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

describe('lining up in the air', () => {
  const street = levelOf(FLAT).streetY;
  // off a roof 4 tiles up, over `under`: the board's angle on the last frame in the air, and the ground's
  function comeDown(under: Surface[]): { air: number; ground: number } {
    const y = street - 4 * TILE;
    const sk = new Skater(withExtras([{ kind: 'roof', x0: 0, x1: 4 * TILE, y, row: -1 }, ...under], [], { x: TILE, y }));
    let air = NaN;
    for (let f = 0; f < 200; f++) {
      const was = sk.mode;
      const pitch = sk.feel.pitch;
      sk.step({ pressed: false, held: false });
      if (was === 'air' && sk.mode !== 'air') return { air: pitch, ground: sk.feel.pitch };
      air = pitch;
    }
    return { air, ground: NaN };
  }

  it('dropping onto a bank, the board meets it at its angle', () => {
    const down: Surface = { kind: 'bank', x0: 4 * TILE, x1: 12 * TILE, y: street - 2 * TILE, y1: street, row: -1 };
    const { air, ground } = comeDown([down]);
    expect(ground).toBeLessThan(-0.2); // nose down the bank
    expect(Math.abs(air - ground)).toBeLessThan(0.05);
  });

  it('dropping toward an up bank, the nose comes up to meet it', () => {
    const up: Surface = { kind: 'bank', x0: 4 * TILE, x1: 14 * TILE, y: street, y1: street - 3 * TILE, row: -1 };
    const { air, ground } = comeDown([up]);
    expect(ground).toBeGreaterThan(0.2);
    expect(Math.abs(air - ground)).toBeLessThan(0.05);
  });

  it('dropping to flat ground, the board stays level', () => {
    expect(Math.abs(comeDown([]).air)).toBeLessThan(0.01);
  });

  it('high over the ground, the board stays level and only lines up as the ground comes up', () => {
    const level = withExtras([{ kind: 'bank', x0: 0, x1: 40 * TILE, y: street, y1: street - 10 * TILE, row: -1 }], [], { x: 2 * TILE, y: street - 20 * TILE });
    const sk = new Skater(level);
    sk.step({ pressed: false, held: false });
    expect(sk.mode).toBe('air');
    expect(Math.abs(sk.feel.pitch)).toBeLessThan(0.01);
  });
});

describe('momentum on slopes (?momentum=, being explored)', () => {
  const street = levelOf(FLAT).streetY;
  const upRamp: Surface = { kind: 'bank', x0: 10 * TILE, x1: 14 * TILE, y: street, y1: street - 2 * TILE, row: -1 };
  const crest = (): Surface[] => [{ kind: 'roof', x0: 0, x1: 12 * TILE, y: street - 6 * TILE, row: -1 }, { kind: 'bank', x0: 15 * TILE, x1: 29 * TILE, y: street - 5.5 * TILE, y1: street - 1.5 * TILE, row: -1 }];
  // speed in, speed out and the land event of the first landing, with an ollie at `ollieAt` tiles
  function landing(mode: MomentumMode, surfaces: Surface[], start: { x: number; y: number }, speed: number, ollieAt: number) {
    MOMENTUM.mode = mode;
    try {
      const sk = new Skater(withExtras(surfaces, [], start));
      sk.hsp = speed;
      sk.carry = speed;
      let popped = false;
      for (let f = 0; f < 200; f++) {
        const press: boolean = !popped && sk.x >= ollieAt * TILE;
        popped ||= press;
        const before = sk.hsp;
        sk.step({ pressed: press, held: press || (popped && sk.vsp < 0) });
        const e = lands(sk)[0];
        if (e) return { before, after: sk.hsp, e };
        sk.events.length = 0;
      }
      throw new Error('never landed');
    } finally {
      MOMENTUM.mode = 'real';
    }
  }
  const early = (mode: MomentumMode) => landing(mode, [upRamp], { x: 2 * TILE, y: street }, 6.5, 6);
  const crestJump = (mode: MomentumMode) => landing(mode, crest(), { x: 2 * TILE, y: street - 6 * TILE }, 6.5, 11.7);

  it('by default an early ollie onto an up ramp drops you to cruising speed', () => {
    const { before, after } = early('real');
    expect(before).toBeGreaterThan(5.5);
    expect(after).toBeCloseTo(PHYS.baseSpeed, 1);
  });

  it('soften: landing on the face of an up ramp keeps most of your speed', () => {
    const { before, after } = early('soften');
    expect(after).toBeCloseTo(before * MOMENTUM.keep, 1);
  });

  it('transfer: landing in line with a down slope carries you out faster, and says how lined up you were', () => {
    const real = crestJump('real');
    const t = crestJump('transfer');
    expect(t.e.lined).toBeGreaterThan(0.2);
    expect(t.after).toBeGreaterThan(real.after * 1.05);
    expect(real.e.lined).toBeUndefined();
    //soften leaves down slopes alone, transfer leaves up ramps alone
    expect(crestJump('soften').after).toBeCloseTo(real.after, 5);
    expect(early('transfer').after).toBeCloseTo(early('real').after, 5);
  });
});

describe('the board is the box (zack, 2026-10-25)', () => {
  const street = levelOf(FLAT).streetY;
  const y = street - 3 * TILE;
  const roof: Surface = { kind: 'roof', x0: 4 * TILE, x1: 8 * TILE, y, row: -1 };
  const level = (): Level => ({ ...withExtras([roof]), street: levelOf(FLAT).street.map(() => false) });

  it('the collision box is as long as the board', () => {
    expect(PHYS.width).toBe(30);
  });

  it('dropping with the back truck over a roof edge lands you on it', () => {
    const sk = new Skater(level());
    sk.mode = 'air';
    sk.surface = null;
    sk.x = roof.x1 + FEEL.wheelbase / 2 - 2; // the middle of the board just past the edge, the back truck over it
    sk.y = y - 10;
    sk.hsp = 0.01;
    sk.vsp = 2;
    for (let f = 0; f < 20 && sk.mode === 'air'; f++) sk.step({ pressed: false, held: false });
    expect(sk.mode).toBe('roll');
    expect(sk.y).toBeCloseTo(y);
  });

  it('rolling off a roof, you stay on it until the back truck rolls off, level the whole way', () => {
    const sk = new Skater(withExtras([roof], [], { x: 5 * TILE, y }));
    let left = 0;
    for (let f = 0; f < 120 && !left; f++) {
      sk.step({ pressed: false, held: false });
      if (sk.mode === 'air') left = sk.x;
      else expect(sk.feel.pitch).toBeCloseTo(0);
    }
    expect(left - roof.x1).toBeGreaterThan(FEEL.wheelbase / 2 - PHYS.baseSpeed - 0.5);
    expect(left - roof.x1).toBeLessThanOrEqual(FEEL.wheelbase / 2 + PHYS.baseSpeed);
  });

  it('a bank or stairs needs the middle of the board on it, not a truck', () => {
    const bank: Surface = { kind: 'bank', x0: 4 * TILE, x1: 8 * TILE, y, y1: y - TILE, row: -1 };
    const sk = new Skater({ ...withExtras([bank]), street: levelOf(FLAT).street.map(() => false) });
    sk.mode = 'air';
    sk.surface = null;
    sk.x = bank.x1 + 4;
    sk.y = y - 2 * TILE;
    sk.hsp = 0.01;
    sk.vsp = 2;
    for (let f = 0; f < 60 && sk.mode === 'air'; f++) sk.step({ pressed: false, held: false });
    expect(sk.surface).not.toBe(bank);
  });
});

describe('tucked in the air, the board is what lands (zack, 2026-10-25)', () => {
  const street = levelOf(FLAT).streetY;

  it("the lift follows the clips: an ollie's peak about 18 px, the air clip none", () => {
    const sk = new Skater(levelOf(FLAT));
    let peak = 0;
    for (let f = 0; f < 80; f++) {
      sk.step({ pressed: f === 0, held: f < 20 });
      peak = Math.max(peak, sk.tuck.lift);
      if (sk.mode === 'air') expect(sk.boardY).toBeCloseTo(sk.y - sk.tuck.lift);
    }
    const clip = Math.max(...CLIPS.ollie.keys.map((k) => k.pose.boardY ?? 0)) * RIG_SCALE * TILE;
    expect(peak).toBeGreaterThan(clip * 0.9);
    expect(peak).toBeLessThanOrEqual(clip + 0.01);
    expect(Math.max(...CLIPS.air.keys.map((k) => k.pose.boardY ?? 0))).toBe(0);
  });

  it('the rig is drawn at the scale the tuck reads the clips at', () => {
    expect(RIG_SCALE).toBe(SCALE);
  });

  // a plain ollie from the street, and a ledge halfway between the feet's and the board's highest points
  const ollie = () => {
    const sk = new Skater(levelOf(FLAT));
    let feetTop = Infinity;
    let boardTop = Infinity;
    for (let f = 0; f < 80; f++) {
      sk.step({ pressed: f === 0, held: f < 20 });
      feetTop = Math.min(feetTop, sk.y);
      boardTop = Math.min(boardTop, sk.boardY);
    }
    return { feetTop, boardTop, y: Math.round((feetTop + boardTop) / 2) };
  };
  const ontoLedge = (y: number) => {
    const ledge: Surface = { kind: 'ledge', x0: 5 * TILE, x1: 30 * TILE, y, row: -1 };
    const sk = new Skater(withExtras([ledge]));
    let drop = 0;
    for (let f = 0; f < 80; f++) {
      const air = sk.mode === 'air';
      sk.step({ pressed: f === 0, held: f < 20 });
      if (air && sk.mode === 'roll') drop = sk.feel.drop;
    }
    return { sk, ledge, drop };
  };

  it('a board that clears a ledge lands on it, though the feet tucked under it never get that high', () => {
    const { feetTop, boardTop, y } = ollie();
    expect(feetTop).toBeGreaterThan(y);
    expect(boardTop).toBeLessThan(y);
    const { sk, ledge } = ontoLedge(y);
    expect(sk.surface).toBe(ledge);
    expect(sk.y).toBeCloseTo(y);
  });

  it('landing on a lifted board, the skater is drawn lower and the legs reach down to it over the crossfade', () => {
    const { sk, drop } = ontoLedge(ollie().y);
    expect(drop).toBeGreaterThan(5);
    expect(sk.feel.drop).toBe(0);
  });

  it('a plain ollie to flat lands with the board back under the feet (the clip is over by then)', () => {
    const sk = new Skater(levelOf(FLAT));
    for (let f = 0; f < 80; f++) {
      const air = sk.mode === 'air';
      sk.step({ pressed: f === 0, held: f < 20 });
      if (air && sk.mode === 'roll') expect(sk.feel.drop).toBeLessThan(8);
    }
    expect(sk.y).toBe(street);
  });
});

// zack (2026-10-25): Lou Gnar's rule, no ollie while the impact animation plays (IMPACT_DURATION 350 ms)
describe('no ollie during the impact', () => {
  // ollie on the flat, land, then press `after` frames after touching down
  function pressAfterLanding(after: number): { ollied: boolean } {
    const sk = new Skater(levelOf(FLAT));
    run(sk, 1, pressAt(0));
    let landed = -1;
    let ollied = false;
    for (let f = 1; f < 200; f++) {
      const press = landed >= 0 && f === landed + after;
      sk.step({ pressed: press, held: press });
      if (landed < 0 && lands(sk).length) landed = f;
      //(the skater's events pile up until the sim takes them: the first ollie is one)
      else if (landed >= 0 && sk.events.filter((e) => e.type === 'ollie').length > 1) ollied = true;
    }
    return { ollied };
  }

  it('a press while the knees take the landing is lost', () => {
    expect(pressAfterLanding(1).ollied).toBe(false);
    expect(pressAfterLanding(PHYS.impactTiers[0].frames - 1).ollied).toBe(false);
  });

  it('once the impact is over, the ollie pops at once', () => {
    expect(pressAfterLanding(PHYS.impactTiers[0].frames + 1).ollied).toBe(true);
  });

  // zack (2026-10-27): the impact grows with the drop, in three tiers, each with its own wait to pop again
  it('an ollie on flat is a small drop; bigger drops lock you out longer', () => {
    const sk = new Skater(levelOf(FLAT));
    run(sk, 1, pressAt(0));
    let land: SkaterEvent | undefined;
    for (let f = 1; f < 200 && !land; f++) {
      sk.step({ pressed: false, held: false });
      land = lands(sk)[0];
    }
    expect(land).toMatchObject({ drop: 'small', lock: PHYS.impactTiers[0].frames });
    expect(impactTier(50).drop).toBe('small');
    expect(impactTier(150).drop).toBe('medium');
    expect(impactTier(400).drop).toBe('big');
    const frames = PHYS.impactTiers.map((t) => t.frames);
    expect([...frames].sort((a, b) => a - b)).toEqual(frames);
  });

  it('a big drop holds the ollie back for the big tier', () => {
    const sk = new Skater(levelOf(FLAT));
    Object.assign(sk, { mode: 'air', y: sk.y - 300, topY: sk.y - 300, vsp: 0, surface: null });
    let landedAt = -1;
    let popped = -1;
    for (let f = 0; f < 200; f++) {
      const press = landedAt >= 0 && popped < 0;
      sk.step({ pressed: press, held: press });
      if (landedAt < 0 && lands(sk).length) {
        expect(lands(sk)[0]).toMatchObject({ drop: 'big', lock: PHYS.impactTiers[2].frames });
        landedAt = f;
      } else if (landedAt >= 0 && sk.events.some((e) => e.type === 'ollie')) popped = f;
    }
    expect(popped - landedAt).toBeGreaterThanOrEqual(PHYS.impactTiers[2].frames);
  });

  // zack (2026-10-26): the Strong Legs boon gives a panicked second tap its ollie
  function tapsAfterLanding(taps: number[], mods = NO_MODS): { ollied: boolean; at: number } {
    const sk = new Skater(levelOf(FLAT), mods);
    run(sk, 1, pressAt(0));
    let landed = -1;
    let at = -1;
    for (let f = 1; f < 200; f++) {
      const press = landed >= 0 && taps.includes(f - landed);
      sk.step({ pressed: press, held: press });
      if (landed < 0 && lands(sk).length) landed = f;
      else if (landed >= 0 && at < 0 && sk.events.filter((e) => e.type === 'ollie').length > 1) at = f - landed;
    }
    return { ollied: at >= 0, at };
  }

  it('Strong Legs: a second tap during the impact ollies right then; one tap still waits', () => {
    const legs = skaterMods(addBoon([], 'strongLegs'));
    expect(tapsAfterLanding([2, 5]).ollied).toBe(false);
    const twice = tapsAfterLanding([2, 5], legs);
    expect(twice.ollied).toBe(true);
    expect(twice.at).toBe(5);
    expect(tapsAfterLanding([2], legs).ollied).toBe(false);
  });

});
