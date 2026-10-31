// The sky route's set pieces, finds and NO GROUND (zack, 2026-10-31, src/gen/sky-beats.ts, src/sim/sky.ts): a blimp,
// a window washer's rig that drops under you, a crane jib that swings out of the lane, paper billboards to burst,
// a stash crate, the golden pigeon and Chinatown's clotheslines; chaining sky pieces multiplies the coins up there.
import { describe, expect, it } from 'vitest';
import { buildFloor } from '../src/gen/descent';
import { FloorSim, type FloorEvent } from '../src/sim/floor';
import { SKY, skyMult, swingAt } from '../src/sim/sky';
import { RunScore } from '../src/run/score';
import { TILE } from '../src/physics/constants';
import type { Level } from '../src/physics/level';

const chicago = (seed: number, floor: number) => buildFloor(seed, floor, undefined, { hills: true });
const piecesOf = (l: Level) => [...(l.skyMovers ?? []).map((m) => m.kind), ...(l.busts ?? []).map(() => 'bust')];

// the first floor (by seed) whose sky has this
function find(test: (l: Level) => boolean): Level {
  for (let seed = 1; seed < 200; seed++) for (let f = 5; f <= 15; f++) {
    const l = chicago(seed * 53, f);
    if (test(l)) return l;
  }
  throw new Error('none found');
}

const run = (sim: FloorSim, frames: number, press?: (sim: FloorSim) => boolean) => {
  const events: FloorEvent[] = [];
  for (let f = 0; f < frames && sim.state === 'skate'; f++) {
    const p = press?.(sim) ?? false;
    sim.step({ pressed: p, held: p });
    events.push(...sim.events);
  }
  return events;
};

describe('the sky route', () => {
  it('one set piece a floor at most, none before floor 5; Chinatown opens on its clotheslines', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      expect(piecesOf(chicago(seed * 53, 4))).toHaveLength(0);
      for (let f = 5; f <= 15; f++) {
        const l = chicago(seed * 53, f);
        const p = piecesOf(l);
        expect(p.length).toBeLessThanOrEqual(1);
        p.forEach((k) => seen.add(k));
      }
      expect(chicago(seed * 53, 5).rails.some((r) => r.sky === 'lines')).toBe(true);
    }
    expect([...seen].sort()).toEqual(['blimp', 'bust', 'rig', 'swing']);
  });

  it('NO GROUND: chaining sky pieces multiplies the coins, and the ground banks it', () => {
    expect(skyMult(0)).toBe(1);
    expect(skyMult(1)).toBe(1);
    expect(skyMult(2)).toBe(1.5);
    expect(skyMult(20)).toBe(4);
    const score = new RunScore();
    score.onEvent({ type: 'pickup', kind: 'cash', index: 0, mult: 2 }, 3.5);
    score.onEvent({ type: 'pickup', kind: 'stoken', index: 1, mult: 2.5 }, 3.5);
    expect(score.cash).toBe(2);
    expect(score.stoken).toBe(2);
    //jump the bust's gap from its first deck to its second: through the billboard, two pieces on the line
    const l = find((x) => !!x.busts?.length);
    const b = l.busts![0];
    const first = l.surfaces.find((s) => s.sky && s.x1 < b.x && b.x - s.x1 < 3 * TILE)!;
    const sim = new FloorSim({ ...l, startX: first.x0 + 8, startY: first.y });
    //(at the speed you get up there with)
    sim.skater.hsp = sim.skater.carry = 6;
    const events = run(sim, 600, (s) => s.skater.grounded && s.skater.x > first.x1 - 30 && s.skater.x < first.x1);
    expect(events.some((e) => e.type === 'bust')).toBe(true);
    expect(events.some((e) => e.type === 'skyChain' && e.n === 2 && e.mult === 1.5)).toBe(true);
    const after = events.findIndex((e) => e.type === 'skyChain');
    expect(events.slice(after).some((e) => e.type === 'pickup' && e.mult === 1.5)).toBe(true);
  });

  it("the window washer's rig drops once you land on it", () => {
    const l = find((x) => !!x.skyMovers?.some((m) => m.kind === 'rig'));
    const m = l.skyMovers!.find((k) => k.kind === 'rig')!;
    const sim = new FloorSim({ ...l, startX: m.x0 + 8, startY: m.y - 4 });
    const rig = sim.sky.pieces.find((p) => p.site === m)!;
    run(sim, 10);
    expect(sim.skater.surface).toBe(rig.ledge);
    run(sim, 14);
    expect(rig.y).toBeGreaterThan(m.y + TILE);
    //and you ride it down
    if (sim.skater.surface === rig.ledge) expect(sim.skater.y).toBe(rig.y);
  });

  it("a crane jib slews out of the lane and back, and drops you if you're still on it", () => {
    expect(swingAt(0)).toBe(0);
    expect(swingAt(SKY.swingHold + SKY.swingMove + 5)).toBe(SKY.swingOut);
    expect(swingAt(SKY.swingHold + 2 * SKY.swingMove + SKY.swingAway)).toBe(0);
    const l = find((x) => !!x.skyMovers?.some((m) => m.kind === 'swing'));
    const m = l.skyMovers!.find((k) => k.kind === 'swing')!;
    //land on it just before it swings away
    const sim = new FloorSim({ ...l, skyMovers: [{ ...m, phase: SKY.swingHold - 20 }], startX: m.x0 + 8, startY: m.y - 4 });
    const jib = sim.sky.pieces[0];
    run(sim, 10);
    expect(sim.skater.surface).toBe(jib.ledge);
    run(sim, 40);
    expect(jib.inLane).toBe(false);
    expect(sim.skater.surface).not.toBe(jib.ledge);
  });

  it('the golden pigeon pays a spin token when you clear it from above', () => {
    const l = find((x) => !!x.flocks?.some((f) => f.gold));
    const g = l.flocks!.find((f) => f.gold)!;
    const deck = l.surfaces.find((s) => s.sky && g.x > s.x0 && g.x < s.x1)!;
    const sim = new FloorSim({ ...l, flocks: [g], startX: g.x - 3 * TILE, startY: deck.y });
    const events = run(sim, 120, (s) => s.skater.grounded && g.x - s.skater.x < 2 * TILE);
    expect(events.some((e) => e.type === 'goldBird')).toBe(true);
    expect(events.some((e) => e.type === 'birds')).toBe(false);
  });

  it("a sky stash's fresh gear part replaces your most worn one", () => {
    const l = find((x) => x.props.some((p) => p.stash && p.loot === 'gear'));
    const crate = l.props.find((p) => p.stash)!;
    const sim = new FloorSim({ ...l, startX: crate.x - 2 * TILE, startY: crate.y }, undefined, 0, [], { deck: 80, shoes: 90, trucks: 30, wheels: 60, bearings: 70 });
    const events = run(sim, 60);
    expect(events.some((e) => e.type === 'repair' && e.part === 'trucks')).toBe(true);
    expect(sim.gear.trucks).toBeGreaterThan(99);
  });
});
