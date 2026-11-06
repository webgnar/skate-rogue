import { describe, expect, it } from 'vitest';
import { DECK_ARTS, DECK_PICK, deckArt, deckChoices, STOCK_DECK } from '../src/board/deck-art';

describe('deck graphics', () => {
  it('has a good set, each with its own id and the colours its shape uses', () => {
    expect(DECK_ARTS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(DECK_ARTS.map((a) => a.id)).size).toBe(DECK_ARTS.length);
    for (const a of DECK_ARTS) expect(a.ink.length).toBeGreaterThan(0);
  });

  it('looks up by id, unknown ids are the stock deck', () => {
    expect(deckArt('skull').name).toBe('Bones');
    expect(deckArt('nope')).toBe(STOCK_DECK);
  });

  it('a shop offers different graphics, never the one on the board, the same for the same seed and visit', () => {
    for (let visit = 1; visit < 30; visit++) {
      const picks = deckChoices(60, visit, 'flames');
      expect(picks.length).toBe(DECK_PICK);
      expect(new Set(picks.map((a) => a.id)).size).toBe(DECK_PICK);
      expect(picks.some((a) => a.id === 'flames')).toBe(false);
      expect(deckChoices(60, visit, 'flames')).toEqual(picks);
    }
    expect(deckChoices(60, 1, 'stock')).not.toEqual(deckChoices(60, 2, 'stock'));
  });
});
