import { describe, expect, it } from 'vitest';
import { buildFloor } from '../src/gen/descent';
import { LEDGE_GRINDS, MANUALS, nollieClip, NOSE_STANCES, RAIL_GRINDS, rollTrick, SPIN, trickName, TRICK_ROLL } from '../src/physics/tricks';
import { CLIPS, SPINS } from '../src/render/poses';
import { RunScore, SCORE } from '../src/run/score';
import { FloorSim } from '../src/sim/floor';

describe('stance', () => {
  it('a quarter of tricks are 180s; shove-its and flips keep your stance', () => {
    expect(TRICK_ROLL.filter((t) => SPIN[t] === 180)).toHaveLength(TRICK_ROLL.length / 4);
    expect(SPIN.shuv1 + SPIN.shuv2 + SPIN.kickflip + SPIN.heelflip).toBe(0);
    expect(rollTrick(2)).toBe('bs180');
    expect(trickName('kickflip', true)).toBe('FAKIE KICKFLIP');
    expect(trickName('heelflip', false, true)).toBe('NOLLIE HEELFLIP');
    expect(trickName('bs180', true, true)).toBe('FAKIE BS 180'); // riding fakie, the nose pop is a fakie flip
    expect(nollieClip('varialHeel')).toBe('nollieVarialHeel');
  });

  it('an ollie out of a nose grind or nose manual makes the next flip a nollie flip, and only that air', () => {
    const flips = (stance: string, fakie = false) => {
      const sim = new FloorSim(buildFloor(9, 1));
      sim.traffic.vehicles.length = 0;
      const sk = sim.skater;
      sk.fakie = fakie;
      sk.stance = stance;
      sim.step({ pressed: true, held: true }); // the ollie, off the ground
      const ollie = sim.events.find((e) => e.type === 'ollie');
      const out: (boolean | undefined)[] = [];
      for (let i = 0; i < 2; i++) {
        Object.assign(sk, { mode: 'air', jumps: 2, vsp: -2, y: sk.level.streetY - 60, surface: null });
        sim.step({ pressed: true, held: true });
        for (const e of sim.events) if (e.type === 'trick') out.push(e.nollie);
        sk.nose = false; // landed between
      }
      return { ollie: ollie?.type === 'ollie' ? ollie.nose : undefined, first: out[0] };
    };
    for (const nose of ['noseGrind', 'crooked', 'noseManual']) expect(flips(nose)).toEqual({ ollie: true, first: true });
    expect(flips('fiveO')).toEqual({ ollie: undefined, first: undefined });
    expect(flips('manual')).toEqual({ ollie: undefined, first: undefined });
    expect(flips('noseGrind', true).first).toBeUndefined(); // fakie: called a fakie flip
  });

  it('the sim takes the grinds and manuals in turn, so it knows the nose ones', () => {
    for (const n of NOSE_STANCES) expect([...LEDGE_GRINDS, ...RAIL_GRINDS, ...MANUALS]).toContain(n);
  });

  it('every flip has a nollie clip popped off the nose, and the nollie 180s turn you round', () => {
    for (const id of new Set(TRICK_ROLL)) expect(CLIPS[nollieClip(id)]?.keys.length).toBeGreaterThan(0);
    expect(SPINS.nollieBs180).toBe(SPINS.bs180);
    expect(SPINS.nollieFs180).toBe(SPINS.fs180);
  });

  it('a 180 lands you fakie, the next 180 brings you back, and a slam puts you back regular', () => {
    const sim = new FloorSim(buildFloor(9, 1));
    sim.traffic.vehicles.length = 0;
    const sk = sim.skater;
    const tricks: { name: string; fakie: boolean }[] = [];
    // a flip thrown from the air, six times over
    for (let i = 0; i < 6; i++) {
      Object.assign(sk, { mode: 'air', jumps: 2, vsp: -2, y: sk.level.streetY - 60, surface: null });
      sim.step({ pressed: true, held: true });
      for (const e of sim.events) if (e.type === 'trick') tricks.push({ name: e.name, fakie: e.fakie });
    }
    expect(tricks.map((t) => t.name)).toEqual(TRICK_ROLL.slice(0, 6));
    expect(tricks.map((t) => t.fakie)).toEqual([false, false, false, true, true, true]);
    expect(sk.fakie).toBe(false); // the fs180 at 6th brought it back
    sk.fakie = true;
    (sk as unknown as { slam(): void }).slam();
    expect(sk.fakie).toBe(false);
  });

  it('fakie tricks score half again, 180s a little extra', () => {
    const a = new RunScore();
    a.onEvent({ type: 'trick', index: 0, name: 'kickflip', spin: 0, fakie: true }, 0);
    expect(a.comboPoints).toBe(SCORE.trick * SCORE.fakieMult);
    const b = new RunScore();
    b.onEvent({ type: 'trick', index: 0, name: 'bs180', spin: 180, fakie: false }, 0);
    expect(b.comboPoints).toBe(SCORE.trick + SCORE.spin);
    const c = new RunScore();
    c.onEvent({ type: 'trick', index: 0, name: 'kickflip', spin: 0, fakie: false, nollie: true }, 0);
    expect(c.comboPoints).toBe(SCORE.trick * SCORE.nollieMult);
  });
});
