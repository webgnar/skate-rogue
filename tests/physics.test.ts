import { describe, expect, it } from 'vitest';
import { PHYS, TILE } from '../src/physics/constants';
import { Skater } from '../src/physics/skater';
import { FixedStep } from '../src/game/loop';
import { FLAT, idle, levelOf, pressAt, run } from './helpers';

function peak(sk: Skater, frames: number, script: (f: number) => { pressed: boolean; held: boolean }): number {
  let top = sk.y;
  for (let f = 0; f < frames; f++) {
    sk.step(script(f));
    top = Math.min(top, sk.y);
  }
  return sk.level.streetY - top;
}

describe('auto-run', () => {
  it('reaches base speed within a second with no input', () => {
    const sk = new Skater(levelOf(FLAT));
    run(sk, 60);
    expect(sk.hsp).toBeCloseTo(PHYS.baseSpeed);
    expect(sk.mode).toBe('roll');
  });
});

describe('ollie', () => {
  it('a held ollie goes at least twice as high as a tap', () => {
    const held = peak(new Skater(levelOf(FLAT)), 80, pressAt(0, 80));
    const tap = peak(new Skater(levelOf(FLAT)), 80, pressAt(0, 2));
    expect(held).toBeGreaterThan(2 * tap);
    expect(held).toBeCloseTo((5 * 5) / (2 * 0.25), -1); // QFS: about 50 px
  });

  it('snaps up fast (zack: "the mechanics of an ollie happen fast"), then hangs and comes down as before', () => {
    const sk = new Skater(levelOf(FLAT));
    const heights: number[] = [];
    let landed = -1;
    run(sk, 60, (f) => {
      heights.push(sk.level.streetY - sk.y);
      if (f > 1 && landed < 0 && sk.mode !== 'air') landed = f;
      return pressAt(0, 60)(f);
    });
    const top = Math.max(...heights);
    //90% of the way up in 9 frames (QFS's plain arc took 14), to the same height
    expect(heights.findIndex((h) => h >= 0.9 * top)).toBeLessThanOrEqual(10);
    expect(top).toBeCloseTo((5 * 5) / (2 * 0.25), -1);
    //and in the air as long, so a gap clears the same (QFS: 39 frames on flat)
    expect(landed).toBeGreaterThanOrEqual(39);
    expect(landed).toBeLessThanOrEqual(42);
  });

  it('second press is a flip trick, third does nothing', () => {
    const sk = new Skater(levelOf(FLAT));
    const presses = new Set([0, 15, 25]);
    run(sk, 30, (f) => ({ pressed: presses.has(f), held: true }));
    const types = sk.events.map((e) => e.type);
    expect(types.filter((t) => t === 'ollie')).toHaveLength(1);
    expect(types.filter((t) => t === 'trick')).toHaveLength(1);
    expect(sk.jumps).toBe(0);
  });

  it('lands back on the street and gets both jumps back', () => {
    const sk = new Skater(levelOf(FLAT));
    run(sk, 120, pressAt(0, 80));
    expect(sk.mode).toBe('roll');
    expect(sk.jumps).toBe(2);
    expect(sk.y).toBe(sk.level.streetY);
  });

  //(zack, 2026-10-25: Lou Gnar's impact lock wins over the buffer, as it did there: the press is lost)
  it('a press just before landing with no jumps left does not ollie through the impact', () => {
    const sk = new Skater(levelOf(FLAT));
    sk.step({ pressed: true, held: true }); // ollie
    sk.step({ pressed: true, held: true }); // trick
    let f = 2;
    while (sk.vsp < 0 || sk.boardY < sk.level.streetY - 3 * sk.vsp - 1) sk.step({ pressed: false, held: false }), f++;
    const before = sk.events.filter((e) => e.type === 'ollie').length;
    sk.step({ pressed: true, held: true });
    for (let i = 0; i < 40; i++) sk.step({ pressed: false, held: true });
    expect(sk.events.filter((e) => e.type === 'ollie').length).toBe(before);
    expect(sk.mode).toBe('roll');
    expect(f).toBeGreaterThan(0);
  });
});

describe('surfaces', () => {
  it('jumps up through a rooftop and lands on top of it', () => {
    const roof = [
      '................', '................', '................', '................', '................',
      '................', '................', '................', '.....RRRRRRRRRR.', '################',
    ];
    const sk = new Skater(levelOf(roof));
    sk.x = 16 * TILE + 3 * TILE; // just before the first copy's roof
    run(sk, 50, pressAt(0, 40));
    expect(sk.mode).toBe('roll');
    expect(sk.y).toBe(9 * TILE);
  });

  it('grinds a flat rail: grinding, 2 jumps, at least grind minimum', () => {
    const rail = [
      '................', '................', '................', '................', '................',
      '................', '................', '................', '..============..', '################',
    ];
    const sk = new Skater(levelOf(rail));
    sk.x = 16 * TILE + 1 * TILE;
    run(sk, 40, pressAt(0, 40));
    expect(sk.mode).toBe('grind');
    expect(sk.jumps).toBe(2);
    expect(sk.hsp).toBeGreaterThanOrEqual(PHYS.grindMin);
  });

  it('a downhill curved rail launches you faster than base speed and keeps it in the air', () => {
    const downhill = [
      '................', '................', '................', '................', '................',
      '..r.............', '................', '................', '.............r..', '################',
    ];
    const level = levelOf(downhill, 24);
    let launched: { hsp: number; vsp: number } | null = null;
    let sk = new Skater(level);
    // try ollie timings until one catches the rail (as a player would)
    for (let at = 0; at < 60 && !launched; at++) {
      sk = new Skater(level);
      sk.x = 16 * TILE - 2 * TILE;
      for (let f = 0; f < 400 && !launched; f++) {
        const wasRail = sk.mode === 'rail';
        sk.step({ pressed: f === at, held: f >= at && f < at + 60 });
        if (wasRail && sk.mode === 'air') launched = { hsp: sk.hsp, vsp: sk.vsp };
      }
    }
    expect(launched).not.toBeNull();
    expect(launched!.hsp).toBeGreaterThan(PHYS.baseSpeed);
    expect(sk.carry).toBeGreaterThan(PHYS.baseSpeed);
    // the extra speed is kept in the air
    const airSpeed = sk.hsp;
    while (sk.mode === 'air') {
      expect(sk.hsp).toBeCloseTo(airSpeed);
      sk.step({ pressed: false, held: false });
    }
    // and it bleeds off on the ground, not all at once
    expect(sk.hsp).toBeGreaterThan(PHYS.baseSpeed);
  });
});

describe('cars', () => {
  const cars = [
    '................', '................', '................', '................', '................',
    '................', '................', '................', '.......c........', '################',
  ];

  it('landing on a roof bounces you up with both jumps', () => {
    const sk = new Skater(levelOf(cars));
    // ollie early enough to come down on the first car (columns 23-24 of the floor)
    const hops = [];
    for (let at = 0; at < 120 && hops.length === 0; at++) {
      const s = new Skater(levelOf(cars));
      s.x = 16 * TILE;
      for (let f = 0; f < 200; f++) {
        s.step({ pressed: f === at, held: f >= at && f < at + 60 });
        if (s.events.some((e) => e.type === 'hop')) {
          hops.push(s);
          expect(s.vsp).toBeLessThan(0);
          expect(s.jumps).toBe(2);
          break;
        }
      }
    }
    expect(hops.length).toBe(1);
    expect(sk.mode).toBe('roll');
  });

  it('running into a car slams you but the run goes on', () => {
    const sk = new Skater(levelOf(cars));
    run(sk, 200);
    expect(sk.events.some((e) => e.type === 'slam')).toBe(true);
    expect(sk.mode).toBe('roll');
    expect(sk.hsp).toBeGreaterThan(0);
  });
});

describe('bail', () => {
  it('missing a canal ends the attempt', () => {
    const canal = [
      '................', '................', '................', '................', '................',
      '................', '................', '................', '................', '####........####',
    ];
    const sk = new Skater(levelOf(canal));
    run(sk, 300);
    expect(sk.mode).toBe('bail');
  });
});

describe('fixed step', () => {
  it('gives the same position at 60 Hz and 120 Hz frames', () => {
    const play = (dt: number, frames: number) => {
      const sk = new Skater(levelOf(FLAT));
      const loop = new FixedStep();
      let step = 0;
      for (let i = 0; i < frames; i++) {
        loop.advance(dt, () => {
          sk.step({ pressed: step === 10, held: step >= 10 && step < 30 });
          step++;
        });
      }
      return [sk.x, sk.y, step];
    };
    expect(play(1 / 60, 60)).toEqual(play(1 / 120, 120));
  });

  it('idle helper does nothing', () => {
    expect(idle(0)).toEqual({ pressed: false, held: false });
  });
});

describe('rail speed', () => {
  it('fades gradually on the ground instead of dropping off', () => {
    const sk = new Skater(levelOf(FLAT));
    sk.carry = 9;
    sk.hsp = 9;
    run(sk, 30);
    // still well above base speed after half a second, and lower than at the start
    expect(sk.hsp).toBeGreaterThan(PHYS.baseSpeed + 3);
    expect(sk.hsp).toBeLessThan(9);
    run(sk, 300);
    expect(sk.hsp).toBeLessThan(PHYS.baseSpeed + 0.6);
  });
});
