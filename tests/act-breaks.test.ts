import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ACT_BREAK_LEN, isActBreak, LINES } from '../src/cutscene/act-breaks';
import { EMPTY_SAVE, loadSave, writeSave } from '../src/run/save';
import { wantTitle } from '../src/ui/title';

describe('the act-break cutscenes', () => {
  it('there are four, one after each of acts 1 to 4 (act 5 ends on the Chapter 1 ending)', () => {
    expect([0, 1, 2, 3, 4, 5].filter(isActBreak)).toEqual([1, 2, 3, 4]);
  });
  it('every line is said inside its cutscene, in order, by the cop, the skater or the AI', () => {
    for (const act of [1, 2, 3, 4] as const) {
      let last = 0;
      for (const l of LINES[act]) {
        expect(l.from).toBeGreaterThanOrEqual(last);
        expect(l.to).toBeGreaterThan(l.from);
        expect(l.to).toBeLessThanOrEqual(ACT_BREAK_LEN[act]);
        expect(['cop', 'skater', 'ai']).toContain(l.who);
        last = l.from;
      }
      //the skater speaks in every one, and so does the AI
      expect(LINES[act].some((l) => l.who === 'skater')).toBe(true);
      expect(LINES[act].some((l) => l.who === 'ai')).toBe(true);
    }
  });
  it('?cutscene=actN skips the title screen', () => {
    for (const q of ['cutscene=act1', 'cutscene=act4']) expect(wantTitle(new URLSearchParams(q), false)).toBe(false);
  });
});

describe('the act breaks seen, in the save', () => {
  const mem = new Map<string, string>();
  beforeEach(() => {
    mem.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
  it('start unseen, are remembered, and keep only acts 1 to 4', () => {
    expect(loadSave().actBreaks).toBeUndefined();
    writeSave({ ...EMPTY_SAVE, actBreaks: [1, 3] });
    expect(loadSave().actBreaks).toEqual([1, 3]);
    mem.set('gnar-run-save', JSON.stringify({ actBreaks: [0, 2, 5, 'x', 4] }));
    expect(loadSave().actBreaks).toEqual([2, 4]);
  });
});
