import { describe, expect, it } from 'vitest';
import { addBoon, type BoonId, type Held } from '../src/boons/defs';
import { skaterMods } from '../src/boons/mods';
import { HEAT } from '../src/heat/heat';
import { PHYS, TILE } from '../src/physics/constants';
import { RunScore } from '../src/run/score';
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
    expect(skaterMods(held('bombHill', 'exitWax')).carryBleedScale).toBe(0.125);
  });

  it('Kicker Boost and Slingshot scale their launches', () => {
    expect(skaterMods(held('kickerBoost')).kickerScale).toBe(1.3);
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

  it('Low Profile slows Heat gains; Ghost Mode halves Heat from skating slow', () => {
    const a = sim(FLAT, 'lowProfile');
    slamInto(a);
    const b = sim(FLAT);
    slamInto(b);
    expect(a.heat.value).toBeLessThan(b.heat.value * 0.8);
    expect(skaterMods(held('ghostMode')).slowHeat).toBe(0.5);
  });

  it('Tuck and Roll: a fall in a gap bounces you back out once, for a slam of Heat', () => {
    const s = sim(CANAL, 'tuckAndRoll');
    const ev = steps(s, 600);
    expect(ev).toContain('tuck');
    expect(s.heat.value).toBeGreaterThan(0);
    //the plain skater falls in the first canal
    expect(steps(sim(CANAL), 600)).toContain('bail');
  });

  it('Siren Song: car hops take more Heat off; Decoy pulls Heat back once', () => {
    expect(skaterMods(held('sirenSong', 'sirenSong')).hopCool).toBe(20);
    const s = sim(FLAT, 'decoy');
    s.heat.value = HEAT.decoyAt - 0.5;
    s.skater.hsp = 1; // slow: the Heat climbs
    const ev = steps(s, 30);
    expect(ev).toContain('decoy');
    expect(s.heat.value).toBeLessThan(40);
    s.heat.value = HEAT.decoyAt + 1;
    expect(steps(s, 5)).not.toContain('decoy');
  });

  it('Slam Stoke: a slam keeps the combo and fills stoke', () => {
    const r = new RunScore();
    r.slamStoke = true;
    r.onEvent({ type: 'trick', index: 0, name: 'kickflip', spin: 0, fakie: false }, 3.5);
    r.onEvent({ type: 'slam' }, 3.5);
    expect(r.combo).toBe(1);
    expect(r.stoke).toBeGreaterThan(0.2);
  });
});
