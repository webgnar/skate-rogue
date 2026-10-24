import { describe, expect, it } from 'vitest';
import { Cell, floorText, segments, stars, wearLevel, wearSegments } from '../src/ui/hud';

describe('hud', () => {
  it('lights meters in whole segments, at least one above zero', () => {
    expect(segments(0, 10)).toBe(0);
    expect(segments(0.01, 10)).toBe(1);
    expect(segments(0.5, 10)).toBe(5);
    expect(segments(1.4, 10)).toBe(10);
    expect(segments(NaN, 10)).toBe(0);
  });

  it('lights a star at 25, 50, 75 and 90 Heat', () => {
    expect([0, 24, 25, 50, 74, 75, 90, 100].map(stars)).toEqual([0, 0, 1, 2, 2, 3, 4, 4]);
  });

  it('wears gear bars on the gameplay lines', () => {
    expect(wearLevel(100)).toBe('fresh');
    expect(wearLevel(50)).toBe('fresh');
    expect(wearLevel(49)).toBe('worn');
    expect(wearLevel(15)).toBe('busted');
    expect(wearSegments(100)).toBe(5);
    expect(wearSegments(14)).toBe(1);
    expect(wearSegments(0)).toBe(0);
  });

  it('names the act, the floor in the act and the escape', () => {
    expect(floorText(1, { kind: 'boon', boonType: 'POP', danger: 1 } as never)).toBe('ACT 1-1 · FLOOR 1');
    expect(floorText(5, { kind: 'cash', danger: 1 } as never)).toBe('ACT 2-2 · FLOOR 5');
    expect(floorText(3, { kind: 'escape', act: 1 } as never)).toBe('ACT 1 · ESCAPE');
  });

  it('only writes to the DOM when the value changes', () => {
    let writes = 0;
    const el = { dataset: {} as DOMStringMap, set textContent(_: string) { writes++; }, get textContent() { return ''; } };
    const cell = new Cell(el as never);
    cell.text('12,340');
    cell.text('12,340');
    cell.text('12,341');
    expect(writes).toBe(2);
  });
});
