import { describe, expect, it } from 'vitest';
import { buildFloor } from '../src/gen/descent';
import { TILE } from '../src/physics/constants';
import { quarters, worldAt, WORLDS } from '../src/render/quarters';
import { restyle, WORLD_PROPS } from '../src/render/props';

const floor = (seed: number, n: number) => buildFloor(seed, n, undefined, { hills: true });

describe('the one city: quarters', () => {
  it('covers the whole street, plain Chicago at the start and on the hill, worlds in turn', () => {
    const level = floor(3, 5);
    const qs = quarters(level);
    const start = Math.round(level.finaleX / TILE);
    expect(qs[0].world).toBe('chicago');
    expect(worldAt(level, start - 10)).toBe('chicago');
    expect(worldAt(level, start + 5)).toBe('chicago'); // round the L
    for (let i = 1; i < qs.length; i++) expect(qs[i].x0).toBe(qs[i - 1].x1);
    expect(qs[qs.length - 1].x1).toBeGreaterThanOrEqual(level.street.length);
    const worlds = qs.filter((q) => q.world !== 'chicago').map((q) => q.world);
    expect(worlds.length).toBeGreaterThan(0);
    expect(new Set(worlds).size).toBe(Math.min(worlds.length, WORLDS.length));
  });

  it('is the same every time for a floor, and a run sees every world', () => {
    expect(quarters(floor(9, 4))).toEqual(quarters(floor(9, 4)));
    const seen = new Set<string>();
    for (let n = 1; n <= 6; n++) for (const q of quarters(floor(21, n))) seen.add(q.world);
    for (const w of WORLDS) expect(seen.has(w)).toBe(true);
  });

  it("swaps smashables for the quarter's world's", () => {
    for (const w of WORLDS) expect(restyle('Bottle', w)).toBe(WORLD_PROPS[w]![0]);
    expect(restyle('Hydrant', 'greece')).toBeNull();
  });
});
