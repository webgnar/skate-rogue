import { describe, expect, it } from 'vitest';
import { INTERP, at, keep } from '../src/game/interp';

describe('drawing between steps', () => {
  it('a kept field is drawn alpha of the way from its last step to its new one', () => {
    const car = { x0: 100, lane: 0 };
    expect(at(car, 'x0')).toBe(100); // never kept: as it is
    keep(car, 'x0', 'lane');
    car.x0 = 104;
    INTERP.alpha = 0.25;
    expect(at(car, 'x0')).toBe(101);
    INTERP.alpha = 1;
    expect(at(car, 'x0')).toBe(104);
  });

  it('a jump further than it could move in a step is drawn where it landed', () => {
    const train = { t: 500 };
    keep(train, 't');
    train.t = -1; // reset between trains
    INTERP.alpha = 0.5;
    expect(at(train, 't', 2)).toBe(-1);
    INTERP.alpha = 1;
  });
});
