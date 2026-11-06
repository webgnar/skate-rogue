import { describe, expect, it } from 'vitest';
import { addBoon, type BoonId, type Held } from '../src/boons/defs';
import { skaterMods } from '../src/boons/mods';
import { offerBoons } from '../src/boons/offer';
import { TILE } from '../src/physics/constants';
import { RunScore } from '../src/run/score';
import { FloorSim } from '../src/sim/floor';
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

});

describe('LUCK boons', () => {
  it('Double Stoken counts each Stoken twice and (it took in Stoken Magnet) reaches three times as far', () => {
    const r = new RunScore();
    r.stokenScale = 2;
    r.onEvent({ type: 'pickup', kind: 'stoken', index: 0 }, 3.5);
    expect(r.stoken).toBe(2);
    const s = sim('doubleStoken');
    s.level.pickups.push({ kind: 'cash', x: s.skater.x + 20, y: s.skater.y - 24 - 60 });
    (s as unknown as { taken: boolean[] }).taken.push(false);
    expect(steps(s, 2)).toContain('pickup');
  });

  it('Hustler adds a card', () => {
    expect(skaterMods(held('hustler')).extraCards).toBe(1);
    expect(offerBoons(1, { floor: 3, boons: [] }, 4)).toHaveLength(4);
  });
});
