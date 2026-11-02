import { describe, expect, it } from 'vitest';
import { wantTitle } from '../src/ui/title';

describe('title screen', () => {
  it('shows on a plain visit', () => {
    expect(wantTitle(new URLSearchParams(''), false)).toBe(true);
  });
  it('skips on test and dev links', () => {
    expect(wantTitle(new URLSearchParams('floor=3'), true)).toBe(false);
    for (const q of ['notitle', 'sewer', 'clouds', 'shop', 'debug']) expect(wantTitle(new URLSearchParams(q), false)).toBe(false);
  });
});
