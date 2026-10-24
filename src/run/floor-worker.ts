// Builds floors off the main thread (src/run/prefetch.ts): floorLevel validates each floor by skating it with the
// bot several times, which can take most of a second on a phone.
import { floorLevel, type FloorSpec } from './floor-level';

self.onmessage = (e: MessageEvent<{ id: number; spec: FloorSpec }>) => {
  const { id, spec } = e.data;
  try {
    (self as unknown as Worker).postMessage({ id, level: floorLevel(spec) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
