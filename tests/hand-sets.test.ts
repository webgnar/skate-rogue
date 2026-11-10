// zack's hand-made sets (src/gen/hand-sets.ts, openspec/changes/le2-hand-made-sets): laid into act 3's and act 5's
// lines as a beat, as drawn, and every set that's on cleared by the plain sky bot (the gate: zack, 2026-11-10)
import { describe, expect, it } from 'vitest';
import { formatHandSets, handSets, isHandSets, laySet, SAVED_SETS, setShape, useHandSets, type HandSet } from '../src/gen/hand-sets';
import { checkSet, setFloor } from '../src/gen/hand-set-check';
import { buildFloor } from '../src/gen/descent';
import { rollFork } from '../src/gen/roads';
import { actGravity } from '../src/physics/feel';
import { TILE } from '../src/physics/constants';
import type { Level } from '../src/physics/level';

const set: HandSet = {
  name: 'test stairs',
  acts: [3, 5],
  on: true,
  weight: 50,
  most: 2,
  parts: [
    { kind: 'deck', x0: 0, y0: 0, x1: 10 },
    { kind: 'stairs', x0: 10, y0: 0, x1: 14, y1: -1.5 },
    { kind: 'deck', x0: 14, y0: -1.5, x1: 22 },
    { kind: 'rail', x0: 16, y0: -0.6, x1: 20, y1: -0.6 },
    { kind: 'coins', x0: 1, y0: 0.5, x1: 5, y1: 0.5 },
    { kind: 'stoken', x0: 8, y0: 1 },
  ],
};
const floorOf = (seed: number, floor: number, act: number): Level =>
  buildFloor(seed, floor, undefined, { hills: true, fork: rollFork(seed, floor), gravity: actGravity(act) });

describe("zack's hand-made sets", () => {
  it('lays a set as drawn: tiles from where you roll in, y up', () => {
    const level = floorOf(1, 8, 3);
    const [s0, r0, p0] = [level.surfaces.length, level.rails.length, level.pickups.length];
    const laid = laySet(level, set, 1000, 500, 3);
    const surf = level.surfaces.slice(s0);
    expect(surf.map((s) => [s.kind, s.x0, s.x1, s.y, s.y1])).toEqual([
      ['ledge', 1000, 1000 + 10 * TILE, 500, undefined],
      ['stairs', 1000 + 10 * TILE, 1000 + 14 * TILE, 500, 500 + 1.5 * TILE],
      ['ledge', 1000 + 14 * TILE, 1000 + 22 * TILE, 500 + 1.5 * TILE, undefined],
    ]);
    //(the stairs' handrail over their noses, and the rail)
    const rails = level.rails.slice(r0);
    expect(rails.map((r) => r.sky)).toEqual(['handrail', 'srail']);
    expect(level.pickups.slice(p0).filter((p) => p.kind === 'cash')).toHaveLength(5);
    expect(level.pickups.slice(p0).filter((p) => p.kind === 'stoken')).toHaveLength(1);
    expect(laid).toEqual({ name: 'test stairs', x0: 1000, x1: 1000 + 22 * TILE, y: 500 });
    expect(level.airways).toContainEqual([1000, 1000 + 22 * TILE]);
    expect(setShape(set)).toMatchObject({ length: 22, endY: -1.5 });
    //(act 5 dresses it as the station)
    const l5 = floorOf(1, 14, 5);
    const r5 = l5.rails.length;
    laySet(l5, set, 1000, 500, 5);
    expect(l5.rails.slice(r5).map((r) => r.sky)).toEqual(['handrail', 'deckrail']);
  });

  it('comes round on act 3 and act 5 floors when on, no more than its most, and never elsewhere', () => {
    useHandSets({ sets: [set] });
    try {
      for (const [floor, act] of [[7, 3], [8, 3], [9, 3], [13, 5], [14, 5], [15, 5]]) {
        let laid = 0;
        for (let seed = 1; seed <= 4; seed++) {
          const n = (floorOf(seed, floor, act).handSets ?? []).length;
          expect(n).toBeLessThanOrEqual(set.most);
          laid += n;
        }
        expect(laid).toBeGreaterThan(0);
      }
      for (const floor of [2, 5, 11]) expect(floorOf(1, floor, 1).handSets ?? []).toHaveLength(0);
      //(off: never)
      useHandSets({ sets: [{ ...set, on: false }] });
      expect(floorOf(1, 8, 3).handSets ?? []).toHaveLength(0);
    } finally {
      useHandSets(SAVED_SETS);
    }
  }, 120000);

  it('no sets on: floors build exactly as before', () => {
    useHandSets({ sets: [] });
    const a = JSON.stringify(floorOf(3, 8, 3).surfaces);
    useHandSets({ sets: [{ ...set, on: false }] });
    const b = JSON.stringify(floorOf(3, 8, 3).surfaces);
    useHandSets(SAVED_SETS);
    expect(b).toBe(a);
  });

  it('the editor\'s "play it" floor lays the set every other beat', () => {
    expect((setFloor(set, 3).handSets ?? []).length).toBeGreaterThan(2);
    expect((setFloor(set, 5).handSets ?? []).length).toBeGreaterThan(2);
  });

  it('the gate passes a fair set and fails one with a gap too far to jump', () => {
    const fair = checkSet(set, 3);
    expect(fair.runs.map((r) => r.ok)).toEqual([true, true]);
    expect(fair.ok).toBe(true);
    expect(fair.runs[0].trace.length).toBeGreaterThan(10);
    const far: HandSet = { ...set, parts: [{ kind: 'deck', x0: 0, y0: 0, x1: 6 }, { kind: 'deck', x0: 30, y0: 0, x1: 40 }] };
    expect(checkSet(far, 3).ok).toBe(false);
  }, 120000);

  it('every saved set is well formed, and every one that is on is cleared by the plain bot on its acts', () => {
    expect(isHandSets(SAVED_SETS)).toBe(true);
    expect(isHandSets(JSON.parse(formatHandSets(SAVED_SETS)))).toBe(true);
    for (const s of handSets().filter((h) => h.on)) for (const act of s.acts) {
      const c = checkSet(s, act);
      expect({ set: s.name, act, ok: c.ok, why: c.runs.map((r) => r.why) }).toMatchObject({ ok: true });
    }
  }, 300000);
});
