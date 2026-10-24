// The animation editor's working copy of a clip, and how it goes back to clip-edits.json. Pure data (no DOM or
// Three.js), so the key edits are testable.
//
// While editing, every key holds a full pose. Saved, a key keeps only the values that differ from BASE, which
// sample() fills back in, so a saved clip plays exactly as it was edited.
import { BASE, BOARD, deckPoint, feetYaw, type Clip, type Pose } from '../render/poses';

export interface WorkKey {
  t: number;
  pose: Pose;
}

export interface WorkClip {
  loop: boolean;
  keys: WorkKey[];
}

export const FPS = 30; // the bake's frame rate: the timeline snaps to it
export const SNAP = 1 / FPS;
const SAME_T = 1 / (FPS * 4); // a key this close to the playhead is the one being edited

export function toWork(clip: Clip): WorkClip {
  return { loop: clip.loop, keys: clip.keys.map((k) => ({ t: k.t, pose: { ...BASE, ...k.pose } })) };
}

const round = (v: number) => Math.round(v * 1e4) / 1e4;

export function toClip(work: WorkClip): Clip {
  return {
    loop: work.loop,
    keys: work.keys.map((k) => {
      const pose: Partial<Pose> = {};
      for (const f of Object.keys(BASE) as (keyof Pose)[]) {
        const v = round(k.pose[f]);
        if (Math.abs(v - BASE[f]) > 1e-4) pose[f] = v;
      }
      return { t: round(k.t), pose };
    }),
  };
}

export const snapT = (t: number) => Math.max(0, Math.round(t * FPS) / FPS);

// the key at time t, if there is one
export function keyAt(work: WorkClip, t: number): number {
  return work.keys.findIndex((k) => Math.abs(k.t - t) < SAME_T);
}

// add a key at t holding `pose` (what the clip shows there), or return the one already there
export function addKey(work: WorkClip, t: number, pose: Pose): number {
  const at = keyAt(work, t);
  if (at >= 0) return at;
  const key = { t: Math.max(0, t), pose: { ...pose } };
  let i = work.keys.findIndex((k) => k.t > t);
  if (i < 0) i = work.keys.length;
  work.keys.splice(i, 0, key);
  return i;
}

// the first key stays at 0 and a clip keeps at least one key
export function deleteKey(work: WorkClip, i: number): boolean {
  if (i <= 0 || i >= work.keys.length) return false;
  work.keys.splice(i, 1);
  return true;
}

// retime a key, kept between its neighbours (a frame apart); the first key can't move off 0
export function moveKey(work: WorkClip, i: number, t: number): number {
  if (i <= 0) return 0;
  const lo = work.keys[i - 1].t + SNAP;
  const hi = i + 1 < work.keys.length ? work.keys[i + 1].t - SNAP : Infinity;
  const tt = Math.min(hi, Math.max(lo, snapT(t)));
  work.keys[i].t = tt;
  return tt;
}

// stretch or squash the whole clip to a new length
export function scaleClip(work: WorkClip, len: number): void {
  const old = work.keys[work.keys.length - 1].t;
  if (old <= 0 || len <= 0) return;
  for (const k of work.keys) k.t = round((k.t * len) / old);
}

// The deck position under a point, for dragging a foot that's standing on the board: the feet only slide along
// the deck, so find the x on it nearest the point (in the rig's own space).
export function nearestDeckX(p: Pose, at: { x: number; y: number; z: number }): number {
  const q = { ...p, boardYaw: feetYaw(p) };
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= 200; i++) {
    const x = -BOARD.tail + (2 * BOARD.tail * i) / 200;
    const d = deckPoint(q, x);
    const dd = (d.x - at.x) ** 2 + (d.y - at.y) ** 2 + (d.z - at.z) ** 2;
    if (dd < bestD) {
      bestD = dd;
      best = x;
    }
  }
  return round(best);
}

// clip-edits.json, one key per line so a change to a clip reads as a small diff
export function formatEdits(edits: Record<string, Clip>): string {
  const names = Object.keys(edits).sort();
  if (!names.length) return '{}\n';
  const clips = names.map((name) => {
    const c = edits[name];
    const keys = c.keys.map((k) => `      ${JSON.stringify(k)}`).join(',\n');
    return `  ${JSON.stringify(name)}: {\n    "loop": ${c.loop},\n    "keys": [\n${keys}\n    ]\n  }`;
  });
  return `{\n${clips.join(',\n')}\n}\n`;
}

// a clip read back from a file or the browser: only accept the shape the game can play
export function isClip(c: unknown): c is Clip {
  const clip = c as Clip;
  return (
    !!clip &&
    typeof clip.loop === 'boolean' &&
    Array.isArray(clip.keys) &&
    clip.keys.length > 0 &&
    clip.keys[0].t === 0 &&
    clip.keys.every(
      (k, i) =>
        typeof k.t === 'number' &&
        (i === 0 || k.t > clip.keys[i - 1].t) &&
        !!k.pose &&
        Object.entries(k.pose).every(([f, v]) => f in BASE && typeof v === 'number' && Number.isFinite(v)),
    )
  );
}
