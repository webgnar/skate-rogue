import { describe, expect, it } from 'vitest';
import { NO_MODS } from '../src/boons/mods';
import { ROADS } from '../src/gen/roads';
import { GNAR, gnarCards, gnarCarry, gnarDanger, gnarOpen, MAX_GNAR, withGnar } from '../src/run/gnar';

describe('Gnar levels', () => {
  it('open with your first win, one past the highest won, up to the last', () => {
    expect(gnarOpen(0, 0)).toBe(0);
    expect(gnarOpen(1, 0)).toBe(1);
    expect(gnarOpen(4, 2)).toBe(3);
    expect(gnarOpen(9, MAX_GNAR)).toBe(MAX_GNAR);
  });

  it('each level adds its rule on top of the ones before', () => {
    expect(gnarDanger(1, 0)).toBe(1);
    expect(gnarDanger(1, 1)).toBe(2);
    expect(gnarDanger(3, 1)).toBe(3);
    expect(withGnar(NO_MODS, 1).heatRise).toBe(1);
    expect(withGnar(NO_MODS, 2).heatRise).toBeCloseTo(GNAR.heatRise);
    expect(gnarCarry(2)).toBe(ROADS.heatCarry);
    expect(gnarCarry(3)).toBe(GNAR.carry);
    expect(gnarCards(3, 3)).toBe(3);
    expect(gnarCards(3, 4)).toBe(2);
    expect(withGnar(NO_MODS, 4).wearScale).toBe(1);
    expect(withGnar(NO_MODS, 5).wearScale).toBe(GNAR.wear);
  });

  it('pays more the higher you go, and a normal run is untouched', () => {
    expect(withGnar(NO_MODS, 0)).toBe(NO_MODS);
    expect(withGnar(NO_MODS, 3).scoreScale).toBeGreaterThan(withGnar(NO_MODS, 1).scoreScale);
    expect(withGnar(NO_MODS, 3).stokenScale).toBeCloseTo(1 + 3 * GNAR.stoken);
  });
});
