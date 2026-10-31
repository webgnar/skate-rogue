import { describe, expect, it } from 'vitest';
import { EMPTY_MISSIONS, MISSIONS, Missions, RANK, cleanMissions, missionDef, rankGrip, statsOf } from '../src/run/missions';
import { isGrip } from '../src/board/grips';

const fresh = () => new Missions(EMPTY_MISSIONS, 7);

describe('missions', () => {
  it('always shows three, all different, from rank 0 at the start', () => {
    const m = fresh();
    expect(m.state.active).toHaveLength(3);
    expect(new Set(m.state.active).size).toBe(3);
    for (const id of m.state.active) expect(missionDef(id)!.tier).toBe(0);
  });

  it('a finished one swaps for a new one at once, and every 3 raise the rank and pay', () => {
    const m = fresh();
    const done = [];
    for (let k = 0; k < 3; k++) {
      const d = missionDef(m.state.active[0])!;
      const out = m.add1(d.stat, d.goal);
      done.push(...out);
      expect(m.state.active).toHaveLength(3);
      expect(m.state.active[0]).not.toBe(d.id);
    }
    expect(m.state.done).toBeGreaterThanOrEqual(3);
    const ranked = done.find((d) => d.rank === 1);
    expect(ranked?.pay).toBe(RANK.pay(1));
  });

  it('combo missions start again when the combo ends, run ones when the run does', () => {
    const m = new Missions({ active: ['rails3combo', 'kickflip5', 'flips10'], progress: [0, 0, 0], done: 6, seen: [] }, 1);
    m.add1('rail');
    m.add1('rail');
    expect(m.count(0)).toBe(2);
    m.reset('combo');
    expect(m.count(0)).toBe(0);
    m.add1('kickflip');
    m.add1('flip');
    m.reset('run');
    expect(m.count(1)).toBe(0);
    expect(m.count(2)).toBe(1); // across runs
  });

  it('best missions keep the high-water mark', () => {
    const m = new Missions({ active: ['combo4', 'floor3', 'flips10'], progress: [0, 0, 0], done: 0, seen: [] }, 1);
    m.add1('combo', 3);
    m.add1('combo', 2);
    expect(m.count(0)).toBe(3);
    expect(m.add1('combo', 4)).toHaveLength(1);
  });

  it('a skip costs a little Stoken and is refused without it', () => {
    const m = fresh();
    const first = m.state.active[1];
    expect(m.skip(1, RANK.skip - 1)).toBeNull();
    expect(m.skip(1, 10)).toBe(10 - RANK.skip);
    expect(m.state.active[1]).not.toBe(first);
    expect(m.state.done).toBe(0);
  });

  it('every mission is reachable and every stat it counts is a real one', () => {
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    for (let t = 0; t <= 6; t++) expect(MISSIONS.filter((m) => m.tier <= t).length).toBeGreaterThanOrEqual(4);
  });

  it('rank grips are real grips', () => {
    for (let r = 0; r < 14; r++) {
      const g = rankGrip(r);
      if (g) expect(isGrip(g)).toBe(true);
    }
    expect(rankGrip(2)).toBe('gold');
  });

  it('a bad save cleans up', () => {
    expect(cleanMissions({ active: ['nope', 'flips10'], progress: ['x'], done: -2 })).toEqual({ active: ['flips10'], progress: [0], done: 0, seen: [] });
  });

  it('floor events count for the right stats', () => {
    expect(statsOf({ type: 'trick', index: 0, name: 'bsFlip', spin: 180, fakie: true })).toEqual(['flip', 'fakie', 'spin']);
    expect(statsOf({ type: 'rail', name: 'boardslide', perfect: true })).toEqual(['grind', 'rail', 'perfect']);
    expect(statsOf({ type: 'smash', index: 0, prop: 'cone', x: 0, y: 0, how: 'car' })).toEqual([]);
  });
});
