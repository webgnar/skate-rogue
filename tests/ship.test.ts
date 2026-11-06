// The ship between runs (src/ship/): the saucer the finale and the ending share, the ending's save flag, and the
// dev links that show the hub and the ending on their own.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { saucer, SAUCER_R } from '../src/ship/saucer';
import { wantTitle } from '../src/ui/title';
import { EMPTY_SAVE, loadSave, writeSave } from '../src/run/save';

describe('the Pleiadian saucer', () => {
  it('is a hull 9 tiles across with 16 rim lights, centred on its origin', () => {
    const g = saucer();
    const box = new THREE.Box3().setFromObject(g);
    expect(box.max.x - box.min.x).toBeCloseTo(2 * (SAUCER_R + 0.28), 0);
    expect(Math.abs(box.min.x + box.max.x)).toBeLessThan(0.01);
    const lights = g.getObjectByName('rimLights') as THREE.InstancedMesh;
    expect(lights.count).toBe(16);
  });
});

describe('the Chapter 1 ending save flag', () => {
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
  it('starts unseen and is remembered once set', () => {
    expect(loadSave().endingSeen).toBeUndefined();
    writeSave({ ...EMPTY_SAVE, endingSeen: true });
    expect(loadSave().endingSeen).toBe(true);
  });
});

describe('dev links', () => {
  it('?ship and ?ending skip the title screen', () => {
    for (const q of ['ship', 'ship=crew', 'ending', 'ending=short']) expect(wantTitle(new URLSearchParams(q), false)).toBe(false);
  });
});
