// The sewer route (src/gen/sewer.ts): zack (2026-10-31), "sky surface ground. these are the three routes our game
// should have". An open drain drops you into a tunnel under the street; an outlet ramp brings you back up.
import { describe, expect, it } from 'vitest';
import { validatedFloor } from '../src/gen/validate';
import { floorTwist } from '../src/gen/twists';
import { SEWER } from '../src/gen/sewer';
import { FloorSim } from '../src/sim/floor';
import { Pilot } from '../src/bot/pilot';
import { PHYS, TILE } from '../src/physics/constants';
import { isStreetAt, SEWER_ROOF, type Level } from '../src/physics/level';

const floorOf = (seed: number, floor: number): Level => validatedFloor(seed, floor, { twist: floorTwist(seed, floor), hills: true, danger: 2 }).level;

// roll up to the first sewer's drain and let the sim run, pressing on the given frames (held for 20)
function dropIn(level: Level, presses: number[] = [], frames = 900) {
  const w = level.sewers![0];
  const sim = new FloorSim({ ...level, startX: w.drain[0] - 3 * TILE, startY: level.streetY });
  const events: string[] = [];
  let top = Infinity;
  let stairs = -99; // (an ollie off the stair set's landing, if it has one)
  for (let f = 0; f < frames && sim.state === 'skate' && sim.skater.x < w.x1 + 2 * TILE; f++) {
    const st = w.stairs?.[0];
    if (st && stairs < 0 && sim.skater.grounded && sim.skater.x > st.top - 1.2 * TILE && sim.skater.x < st.top) stairs = f;
    sim.step({ pressed: presses.includes(f) || f === stairs, held: presses.some((p) => f >= p && f < p + 20) || (f >= stairs && f < stairs + 20) });
    for (const e of sim.events) events.push(e.type === 'sewer' ? `sewer:${e.down}` : e.type);
    if (sim.down && presses.length && f >= presses[0] && f < presses[0] + 40) top = Math.min(top, sim.skater.y);
  }
  return { sim, w, events, top };
}

// (whole floors get built and skated here: seconds each, more with the rest of the suite running alongside)
describe('the sewer route', { timeout: 30000 }, () => {
  it('floors with hills get one under a street chase, with its holes in the street', () => {
    //(about 1 layout in 13 has no stretch of unbroken street long enough for one: 7 of 90 floors, before and after the
    //sky route's level design pass, 2026-10-31)
    let floors = 0;
    let dug = 0;
    for (let s = 1; s <= 4; s++) {
      for (const floor of [1, 4, 7]) {
        const level = floorOf(s * 7919, floor);
        floors++;
        if (level.sewers?.length) dug++;
        for (const w of level.sewers ?? []) {
          expect(w.y).toBe(level.streetY + SEWER.depth);
          expect(isStreetAt(level, (w.drain[0] + w.drain[1]) / 2)).toBe(false);
          expect(isStreetAt(level, (w.outlet[0] + w.outlet[1]) / 2)).toBe(false);
          expect(isStreetAt(level, (w.drain[1] + w.outlet[0]) / 2)).toBe(true);
        }
      }
    }
    expect(dug).toBeGreaterThanOrEqual(floors - 2);
  });

  it('rolling into the drain drops you in, and the outlet ramp brings you back up without a slam', () => {
    const { sim, events } = dropIn(floorOf(7919, 1));
    expect(events).toContain('sewer:true');
    expect(events).toContain('sewer:false');
    expect(events).not.toContain('slam');
    expect(sim.state).toBe('skate');
    expect(sim.skater.y).toBe(sim.level.streetY);
  });

  it('the street is its roof: a quick double tap bumps your head', () => {
    const level = floorOf(7919, 1);
    const w = level.sewers![0];
    const sim = new FloorSim({ ...level, startX: w.drain[0] - 3 * TILE, startY: level.streetY });
    //roll in, and once down on the floor, pop and flip at once
    let at = -1;
    let top = Infinity;
    for (let f = 0; f < 600 && (at < 0 || f < at + 40); f++) {
      const sk = sim.skater;
      if (at < 0 && sim.down && sk.mode === 'roll' && sk.x > w.drain[1] + TILE) at = f + 30; // (past the landing's lockout)
      const press = at >= 0 && (f === at || f === at + 3);
      sim.step({ pressed: press, held: at >= 0 && f >= at && f < at + 20 });
      if (at >= 0 && f >= at) top = Math.min(top, sim.skater.y);
    }
    expect(at).toBeGreaterThan(0);
    expect(top).toBeCloseTo(level.streetY + SEWER_ROOF + PHYS.height, 0);
    expect(w.y - top).toBeLessThan(SEWER.depth);
  });

  it('down there the Heat cools', () => {
    const level = floorOf(7919, 1);
    const w = level.sewers![0];
    const sim = new FloorSim({ ...level, startX: w.drain[0] - 3 * TILE, startY: level.streetY });
    sim.heat.value = 60;
    let inside = -1;
    let stairs = -99; // (an ollie off the stair set's landing, if it has one)
    for (let f = 0; f < 600 && sim.skater.x < w.outlet[0]; f++) {
      const st = w.stairs?.[0];
      if (st && stairs < 0 && sim.skater.grounded && sim.skater.x > st.top - 1.2 * TILE && sim.skater.x < st.top) stairs = f;
      sim.step({ pressed: f === stairs, held: f >= stairs && f < stairs + 20 });
      if (sim.down && inside < 0) inside = sim.heat.value;
    }
    expect(inside).toBeGreaterThan(0);
    expect(sim.heat.value).toBeLessThan(inside - 10);
  });

  it('the sewer bot takes the drains and clears the floor', () => {
    let downs = 0;
    let sewers = 0;
    let floors = 0;
    let cleared = 0;
    for (let s = 1; s <= 4; s++) {
      const level = floorOf(s * 7919, 4);
      if (!level.sewers) continue;
      floors++;
      const sim = new FloorSim(level);
      const pilot = new Pilot('sewer');
      let d = 0;
      for (let f = 0; f < 9000 && sim.state === 'skate'; f++) {
        sim.step(pilot.input(sim));
        d += sim.events.filter((e) => e.type === 'sewer' && e.down).length;
      }
      if (sim.state === 'exit') {
        cleared++;
        sewers += level.sewers.length;
        downs += d;
      }
    }
    //(all but one: the sewer bot isn't the one the validator rolls floors for, and a street pit it hops into late can
    //take one of them)
    expect(cleared).toBeGreaterThanOrEqual(floors - 1);
    //(it skips some, when it's still in the air from a grind or a hop before one)
    expect(downs).toBeGreaterThanOrEqual(sewers / 3);
  }, 60000);
});

// zack (2026-10-31): "build all of it": construction spots for the ways in, kick-outs, DOWNSTREAM, the set pieces,
// the alligator, the DIY stash and the sewer road at the gate
import { SEWER_SIM } from '../src/sim/sewer';
import { floorLevel } from '../src/run/floor-level';
import { FIRST_ROAD } from '../src/gen/roads';
import type { Sewer } from '../src/physics/level';

// the first floor (seeds 1.., floors 2-8) with a sewer s matching want, and that sewer (without a stair set, unless
// stairs: those that roll on through from the way in would slam on its steps)
let lastFound: Level | null = null; // (the floor find() is looking at)
function find(want: (s: Sewer) => boolean, stairs = false): { level: Level; s: Sewer } {
  for (let seed = 1; seed < 60; seed++) {
    for (const floor of [2, 3, 5, 8]) {
      const level = floorOf(seed * 7919, floor);
      lastFound = level;
      const s = level.sewers?.find((w) => want(w) && (stairs || !w.stairs?.length));
      if (s) return { level, s };
    }
  }
  throw new Error('no such sewer');
}

// skate from x on the sewer's floor (or the street over the way in) with presses at these frames; the events seen
function ride(level: Level, s: Sewer, x: number, onFloor: boolean | number, presses: (sim: FloorSim, f: number) => boolean, frames = 700) {
  //(onFloor: on the sewer's floor, or at this y; else on the street)
  const sim = new FloorSim({ ...level, startX: x, startY: typeof onFloor === 'number' ? onFloor : onFloor ? s.y : level.streetY });
  const events: string[] = [];
  let tap = -99;
  for (let f = 0; f < frames && sim.state === 'skate' && sim.skater.x < s.x1 + 4 * TILE; f++) {
    const p = presses(sim, f);
    if (p) tap = f;
    //(a tap: the finger's down for about 100 ms)
    sim.step({ pressed: p, held: f - tap < 6 });
    for (const e of sim.events) events.push(e.type === 'sewer' ? `sewer:${e.down}${e.kicked ? ':kicked' : ''}` : e.type);
  }
  return { sim, events };
}
const never = () => false;

describe('the sewer route, built out', { timeout: 30000 }, () => {
  it('the ways in are construction spots: a dig on the street, or a plank ramp down off the foot of a hill', () => {
    const { level, s } = find((w) => w.entry === 'ramp');
    const ramp = level.surfaces.find((f) => f.sewer && f.x0 === s.drain[0] && f.y1 !== undefined)!;
    expect(ramp.y).toBe(level.streetY);
    expect(ramp.y1).toBe(s.y);
    //rolling off the street onto it takes you down into the tunnel, no slam
    const { events } = ride(level, s, s.drain[0] - 2 * TILE, false, never, 200);
    expect(events).toContain('sewer:true');
    //(down there: up to coming back up)
    const below = events.slice(0, events.findIndex((e) => e.startsWith('sewer:false')));
    expect(below).not.toContain('slam');
    expect(below.slice(0, 3)).not.toContain('land'); // you roll down the ramp onto the floor, no landing
    expect(find((w) => w.entry === 'dig').s.entry).toBe('dig');
  });

  it('a kick-out throws you up through its grate onto the street; ollie it and you stay down', () => {
    //(one that comes down on the street, not over the outlet onto its ramp, and with no traffic driving through the
    //spot it comes down on: the street's cars are the street's, a kick-out up into one is a slam like any other)
    let after = NaN;
    let up: ReturnType<typeof ride> | null = null;
    const { level, s } = find((w) => {
      if (!w.kicks?.length || w.kicks[0].grate[1] + SEWER.kickRunOut * TILE >= w.outlet[0]) return false;
      const k = w.kicks[0];
      after = NaN;
      up = ride(lastFound!, w, k.x0 - 3 * TILE, true, (sim) => {
        if (Number.isNaN(after) && sim.skater.x > k.grate[1] + SEWER.kickRunOut * TILE) after = sim.skater.y;
        return false;
      }, 260);
      return !up.events.includes('slam');
    }, true);
    const k = s.kicks![0];
    up = up!;
    expect(up.events).toContain('sewer:false:kicked');
    expect(up.events, `${up.events}`).not.toContain('slam');
    expect(after).toBe(level.streetY);
    //(an ollie a few tiles before it)
    let at = -1;
    const down = ride(level, s, k.x0 - 3 * TILE, true, (sim, f) => {
      if (at < 0 && k.x0 - sim.skater.x < 3 * Math.max(1, sim.skater.hsp)) at = f;
      return f === at;
    }, 80);
    expect(down.events).not.toContain('sewer:false:kicked');
    expect(down.sim.skater.y).toBeGreaterThan(level.streetY + TILE);
  });

  it('DOWNSTREAM: the runoff runs your way and pushes you past cruising speed', () => {
    const { level, s } = find((w) => w.piece?.kind !== 'rats' && !w.gator && w.wet.some(([a, b]) => b - a >= 5 * TILE));
    const [a] = s.wet.find(([a, b]) => b - a >= 5 * TILE)!;
    const sim = new FloorSim({ ...level, startX: a + 2, startY: s.y });
    const before = sim.skater.hsp;
    for (let f = 0; f < 40; f++) sim.step({ pressed: false, held: false });
    expect(sim.skater.hsp).toBeGreaterThan(before + 1);
  });

  it('DOWNSTREAM: pieces chained down there multiply the coins, and coming up banks the line', () => {
    let chained = 0;
    let banked = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const level = floorOf(seed * 7919, 2 + (seed % 3) * 3);
      for (const s of level.sewers ?? []) {
        const sim = new FloorSim({ ...level, startX: s.drain[0] - 2 * TILE, startY: level.streetY });
        const pilot = new Pilot('sewer');
        for (let f = 0; f < 1500 && sim.state === 'skate' && sim.skater.x < s.x1 + 2 * TILE; f++) {
          sim.step(pilot.input(sim));
          for (const e of sim.events) {
            if (e.type === 'flowChain') chained++;
            if (e.type === 'flowBank') banked++;
            if (e.type === 'pickup' && sim.down && sim.flowLine >= 2) expect(e.mult).toBeGreaterThan(1);
          }
        }
      }
    }
    expect(chained).toBeGreaterThan(0);
    expect(banked).toBeGreaterThan(0);
  }, 60000);

  it('a rat pack runs at you: roll into it and it trips you, ollie it and it is cleared', () => {
    const { level, s } = find((w) => w.piece?.kind === 'rats', true);
    const from = (s.piece as { x: number }).x - 9 * TILE;
    const trip = ride(level, s, from, true, never, 200);
    expect(trip.events).toContain('ratBump');
    expect(trip.events).not.toContain('rats');
    const hop = ride(level, s, from, true, (sim) => {
      const t = sim.sewer.tunnels.find((x) => x.s === s)!;
      return sim.skater.grounded && t.pack!.rats.some((r) => r.alive && r.x - PHYS.width / 2 - sim.skater.x > 0 && r.x - PHYS.width / 2 - sim.skater.x < 3 * (sim.skater.hsp + SEWER_SIM.ratSpeed));
    }, 200);
    expect(hop.events).toContain('rats');
    expect(hop.events).not.toContain('ratBump');
  });

  it('the alligator bites if you roll into it, and pays a spin token if you ollie it', () => {
    const { level, s } = find((w) => !!w.gator, true);
    const [g0] = s.gator!;
    const bite = ride(level, s, g0 - 4 * TILE, true, never, 120);
    expect(bite.events).toContain('bite');
    expect(bite.events).toContain('slam');
    let at = -1;
    const clear = ride(level, s, g0 - 4 * TILE, true, (sim, f) => {
      if (at < 0 && g0 - PHYS.width / 2 - sim.skater.x < 3 * sim.skater.hsp) at = f;
      return f === at;
    }, 120);
    expect(clear.events).toContain('gator');
    expect(clear.events).not.toContain('bite');
  });

  it('the subway: hop off a passing train, or ollie the gap; drop in with no train and you bail', () => {
    const { level, s } = find((w) => w.piece?.kind === 'subway', true);
    const p = s.piece as { x0: number; x1: number; phase: number };
    //roll off the edge with a train under the gap: a hop off its roof, and across
    const onTrain = (sim: FloorSim) => sim.sewer.tunnels.find((t) => t.s === s)!.train!;
    let crossedOnTrain = false;
    let bailedNoTrain = false;
    for (let wait = 0; wait < SEWER.subwayPeriod; wait += 10) {
      const sim = new FloorSim({ ...level, startX: p.x0 - 4 * TILE, startY: s.y });
      //hold back the skater's start by stepping the trains first
      for (let k = 0; k < wait; k++) sim.sewer.stepTrains();
      let train = false;
      for (let f = 0; f < 200 && sim.state === 'skate' && sim.skater.x < p.x1 + 2 * TILE; f++) {
        sim.step({ pressed: false, held: false });
        if (sim.skater.x > p.x0 && sim.skater.x < p.x1) train ||= onTrain(sim).on;
      }
      if (train && sim.state === 'skate' && sim.skater.x >= p.x1) crossedOnTrain = true;
      if (!train && sim.state === 'bail') bailedNoTrain = true;
    }
    expect(crossedOnTrain).toBe(true);
    expect(bailedNoTrain).toBe(true);
    //an ollie at the edge clears it whenever
    let at = -1;
    const hop = ride(level, s, p.x0 - 4 * TILE, true, (sim, f) => {
      if (at < 0 && p.x0 - sim.skater.x < 3 * sim.skater.hsp) at = f;
      return f === at;
    }, 200);
    expect(hop.events).toContain('subway');
    expect(hop.sim.state).toBe('skate');
  });

  it('the full pipe: the floor dips through its bowl and carves you out the far side', () => {
    const { level, s } = find((w) => w.piece?.kind === 'bowl', true);
    const p = s.piece as { x0: number; x1: number; depth: number };
    let low = 0;
    const { sim } = ride(level, s, p.x0 - 3 * TILE, true, (sim) => {
      low = Math.max(low, sim.skater.y - s.y);
      return false;
    }, 300);
    expect(low).toBeGreaterThan(p.depth - 4);
    expect(sim.state).toBe('skate');
    expect(sim.skater.x).toBeGreaterThan(p.x1);
  });

  it('the flood surge catches you if you dawdle', () => {
    const { level, s } = find((w) => w.piece?.kind === 'surge' && !w.kicks?.length);
    const sim = new FloorSim({ ...level, startX: s.drain[1] + 3 * TILE, startY: s.y });
    const events: string[] = [];
    for (let f = 0; f < 900 && sim.state === 'skate' && sim.skater.x < s.x1; f++) {
      //(held back, as if tripping over and over)
      if (f % 8 === 0) sim.skater.hsp = 1;
      sim.step({ pressed: false, held: false });
      events.push(...sim.events.map((e) => e.type));
    }
    expect(events).toContain('surge');
    expect(events).toContain('washed');
  });

  it('the tunnel to the gate is the sewer road: up out of it at the gate, on to the underground spot', () => {
    let roads = 0;
    for (let seed = 1; seed <= 12 && roads < 2; seed++) {
      const level = floorLevel({ seed: seed * 7919, floor: 2, road: FIRST_ROAD, library: { types: ['POP', 'GRIND', 'FLOW', 'COOL', 'LUCK', 'STREET'] } as never, gnar: 0 });
      const s = level.sewers?.find((w) => w.gate && w.entry === 'dig' && !w.kicks?.length && !w.piece);
      if (!s) continue;
      expect(level.fork?.sewer?.kind).toBe('spot');
      const sim = new FloorSim({ ...level, startX: s.drain[0] - TILE, startY: level.streetY });
      for (let f = 0; f < 1500 && sim.state === 'skate'; f++) sim.step({ pressed: false, held: false });
      expect(sim.state).toBe('exit');
      expect(sim.road).toBe('sewer');
      roads++;
    }
    expect(roads).toBeGreaterThan(0);
  });
});

// zack (2026-10-31): a stair set where you come down into the tunnel, from the ledges ref. Steps are steps: "you
// shouldnt be able to push up stairs". Ollie them or grind the handrail; roll onto them and you slam
describe('the sewer stair set', { timeout: 30000 }, () => {
  it('you come down onto its landing, and the steps only go down', () => {
    let sets = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const level = floorOf(seed * 7919, 3);
      for (const w of level.sewers ?? []) {
        for (const st of w.stairs ?? []) {
          sets++;
          expect(st.up).toBe(st.x0);
          const steps = level.surfaces.filter((f) => f.sewer && f.kind === 'stairs' && f.x0 >= w.x0 && f.x1 <= w.x1);
          expect(steps.length).toBe(1);
          expect(steps[0].y1!).toBeGreaterThan(steps[0].y); // down, left to right
          //(nothing in the tunnel rises as steps, and nothing else sits on the set)
          expect((w.kicks ?? []).some((k) => k.x0 < st.x1 && k.x1 > st.x0)).toBe(false);
          if (w.gator) expect(w.gator[0] < st.x1 && w.gator[1] > st.x0).toBe(false);
        }
      }
    }
    expect(sets).toBeGreaterThanOrEqual(3); // (of 12 floors: tunnels long enough for one)
  });

  it('roll onto the steps and you slam; ollie off the landing and you clear them or grind the handrail down', () => {
    const { level, s } = find((w) => !!w.stairs?.length && !w.gator && w.piece?.kind !== 'rats' && w.piece?.kind !== 'surge', true);
    const st = s.stairs![0];
    const roll = ride(level, s, st.top - 3 * TILE, s.y - st.h, never, 120);
    expect(roll.events).toContain('slam');
    let at = -1;
    let grind = false;
    const ollie = ride(level, s, st.top - 3 * TILE, s.y - st.h, (sim, f) => {
      if (sim.skater.mode === 'rail') grind = true;
      if (at < 0 && sim.skater.x > st.top - 1.2 * TILE) at = f;
      return f === at;
    }, 200);
    expect(ollie.events).not.toContain('slam');
    expect(ollie.sim.skater.x).toBeGreaterThan(st.x1);
    //(and a later ollie, right at the edge, catches the handrail)
    at = -1;
    ride(level, s, st.top - 3 * TILE, s.y - st.h, (sim, f) => {
      if (sim.skater.mode === 'rail') grind = true;
      if (at < 0 && sim.skater.x > st.top - 0.4 * TILE) at = f;
      return f === at;
    }, 200);
    expect(grind).toBe(true);
  });
});
