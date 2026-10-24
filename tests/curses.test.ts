import { describe, expect, it } from 'vitest';
import { addBoon, BOONS, CURSES_FROM, type BoonId, type Held } from '../src/boons/defs';
import { skaterMods } from '../src/boons/mods';
import { offerBoons } from '../src/boons/offer';
import { PHYS, TILE } from '../src/physics/constants';
import { Skater } from '../src/physics/skater';
import { cursesHeld } from '../src/run/spot';
import { FLAT, levelOf, pressAt, run } from './helpers';

const RAIL = [
  '................', '................', '................', '................', '................',
  '................', '................', '................', '..============..', '################',
];

const held = (...ids: BoonId[]): Held[] => ids.reduce<Held[]>((h, id) => addBoon(h, id), []);
const skater = (rows: string[], ...ids: BoonId[]) => new Skater(levelOf(rows), skaterMods(held(...ids)));

describe('curse and duo offers', () => {
  it('never offers a curse before floor 6, and sometimes after', () => {
    const cursed = (floor: number) =>
      Array.from({ length: 300 }, (_, seed) => offerBoons(seed, { floor, boons: [] })).filter((o) => o.some((b) => b.cursed)).length;
    expect(cursed(CURSES_FROM - 1)).toBe(0);
    expect(cursed(CURSES_FROM)).toBeGreaterThan(50);
  });

  it('only offers a duo once you hold both halves, as an extra card', () => {
    const duo = BOONS.find((b) => b.id === 'perpetualMotion')!;
    const has = (boons: Held[]) => Array.from({ length: 200 }, (_, seed) => offerBoons(seed, { floor: 2, boons })).filter((o) => o.includes(duo));
    expect(has(held('butter'))).toHaveLength(0);
    const offers = has(held('butter', 'slingshot'));
    expect(offers.length).toBeGreaterThan(40);
    expect(offers.every((o) => o.length === 4)).toBe(true);
  });

  it('the spot finds the curses you hold', () => {
    expect(cursesHeld(held('bigPop', 'wanted', 'moonShoes')).map((h) => h.id)).toEqual(['wanted', 'moonShoes']);
  });
});

describe('curses', () => {
  it('Speed Wobbles: a landing well over cruising speed slams, a normal one does not', () => {
    const land = (hsp: number) => {
      const sk = skater(FLAT, 'speedWobbles');
      sk.step({ pressed: true, held: false });
      sk.hsp = hsp;
      run(sk, 60);
      return sk.events.some((e) => e.type === 'slam');
    };
    expect(land(PHYS.baseSpeed * 1.4)).toBe(false);
    expect(land(PHYS.bombSpeed + 1)).toBe(true);
  });

  it('Moon Shoes: ollies higher, grinds slower', () => {
    const mods = skaterMods(held('moonShoes'));
    expect(mods.ollieScale).toBeCloseTo(1.6);
    expect(mods.grindScale).toBeCloseTo(0.7);
  });
});

describe('duos', () => {
  it('Rocket Grind: an ollie off a fast grind pops harder and gives every jump back at the top', () => {
    const pop = (...ids: BoonId[]) => {
      const sk = skater(RAIL, ...ids);
      sk.x = 17 * TILE;
      run(sk, 40, pressAt(0, 40));
      expect(sk.mode).toBe('grind');
      sk.hsp = PHYS.grindSpeed;
      sk.step({ pressed: true, held: true });
      const vsp = sk.vsp;
      sk.step({ pressed: true, held: true }); // a flip on the way up spends a jump
      while (sk.vsp < 0) sk.step({ pressed: false, held: true });
      return { vsp, jumps: sk.jumps };
    };
    const rocket = pop('rocketGrind');
    expect(rocket.vsp).toBeLessThan(pop().vsp * 1.4);
    expect(rocket.jumps).toBe(PHYS.jumps);
  });

  it('Sky Line: a flip leaves a rail under you to grind', () => {
    const sk = skater(FLAT, 'skyLine');
    run(sk, 10, pressAt(0, 10));
    sk.step({ pressed: true, held: true });
    run(sk, 60, () => ({ pressed: false, held: true }));
    expect(sk.events.some((e) => e.type === 'grind')).toBe(true);
  });

  it('Perpetual Motion: extra speed never bleeds off', () => {
    const sk = skater(FLAT, 'perpetualMotion');
    sk.carry = 8;
    run(sk, 300);
    expect(sk.carry).toBe(8);
  });
});
