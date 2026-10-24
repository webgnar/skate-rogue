// Floor layout, ported from QFS Survivor (survivor_layout): a start piece, clamp(3 + floor, 4, 12) pieces from the
// library, then an exit piece, stitched into one grid. Same seed + floor = same floor.
import { EXIT_PIECE, PIECES, START_PIECE, type Piece } from './pieces';
import { makeRng, randInt } from './rng';

export const CHUNK_W = 16;
export const ROWS = 13; // floor rows: row 0 is sky, rows 1-10 come from the pieces, 11-12 copy the street row
export const STREET_ROW = 10;

export interface Layout {
  floor: number;
  seed: number;
  cols: number;
  grid: string[]; // ROWS strings, cols characters each
  pieces: Piece[];
}

export function floorLength(floor: number): number {
  return Math.min(12, Math.max(4, 3 + floor));
}

export function maxTier(floor: number): number {
  return Math.min(3, 1 + Math.floor((floor - 1) / 2));
}

// `tail` pieces go just before the exit (the fork's runway)
export function makeLayout(seed: number, floor: number, library: Piece[] = PIECES, count = floorLength(floor), tail: Piece[] = []): Layout {
  const rng = makeRng(seed + floor * 7919);
  const top = maxTier(floor);
  //pieces of the newest tier come up three times as often, so the floor feels harder
  const pool: Piece[] = [];
  for (const p of library) {
    if (p.tier > top) continue;
    const weight = p.tier === top ? 3 : 1;
    for (let i = 0; i < weight; i++) pool.push(p);
  }

  const pieces: Piece[] = [START_PIECE];
  let last: Piece | undefined;
  for (let n = 0; n < count; n++) {
    let pick = pool[randInt(rng, pool.length)];
    //no piece twice in a row
    for (let tries = 0; pick === last && tries < 10; tries++) pick = pool[randInt(rng, pool.length)];
    pieces.push(pick);
    last = pick;
  }
  pieces.push(...tail, EXIT_PIECE);

  const grid = new Array<string>(ROWS).fill('');
  for (const p of pieces) {
    grid[0] += '.'.repeat(CHUNK_W);
    for (let r = 0; r < 10; r++) grid[r + 1] += p.rows[r];
    grid[11] += p.rows[9];
    grid[12] += p.rows[9];
  }
  return { floor, seed, cols: pieces.length * CHUNK_W, grid, pieces };
}

export function cell(layout: Layout, col: number, row: number): string {
  if (row < 0 || row >= ROWS || col < 0 || col >= layout.cols) return '.';
  return layout.grid[row][col];
}
