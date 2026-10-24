// Escape set pieces (GDD: How a run ends). After every act's third floor comes a short, hand-built chase with no
// fork: a street run under rush-hour traffic with the Heat already up, then the set piece, then the act gate.
//
// Roadblock (act 1, and until their own set pieces exist acts 2-4): the cruisers have closed the street. A parked
// car, a CTA bus and a line of cruisers bumper to bumper, then a second bus: ollie onto the first car and car-hop
// across the roofs (every hop refills your jumps), or slam into the side and lose your speed with the Heat climbing.
// The finale (act 5) doubles it, and its gate is the way out of the city: clear it and the run is won.
import { TILE } from '../physics/constants';
import { buildLevel, type Car, type EscapeKind, type Level } from '../physics/level';
import { EXIT_PIECE, PIECES, START_PIECE, type Piece } from './pieces';
import { CHUNK_W, makeLayout } from './layout';
import { clearable } from './validate';

export const ACTS = 5;
export const FLOORS_PER_ACT = 3;

export const ESCAPE = {
  startHeat: 30,
  streetPieces: 5,
  carH: 40, // a parked car's roof
  cruiserH: 44,
  busH: 72, // a bus: past a plain ollie (50 px), within an ollie and a flip, or a hop off a car roof
  actCash: (act: number) => 30 + 15 * act,
  actStoken: (act: number) => 3 * act,
};

export function actOf(floor: number): number {
  return Math.ceil(floor / FLOORS_PER_ACT);
}

// the floor that ends an act, so an escape comes after it
export function endsAct(floor: number): boolean {
  return floor % FLOORS_PER_ACT === 0;
}

export function escapeKind(act: number): EscapeKind {
  return act >= ACTS ? 'finale' : 'roadblock';
}

export const ESCAPE_NAMES: Record<EscapeKind, string> = { roadblock: 'ROADBLOCK', finale: 'THE LAST ROADBLOCK' };

// one plain street piece, for the set piece to stand on
const FLAT: Piece = { ...EXIT_PIECE, name: 'flat' };

// a roadblock from x (px) on the street: car, bus, cruisers, bus. Returns where it ends
function roadblock(cars: Car[], streetY: number, x: number, cruisers: number): number {
  const add = (tiles: number, h: number, model?: Car['model']) => {
    cars.push({ x0: x, x1: x + tiles * TILE, roof: streetY - h, bottom: streetY, ...(model ? { model } : {}) });
    x += tiles * TILE;
  };
  add(2, ESCAPE.carH);
  x += 2 * TILE;
  add(6, ESCAPE.busH, 'bus');
  x += TILE;
  for (let i = 0; i < cruisers; i++) {
    add(2, ESCAPE.cruiserH, 'cruiser');
    x += TILE / 2;
  }
  x += TILE / 2;
  add(6, ESCAPE.busH, 'bus');
  return x;
}

export function buildEscape(seed: number, act: number): Level {
  const kind = escapeKind(act);
  const floor = act * FLOORS_PER_ACT;
  //the street run: library pieces at this act's depth, then flat street for the set piece and the gate
  const run = makeLayout(seed * 3 + act * 92821, floor, PIECES, ESCAPE.streetPieces);
  const blocks = kind === 'finale' ? 2 : 1;
  const flats = blocks * 3;
  const pieces = [START_PIECE, ...run.pieces.slice(1, -1), ...new Array<Piece>(flats).fill(FLAT), EXIT_PIECE];
  const grid = run.grid.map((_, r) =>
    pieces.map((p) => (r === 0 ? '.'.repeat(CHUNK_W) : p.rows[Math.min(r - 1, 9)])).join(''),
  );
  const level = buildLevel({ floor, seed: run.seed, cols: pieces.length * CHUNK_W, grid, pieces });
  const x0 = (pieces.length - 1 - flats) * CHUNK_W * TILE + 4 * TILE;
  let x = x0;
  for (let b = 0; b < blocks; b++) x = roadblock(level.cars, level.streetY, x, 3 + act) + 10 * TILE;
  return { ...level, danger: 3, escape: { kind, act, x0, x1: x - 10 * TILE } };
}

// an escape the no-boon reference bot gets through: re-rolled street runs until one passes
export function validatedEscape(seed: number, act: number): Level {
  for (let k = 0; k < 16; k++) {
    const level = buildEscape(seed + k * 15485863, act);
    if (clearable(level)) return level;
  }
  return buildEscape(seed, act);
}
