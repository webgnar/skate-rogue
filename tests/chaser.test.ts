import { describe, expect, it } from 'vitest';
import { TILE } from '../src/physics/constants';
import { botRun } from '../src/gen/validate';
import { escapeKind, validatedEscape } from '../src/gen/escape';
import { Chaser, CHASER } from '../src/sim/chaser';
import { FloorSim } from '../src/sim/floor';
import type { Skater } from '../src/physics/skater';

const slam = [{ type: 'slam' as const }];
const at = (x: number) => ({ x }) as Skater;

describe("act 3's chaser", () => {
  it('act 3 is the chase; the others keep their set pieces', () => {
    expect([1, 2, 3, 4, 5].map(escapeKind)).toEqual(['roadblock', 'chopper', 'chase', 'drones', 'finale']);
  });

  it('waits behind until the chase starts, then each slam lets it close in', () => {
    const c = new Chaser(1000, 100);
    c.step(at(500), slam);
    expect(c.gap).toBe(CHASER.startGap); // not started: slams don't count
    expect(c.x).toBe(500 - CHASER.startGap);
    c.step(at(1000), slam);
    expect(c.gap).toBe(CHASER.startGap - CHASER.slam);
    c.step(at(1004), slam);
    expect(c.caught).toBe(false);
    c.step(at(1008), slam);
    expect(c.caught).toBe(true); // three close together
  });

  it('clean skating opens the gap back up, to a cap', () => {
    const c = new Chaser(0, 0);
    c.step(at(10), slam);
    for (let f = 0; f < 60 * 10; f++) c.step(at(10 + f), []);
    expect(c.gap).toBe(CHASER.maxGap);
    //spread out, slams don't add up to a catch
    for (let k = 0; k < 6; k++) {
      c.step(at(0), slam);
      for (let f = 0; f < 60 * 5; f++) c.step(at(0), []);
    }
    expect(c.caught).toBe(false);
  });

  it('a caught skater ends the floor as caught', () => {
    const l = validatedEscape(77, 3);
    expect(l.escape?.kind).toBe('chase');
    const sim = new FloorSim(l);
    sim.skater.x = l.escape!.chaseFrom! + 4 * TILE;
    sim.chaser!.gap = CHASER.catchAt + 1;
    sim.chaser!.step(sim.skater, slam);
    sim.step({ pressed: false, held: false });
    expect(sim.state).toBe('caught');
  });

  it('the no-boon bot gets through the chase', () => {
    for (const seed of [3, 19, 77, 140]) expect(botRun(validatedEscape(seed, 3)).result).toBe('exit');
  });
});
