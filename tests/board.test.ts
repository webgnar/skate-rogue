import { describe, expect, it } from 'vitest';
import { BOARD, fires, MOD_DEFS, modDef, newBoard, type Slots } from '../src/board/mods';
import { buy, buySlot, restock, rollStock, STOCK_SIZE, swap, type ShopState } from '../src/board/shop';
import { buildFloor } from '../src/gen/descent';
import { floorRoad, rollFork, ROADS } from '../src/gen/roads';
import { PHYS } from '../src/physics/constants';
import { isStreetAt } from '../src/physics/level';
import { RunScore } from '../src/run/score';
import { FloorSim } from '../src/sim/floor';

const still = { pressed: false, held: false };

describe('board mods', () => {
  it('has 6 triggers and 8 effects, starting with 3 empty slots', () => {
    expect(MOD_DEFS.filter((m) => m.kind === 'trigger')).toHaveLength(6);
    expect(MOD_DEFS.filter((m) => m.kind === 'effect')).toHaveLength(8);
    expect(newBoard()).toEqual([null, null, null]);
  });

  it('a trigger fires the effects to its right, in order, until the next trigger', () => {
    const b: Slots = ['onGrindEnd', 'speedKick', 'cashBurst', 'onLand', 'sparks'];
    expect(fires(b, 'onGrindEnd')).toEqual([
      { slot: 1, effect: 'speedKick' },
      { slot: 2, effect: 'cashBurst' },
    ]);
    expect(fires(b, 'onLand')).toEqual([{ slot: 4, effect: 'sparks' }]);
    expect(fires(b, 'onTrick')).toEqual([]);
    //effects with no trigger before them never fire
    expect(fires(['cashBurst', 'onOllie', null, 'sparks'], 'onOllie')).toEqual([{ slot: 3, effect: 'sparks' }]);
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

  it('Gravity Flip stops a fall and pulls up; Jump Refill banks half a jump', () => {
    const l = buildFloor(9, 1);
    const sim = new FloorSim(l, undefined, 0, ['onTrick', 'gravFlip', 'jumpRefill']);
    sim.traffic.vehicles.length = 0;
    sim.step({ pressed: true, held: true });
    for (let f = 0; f < 30; f++) sim.step({ pressed: false, held: true });
    sim.step({ pressed: true, held: true }); // the flip
    expect(sim.skater.gravFlipT).toBeGreaterThan(0);
    expect(sim.skater.spare).toBeCloseTo(BOARD.jumpRefill);
    for (let f = 0; f < 10; f++) sim.step({ pressed: false, held: false });
    expect(sim.skater.vsp).toBeLessThan(PHYS.trick);
  });

  it('On Grind End fires when the skater leaves a ledge or rail', () => {
    const l = buildFloor(9, 1);
    const ledge = l.surfaces.find((s) => s.kind === 'rail' && s.y1 === undefined)!;
    expect(ledge).toBeDefined();
    const sim = new FloorSim(l, undefined, 0, ['onGrindEnd', 'cashBurst']);
    sim.traffic.vehicles.length = 0;
    const sk = sim.skater;
    sk.x = ledge.x1 - 10;
    sk.y = ledge.y;
    sk.surface = ledge;
    sk.mode = 'grind';
    let fired = 0;
    for (let f = 0; f < 20; f++) {
      sim.step(still);
      fired += sim.events.filter((e) => e.type === 'mod' && e.effect === 'cashBurst').length;
    }
    expect(fired).toBe(1);
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

  it('Spark Trail style goes into the combo, or to the score with no combo', () => {
    const s = new RunScore();
    s.addStyle(BOARD.sparkStyle);
    expect(s.score).toBe(BOARD.sparkStyle);
    s.onEvent({ type: 'trick', index: 0, name: 'kickflip', spin: 0, fakie: false }, 0);
    s.addStyle(BOARD.sparkStyle);
    expect(s.comboPoints).toBe(100 + BOARD.sparkStyle);
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
    let s = shop(200);
    const id = s.stock[0]!;
    s = buy(s, 0, 2)!;
    expect(s.board[2]).toBe(id);
    expect(s.cash).toBe(200 - modDef(id).price);
    expect(s.stock[0]).toBeNull();
    expect(buy(s, 0, 1)).toBeNull(); // sold
    const id2 = s.stock[1]!;
    s = buy(s, 1, 2)!;
    expect(s.board[2]).toBe(id2);
    expect(buy(shop(5), 0, 0)).toBeNull();
  });

  it('swaps slots for free; sells a slot up to 5; restocks for more each time', () => {
    let s = shop(500);
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
