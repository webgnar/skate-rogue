// Deck graphics, the art on the underside of the board (zack, 2026-11-06: "there should be more deck underside
// graphics... these ones you made look pretty good", the decks on GNAR SUPPLY's wall rack, art/skateshop.py). The
// same flat style: a deck painted one colour with a bold shape or two on it in others. A run starts on the stock deck
// (plain red, as before); a new deck from the shop comes with a graphic, for the rest of the run.
// Pure: the run keeps the id, src/render/deck-graphic.ts paints it.
import { makeRng, randInt } from '../gen/rng';

// the shapes, each a function of the deck's colours in deck-graphic.ts
export type DeckShape =
  | 'plain' | 'band' | 'stripe' | 'dot' | 'bolt' | 'chevrons' | 'checker' | 'racing' | 'star' | 'flames' | 'diamond'
  | 'cross' | 'target' | 'split' | 'polka' | 'wave' | 'zigzag' | 'eye' | 'moon' | 'heart' | 'triangles' | 'sunburst'
  | 'skull' | 'crown' | 'drips';

export interface DeckArt {
  id: string;
  name: string;
  shape: DeckShape;
  base: number; // the deck's paint
  ink: number[]; // the shape's colours, first is the main one
}

const RED = 0xc8312b; // the stock deck (art/board.py 'deck')
const C = {
  black: 0x18181c, white: 0xf0ece0, red: 0xd8392b, yellow: 0xf2c230, blue: 0x2f7fe0, green: 0x3cc06a, pink: 0xff6fb0,
  maple: 0xddaa6e, orange: 0xff7a1a, purple: 0x8a4de0, teal: 0x14a89a, cream: 0xf4e4c0, navy: 0x23306e, lime: 0x9be33a,
};

export const STOCK_DECK: DeckArt = { id: 'stock', name: 'Stock', shape: 'plain', base: RED, ink: [] };

// the rack's four (art/skateshop.py) and twenty more in the same style
export const DECK_ARTS: DeckArt[] = [
  { id: 'band', name: 'Belt', shape: 'band', base: C.yellow, ink: [C.black] },
  { id: 'stripe', name: 'Pinline', shape: 'stripe', base: C.blue, ink: [C.white] },
  { id: 'dot', name: 'Red Dot', shape: 'dot', base: C.maple, ink: [C.red] },
  { id: 'bolt', name: 'Zap', shape: 'bolt', base: C.green, ink: [C.yellow] },
  { id: 'chevrons', name: 'Sergeant', shape: 'chevrons', base: C.black, ink: [C.orange, C.yellow] },
  { id: 'checker', name: 'Checkers', shape: 'checker', base: C.white, ink: [C.black, C.red] },
  { id: 'racing', name: 'Racer', shape: 'racing', base: C.navy, ink: [C.white, C.red] },
  { id: 'star', name: 'Lone Star', shape: 'star', base: C.red, ink: [C.white, C.black] },
  { id: 'flames', name: 'Hot Rod', shape: 'flames', base: C.black, ink: [C.orange, C.yellow, C.red] },
  { id: 'diamond', name: 'Ace', shape: 'diamond', base: C.cream, ink: [C.red, C.black] },
  { id: 'cross', name: 'X Out', shape: 'cross', base: C.pink, ink: [C.black] },
  { id: 'target', name: 'Bullseye', shape: 'target', base: C.white, ink: [C.red, C.blue] },
  { id: 'split', name: 'Half Pipe', shape: 'split', base: C.teal, ink: [C.yellow] },
  { id: 'polka', name: 'Polka', shape: 'polka', base: C.purple, ink: [C.pink] },
  { id: 'wave', name: 'Swell', shape: 'wave', base: C.blue, ink: [C.white, C.teal] },
  { id: 'zigzag', name: 'Static', shape: 'zigzag', base: C.yellow, ink: [C.black] },
  { id: 'eye', name: 'Watcher', shape: 'eye', base: C.black, ink: [C.white, C.teal, C.black] },
  { id: 'moon', name: 'Night Shift', shape: 'moon', base: C.navy, ink: [C.yellow, C.white] },
  { id: 'heart', name: 'Sweetheart', shape: 'heart', base: C.pink, ink: [C.red, C.white] },
  { id: 'triangles', name: 'Peaks', shape: 'triangles', base: C.orange, ink: [C.black, C.white] },
  { id: 'sunburst', name: 'Sunrise', shape: 'sunburst', base: C.yellow, ink: [C.orange, C.red] },
  { id: 'skull', name: 'Bones', shape: 'skull', base: C.black, ink: [C.white, C.black] },
  { id: 'crown', name: 'Royalty', shape: 'crown', base: C.purple, ink: [C.yellow, C.red] },
  { id: 'drips', name: 'Slime', shape: 'drips', base: C.lime, ink: [C.black, C.green] },
];

export function deckArt(id: string): DeckArt {
  return DECK_ARTS.find((a) => a.id === id) ?? STOCK_DECK;
}

export const DECK_PICK = 3; // how many graphics a new deck offers

// the graphics a shop visit's new deck comes in: `n` different ones, rolled from the run seed and the visit, never
// the one already on the board. The first is the one a new deck gets when there's no picking
export function deckChoices(seed: number, visit: number, current: string, n = DECK_PICK): DeckArt[] {
  const rng = makeRng(seed * 49979687 + visit * 86028121);
  const pool = DECK_ARTS.filter((a) => a.id !== current);
  const out: DeckArt[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(randInt(rng, pool.length), 1)[0]);
  return out;
}
