// Level edits (docs/level-editor.md): per-floor overrides of the hill recipe and dials, made in the level editor
// (?levels) and saved to level-edits.json. A floor with no entry is built from the code (src/gen/hills.ts), so the
// file only ever holds what zack changed. Floors past 15 (Endless) follow the floor whose recipe they reuse.
import saved from './level-edits.json';
import type { Beat } from './hills';
import type { SkyBeat } from './sky-beats';

export interface FloorEdit {
  recipe?: Beat[][]; // slots, each a set of beats the seed picks from; the last slot is the floor's peak
  top?: number; // tiles the floor starts above the street
  grade?: number; // tiles down per tile along a block of hill
  run?: [number, number]; // tiles per block of hill
  crest?: [number, number]; // the flat intersection at the top of each block
  gap?: [number, number]; // crest jumps, tiles
  midSet?: [number, number]; // steps in a stairway before the last
  finalSet?: number; // the most steps the last stairway can have
  street?: number; // street pieces before the fork
  climbTop?: number; // tiles each cable car takes you up after a street chase
  chasePieces?: number; // street pieces in each flat chase between stretches of hill
  topStart?: number; // top route: how far down each stretch of hill (0-1) its power line starts
  roofGap?: [number, number]; // top route: tiles between rooftops
  flocks?: number; // top route: chance of pigeons on a wire or a long rooftop
  sky?: SkyBeat[][]; // the sky beats over each stretch of hill (src/gen/sky-beats.ts), slots as the hill recipe's
  skyHeight?: number; // tiles the sky beats stand over the ground behind
  skyStart?: number; // how far down each stretch of hill (0-1) they start
  clouds?: LayerEdit; // the cloud layer (src/gen/clouds.ts): on/off, its CLOUDS dials, which cloud beats it picks from
  sewer?: LayerEdit; // the sewer route (src/gen/sewer.ts): on/off and its SEWER dials
}

// a route layer's edits: `on` turns it on or off for the floor, `mix` (clouds) the beats it picks from, and the rest
// overlay the layer's dials object (CLOUDS, SEWER) by key while the floor is built (see withDials)
export interface LayerEdit {
  on?: boolean;
  mix?: string[];
  [dial: string]: number | [number, number] | boolean | string[] | undefined;
}

// build with a layer's dials overlaid by a floor's edits, then put them back: the code's dials stay the defaults,
// so a key the layer adds later is editable without touching this file
export function withDials<T extends object, R>(dials: T, edit: LayerEdit | undefined, fn: () => R): R {
  const keep: [string, unknown][] = [];
  const d = dials as Record<string, unknown>;
  for (const [k, v] of Object.entries(edit ?? {})) {
    if (k === 'on' || k === 'mix' || !(k in d) || v === undefined) continue;
    keep.push([k, d[k]]);
    d[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of keep) d[k] = v;
  }
}

export interface LevelEdits {
  floors: Record<string, FloorEdit>;
}

export const SAVED_EDITS: LevelEdits = saved as LevelEdits;

let active: LevelEdits = SAVED_EDITS;

// the editor and ?leveldrafts swap in unsaved edits; everything else reads the saved file
export function useLevelEdits(edits: LevelEdits): void {
  active = edits;
}

// the edits in use, for the floor worker (src/run/floor-worker.ts) to build with the same ones
export function levelEdits(): LevelEdits {
  return active;
}

export function floorEdit(floor: number): FloorEdit {
  return active.floors[String(floor)] ?? {};
}
