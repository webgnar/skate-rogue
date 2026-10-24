import { describe, expect, it } from 'vitest';
import { offerBoons } from '../src/boons/offer';
import { buildFloor } from '../src/gen/descent';
import { label, rollFork } from '../src/gen/roads';
import { validatedFloor } from '../src/gen/validate';
import { PHYS } from '../src/physics/constants';
import { RunScore, SCORE } from '../src/run/score';
import { FloorSim } from '../src/sim/floor';
import { Pilot } from '../src/bot/pilot';
import { inHill, inLane } from '../src/physics/level';

const fork = { high: { kind: 'cash', danger: 2 }, low: { kind: 'boon', boonType: 'GRIND', danger: 1 } } as const;

describe('the fork', () => {
  it('rolls the same roads for a seed, two different roads, at least one a boon street', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (let floor = 1; floor <= 8; floor++) {
        const f = rollFork(seed, floor);
        expect(rollFork(seed, floor)).toEqual(f);
        expect(label(f.high)).not.toBe(label(f.low));
        expect(f.high.kind === 'boon' || f.low.kind === 'boon').toBe(true);
        if (floor < 2) expect([f.high.kind, f.low.kind]).not.toContain('hot');
      }
    }
  });

  it('keeps lane switches and lane-only things off the stretches of hill on a longer floor', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const l = buildFloor(seed, 1 + (seed % 7), undefined, { fork, hills: true });
      for (const s of l.fork!.switches!) expect(inHill(l, s.x)).toBe(false);
      for (const o of [...l.surfaces, ...l.rails, ...l.cars].filter((o) => o.track !== undefined)) {
        expect(inHill(l, o.x0) || inHill(l, o.x1)).toBe(false);
      }
    }
  });

  it('runs two lanes from a quarter of the way down, with hop and forced switches spread along it', () => {
    let forced = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const l = buildFloor(seed, 2 + (seed % 6), undefined, { fork });
      const sw = l.fork!.switches!;
      expect(sw.length).toBeGreaterThanOrEqual(3);
      expect(sw[0].to).toBeUndefined(); // the first and last are luck
      expect(sw.at(-1)!.to).toBeUndefined();
      forced += sw.filter((s) => s.to !== undefined).length;
      const len = l.exitX - l.finaleX;
      expect(sw[0].x).toBeGreaterThan(l.finaleX + 0.2 * len); // (no hills here: the street is the whole stretch)
      expect(sw.at(-1)!.x).toBeLessThan(l.exitX);
      expect(l.surfaces.some((s) => s.kind === 'overpass')).toBe(false);
      //nothing lane-only straddles a switch or sits before the first one
      for (const o of [...l.surfaces, ...l.cars, ...l.glass].filter((o) => o.track !== undefined)) {
        expect(o.x0).toBeGreaterThan(sw[0].x);
        for (const s of sw) expect(o.x1 < s.x || o.x0 > s.x).toBe(true);
      }
    }
    expect(forced).toBeGreaterThan(2);
    const all = Array.from({ length: 12 }, (_, s) => buildFloor(s + 1, 4, undefined, { fork }));
    expect(all.some((l) => l.surfaces.some((s) => s.track === 1))).toBe(true);
    expect(all.some((l) => l.surfaces.some((s) => s.track === 0))).toBe(true);
  });

  it('at a hop switch, in the air you hop lanes and rolling you stay; a forced one moves everyone', () => {
    const l = buildFloor(5, 2, undefined, { fork });
    const go = (x: number, air: boolean, lane: 0 | 1 = 0) => {
      const sim = new FloorSim(l);
      sim.traffic.vehicles.length = 0;
      Object.assign(sim.skater, { x: x - 3, y: air ? l.streetY - 30 : l.streetY, surface: null, mode: air ? 'air' : 'roll', vsp: 0, hsp: PHYS.baseSpeed, lane });
      sim.step({ pressed: false, held: false });
      return sim;
    };
    const x = l.fork!.switches![0].x;
    const hop = go(x, true);
    expect(hop.skater.lane).toBe(1);
    expect(hop.events).toContainEqual({ type: 'lane', lane: 1 });
    expect(hop.roadAhead).toBe('high');
    expect(go(x, true, 1).skater.lane).toBe(0); // and back again
    const stay = go(x, false);
    expect(stay.skater.lane).toBe(0);
    expect(stay.roadAhead).toBe('low');
    expect(go(x + 20, false, 0).skater.lane).toBe(0); // only as you cross it
    const forced = { x: x + 40, to: 1 as const };
    l.fork!.switches = [...l.fork!.switches!, forced];
    expect(go(forced.x, false, 0).skater.lane).toBe(1);
    expect(go(forced.x, true, 1).skater.lane).toBe(1);
  });

  it('the lane at the gate picks the road, and back-lane things are only solid in the back lane', () => {
    const l = validatedFloor(5, 4, { fork }).level;
    for (const lane of [0, 1] as const) {
      const sim = new FloorSim(l);
      sim.skater.laneLock = lane;
      const pilot = new Pilot('ref');
      for (let f = 0; f < 60 * 120 && sim.state === 'skate'; f++) sim.step(pilot.input(sim));
      expect(sim.state).toBe('exit');
      //the last switch decides: forced, or the lane taken at the hop
      const last = l.fork!.switches!.at(-1)!;
      expect(sim.road).toBe((last.to ?? lane) === 1 ? 'high' : 'low');
    }
    expect(inLane({ track: 1 }, 1)).toBe(true);
    expect(inLane({ track: 1 }, 0)).toBe(false);
    expect(inLane({}, 0) && inLane({}, 1)).toBe(true);
  });

  it('every floor gets coins and at least one Stoken', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const l = buildFloor(seed, 1 + (seed % 5), undefined, { fork });
      expect(l.pickups.filter((p) => p.kind === 'cash').length).toBeGreaterThan(10);
      expect(l.pickups.some((p) => p.kind === 'stoken')).toBe(true);
    }
  });

  it('validated floors with a fork still clear, and a stash floor is shorter', () => {
    for (let floor = 1; floor <= 4; floor++) {
      const v = validatedFloor(77, floor, { fork, danger: 3 });
      expect(v.tierDrops).toBeGreaterThanOrEqual(0);
    }
    let full = 0;
    let short = 0;
    for (let seed = 1; seed <= 10; seed++) {
      full += buildFloor(seed, 3).finaleX;
      short += buildFloor(seed, 3, undefined, { short: true }).finaleX;
    }
    expect(short).toBeLessThan(full * 0.85);
  });

  it('a boon street offers only its type', () => {
    const offer = offerBoons(3, { floor: 2, boons: [] }, 3, 'GRIND');
    expect(offer).toHaveLength(3);
    expect(offer.every((b) => b.type === 'GRIND')).toBe(true);
    expect(offerBoons(3, { floor: 2, boons: [] }, 3, 'GRIND', 1)).not.toEqual(offer);
  });
});

describe('pickups', () => {
  it('collects a coin the skater rolls through, once', () => {
    const l = buildFloor(9, 1, undefined, { fork });
    const sim = new FloorSim(l);
    const sk = sim.skater;
    l.pickups.unshift({ kind: 'cash', x: sk.x + 40, y: sk.y - 24 });
    const taken = new FloorSim(l);
    let got = 0;
    for (let f = 0; f < 30; f++) {
      taken.step({ pressed: false, held: false });
      got += taken.events.filter((e) => e.type === 'pickup' && e.index === 0).length;
    }
    expect(got).toBe(1);
    expect(taken.taken[0]).toBe(true);
  });
});

describe('score', () => {
  it('banks a combo on landing: points x count x speed, and pays cash for long combos', () => {
    const s = new RunScore();
    for (let i = 0; i < 5; i++) s.onEvent({ type: 'trick', index: i, name: 'kickflip', spin: 0, fakie: false }, 0);
    const bank = s.onEvent({ type: 'land' }, PHYS.baseSpeed * 2)!;
    expect(bank.points).toBe(5 * SCORE.trick * 5 * 2);
    expect(bank.cash).toBe(2 * SCORE.cashOutPer);
    expect(s.score).toBe(bank.points);
    expect(s.combo).toBe(0);
  });

  it('a slam loses the combo and knocks the stoke meter', () => {
    const s = new RunScore();
    s.stoke = 0.5;
    s.onEvent({ type: 'trick', index: 0, name: 'kickflip', spin: 0, fakie: false }, 0);
    s.onEvent({ type: 'slam' }, 0);
    expect(s.onEvent({ type: 'land' }, PHYS.baseSpeed)).toBeNull();
    expect(s.score).toBe(0);
    expect(s.stoke).toBeCloseTo(0.25);
  });

  it('full stoke starts the gnar state, which wears off', () => {
    const s = new RunScore();
    for (let i = 0; i < 6; i++) s.onEvent({ type: 'trick', index: i, name: 'kickflip', spin: 0, fakie: false }, 0);
    s.onEvent({ type: 'land' }, PHYS.baseSpeed);
    expect(s.gnar).toBe(true);
    for (let f = 0; f < SCORE.gnarSecs * 60 + 1; f++) s.step('roll');
    expect(s.gnar).toBe(false);
  });

  it('gnar slams cost no Heat', () => {
    const l = buildFloor(9, 1);
    const sim = new FloorSim(l);
    sim.heat.slamFree = true;
    sim.heat.step(sim.skater, [{ type: 'slam' }]);
    expect(sim.heat.value).toBe(0);
  });

  it('pickups: coins are cash, Stoken adds to score', () => {
    const s = new RunScore();
    s.onEvent({ type: 'pickup', kind: 'cash', index: 0 }, 0);
    s.onEvent({ type: 'pickup', kind: 'stoken', index: 1 }, 0);
    expect(s.cash).toBe(1);
    expect(s.stoken).toBe(1);
    expect(s.score).toBe(SCORE.stoken);
  });
});
