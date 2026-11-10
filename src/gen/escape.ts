// Escape set pieces (GDD: How a run ends). After every act's third floor comes a short, hand-built chase with no
// fork: a street run under rush-hour traffic with the Heat already up, then the set piece, then the act gate.
//
// Roadblock (act 1, and until their own set pieces exist act 2's): the cruisers have closed the street. A parked
// car, a CTA bus and a line of cruisers bumper to bumper, then a second bus: ollie onto the first car and car-hop
// across the roofs (every hop refills your jumps), or slam into the side and lose your speed with the Heat climbing.
// The helicopter (act 2) hunts you along the street. Act 4's is the ceiling (the climb, step d): a convoy of blimps
// up over the street, the drone swarm (src/sim/drones.ts) diving onto their backs, and at the end the AI's fighter jets
// holding a line across the sky: hop up onto them and across their roofs, through it. Act 5's finale is the beam-up:
// a line of station decks, satellites and debris up in space, the AI's drone swarm on your tail, and the
// Pleiadian ship's beam over the gate: reach it and the run is won. Under both the street runs on as it was (the
// finale's double roadblock under the helicopter), the way you go if you fall. Acts 4 and 5's escapes skate in their
// act's gravity.
import { placeGrass } from './grass';
import { TILE } from '../physics/constants';
import { buildLevel, type Car, type EscapeKind, type Level, type SkyMover, type Surface } from '../physics/level';
import { actGravity } from '../physics/feel';
import { PICKUPS } from './descent';
import { EXIT_PIECE, PIECES, START_PIECE, type Piece } from './pieces';
import { CHUNK_W, makeLayout } from './layout';
import { clearable } from './validate';
import { DRONE, droneSpots, PATTERNS } from '../sim/drones';
import { placeProps } from './props';
import { EL } from '../traffic/el';
import { makeRng, randInt } from './rng';

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

export function actOf(floor: number): number {
  return Math.ceil(floor / FLOORS_PER_ACT);
}

// the floor that ends an act, so an escape comes after it
export function endsAct(floor: number): boolean {
  return floor % FLOORS_PER_ACT === 0;
}

// act 1 the roadblock, act 2 the helicopter, act 3 the district's chaser, act 4 the ceiling, act 5 the finale
export function escapeKind(act: number): EscapeKind {
  if (act >= ACTS) return 'finale';
  if (act === 4) return 'ceiling';
  if (act === 3) return 'chase';
  return act % 2 === 0 ? 'chopper' : 'roadblock';
}

export const ESCAPE_NAMES: Record<EscapeKind, string> = {
  roadblock: 'ROADBLOCK',
  chopper: 'HELICOPTER',
  chase: 'RUN FOR IT',
  drones: 'DRONE SWARM',
  ceiling: 'THE CEILING',
  finale: 'THE BEAM-UP',
};

// act 4's ceiling and act 5's beam-up: the line up over the street, in tiles at street gravity (each grown by
// 1 / the act's gravity, as the floors before them are: src/gen/clouds.ts HIGH)
export const UP_HIGH = {
  entry: 2.5, // the girder up off the street, over it: an ollie and a flip makes it
  entryW: 5,
  rise: 1.5, // each piece up to this much over the last, to the cruise
  cruise: 8, // tiles over the street the line levels off at
  gap: [3, 4], // tiles of open sky between pieces
  blimp: 16, // act 4: a blimp's back
  deck: [10, 14], // act 5: a station's deck
  debris: [6, 8], // a drifting piece of debris (a drifting cloud's mechanics)
  satellite: 2.5, // a satellite (a balloon's)
  drift: 1.5, // tiles a piece of debris wanders either way
  jets: 6, // act 4: fighter jets nose to tail to bumper in the line across the sky at the end
  jet: 2.5, // tiles each
  jetGap: 0.5,
  jetUp: 2, // the line's roof over the last blimp's back: past an ollie, an ollie and a flip (times the scale)
  jetH: 1.5, // tiles deep: it blocks the blimps' level, so you hop up onto it or slam into it
  beamUp: 4, // the ship hangs this far over the cruise (tiles, not scaled: in the frame as you come in)
  chopperTop: 6, // act 5: tiles over the street the helicopter can't climb past (up in space, out of its reach)
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

// (kind: the act's own unless given; the street drone swarm is no act's since the ceiling took act 4, but stays
// built and tested for a later use)
export function buildEscape(seed: number, act: number, kind: EscapeKind = escapeKind(act)): Level {
  const floor = act * FLOORS_PER_ACT;
  //the street run: library pieces at this act's depth, then flat street for the set piece and the gate
  const chopper = kind === 'chopper' || kind === 'finale';
  const swarm = kind === 'drones';
  const chase = kind === 'chase';
  const high = kind === 'ceiling' || kind === 'finale';
  const run = makeLayout(seed * 3 + act * 92821, floor, PIECES, ESCAPE.streetPieces + (chopper || chase || high ? 3 : 0));
  const blocks = kind === 'finale' ? 2 : kind === 'roadblock' ? 1 : 0;
  const flats = swarm ? ESCAPE.droneFlats : Math.max(1, blocks * 3);
  const pieces = [START_PIECE, ...run.pieces.slice(1, -1), ...new Array<Piece>(flats).fill(FLAT), EXIT_PIECE];
  const grid = run.grid.map((_, r) =>
    pieces.map((p) => (r === 0 ? '.'.repeat(CHUNK_W) : p.rows[Math.min(r - 1, 9)])).join(''),
  );
  const level = buildLevel({ floor, seed: run.seed, cols: pieces.length * CHUNK_W, grid, pieces });
  //(acts 4 and 5 in their own gravity, as their floors are)
  const g = actGravity(act);
  if (high && g !== 1) level.gravity = g;
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
    //their running rails grind (src/traffic/el.ts): a bus roof and an ollie gets you up
    for (const c of covers) level.surfaces.push({ kind: 'rail', x0: c.x0, x1: c.x1, y: c.y - EL.head * TILE, row: -1, el: true });
  }
  //the ceiling and the beam-up: the line up over the street, from the end of the start piece to the gate
  if (high) {
    const rng = makeRng(seed * 11 + act * 7703);
    const up = upHigh(level, kind, rng);
    if (kind === 'ceiling') return withProps({ ...level, danger: 3, escape: { kind, act, x0: up.x0, x1: level.exitX, covers, drones: up.drones } });
    return withProps({
      ...level,
      danger: 3,
      escape: { kind, act, x0: blocks ? x0 : chopperFrom!, x1: blocks ? x - 10 * TILE : level.exitX, chopperFrom, chopperTop: level.streetY - UP_HIGH.chopperTop * TILE, covers, chaseFrom: CHUNK_W * TILE, swarm: true, beam: up.beam },
    });
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

// the line up over an escape's street (act 4's ceiling, act 5's beam-up): a girder up off the street, then piece
// after piece, each up to a flip higher, levelling off at the cruise. Act 4's are blimps, drones diving onto their
// backs, and the jets' line at the end; act 5's station decks, satellites and debris, under the ship
function upHigh(level: Level, kind: EscapeKind, rng: () => number): { x0: number; drones: { x: number; h: number; base: number }[]; beam?: { x: number; y: number } } {
  const k = 1 / (level.gravity ?? 1);
  const T = (tiles: number) => tiles * k * TILE;
  const range = ([lo, hi]: number[]) => lo + Math.floor(rng() * (hi - lo + 1));
  const surfaces: Surface[] = [];
  const movers: SkyMover[] = [];
  const drones: { x: number; h: number; base: number }[] = [];
  const coins = (x0: number, x1: number, y: number) => {
    for (let c = x0 + TILE; c < x1 - TILE / 2; c += 2 * TILE) level.pickups.push({ kind: 'cash', x: c, y: y - PICKUPS.ride });
  };
  const s = level.streetY;
  const x0 = CHUNK_W * TILE + 2 * TILE;
  //the way up: a girder a flip up off the street
  let y = s - UP_HIGH.entry * TILE;
  surfaces.push({ kind: 'ledge', x0, x1: x0 + T(UP_HIGH.entryW), y, row: -1, sky: 'step' });
  coins(x0, x0 + T(UP_HIGH.entryW), y);
  let x = x0 + T(UP_HIGH.entryW);
  const cruise = s - T(UP_HIGH.cruise);
  const lineEnd = kind === 'ceiling' ? level.exitX - (UP_HIGH.jets * (UP_HIGH.jet + UP_HIGH.jetGap) + 6) * TILE : level.exitX + 2 * TILE;
  let n = 0;
  let last: Surface | SkyMover | null = null;
  while (true) {
    const gap = T(range(UP_HIGH.gap));
    const ny = Math.max(cruise, y - T(UP_HIGH.rise));
    if (kind === 'ceiling') {
      const w = UP_HIGH.blimp * k * TILE;
      if (x + gap + w > lineEnd) break;
      x += gap;
      y = ny;
      const m: SkyMover = { kind: 'blimp', x0: x, x1: x + w, y };
      movers.push(m);
      coins(x, x + w, y);
      //(a drone pattern on every blimp after the first, its heights grown for the gravity)
      if (n > 0) {
        const names = Object.keys(PATTERNS) as (keyof typeof PATTERNS)[];
        const pat = PATTERNS[n < 3 ? (['single', 'pair'] as const)[n - 1] : names[Math.floor(rng() * names.length)]];
        const at = x + 5 * TILE;
        //(spaced out by the scale too, so the landing between two is as long as it is on the street)
        if (at + pat[pat.length - 1][0] * k * TILE + DRONE.w < x + w - 3 * TILE) for (const [dx, h] of pat) drones.push({ x: at + dx * k * TILE, h: h * k, base: y });
      }
      last = m;
      x += w;
    } else {
      //act 5: station decks, debris and satellites, drawn as space (src/render/sky-pieces-view.ts)
      const r = rng();
      const pick = n === 0 || r < 0.45 ? 'deck' : r < 0.75 ? 'debris' : 'satellite';
      const room = UP_HIGH.drift * TILE;
      const w = pick === 'deck' ? range(UP_HIGH.deck) * k * TILE : pick === 'debris' ? range(UP_HIGH.debris) * k * TILE : UP_HIGH.satellite * k * TILE;
      const span = w + (pick === 'debris' ? 2 * room : 0);
      if (x + gap + span > lineEnd) break;
      x += gap;
      y = ny;
      if (pick === 'deck') {
        const d: Surface = { kind: 'ledge', x0: x, x1: x + w, y, row: -1, sky: 'cloud' };
        surfaces.push(d);
        last = d;
      } else {
        const m: SkyMover = pick === 'debris' ? { kind: 'cloud', x0: x + room, x1: x + room + w, y, phase: Math.floor(rng() * 360) } : { kind: 'balloon', x0: x, x1: x + w, y, phase: Math.floor(rng() * 240) };
        movers.push(m);
        last = m;
      }
      coins(x + (pick === 'debris' ? room : 0), x + (pick === 'debris' ? room : 0) + w, y);
      x += span;
    }
    n++;
  }
  level.surfaces.push(...surfaces);
  level.skyMovers = [...(level.skyMovers ?? []), ...movers];
  if (kind === 'ceiling') {
    //the jets' line across the sky: bumper to bumper over the last stretch to the gate, its roof up over the
    //last blimp's back and deep enough to block its level. Hop up onto it and across, through it
    const top = (last?.y ?? cruise) - T(UP_HIGH.jetUp);
    let gx = (last?.x1 ?? x) + T(2);
    for (let i = 0; i < UP_HIGH.jets; i++) {
      level.cars.push({ x0: gx, x1: gx + UP_HIGH.jet * TILE, roof: top, bottom: top + UP_HIGH.jetH * TILE, model: 'jet' });
      level.pickups.push({ kind: 'cash', x: gx + (UP_HIGH.jet * TILE) / 2, y: top - PICKUPS.ride });
      gx += (UP_HIGH.jet + UP_HIGH.jetGap) * TILE;
    }
    level.pickups.push({ kind: 'stoken', x: gx + TILE, y: top - PICKUPS.arc });
    return { x0, drones };
  }
  return { x0, drones, beam: { x: level.exitX, y: cruise - UP_HIGH.beamUp * TILE } };
}

function withProps(level: Level): Level {
  level.grass = placeGrass(level);
  level.props = placeProps(level);
  return level;
}

// an escape the no-boon reference bot gets through: re-rolled street runs until one passes
export function validatedEscape(seed: number, act: number): Level {
  for (let k = 0; k < 24; k++) {
    const level = buildEscape(seed + k * 15485863, act);
    if (clearable(level)) return level;
  }
  return buildEscape(seed, act);
}
