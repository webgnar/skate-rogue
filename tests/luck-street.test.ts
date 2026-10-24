import { describe, expect, it } from 'vitest';
import { addBoon, type BoonId, type Held } from '../src/boons/defs';
import { skaterMods } from '../src/boons/mods';
import { offerBoons } from '../src/boons/offer';
import { PHYS, TILE } from '../src/physics/constants';
import { RunScore } from '../src/run/score';
import { FloorSim } from '../src/sim/floor';
import { TRAFFIC } from '../src/traffic/traffic';
import { FLAT, levelOf } from './helpers';

const idle = { pressed: false, held: false };
const held = (...ids: BoonId[]) => ids.reduce<Held[]>((h, id) => addBoon(h, id), []);

function sim(...ids: BoonId[]): FloorSim {
  const s = new FloorSim(levelOf(FLAT), skaterMods(held(...ids)));
  s.traffic.vehicles.length = 0;
  return s;
}

function steps(s: FloorSim, n: number): string[] {
  const out: string[] = [];
  for (let f = 0; f < n; f++) {
    s.step(idle);
    out.push(...s.events.map((e) => e.type));
  }
  return out;
}

const robotaxi = (s: FloorSim, gap: number) => {
  const x0 = s.skater.x + gap;
  s.traffic.vehicles.push({ id: 7, kind: 'robotaxi', speed: 1.6, cruise: 1.6, lane: 0, leaving: false, x0, x1: x0 + TRAFFIC.carW, bottom: s.level.streetY, roof: s.level.streetY - TRAFFIC.carH });
  return s.traffic.vehicles[s.traffic.vehicles.length - 1];
};

describe('STREET boons', () => {
  it('Roof Rider: land on a parked roof and grind it', () => {
    for (const [ids, grind] of [[[], false], [['roofRider'], true]] as [BoonId[], boolean][]) {
      const s = sim(...ids);
      const x0 = s.skater.x + 2 * TILE;
      s.level.cars.push({ x0, x1: x0 + 3 * TILE, roof: s.level.streetY - 40, bottom: s.level.streetY });
      Object.assign(s.skater, { x: x0 + 4, y: s.level.streetY - 50, vsp: 1, mode: 'air', surface: null });
      const ev = steps(s, 6);
      expect(ev.includes('grind')).toBe(grind);
      expect(ev.includes('hop')).toBe(!grind);
    }
  });

  it('Hood Pop: car hops bounce 50% higher', () => {
    expect(skaterMods(held('hoodPop')).hopScale).toBe(1.5);
  });

  it('Spoofed Plate: robotaxis keep their speed when you roll up behind', () => {
    const plain = sim();
    const a = robotaxi(plain, 2 * TILE);
    steps(plain, 10);
    const spoof = sim('spoofedPlate');
    const b = robotaxi(spoof, 2 * TILE);
    steps(spoof, 10);
    expect(a.speed).toBeLessThan(1.5);
    expect(b.speed).toBeCloseTo(1.6);
  });

  it('Slipstream: drafting a car going your way throws you forward', () => {
    const s = sim('slipstream', 'spoofedPlate');
    robotaxi(s, 3.5 * TILE);
    let slipped = false;
    for (let f = 0; f < 40 && !slipped; f++) {
      s.step(idle);
      slipped = s.events.some((e) => e.type === 'slip');
    }
    expect(slipped).toBe(true);
    expect(s.skater.carry).toBeGreaterThan(PHYS.baseSpeed);
    expect(steps(sim('spoofedPlate'), 40)).not.toContain('slip');
  });

  it('Jaywalker doubles the close-call window and its score', () => {
    expect(skaterMods(held('jaywalker')).nearScale).toBe(2);
    const r = new RunScore();
    r.nearScale = 2;
    r.onEvent({ type: 'near' }, 3.5);
    r.onEvent({ type: 'land' }, 3.5);
    expect(r.score).toBe(400);
  });
});

describe('LUCK boons', () => {
  it('Double Stoken counts each Stoken twice; Stoken Magnet reaches three times as far', () => {
    const r = new RunScore();
    r.stokenScale = 2;
    r.onEvent({ type: 'pickup', kind: 'stoken', index: 0 }, 3.5);
    expect(r.stoken).toBe(2);
    const s = sim('stokenMagnet');
    s.level.pickups.push({ kind: 'cash', x: s.skater.x + 20, y: s.skater.y - 24 - 60 });
    (s as unknown as { taken: boolean[] }).taken.push(false);
    expect(steps(s, 2)).toContain('pickup');
  });

  it('Hustler adds a card; Lucky Reroll is a mod flag', () => {
    expect(skaterMods(held('hustler')).extraCards).toBe(1);
    expect(offerBoons(1, { floor: 3, boons: [] }, 4)).toHaveLength(4);
    expect(skaterMods(held('luckyReroll')).freeReroll).toBe(true);
  });
});
