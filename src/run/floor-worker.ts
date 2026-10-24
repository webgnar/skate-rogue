// Builds floors off the main thread (src/run/prefetch.ts): floorLevel validates each floor by skating it with the
// bot several times, which can take most of a second on a phone.
import { floorLevel, type FloorSpec } from './floor-level';
import { useLevelEdits, type LevelEdits } from '../gen/level-edits';

// each request carries the level edits the game is using (?leveldrafts swaps in the editor's unsaved ones)
self.onmessage = (e: MessageEvent<{ id: number; spec: FloorSpec; edits: LevelEdits }>) => {
  const { id, spec, edits } = e.data;
  useLevelEdits(edits);
  try {
    (self as unknown as Worker).postMessage({ id, level: floorLevel(spec) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
