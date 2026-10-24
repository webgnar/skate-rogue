import { describe, expect, it } from 'vitest';
import { BASE, CLIPS, deckPoint, sample } from '../src/render/poses';
import { addKey, deleteKey, formatEdits, isClip, keyAt, moveKey, nearestDeckX, scaleClip, toClip, toWork } from '../src/editor/clip-doc';

describe('animation editor clips', () => {
  it('a clip opened and saved untouched plays the same', () => {
    for (const [name, clip] of Object.entries(CLIPS)) {
      const back = toClip(toWork(clip));
      for (const t of [0, 0.05, 0.13, 0.3, 0.71]) {
        const a = sample(clip, t);
        const b = sample(back, t);
        for (const f of Object.keys(BASE) as (keyof typeof BASE)[]) expect(b[f], `${name} ${f} at ${t}`).toBeCloseTo(a[f], 3);
      }
    }
  });

  it('saves only what differs from the base pose', () => {
    const c = toClip(toWork({ loop: true, keys: [{ t: 0, pose: { hipY: 0.5, yaw: BASE.yaw } }] }));
    expect(c.keys[0].pose).toEqual({ hipY: 0.5 });
  });

  it('adds a key between two holding the pose shown there, and finds it again', () => {
    const w = toWork(CLIPS.land);
    const shown = sample(CLIPS.land, 0.2);
    const i = addKey(w, 0.2, shown);
    expect(i).toBe(2);
    expect(w.keys.map((k) => k.t)).toEqual([0, 0.1, 0.2, 0.35]);
    expect(addKey(w, 0.2, BASE)).toBe(2);
    expect(keyAt(w, 0.2)).toBe(2);
    expect(sample(w, 0.2).hipY).toBeCloseTo(shown.hipY);
  });

  it('keeps the first key at 0 and keys in order when moving or deleting', () => {
    const w = toWork(CLIPS.land);
    expect(moveKey(w, 0, 0.2)).toBe(0);
    expect(moveKey(w, 1, 1)).toBeCloseTo(0.35 - 1 / 30);
    expect(moveKey(w, 2, 0)).toBeGreaterThan(w.keys[1].t);
    expect(deleteKey(w, 0)).toBe(false);
    expect(deleteKey(w, 1)).toBe(true);
    expect(w.keys).toHaveLength(2);
  });

  it('stretches a clip to a new length', () => {
    const w = toWork(CLIPS.land);
    scaleClip(w, 0.7);
    expect(w.keys.map((k) => k.t)).toEqual([0, 0.2, 0.7]);
  });

  it('slides a foot on the board to the deck point nearest the drag', () => {
    const p = { ...BASE, boardPitch: 0.3, boardPivot: -0.2 };
    const at = deckPoint(p, 0.31);
    expect(nearestDeckX(p, at)).toBeCloseTo(0.31, 2);
  });

  it('writes clip-edits.json one key per line, and reads back only playable clips', () => {
    const text = formatEdits({ land: toClip(toWork(CLIPS.land)) });
    expect(text.split('\n')).toHaveLength(11);
    const back = JSON.parse(text);
    expect(isClip(back.land)).toBe(true);
    expect(formatEdits({})).toBe('{}\n');
    expect(isClip({ loop: false, keys: [{ t: 0.1, pose: {} }] })).toBe(false);
    expect(isClip({ loop: false, keys: [{ t: 0, pose: { wings: 1 } }] })).toBe(false);
  });
});
