import { describe, expect, it } from 'vitest';
import { addBoon, type BoonId, type Held } from '../src/boons/defs';
import { skaterMods } from '../src/boons/mods';
import { PHYS, TILE } from '../src/physics/constants';
import { FloorSim } from '../src/sim/floor';
import { FLAT, levelOf } from './helpers';

const idle = { pressed: false, held: false };
const held = (...ids: BoonId[]) => ids.reduce<Held[]>((h, id) => addBoon(h, id), []);
const CANAL = [
  '................', '................', '................', '................', '................',
  '................', '................', '................', '................', '#####......#####',
];

function sim(rows: string[], ...ids: BoonId[]): FloorSim {
  const s = new FloorSim(levelOf(rows), skaterMods(held(...ids)));
  s.traffic.vehicles.length = 0;
  return s;
}

function steps(s: FloorSim, n: number, input = idle): string[] {
  const out: string[] = [];
  for (let f = 0; f < n; f++) {
    s.step(input);
    out.push(...s.events.map((e) => e.type));
  }
  return out;
}

describe('FLOW boons', () => {
  it('New Wheels: cruise 20% faster per stack, and score 20% more', () => {
    const a = sim(FLAT, 'newWheels', 'newWheels');
    steps(a, 120);
    expect(a.skater.hsp).toBeCloseTo(PHYS.baseSpeed * 1.4, 1);
    expect(skaterMods(held('newWheels')).scoreScale).toBeCloseTo(1.2);
  });

  it('Butter: landing keeps your air speed as flow speed', () => {
    for (const [ids, keep] of [[[], false], [['butter'], true]] as [BoonId[], boolean][]) {
      const s = sim(FLAT, ...ids);
      Object.assign(s.skater, { y: s.level.streetY - 30, vsp: 2, hsp: 7, mode: 'air', surface: null });
      steps(s, 20);
      expect(s.skater.hsp > PHYS.baseSpeed + 1).toBe(keep);
    }
  });

  it('Bomb Hill: extra speed bleeds off half as fast', () => {
    expect(skaterMods(held('bombHill')).carryBleedScale).toBe(0.5);
  });

  it('Slingshot scales its launch', () => {
    expect(skaterMods(held('slingshot', 'slingshot')).slingshot).toBe(2);
  });
});

describe('COOL boons', () => {
  const slamInto = (s: FloorSim) => {
    const x0 = s.skater.x + 3 * TILE;
    s.level.cars.push({ x0, x1: x0 + 2 * TILE, roof: s.level.streetY - 40, bottom: s.level.streetY });
    return steps(s, 60);
  };

  it('Bubble Pads: the first slam each floor costs no speed and no Heat', () => {
    const s = sim(FLAT, 'bubblePads');
    const ev = slamInto(s);
    expect(ev).toContain('pad');
    expect(ev).not.toContain('slam');
    expect(s.heat.value).toBe(0);
    const plain = sim(FLAT);
    expect(slamInto(plain)).toContain('slam');
    expect(plain.heat.value).toBeGreaterThan(20);
  });

  it('Low Profile slows Heat gains', () => {
    const a = sim(FLAT, 'lowProfile');
    slamInto(a);
    const b = sim(FLAT);
    slamInto(b);
    expect(a.heat.value).toBeLessThan(b.heat.value * 0.8);
  });

  it('a bail is one event: the steps the game keeps taking while he sinks make none (its sound played every frame)', () => {
    const ev = steps(sim(CANAL), 600);
    expect(ev.filter((e) => e === 'bail')).toHaveLength(1);
  });

});
