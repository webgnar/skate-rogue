import { describe, expect, it } from 'vitest';
import { dragKind } from '../src/ui/shop-drag';

const el = (data: Record<string, string>) => ({ dataset: data }) as unknown as HTMLElement;

describe('shop drag', () => {
  it('tells mod, slot, gear and extra-slot cards apart', () => {
    expect(dragKind(el({ stock: '2' }))).toBe('mod');
    expect(dragKind(el({ gear: 'deck' }))).toBe('gear');
    expect(dragKind(el({ buyslot: '' }))).toBe('buyslot');
    expect(dragKind(el({ slot: '0' }))).toBe('slot');
  });
});
