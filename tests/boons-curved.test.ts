// Every GRIND boon (and the duos built on them) on the rails the levels are made of now: curved rails (handrails down
// the stairways, power lines, the L), not just flat ledges. Ghost Rail was dead on these for weeks (PR #179).
import { describe, expect, it } from 'vitest';
import { addBoon, type BoonId, type Held } from '../src/boons/defs';
import { skaterMods } from '../src/boons/mods';
import { PHYS, TILE } from '../src/physics/constants';
import { CurvedRail } from '../src/physics/level';
import { Skater, type StepInput } from '../src/physics/skater';
import { FLAT, levelOf } from './helpers';

const base = levelOf(FLAT);
const street = base.streetY;
const idle: StepInput = { pressed: false, held: false };

const held = (...ids: BoonId[]): Held[] => ids.reduce<Held[]>((h, id) => addBoon(h, id), []);

// a rail from x 3 to 20 tiles, `drop` px lower at its end (a handrail down a stairway), and a skater falling onto it
function onRail(drop: number, ids: BoonId[], at = 3 * TILE + 4): Skater {
  const rail = new CurvedRail(3 * TILE, street - 60, 20 * TILE, street - 60 + drop, 0);
  const sk = new Skater({ ...base, rails: [rail], startX: at, startY: street - 80 }, skaterMods(held(...ids)));
  sk.mode = 'air';
  sk.vsp = 1;
  for (let f = 0; f < 30 && (sk.mode as string) !== 'rail'; f++) sk.step(idle);
  return sk;
}

describe('More Wax (feebleFrenzy) only on flat grinds (zack, 2026-10-26)', () => {
  const v = (drop: number, ...ids: BoonId[]) => {
    const sk = onRail(drop, ids);
    for (let f = 0; f < (drop ? 32 : 70); f++) sk.step(idle); // past the first 30-frame step, still on the rail
    expect(sk.mode).toBe('rail');
    return sk.railV;
  };
  it('builds speed along a flat power line', () => {
    expect(v(0, 'feebleFrenzy')).toBeGreaterThan(v(0) * 1.1);
  });
  it('adds nothing down a stairway handrail', () => {
    //a real handrail: half a tile down for every tile along
    expect(v(272, 'feebleFrenzy')).toBeCloseTo(v(272), 5);
  });
});

describe('GRIND boons on curved rails', () => {
  for (const drop of [0, 60]) {
    const kind = drop ? 'a handrail' : 'a power line';

    it(`Ledge Butter: faster along ${kind}, from the moment you catch it`, () => {
      const speed = (...ids: BoonId[]) => {
        const sk = onRail(drop, ids);
        expect(sk.mode).toBe('rail');
        const caught = sk.railV;
        for (let f = 0; f < 40; f++) sk.step(idle);
        return { caught, later: sk.railV };
      };
      const plain = speed();
      const grease = speed('grease');
      expect(grease.caught).toBeGreaterThanOrEqual(PHYS.grindSpeed * 1.25 - 0.01);
      expect(grease.later).toBeGreaterThan(plain.later * 1.15);
    });

    it(`Rail Magnet: catches ${kind} you'd have dropped in just before`, () => {
      const caught = (...ids: BoonId[]) => {
        //dropping straight down just before its start
        const rail = new CurvedRail(3 * TILE, street - 60, 20 * TILE, street - 60 + drop, 0);
        const sk = new Skater({ ...base, rails: [rail], startX: 3 * TILE - 30, startY: street - 80 }, skaterMods(held(...ids)));
        sk.mode = 'air';
        sk.hsp = 0;
        sk.vsp = 1;
        for (let f = 0; f < 30; f++) sk.step(idle);
        return sk.events.some((e) => e.type === 'rail') || (sk.mode as string) === 'rail';
      };
      expect(caught()).toBe(false);
      expect(caught('railMagnet')).toBe(true);
    });

    it(`Full Sail: an ollie off ${kind} pops higher`, () => {
      const pop = (...ids: BoonId[]) => {
        const sk = onRail(drop, ids);
        for (let f = 0; f < 20; f++) sk.step(idle);
        expect(sk.mode).toBe('rail');
        sk.step({ pressed: true, held: true });
        return sk.vsp;
      };
      expect(pop('railLaunch')).toBeLessThan(pop() - 1);
    });

    it(`Spare Change: catching ${kind} banks part of a bonus jump`, () => {
      const sk = onRail(drop, ['spareChange', 'spareChange', 'spareChange']);
      expect(sk.mode).toBe('rail');
      expect(sk.spare).toBeCloseTo(0.75);
      expect(onRail(drop, []).spare).toBe(0);
    });

    it(`Waxed Bearings: the speed off the end of ${kind} lasts longer`, () => {
      const carryAfter = (...ids: BoonId[]) => {
        const sk = onRail(drop, ids);
        while (sk.mode === 'rail' || sk.mode === 'air') sk.step(idle);
        sk.carry = 8; // the same rail speed off the end either way
        for (let f = 0; f < 90; f++) sk.step(idle);
        return sk.carry;
      };
      expect(carryAfter('exitWax')).toBeGreaterThan(carryAfter() + 1);
    });

    it(`Slingshot: riding off the end of ${kind} launches harder`, () => {
      const launch = (...ids: BoonId[]) => {
        const sk = onRail(drop, ids);
        while (sk.mode === 'rail') sk.step(idle);
        return sk.hsp;
      };
      expect(launch('slingshot')).toBeGreaterThan(launch() * 1.3);
    });

    it(`Rocket Grind: an ollie off fast ${kind} gives every jump back at the top`, () => {
      const sk = onRail(drop, ['rocketGrind']);
      sk.railV = PHYS.grindSpeed + 1;
      sk.step({ pressed: true, held: true });
      sk.step({ pressed: true, held: true });
      while (sk.vsp < 0) sk.step({ pressed: false, held: true });
      expect(sk.jumps).toBe(PHYS.jumps);
    });
  }
});
