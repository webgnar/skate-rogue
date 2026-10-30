import { describe, expect, it } from 'vitest';
import { addBoon, BOONS, stacksOf, type BoonId, type Held } from '../src/boons/defs';
import { skaterMods } from '../src/boons/mods';
import { offerBoons } from '../src/boons/offer';
import { PHYS, TILE } from '../src/physics/constants';
import { CurvedRail } from '../src/physics/level';
import { Skater, type StepInput } from '../src/physics/skater';
import { FLAT, levelOf, pressAt, run } from './helpers';

const RAIL = [
  '................', '................', '................', '................', '................',
  '................', '................', '................', '..============..', '################',
];

function withBoons(...ids: BoonId[]): Held[] {
  return ids.reduce<Held[]>((held, id) => addBoon(held, id), []);
}

function skater(rows: string[], ...ids: BoonId[]): Skater {
  return new Skater(levelOf(rows), skaterMods(withBoons(...ids)));
}

function peak(sk: Skater, frames: number, script: (f: number) => StepInput): number {
  let top = sk.y;
  for (let f = 0; f < frames; f++) {
    sk.step(script(f));
    top = Math.min(top, sk.y);
  }
  return sk.level.streetY - top;
}

describe('boon data', () => {
  it('has 7 POP, 6 GRIND, 6 FLOW, 7 COOL, 4 LUCK and 5 STREET boons, plus curses and duos, with unique ids', () => {
    const plain = BOONS.filter((b) => !b.cursed && !b.duo);
    expect(plain.filter((b) => b.type === 'POP')).toHaveLength(7);
    expect(plain.filter((b) => b.type === 'GRIND')).toHaveLength(6);
    expect(plain.filter((b) => b.type === 'FLOW')).toHaveLength(6);
    expect(plain.filter((b) => b.type === 'COOL')).toHaveLength(7);
    expect(plain.filter((b) => b.type === 'LUCK')).toHaveLength(4);
    expect(plain.filter((b) => b.type === 'STREET')).toHaveLength(5);
    expect(BOONS.filter((b) => b.cursed)).toHaveLength(3);
    expect(BOONS.filter((b) => b.duo)).toHaveLength(3);
    expect(new Set(BOONS.map((b) => b.id)).size).toBe(BOONS.length);
  });

  it('stacks up to max and no further', () => {
    const held = withBoons('bigPop', 'bigPop', 'bigPop', 'bigPop', 'tripleThreat', 'tripleThreat');
    expect(stacksOf(held, 'bigPop')).toBe(3);
    expect(stacksOf(held, 'tripleThreat')).toBe(1);
  });
});

describe('offers', () => {
  it('offers 3 distinct boons, the same for the same seed and floor', () => {
    const run = { floor: 2, boons: withBoons('grease') };
    const a = offerBoons(42, run).map((b) => b.id);
    const b = offerBoons(42, run).map((b) => b.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(3);
  });

  it('never offers a maxed boon', () => {
    const boons = withBoons('tripleThreat', 'lateFlip', 'floatyFlip');
    for (let seed = 0; seed < 200; seed++) {
      const ids = offerBoons(seed, { floor: 3, boons }).map((b) => b.id);
      expect(ids).not.toContain('tripleThreat');
      expect(ids).not.toContain('lateFlip');
    }
  });
});

describe('POP boons', () => {
  it('Big Pop x2: held ollie at least 1.4x as high', () => {
    const base = peak(skater(FLAT), 90, pressAt(0, 90));
    const big = peak(skater(FLAT, 'bigPop', 'bigPop'), 90, pressAt(0, 90));
    expect(big).toBeGreaterThan(1.4 * base);
  });

  it('Triple Threat: two flips in the air, the third press does nothing', () => {
    const sk = skater(FLAT, 'tripleThreat');
    const presses = new Set([0, 10, 18, 26]);
    run(sk, 30, (f) => ({ pressed: presses.has(f), held: true }));
    expect(sk.events.filter((e) => e.type === 'trick')).toHaveLength(2);
    expect(sk.jumps).toBe(0);
  });

  it('Late Flip: a tapped flip rises as high as a held one', () => {
    const flip = (late: boolean, hold: number) => {
      const sk = late ? skater(FLAT, 'lateFlip') : skater(FLAT);
      run(sk, 20, pressAt(0, 20));
      return peak(sk, 60, pressAt(0, hold));
    };
    expect(flip(true, 2)).toBeCloseTo(flip(true, 60), 0);
    expect(flip(false, 2)).toBeLessThan(flip(false, 60) * 0.7);
  });

  it('Boostin (floatyFlip): more hang time after a flip', () => {
    const air = (...ids: BoonId[]) => {
      const sk = skater(FLAT, ...ids);
      let f = 0;
      sk.step({ pressed: true, held: true });
      while (sk.mode === 'air' && f < 300) sk.step({ pressed: ++f === 10, held: true });
      return f;
    };
    expect(air('floatyFlip')).toBeGreaterThan(air() + 4);
  });

  it('Mad Pop (pressureFlip): holding past 0.15 s floats, a short hold does not', () => {
    const base = peak(skater(FLAT), 120, pressAt(0, 120));
    const pressure = peak(skater(FLAT, 'pressureFlip'), 120, pressAt(0, 120));
    expect(pressure).toBeGreaterThan(base);
    const tap = peak(skater(FLAT, 'pressureFlip'), 120, pressAt(0, 2));
    expect(tap).toBeCloseTo(peak(skater(FLAT), 120, pressAt(0, 2)));
  });

  it('Spare Change x3: banks a bonus air jump after two grinds, lost on landing', () => {
    const sk = skater(RAIL, 'spareChange', 'spareChange', 'spareChange');
    // bank 0.75 twice by grinding the same rail twice
    sk.x = 16 * TILE + 1 * TILE;
    run(sk, 40, pressAt(0, 40));
    expect(sk.mode).toBe('grind');
    run(sk, 20, pressAt(0, 20));
    run(sk, 40, (f) => ({ pressed: false, held: f < 10 }));
    expect(sk.spare).toBeGreaterThanOrEqual(1.5);
    sk.jumps = 0;
    sk.mode = 'air';
    sk.step({ pressed: true, held: true });
    expect(sk.events.at(-1)?.type).toBe('trick');
  });
});

describe('GRIND boons', () => {
  function overRailStart(sk: Skater, gap: number): void {
    const rail = sk.level.surfaces.find((s) => s.kind === 'rail')!;
    sk.x = rail.x0 - gap;
    sk.y = rail.y - 20;
    sk.mode = 'air';
    sk.vsp = 2;
  }

  it('Rail Magnet: catches a rail you would have missed', () => {
    const plain = skater(RAIL);
    overRailStart(plain, 40);
    run(plain, 30);
    expect(plain.events.some((e) => e.type === 'grind')).toBe(false);

    const magnet = skater(RAIL, 'railMagnet');
    overRailStart(magnet, 40);
    run(magnet, 30);
    expect(magnet.events.some((e) => e.type === 'grind')).toBe(true);
  });

  it('Ledge Butter (grease): grind speed settles 25% higher, right away', () => {
    const speedAfter = (...ids: BoonId[]) => {
      const sk = skater(RAIL, ...ids);
      sk.x = 16 * TILE + 1 * TILE;
      let f = 0;
      while (sk.mode !== 'grind' && f++ < 60) sk.step({ pressed: f === 1, held: true });
      sk.step({ pressed: false, held: false });
      return sk.hsp;
    };
    expect(speedAfter('grease')).toBeCloseTo(PHYS.grindSpeed * 1.25);
    expect(speedAfter()).toBeLessThan(PHYS.grindSpeed);
  });

  it('Full Sail (railLaunch): ollies off a rail pop higher', () => {
    const popOffRail = (...ids: BoonId[]) => {
      const sk = skater(RAIL, ...ids);
      sk.x = 16 * TILE + 1 * TILE;
      run(sk, 40, pressAt(0, 40));
      expect(sk.mode).toBe('grind');
      sk.step({ pressed: true, held: true });
      return sk.vsp;
    };
    expect(popOffRail('railLaunch')).toBeLessThan(popOffRail() - 1);
  });

  it('Speed Cream (exitWax): rail speed lasts longer on the ground', () => {
    const carryAfter = (...ids: BoonId[]) => {
      const sk = skater(FLAT, ...ids);
      sk.carry = 8;
      run(sk, 120);
      return sk.carry;
    };
    expect(carryAfter('exitWax')).toBeGreaterThan(carryAfter() + 2);
  });

  it('More Wax (feebleFrenzy): speed builds the longer you grind one flat rail', () => {
    const sk = skater(RAIL, 'feebleFrenzy', 'grease');
    sk.x = 16 * TILE + 1 * TILE;
    let f = 0;
    while (sk.mode !== 'grind' && f++ < 60) sk.step({ pressed: f === 1, held: true });
    const early = sk.hsp;
    run(sk, 35); // still on the rail: the lifted board catches it a few frames into it (src/physics/tuck.ts)
    expect(sk.mode).toBe('grind');
    expect(sk.hsp).toBeGreaterThan(early * 1.05);
  });

  it('Ghost Rail: rolling off a rail end keeps you grinding', () => {
    const offEnd = (...ids: BoonId[]) => {
      const sk = skater(RAIL, ...ids);
      sk.x = 16 * TILE + 1 * TILE;
      run(sk, 40, pressAt(0, 40));
      expect(sk.mode).toBe('grind');
      const end = sk.surface!.x1;
      while (sk.x < end + 20) sk.step({ pressed: false, held: false });
      return sk.mode;
    };
    expect(offEnd('ghostRail')).toBe('grind');
    expect(offEnd()).not.toBe('grind');
  });

  it('Ghost Rail: riding off the end of a handrail or power line keeps you grinding too', () => {
    //a curved rail (handrails, power lines, the L) has no surface under you, and that used to stop the ghost spawning
    const base = levelOf(FLAT);
    const offEnd = (drop: number, ...ids: BoonId[]) => {
      const rail = new CurvedRail(3 * TILE, base.streetY - 60, 12 * TILE, base.streetY - 60 + drop, 0);
      const sk = new Skater({ ...base, rails: [rail], startX: 3 * TILE + 4, startY: base.streetY - 80 }, skaterMods(withBoons(...ids)));
      sk.mode = 'air';
      sk.vsp = 1;
      for (let f = 0; f < 30 && (sk.mode as string) !== 'rail'; f++) sk.step({ pressed: false, held: false });
      expect(sk.mode).toBe('rail');
      while (sk.x < 12 * TILE + 20) sk.step({ pressed: false, held: false });
      return sk.mode;
    };
    for (const drop of [0, 30]) {
      expect(offEnd(drop, 'ghostRail')).toBe('grind');
      expect(offEnd(drop)).not.toBe('grind');
    }
  });
});

describe('no boons', () => {
  it('a skater with no mods behaves as in M0', () => {
    const sk = new Skater(levelOf(FLAT));
    expect(sk.jumps).toBe(PHYS.jumps);
  });
});
