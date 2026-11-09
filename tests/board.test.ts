import { describe, expect, it } from 'vitest';
import { BOARD, fires, MOD_DEFS, modDef, newBoard, type Slots } from '../src/board/mods';
import { buy, buySlot, restock, rollStock, STOCK_SIZE, swap, type ShopState } from '../src/board/shop';
import { buildFloor } from '../src/gen/descent';
import { floorRoad, rollFork, ROADS } from '../src/gen/roads';
import { PHYS } from '../src/physics/constants';
import { isStreetAt } from '../src/physics/level';
import { FloorSim } from '../src/sim/floor';

const still = { pressed: false, held: false };

describe('board mods', () => {
  it('has 4 triggers, 5 effects and 3 modifiers (trimmed 2026-11-06), starting with 3 empty slots', () => {
    expect(MOD_DEFS.filter((m) => m.kind === 'trigger')).toHaveLength(4);
    expect(MOD_DEFS.filter((m) => m.kind === 'effect')).toHaveLength(5);
    expect(MOD_DEFS.filter((m) => m.kind === 'modifier')).toHaveLength(3);
    expect(newBoard()).toEqual([null, null, null]);
  });

  it('a trigger fires the effects to its right, in order, until the next trigger', () => {
    const b: Slots = ['onGrind', 'speedKick', 'cashBurst', 'onLand', 'doublePop'];
    const plain = { times: 1, comboOnly: false, coinFlip: false };
    expect(fires(b, 'onGrind')).toEqual([
      { slot: 1, effect: 'speedKick', ...plain },
      { slot: 2, effect: 'cashBurst', ...plain },
    ]);
    expect(fires(b, 'onLand')).toEqual([{ slot: 4, effect: 'doublePop', ...plain }]);
    expect(fires(b, 'onTrick')).toEqual([]);
    //effects with no trigger before them never fire
    expect(fires(['cashBurst', 'onOllie', null, 'doublePop'], 'onOllie')).toEqual([{ slot: 3, effect: 'doublePop', ...plain }]);
  });

  it('a modifier shapes the next effect only, and they stack', () => {
    const f = fires(['onLand', 'twice', 'twice', 'cashBurst', 'doublePop', 'twice', 'comboOnly', 'speedKick'], 'onLand');
    expect(f.map((x) => [x.effect, x.times, x.comboOnly])).toEqual([
      ['cashBurst', 4, false],
      ['doublePop', 1, false],
      ['speedKick', 4, true],
    ]);
    //a modifier before the trigger, or under another trigger, does nothing here
    expect(fires(['twice', 'onLand', 'doublePop'], 'onLand')[0].times).toBe(1);
    expect(fires(['onOllie', 'twice', 'onLand', 'doublePop'], 'onLand')[0].times).toBe(1);
  });

  it('in the sim: ×2 pays twice, Combo Only needs a combo', () => {
    const run = (board: Slots, combo = 0) => {
      const sim = new FloorSim(buildFloor(5, 1), undefined, 0, board);
      sim.combo = combo;
      const at: number[] = [];
      for (let f = 0; f < 90; f++) {
        sim.step({ pressed: f === 2, held: f >= 2 && f < 6 });
        for (const e of sim.events) if (e.type === 'mod') at.push(f);
      }
      return at;
    };
    const once = run(['onOllie', 'cashBurst']);
    expect(once).toHaveLength(1);
    expect(run(['onOllie', 'twice', 'cashBurst'])).toEqual([once[0], once[0]]);
    expect(run(['onOllie', 'comboOnly', 'cashBurst'])).toEqual([]);
    expect(run(['onOllie', 'comboOnly', 'cashBurst'], 5)).toHaveLength(2);
    expect([0, 3]).toContain(run(['onOllie', 'coinFlip', 'cashBurst']).length);
  });

  it('On Ollie + Speed Kick: the pop comes with +2 speed, carried like rail speed', () => {
    const l = buildFloor(9, 1);
    const sim = new FloorSim(l, undefined, 0, ['onOllie', 'speedKick', null]);
    sim.traffic.vehicles.length = 0;
    sim.step({ pressed: true, held: true });
    expect(sim.events.some((e) => e.type === 'mod' && e.effect === 'speedKick' && e.slot === 1)).toBe(true);
    expect(sim.skater.hsp).toBeCloseTo(PHYS.baseSpeed + BOARD.speedKick);
    expect(sim.skater.carry).toBeCloseTo(PHYS.baseSpeed + BOARD.speedKick);
  });

  it('Double Pop: a second, smaller pop 0.2 s after the ollie', () => {
    const l = buildFloor(9, 1);
    const sim = new FloorSim(l, undefined, 0, ['onOllie', 'doublePop']);
    sim.traffic.vehicles.length = 0;
    sim.step({ pressed: true, held: false });
    for (let f = 0; f < BOARD.doublePopFrames - 1; f++) sim.step(still);
    const before = sim.skater.vsp;
    sim.step(still);
    expect(before).toBeGreaterThan(PHYS.ollie * BOARD.doublePop);
    expect(sim.skater.vsp).toBeLessThanOrEqual(PHYS.ollie * BOARD.doublePop + PHYS.grav + 1e-6);
  });

  it('Double Pop is one a jump: On Trick + Double Pop can not fly a floor off dead flips (zack, 2026-11-08)', () => {
    //tapping every 24 frames used to fire a pop off every dead flip and stay in the air from start to exit
    const longest = (board: Slots) => {
      const sim = new FloorSim(buildFloor(9, 6), undefined, 0, board);
      sim.traffic.vehicles.length = 0;
      let air = 0;
      let best = 0;
      for (let f = 0; f < 3600 && sim.state === 'skate'; f++) {
        const tap = f % 24 === 0;
        sim.step({ pressed: tap, held: tap });
        air = sim.skater.mode === 'air' ? air + 1 : 0;
        best = Math.max(best, air);
      }
      return best;
    };
    expect(longest(['onTrick', 'doublePop', 'cashBurst'])).toBeLessThan(300);
    expect(longest(['onTrick', 'twice', 'doublePop'])).toBeLessThan(300);
  });

  it('Shockwave pulls nearby cars out of the skate lane, not far ones', () => {
    const l = buildFloor(9, 3);
    const car = (x: number) => ({ id: x, kind: 'robotaxi' as const, speed: 1, cruise: 1, lane: 0, leaving: false, x0: x, x1: x + 64, roof: l.streetY - 40, bottom: l.streetY });
    // whether a car at x is pulled out on the first step, with this board
    //a long open stretch of street to stand on
    const open = (x0: number) => {
      for (let x = x0; x < x0 + 700; x += 16) if (!isStreetAt(l, x)) return false;
      return !l.cars.some((c) => c.x1 > x0 && c.x0 < x0 + 700) && !l.glass.some((g) => g.x1 > x0 && g.x0 < x0 + 700);
    };
    let at = l.startX;
    while (!open(at) && at < l.exitX) at += 32;
    expect(at).toBeLessThan(l.exitX);
    const leaves = (x: number, board: Slots) => {
      const sim = new FloorSim(l, undefined, 0, board);
      Object.assign(sim.skater, { x: at, y: l.streetY, surface: null, mode: 'roll' });
      const v = car(at + x);
      sim.traffic.vehicles = [v];
      sim.step({ pressed: true, held: true });
      return v.leaving;
    };
    const wave: Slots = ['onOllie', 'shockwave'];
    //spots where traffic would stay in the lane by itself
    const near = [64, 128, 192, 256, 320].filter((x) => !leaves(x, []));
    const far = [416, 480, 560, 620].filter((x) => !leaves(x, []));
    expect(near.length).toBeGreaterThan(0);
    expect(far.length).toBeGreaterThan(0);
    for (const x of near) expect(leaves(x, wave)).toBe(true);
    for (const x of far) expect(leaves(x, wave)).toBe(false);
  });

  it('Patch Job puts 5 back on the most worn part, 6 times a floor at most', () => {
    const sim = new FloorSim(buildFloor(9, 1), undefined, 0, ['onOllie', 'twice', 'patchJob'], { deck: 40, trucks: 80, wheels: 20, shoes: 90, bearings: 70 });
    sim.traffic.vehicles.length = 0;
    sim.step({ pressed: true, held: true });
    expect(sim.gear.wheels).toBe(20 + 2 * BOARD.patchJob);
    expect(sim.events.filter((e) => e.type === 'patch')).toHaveLength(2);
    //land, pop again until the floor's patches run out
    let total = 2;
    for (let f = 0; f < 1200 && total < 10; f++) {
      sim.step({ pressed: f % 40 === 0, held: f % 40 < 4 });
      total += sim.events.filter((e) => e.type === 'patch').length;
    }
    expect(total).toBe(BOARD.patchJobPerFloor);
  });
});

describe('the skate shop', () => {
  const shop = (cash: number): ShopState => ({ cash, board: newBoard(), stock: rollStock(5, 1, 0), restocks: 0 });

  it('stocks 4 different mods with at least one trigger and one effect, the same for a seed', () => {
    for (let seed = 1; seed < 60; seed++) {
      const st = rollStock(seed, 2, 0);
      expect(st).toHaveLength(STOCK_SIZE);
      expect(new Set(st).size).toBe(STOCK_SIZE);
      expect(st.some((id) => modDef(id).kind === 'trigger')).toBe(true);
      expect(st.some((id) => modDef(id).kind === 'effect')).toBe(true);
      expect(rollStock(seed, 2, 0)).toEqual(st);
    }
  });

  it('buys a mod into the chosen slot, replacing what was there, and only with the cash for it', () => {
    let s = shop(1000);
    const id = s.stock[0]!;
    s = buy(s, 0, 2)!;
    expect(s.board[2]).toBe(id);
    expect(s.cash).toBe(1000 - modDef(id).price);
    expect(s.stock[0]).toBeNull();
    expect(buy(s, 0, 1)).toBeNull(); // sold
    const id2 = s.stock[1]!;
    s = buy(s, 1, 2)!;
    expect(s.board[2]).toBe(id2);
    expect(buy(shop(5), 0, 0)).toBeNull();
  });

  it('swaps slots for free; sells a slot up to 5; restocks for more each time', () => {
    let s = shop(2000);
    s = buy(s, 0, 0)!;
    const cash = s.cash;
    s = swap(s, 0, 2);
    expect(s.board[2]).not.toBeNull();
    expect(s.board[0]).toBeNull();
    expect(s.cash).toBe(cash);
    s = buySlot(s)!;
    s = buySlot(s)!;
    expect(s.board).toHaveLength(BOARD.maxSlots);
    expect(buySlot(s)).toBeNull();
    const r1 = restock(s, 5, 1)!;
    expect(r1.cash).toBe(s.cash - BOARD.restockPrice);
    const r2 = restock(r1, 5, 1)!;
    expect(r2.cash).toBe(r1.cash - BOARD.restockPrice - 5);
  });

  it('the fork offers the shop at the end of every third floor, from floor 2 sometimes, beside a boon street', () => {
    let early = 0;
    for (let seed = 1; seed <= 60; seed++) {
      for (let floor = 1; floor <= 9; floor++) {
        const f = rollFork(seed, floor);
        const shopRoad = [f.high, f.low].find((r) => r.kind === 'shop');
        if (floor % ROADS.shopEvery === 0) expect(shopRoad).toBeDefined();
        if (floor < ROADS.shopFrom) expect(shopRoad).toBeUndefined();
        if (shopRoad) {
          expect([f.high, f.low].some((r) => r.kind === 'boon')).toBe(true);
          expect(floorRoad(shopRoad).kind).toBe('boon');
          if (floor % ROADS.shopEvery !== 0) early++;
        }
      }
    }
    expect(early).toBeGreaterThan(0);
  });
});

describe('speed kick cap', () => {
  it('kicks stack up to twice cruising speed', () => {
    const l = buildFloor(9, 1);
    const sim = new FloorSim(l, undefined, 0, ['onTrick', 'speedKick', 'speedKick']);
    sim.traffic.vehicles.length = 0;
    sim.step({ pressed: true, held: true });
    for (let f = 0; f < 10; f++) sim.step({ pressed: false, held: true });
    sim.step({ pressed: true, held: true });
    expect(sim.skater.hsp).toBeCloseTo(BOARD.speedKickMax);
  });
});
