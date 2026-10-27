import { describe, expect, it } from 'vitest';
import { whole } from '../src/run/save';

describe('Stoken shown whole', () => {
  it('drops the Gnar fractions and float noise', () => {
    let s = 0;
    for (let i = 0; i < 9; i++) s += 1.2; // nine pickups at Gnar 1
    expect(String(s)).not.toBe('10.8'); // the float sum the HUD used to print
    expect(whole(s)).toBe(10);
    expect(whole(12)).toBe(12);
    expect(whole(11.999999999)).toBe(12);
    expect(whole(0)).toBe(0);
  });
});
