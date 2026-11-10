// Runs the bot gate (src/gen/hand-set-check.ts) off the main thread for the set editor: a few floors skated twice
// each, which would freeze the editor for a second or two
import { checkSet } from '../gen/hand-set-check';
import type { HandAct, HandSet } from '../gen/hand-sets';

self.onmessage = (e: MessageEvent<{ id: number; set: HandSet; act: HandAct }>) => {
  const { id, set, act } = e.data;
  try {
    const c = checkSet(set, act);
    (self as unknown as Worker).postMessage({ id, act, ok: c.ok, laid: c.laid, runs: c.runs });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, act, error: String(err) });
  }
};
