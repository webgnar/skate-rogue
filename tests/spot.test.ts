import { describe, expect, it } from 'vitest';
import { floorRoad, label, rollFork, ROADS } from '../src/gen/roads';
import { carriedHeat, dropBoon, startHeat } from '../src/run/spot';

describe('the underground spot', () => {
  it('turns up at some forks from floor 3, beside a boon street, and leads on to it', () => {
    const forks = Array.from({ length: 400 }, (_, i) => rollFork(i + 1, 3 + (i % 9)));
    const spots = forks.filter((f) => f.high.kind === 'spot' || f.low.kind === 'spot');
    expect(spots.length).toBeGreaterThan(20);
    for (const f of spots) {
      const other = f.high.kind === 'spot' ? f.low : f.high;
      expect(other.kind).toBe('boon');
    }
    for (let i = 1; i <= 200; i++) {
      const f = rollFork(i, 2);
      expect(f.high.kind === 'spot' || f.low.kind === 'spot').toBe(false);
    }
    const spot = spots[0].high.kind === 'spot' ? spots[0].high : spots[0].low;
    expect(label(spot)).toBe('UNDERGROUND SPOT');
    expect(floorRoad(spot).kind).toBe('boon');
  });

  it('Heat carries at half into the next floor, and a road with its own Heat starts at least there', () => {
    expect(ROADS.heatCarry).toBe(0.5);
    expect(carriedHeat(61)).toBe(31);
    expect(carriedHeat(0)).toBe(0);
    expect(startHeat(0, 31)).toBe(31);
    expect(startHeat(30, 12)).toBe(30);
  });

  it('a swap drops one stack of the boon', () => {
    const held = [{ id: 'bigPop', stacks: 2 }, { id: 'grease', stacks: 1 }] as Parameters<typeof dropBoon>[0];
    expect(dropBoon(held, held[0].id)).toEqual([{ id: 'bigPop', stacks: 1 }, { id: 'grease', stacks: 1 }]);
    expect(dropBoon(held, held[1].id)).toEqual([{ id: 'bigPop', stacks: 2 }]);
  });
});
