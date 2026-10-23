import { makeLayout } from '../src/gen/layout';
import type { Piece } from '../src/gen/pieces';
import { buildLevel, type Level } from '../src/physics/level';
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
