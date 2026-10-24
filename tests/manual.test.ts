import { describe, expect, it } from 'vitest';
import { PHYS, TILE } from '../src/physics/constants';
import { isStreetAt, MANUAL_PAD_MAX } from '../src/physics/level';
import { validatedFloor } from '../src/gen/validate';
import { Skater } from '../src/physics/skater';
import { RunScore, SCORE } from '../src/run/score';

const levels = Array.from({ length: 16 }, (_, s) => validatedFloor((s + 1) * 131, 4).level);

describe('manual pads', () => {
  it('are the short floating platforms over the canals', () => {
    const pads = levels.flatMap((l) => l.surfaces.filter((s) => s.manual).map((s) => ({ l, s })));
    expect(pads.length).toBeGreaterThan(3);
    for (const { l, s } of pads) {
      expect(s.kind).toBe('ledge');
      expect(s.x1 - s.x0).toBeLessThanOrEqual(MANUAL_PAD_MAX);
      expect(isStreetAt(l, (s.x0 + s.x1) / 2)).toBe(false);
    }
  });

  it('landing on one starts a manual, and leaving it ends it', () => {
    const l = levels.find((l) => l.surfaces.some((s) => s.manual))!;
    const pad = l.surfaces.find((s) => s.manual)!;
    const sk = new Skater(l);
    Object.assign(sk, { x: pad.x0 + 4, y: pad.y - 3, surface: null, mode: 'air', vsp: 4, hsp: PHYS.baseSpeed });
    sk.step({ pressed: false, held: false });
    expect(sk.events).toContainEqual(expect.objectContaining({ type: 'land', manual: true }));
    expect(sk.manualing).toBe(true);
    for (let f = 0; f < 3 * TILE / PHYS.baseSpeed + 4; f++) sk.step({ pressed: false, held: false });
    expect(sk.manualing).toBe(false);
  });

  it('scores as a trick and keeps the combo going; the next landing banks it all', () => {
    const run = new RunScore();
    run.onEvent({ type: 'trick', index: 0, name: 'kickflip', spin: 0, fakie: false } as never, PHYS.baseSpeed);
    expect(run.onEvent({ type: 'land', manual: true }, PHYS.baseSpeed)).toBeNull();
    expect(run.combo).toBe(2);
    run.onEvent({ type: 'trick', index: 1, name: 'kickflip', spin: 0, fakie: false } as never, PHYS.baseSpeed);
    const bank = run.onEvent({ type: 'land', quality: 'clean' }, PHYS.baseSpeed)!;
    expect(bank.count).toBe(3);
    expect(bank.points).toBeGreaterThan((2 * SCORE.trick + SCORE.manual) * 3 - 1);
  });
});
