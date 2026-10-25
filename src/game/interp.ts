// Drawing between the sim's steps. The sim runs at a fixed 60 Hz and the screen at whatever it runs at, so a frame
// usually lands part way between two steps (FixedStep.alpha). The skater and the camera are drawn there; anything
// else drawn straight from the sim's latest step jumps against them, a step at a time (zack: the vehicles and the
// collision shapes moved "in that same jittery fashion" as the helicopter did). So before each step the game
// keeps the numbers each moving thing is drawn from, and the views draw them `alpha` of the way to the new ones.
const prev = new WeakMap<object, Map<string, number>>();

export const INTERP = { alpha: 1 };

// before a step: remember these fields of obj as they are now
export function keep<T extends object>(obj: T, ...keys: (keyof T & string)[]): void {
  let m = prev.get(obj);
  if (!m) prev.set(obj, (m = new Map()));
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number') m.set(k, v);
    else m.delete(k);
  }
}

// a field of obj as it is drawn this frame: between its last two steps (just as it is if it wasn't kept, or it
// jumped further than `jump` in one step, a teleport rather than a move)
export function at<T extends object>(obj: T, key: keyof T & string, jump = Infinity): number {
  const cur = obj[key] as unknown as number;
  const p = prev.get(obj)?.get(key);
  if (p === undefined || typeof cur !== 'number' || Math.abs(cur - p) > jump) return cur;
  return p + (cur - p) * INTERP.alpha;
}
