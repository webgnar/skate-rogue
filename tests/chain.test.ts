import { describe, expect, it } from 'vitest';
import { chain, chainText, type Slots } from '../src/board/mods';
import { dropBoard, type ShopState } from '../src/board/shop';

const wires = (s: Slots) => chain(s).map((l) => `${l.live ? '+' : '-'}${l.wire ?? '.'}`);

describe('board chain', () => {
  it('wires a trigger to the effects it fires, through modifiers and gaps', () => {
    expect(wires(['onOllie', 'twice', null, 'speedKick'])).toEqual(['+start', '+mid', '-mid', '+end']);
    expect(chainText(['onOllie', 'twice', null, 'speedKick'])).toEqual(['OLLIE ▸ ×2 KICK']);
  });
  it('leaves what nothing fires dead', () => {
    // an effect before any trigger, a trigger with nothing after it, a modifier with no effect after it
    expect(wires(['sparks', 'onOllie', 'onLand', 'cashBurst', 'twice'])).toEqual(['-.', '-.', '+start', '+end', '-.']);
    expect(chainText(['sparks', 'onOllie', 'onLand', 'cashBurst', 'twice'])).toEqual(['LAND ▸ +$2']);
  });
  it('gives each trigger its own run', () => {
    expect(wires(['onOllie', 'sparks', 'onGrind', 'delay', 'speedKick'])).toEqual(['+start', '+end', '+start', '+mid', '+end']);
    expect(chainText(['onOllie', 'sparks', 'onGrind', 'delay', 'speedKick'])).toEqual(['OLLIE ▸ SPARKS', 'GRIND ▸ DELAY KICK']);
  });
  it('an empty board fires nothing', () => {
    expect(chainText([null, null, null])).toEqual([]);
  });
});

describe('drag preview board', () => {
  const s = { cash: 99, board: ['sparks', 'onOllie', null] as Slots, stock: ['speedKick', null] as ShopState['stock'], restocks: 0 };
  it('a stock card held over a slot replaces it', () => {
    expect(dropBoard(s, { stock: 0 }, 2)).toEqual(['sparks', 'onOllie', 'speedKick']);
  });
  it('a slot held over another swaps them', () => {
    expect(chainText(dropBoard(s, { slot: 0 }, 1))).toEqual(['OLLIE ▸ SPARKS']);
  });
  it('leaves the shop as it was', () => {
    dropBoard(s, { slot: 0 }, 1);
    expect(s.board).toEqual(['sparks', 'onOllie', null]);
  });
});
