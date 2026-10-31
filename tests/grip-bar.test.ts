// The bar across the grip by the back truck (art/board.py 'gripbar', wear.ts gripBarColor): it has to stand out from
// every grip colour the shop sells, so you can always tell the tail from the nose.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GRIPS, RANK_GRIPS } from '../src/board/grips';
import { gripBarColor } from '../src/render/wear';

const lum = (hex: number) => {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};
const contrast = (a: number, b: number) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

describe('grip bar', () => {
  it('is bare maple on the classic black grip', () => {
    expect(gripBarColor(0x1c1c20)).toBe(0xe2c08d);
  });

  it('goes dark on white grip', () => {
    expect(gripBarColor(0xf4f4f4)).toBe(0x1c1c20);
  });

  it('stands out from every grip colour', () => {
    for (const g of [...GRIPS, ...RANK_GRIPS]) expect(contrast(g.color, gripBarColor(g.color)), g.id).toBeGreaterThan(1.8);
  });
});
