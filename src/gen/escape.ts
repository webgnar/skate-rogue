// Escape set pieces (GDD: How a run ends). After every act's third floor comes a short, hand-built chase with no
// fork: a street run under rush-hour traffic with the Heat already up, then the set piece, then the act gate.
//
// Roadblock (act 1, and until their own set pieces exist acts 2-4): the cruisers have closed the street. A parked
// car, a CTA bus and a line of cruisers bumper to bumper, then a second bus: ollie onto the first car and car-hop
// across the roofs (every hop refills your jumps), or slam into the side and lose your speed with the Heat climbing.
// The helicopter (act 2) hunts you along the street; the drone swarm (act 4) dives into the lane in patterns to be
// stomped (src/sim/drones.ts). The finale (act 5) doubles the roadblock under the helicopter, and its gate is the
// way out of the city: clear it and the run is won.
import { TILE } from '../physics/constants';
import { buildLevel, type Car, type EscapeKind, type Level } from '../physics/level';
import { EXIT_PIECE, PIECES, START_PIECE, type Piece } from './pieces';
import { CHUNK_W, makeLayout } from './layout';
import { clearable } from './validate';
import { droneSpots } from '../sim/drones';
import { placeProps } from './props';
import { makeRng, randInt } from './rng';
import type { BiomeId } from '../render/biomes';

export const ACTS = 5;
export const FLOORS_PER_ACT = 3;

export const ESCAPE = {
  startHeat: 30,
  streetPieces: 5,
  carH: 40, // a parked car's roof
  cruiserH: 44,
  droneFlats: 5, // pieces of flat street for the drone waves
  busH: 72, // a bus: past a plain ollie (50 px), within an ollie and a flip, or a hop off a car roof
  actCash: (act: number) => 30 + 15 * act,
  actStoken: (act: number) => 3 * act,
};

// the district each act is in (GDD: Run structure 2): act 3 is Greece, Atlantis or the museum, by the run's seed
const DISTRICTS: BiomeId[][] = [['chicago'], ['clemente'], ['greece', 'atlantis', 'museum'], ['hightech'], ['hive']];

export function actBiome(seed: number, act: number): BiomeId {
  const pool = DISTRICTS[Math.min(DISTRICTS.length, Math.max(1, act)) - 1];
  return pool[randInt(makeRng(seed * 31 + act * 977), pool.length)];
}

export function actOf(floor: number): number {
  return Math.ceil(floor / FLOORS_PER_ACT);
}

// the floor that ends an act, so an escape comes after it
export function endsAct(floor: number): boolean {
  return floor % FLOORS_PER_ACT === 0;
}

// act 1 the roadblock, act 2 the helicopter, act 3 the district's chaser, act 4 the drones, act 5 the finale
export function escapeKind(act: number): EscapeKind {
  if (act >= ACTS) return 'finale';
  if (act === 4) return 'drones';
  if (act === 3) return 'chase';
  return act % 2 === 0 ? 'chopper' : 'roadblock';
}

export const ESCAPE_NAMES: Record<EscapeKind, string> = {
  roadblock: 'ROADBLOCK',
  chopper: 'HELICOPTER',
  chase: 'RUN FOR IT',
  drones: 'DRONE SWARM',
  finale: 'THE LAST ROADBLOCK',
};

export const L_TRACKS = {
  height: 3.5 * TILE, // underside above the street: clear of an ollie and a flip, so you can't hit it
  every: [16, 24], // tiles between the starts of two stretches
  length: [5, 8],
};

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
  const chopper = kind === 'chopper' || kind === 'finale';
  const swarm = kind === 'drones';
  const chase = kind === 'chase';
  const run = makeLayout(seed * 3 + act * 92821, floor, PIECES, ESCAPE.streetPieces + (chopper || chase ? 3 : 0));
  const blocks = kind === 'finale' ? 2 : kind === 'roadblock' ? 1 : 0;
  const flats = swarm ? ESCAPE.droneFlats : Math.max(1, blocks * 3);
  const pieces = [START_PIECE, ...run.pieces.slice(1, -1), ...new Array<Piece>(flats).fill(FLAT), EXIT_PIECE];
  const grid = run.grid.map((_, r) =>
    pieces.map((p) => (r === 0 ? '.'.repeat(CHUNK_W) : p.rows[Math.min(r - 1, 9)])).join(''),
  );
  const level = buildLevel({ floor, seed: run.seed, cols: pieces.length * CHUNK_W, grid, pieces });
  const x0 = (pieces.length - 1 - flats) * CHUNK_W * TILE + 4 * TILE;
  let x = x0;
  for (let b = 0; b < blocks; b++) x = roadblock(level.cars, level.streetY, x, 3 + act) + 10 * TILE;
  //the helicopter hunts from the end of the start piece; L tracks overhead every so often to hide under
  const covers: { x0: number; x1: number; y: number }[] = [];
  let chopperFrom: number | undefined;
  if (chopper) {
    chopperFrom = CHUNK_W * TILE;
    const rng = makeRng(seed * 5 + act * 6007);
    const [e0, e1] = L_TRACKS.every;
    const [l0, l1] = L_TRACKS.length;
    for (let c = chopperFrom + 14 * TILE; c < level.exitX - 10 * TILE; c += (e0 + randInt(rng, e1 - e0 + 1)) * TILE) {
      covers.push({ x0: c, x1: c + (l0 + randInt(rng, l1 - l0 + 1)) * TILE, y: level.streetY - L_TRACKS.height });
    }
  }
  //the swarm: waves of drones over the flat street before the gate
  if (swarm) {
    const rng = makeRng(seed * 7 + act * 4093);
    const drones = droneSpots(x0, level.exitX - 4 * TILE, rng);
    return withProps({ ...level, danger: 3, escape: { kind, act, x0, x1: level.exitX, covers, drones } });
  }
  //the chase: from the end of the start piece to the gate
  if (chase) {
    const from = CHUNK_W * TILE;
    return withProps({ ...level, danger: 3, escape: { kind, act, x0: from, x1: level.exitX, covers, chaseFrom: from } });
  }
  return withProps({
    ...level,
    danger: 3,
    escape: { kind, act, x0: blocks ? x0 : chopperFrom!, x1: blocks ? x - 10 * TILE : level.exitX, chopperFrom, covers },
  });
}

function withProps(level: Level): Level {
  level.props = placeProps(level);
  return level;
}

// an escape the no-boon reference bot gets through: re-rolled street runs until one passes
export function validatedEscape(seed: number, act: number): Level {
  for (let k = 0; k < 16; k++) {
    const level = buildEscape(seed + k * 15485863, act);
    if (clearable(level)) return level;
  }
  return buildEscape(seed, act);
}
