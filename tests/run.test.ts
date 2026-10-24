import { describe, expect, it } from 'vitest';
import { offerBoons } from '../src/boons/offer';
import { buildFloor, PICKUPS } from '../src/gen/descent';
import { label, rollFork } from '../src/gen/roads';
import { validatedFloor } from '../src/gen/validate';
import { PHYS, TILE } from '../src/physics/constants';
import { RunScore, SCORE } from '../src/run/score';
import { FloorSim } from '../src/sim/floor';

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

  it('puts an overpass over the last street piece, up past a plain ollie, running past the gate', () => {
    const l = buildFloor(5, 2, undefined, { fork });
    const o = l.surfaces.find((s) => s.kind === 'overpass')!;
    expect(o).toBeDefined();
    expect(l.streetY - o.y).toBe(PICKUPS.fork);
    expect(PICKUPS.fork).toBeGreaterThan(50); // a full single ollie peaks at 50 px
    expect(o.x0).toBeLessThan(l.exitX - 8 * TILE);
    expect(o.x1).toBeGreaterThan(l.exitX);
    expect(l.fork?.high.kind).toBe('cash');
  });

  it('leaving on the overpass is the high road, on the street the low road', () => {
    const l = buildFloor(5, 2, undefined, { fork });
    const o = l.fork!;
    const high = new FloorSim(l);
    high.skater.x = o.x0 + 2 * TILE;
    high.skater.y = o.y;
    high.skater.surface = l.surfaces.find((s) => s.kind === 'overpass')!;
    high.skater.mode = 'roll';
    high.traffic.vehicles.length = 0;
    for (let f = 0; f < 600 && high.state === 'skate'; f++) high.step({ pressed: false, held: false });
    expect(high.state).toBe('exit');
    expect(high.road).toBe('high');

    const low = new FloorSim(l);
    low.skater.x = o.x0 + 2 * TILE;
    low.skater.y = l.streetY;
    low.skater.surface = null;
    low.skater.mode = 'roll';
    for (let f = 0; f < 600 && low.state === 'skate'; f++) low.step({ pressed: false, held: false });
    expect(low.road).toBe('low');
  });

  it('the high road is reachable from the street with an ollie and a flip', () => {
    const l = buildFloor(5, 2, undefined, { fork });
    const o = l.fork!;
    let reached = false;
    for (let lead = 2; lead <= 6 && !reached; lead++) {
      const sim = new FloorSim(l);
      sim.traffic.vehicles.length = 0;
      sim.skater.x = o.x0 - 6 * TILE; // the start of the runway
      sim.skater.y = l.streetY;
      sim.skater.surface = null;
      sim.skater.mode = 'roll';
      sim.skater.hsp = PHYS.baseSpeed;
      const popAt = Math.round(((6 - lead) * TILE) / PHYS.baseSpeed);
      for (let f = 0; f < 400 && sim.state === 'skate'; f++) {
        const flip = f === popAt + 18;
        sim.step({ pressed: f === popAt || flip, held: (f >= popAt && f < popAt + 14) || (f >= popAt + 18 && f < popAt + 30) });
        if ((sim.skater.surface as { kind: string } | null)?.kind === 'overpass') reached = true;
      }
    }
    expect(reached).toBe(true);
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
