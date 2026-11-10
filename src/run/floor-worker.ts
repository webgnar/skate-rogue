// Builds floors off the main thread (src/run/prefetch.ts): floorLevel validates each floor by skating it with the
// bot several times, which can take most of a second on a phone.
import { floorLevel, type FloorSpec } from './floor-level';
import { useLevelEdits, type LevelEdits } from '../gen/level-edits';
import { forceSet, useHandSets, type HandSet, type HandSets } from '../gen/hand-sets';

// each request carries the level edits the game is using (?leveldrafts swaps in the editor's unsaved ones), and the
// hand-made sets (?setdrafts: the set editor's unsaved ones; ?playset: the one it's playing, every other beat)
self.onmessage = (e: MessageEvent<{ id: number; spec: FloorSpec; edits: LevelEdits; sets?: HandSets; forced?: HandSet | null }>) => {
  const { id, spec, edits, sets, forced } = e.data;
  useLevelEdits(edits);
  if (sets) useHandSets(sets);
  forceSet(forced ?? null);
  try {
    (self as unknown as Worker).postMessage({ id, level: floorLevel(spec) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
