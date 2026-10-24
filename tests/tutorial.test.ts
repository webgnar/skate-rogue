import { describe, expect, it } from 'vitest';
import { botRun } from '../src/gen/validate';
import { LESSONS, tutorialLevel } from '../src/gen/tutorial';
import { FloorSim } from '../src/sim/floor';

describe('the tutorial floor', () => {
  const level = tutorialLevel(7);

  it('puts a prompt before each lesson, in order along the street', () => {
    expect(level.tutorial!.map((t) => t.text)).toEqual(LESSONS.map((l) => l.text));
    const xs = level.tutorial!.map((t) => t.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(xs[0]).toBeGreaterThan(level.startX);
    expect(xs[xs.length - 1]).toBeLessThan(level.exitX);
  });

  it('is quiet: no traffic, no hazards that wait, and Heat stays at 0', () => {
    const sim = new FloorSim(level);
    expect(sim.traffic.vehicles).toHaveLength(0);
    expect(level.busStops).toHaveLength(0);
    expect(level.doors).toHaveLength(0);
    for (let f = 0; f < 600; f++) sim.step({ pressed: f % 40 === 0, held: f % 40 < 10 });
    expect(sim.traffic.vehicles).toHaveLength(0);
    expect(sim.heat.value).toBe(0);
  });

  it('the no-boon bot gets through it', () => {
    expect(botRun(tutorialLevel(1)).result).toBe('exit');
    expect(botRun(tutorialLevel(99)).result).toBe('exit');
  });
});
