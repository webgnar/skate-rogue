import { describe, expect, it } from 'vitest';
import { HEAT, Heat } from '../src/heat/heat';
import { buildLevel } from '../src/physics/level';
import { PHYS, TILE } from '../src/physics/constants';
import { Skater } from '../src/physics/skater';
import { validatedLayout } from '../src/gen/validate';
import { FloorSim } from '../src/sim/floor';
import { spawnPlan, TRAFFIC, Traffic } from '../src/traffic/traffic';
import { FLAT, levelOf } from './helpers';

const idle = { pressed: false, held: false };

describe('traffic', () => {
  it('a robotaxi brakes when the skater rolls up behind it, and the skater slams if it does nothing', () => {
    const level = levelOf(FLAT);
    const traffic = new Traffic(level, [{ at: 0, kind: 'robotaxi', speed: PHYS.baseSpeed * 0.45 }]);
    const sk = new Skater(level);
    let braked = false;
    let slammed = false;
    for (let f = 0; f < 600 && !slammed; f++) {
      traffic.step(sk.x);
      sk.movers = traffic.inLane;
      sk.step(idle);
      const v = traffic.vehicles[0];
      if (v && v.speed < v.cruise * 0.8) braked = true;
      slammed = sk.events.some((e) => e.type === 'slam');
      sk.events.length = 0;
    }
    expect(braked).toBe(true);
    expect(slammed).toBe(true);
  });

  it('an oncoming car is on its way for at least 45 frames before it can reach the skater', () => {
    const closing = PHYS.baseSpeed - TRAFFIC.oncomingSpeed;
    // spawned this far ahead; the screen shows about 18 tiles ahead of the skater
    const frames = (TRAFFIC.aheadOncoming - 18 * TILE) / closing;
    expect(frames).toBeGreaterThanOrEqual(45);
  });

  it('vehicles pull out of the lane before a canal', () => {
    const canal = [
      '................', '................', '................', '................', '................',
      '................', '................', '................', '................', '#######....#####',
    ];
    const level = levelOf(canal);
    const traffic = new Traffic(level, [{ at: 0, kind: 'robotaxi', speed: 2 }]);
    for (let f = 0; f < 400; f++) traffic.step(0);
    for (const v of traffic.vehicles) {
      if (!v.leaving) continue;
      expect(v.lane).toBeGreaterThan(0);
    }
    expect(traffic.vehicles.some((v) => v.leaving)).toBe(true);
  });

  it('the same seed gives the same traffic', () => {
    const level = buildLevel(validatedLayout(9, 5).layout);
    expect(spawnPlan(level, 9)).toEqual(spawnPlan(level, 9));
    expect(spawnPlan(level, 9).some((s) => s.kind === 'oncoming') || spawnPlan(level, 9).length > 0).toBe(true);
  });

  it('floor 1 has robotaxis only', () => {
    for (let seed = 1; seed < 30; seed++) {
      const level = buildLevel(validatedLayout(seed, 1).layout);
      expect(spawnPlan(level, seed).every((s) => s.kind === 'robotaxi')).toBe(true);
    }
  });
});

describe('heat', () => {
  function slamAt(frames: Set<number>, total: number): Heat {
    const sk = new Skater(levelOf(FLAT));
    const heat = new Heat();
    for (let f = 0; f < total && !heat.caught; f++) {
      sk.step(idle);
      const events = frames.has(f) ? [{ type: 'slam' as const }] : [];
      heat.step(sk, events);
    }
    return heat;
  }

  it('three slams within 4 seconds catch you', () => {
    expect(slamAt(new Set([0, 100, 200]), 240).caught).toBe(true);
  });

  it('one slam is forgiven after about 10 seconds of clean skating', () => {
    const h = slamAt(new Set([0]), 60 * 11);
    expect(h.value).toBe(0);
  });

  it('two slams are a scare, not a catch', () => {
    const h = slamAt(new Set([0, 100]), 400);
    expect(h.caught).toBe(false);
  });

  it('the cruiser holds while the skater remounts', () => {
    const h = slamAt(new Set([0]), 1);
    expect(h.holdT).toBe(PHYS.slamFrames - 1);
    expect(HEAT.slam).toBe(35);
  });

  it('a floor sim reports caught when Heat hits 100', () => {
    const sim = new FloorSim(levelOf(FLAT));
    sim.heat.value = 99.99;
    sim.heat.sinceSlam = 0;
    for (let f = 0; f < 3; f++) {
      sim.skater.hsp = 0;
      sim.step(idle);
    }
    expect(sim.state).toBe('caught');
  });
});
