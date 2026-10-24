// The tutorial floor (GDD milestone M6): the first floor on a new phone, before the run's floor 1. A short, quiet
// street built from fixed pieces, each teaching one move with a prompt as you reach it: ollie, a held ollie, a flip,
// a grind, the parked cars, then the gate. No traffic, and Heat doesn't rise. Logged overnight (2026-10-24).
import { TILE } from '../physics/constants';
import { buildLevel, type Level } from '../physics/level';
import { CHUNK_W, ROWS } from './layout';
import { EXIT_PIECE, PIECES, START_PIECE, type Piece } from './pieces';
import { placeProps } from './props';

const piece = (name: string): Piece => PIECES.find((p) => p.name === name)!;

// each lesson: the piece, and what to say as you reach it
export const LESSONS: { piece: string; text: string }[] = [
  { piece: 'street', text: 'TAP TO OLLIE' },
  { piece: 'kiosks', text: 'OLLIE UP ONTO THE KIOSKS' },
  { piece: 'small canal', text: 'HOLD THE TAP TO OLLIE HIGHER' },
  { piece: 'stepping stone', text: 'TAP AGAIN IN THE AIR TO FLIP' },
  { piece: 'rail line', text: 'LAND ON THE RAIL TO GRIND' },
  { piece: 'parked cars', text: 'HOP UP ONTO THE CARS' },
  { piece: 'street', text: 'SKATE THROUGH THE GATE!' },
];

export function tutorialLevel(seed: number): Level {
  const pieces = [START_PIECE, ...LESSONS.map((l) => piece(l.piece)), EXIT_PIECE];
  const grid = new Array<string>(ROWS).fill('');
  for (const p of pieces) {
    grid[0] += '.'.repeat(CHUNK_W);
    for (let r = 0; r < 10; r++) grid[r + 1] += p.rows[r];
    grid[11] += p.rows[9];
    grid[12] += p.rows[9];
  }
  const level = buildLevel({ floor: 1, seed, cols: pieces.length * CHUNK_W, grid, pieces });
  //the prompt comes up a few tiles before each piece
  level.tutorial = LESSONS.map((l, i) => ({ x: (i + 1) * CHUNK_W * TILE - 4 * TILE, text: l.text }));
  level.danger = 1;
  level.props = placeProps(level);
  return level;
}
