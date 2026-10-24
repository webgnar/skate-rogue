import { describe, expect, it } from 'vitest';
import { BOONS } from '../src/boons/defs';
import { NO_MODS } from '../src/boons/mods';
import { offerBoons } from '../src/boons/offer';
import { floorTwist, TWISTS } from '../src/gen/twists';
import { floorLevel } from '../src/run/floor-level';
import { rollFork } from '../src/gen/roads';
import { buy, dailySeed, DECK_SLOTS, firstPick, FULL_LIBRARY, libraryOf, START_TYPES, STOCK, UNLOCKS, withLoadout } from '../src/run/meta';
import { RunScore } from '../src/run/score';
import { Heat } from '../src/heat/heat';
import { Skater } from '../src/physics/skater';
import { buildFloor } from '../src/gen/descent';

describe('meta progression', () => {
  const fresh = libraryOf([]);

  it('a new phone draws from POP and GRIND only: 12 boons, no curses or duos', () => {
    expect(fresh.types).toEqual(START_TYPES);
    expect(BOONS.filter((b) => !b.cursed && !b.duo && fresh.types.includes(b.type))).toHaveLength(12);
    for (let seed = 1; seed < 60; seed++) {
      const run = { floor: 8, boons: [{ id: 'tripleThreat' as const, stacks: 1 }, { id: 'grease' as const, stacks: 1 }], library: fresh };
      for (const b of offerBoons(seed, run, 4)) {
        expect(START_TYPES).toContain(b.type);
        expect(b.cursed || b.duo).toBeFalsy();
      }
      for (const f of [rollFork(seed, 2, fresh.types), rollFork(seed, 3, fresh.types), rollFork(seed, 4, fresh.types)]) {
        for (const r of [f.high, f.low]) if ('boonType' in r) expect(START_TYPES).toContain(r.boonType);
      }
    }
  });

  it('packs add their type to the pool and the roads', () => {
    const lib = libraryOf(['FLOW', 'curses']);
    expect(lib).toEqual({ types: ['POP', 'GRIND', 'FLOW'], curses: true, duos: false });
    const types = new Set(Array.from({ length: 200 }, (_, i) => rollFork(i, 4, lib.types)).flatMap((f) => [f.high, f.low]).flatMap((r) => ('boonType' in r ? [r.boonType] : [])));
    expect([...types].sort()).toEqual(['FLOW', 'GRIND', 'POP']);
    //no library given is everything, as before
    expect(libraryOf(UNLOCKS.map((u) => u.id))).toEqual(FULL_LIBRARY);
  });

  it('buying spends banked Stoken once', () => {
    expect(buy([], 10, 'webster')).toBeNull();
    const got = buy([], 40, 'webster')!;
    expect(got).toEqual({ unlocked: ['webster'], stoken: 10 });
    expect(buy(got.unlocked, 100, 'webster')).toBeNull();
    expect(buy([], 0, 'lou-gnar')).toBeNull(); // free ones are always owned
  });

  it('each skater leans the first pick to their type, if it is in the library', () => {
    expect(firstPick(STOCK, fresh)).toBe('POP');
    expect(firstPick({ ...STOCK, skater: 'webster' }, fresh)).toBe('GRIND');
    expect(firstPick({ ...STOCK, skater: 'keanu' }, fresh)).toBe('POP');
    expect(firstPick({ ...STOCK, skater: 'keanu' }, FULL_LIBRARY)).toBe('COOL');
  });

  it('skater passives and deck stats', () => {
    expect(withLoadout(NO_MODS, STOCK)).toEqual(NO_MODS);
    expect(withLoadout(NO_MODS, { ...STOCK, skater: 'webster' }).grindScale).toBeCloseTo(1.15);
    expect(withLoadout(NO_MODS, { ...STOCK, skater: 'roxy' }).hopScale).toBeCloseTo(1.2);
    const bomb = withLoadout(NO_MODS, { ...STOCK, deck: 'bombhill' });
    expect(bomb.speedScale).toBeCloseTo(1.15);
    expect(bomb.wearScale).toBeCloseTo(1.3);
    expect(DECK_SLOTS.slab).toBe(4);
    //Keanu: cooling in the air is faster, gains are not
    const sk = new Skater(buildFloor(5, 1));
    sk.mode = 'air';
    const plain = new Heat();
    const keanu = new Heat();
    keanu.mods = { ...keanu.mods, airCool: withLoadout(NO_MODS, { ...STOCK, skater: 'keanu' }).airCool };
    for (const h of [plain, keanu]) {
      h.value = 50;
      h.sinceSlam = 1000;
      h.step(sk, [{ type: 'trick', name: 'kickflip' } as never]);
    }
    expect(50 - keanu.value).toBeCloseTo((50 - plain.value) * 1.15);
  });

  it("Goldie's cut adds up across small payouts", () => {
    const run = new RunScore();
    run.cashScale = 1.25;
    for (let i = 0; i < 8; i++) run.addCash(1);
    expect(run.cash).toBe(10);
  });

  it('the daily seed is the same all day and changes the next', () => {
    const a = dailySeed(new Date('2026-10-25T00:10:00Z'));
    expect(dailySeed(new Date('2026-10-25T23:50:00Z'))).toBe(a);
    expect(dailySeed(new Date('2026-10-26T00:10:00Z'))).not.toBe(a);
    expect(a).toBeGreaterThan(0);
  });

  it('one world: no twist in act 1, then about half the floors roll one', () => {
    const road = { kind: 'boon', boonType: 'POP', danger: 1 } as const;
    for (let seed = 1; seed <= 20; seed++) for (let floor = 1; floor <= 3; floor++) expect(floorTwist(seed, floor)).toBeUndefined();
    const later = Array.from({ length: 200 }, (_, s) => floorTwist(s, 4 + (s % 12)));
    expect(new Set(later.filter(Boolean))).toEqual(new Set(TWISTS));
    expect(later.filter(Boolean).length).toBeGreaterThan(60);
    expect(later.filter(Boolean).length).toBeLessThan(140);
    //no district gravity any more
    expect(floorLevel({ seed: 5, floor: 13, road, library: FULL_LIBRARY, gnar: 0 }).gravity ?? 1).toBe(1);
  });
});
