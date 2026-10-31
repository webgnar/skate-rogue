import { makeLayout } from '../src/gen/layout';
import type { Piece } from '../src/gen/pieces';
import { buildLevel, type CurvedRail, type Level, type Surface } from '../src/physics/level';
import { TILE } from '../src/physics/constants';
import { Skater, type StepInput } from '../src/physics/skater';

// a floor made of one piece repeated (start, 4 copies, exit)
export function levelOf(rows: string[], railCurve?: number): Level {
  const piece: Piece = { name: 'test', tier: 1, rows, railCurve };
  return buildLevel(makeLayout(1, 1, [piece]));
}

export const FLAT = [
  '................', '................', '................', '................', '................',
  '................', '................', '................', '................', '################',
];

export type Script = (frame: number) => StepInput;

export const idle: Script = () => ({ pressed: false, held: false });

export function run(sk: Skater, frames: number, script: Script = idle, from = 0): void {
  for (let f = from; f < from + frames; f++) sk.step(script(f));
}

// press on frame `at`, hold for `hold` frames
export function pressAt(at: number, hold = 1): Script {
  return (f) => ({ pressed: f === at, held: f >= at && f < at + hold });
}

// the street, with extra surfaces and rails dropped on it
// (no street under the banks, so you roll onto them)
export function withExtras(surfaces: Surface[], rails: CurvedRail[] = [], start?: { x: number; y: number }): Level {
  const base = levelOf(FLAT);
  const banks = surfaces.filter((s) => s.kind === 'bank');
  const street = base.street.map((on, c) => on && !banks.some((s) => (c + 1) * TILE > s.x0 && c * TILE < s.x1));
  return { ...base, street, surfaces: [...base.surfaces, ...surfaces], rails: [...base.rails, ...rails], startX: start?.x ?? base.startX, startY: start?.y ?? base.startY };
}
