import { describe, expect, it } from 'vitest';
import { PHYS, TILE } from '../src/physics/constants';
import { ceilingAt, currentAt } from '../src/physics/level';
import { botRun, validatedFloor } from '../src/gen/validate';
import { districtPieces, TWIST, type Twist } from '../src/gen/twists';
import { PIECES } from '../src/gen/pieces';
import { BIOME_GRAVITY } from '../src/physics/feel';
import { Skater } from '../src/physics/skater';

const floors = (twist: Twist, floor: number, n = 8, gravity = 1) =>
  Array.from({ length: n }, (_, s) => validatedFloor((s + 1) * 61, floor, { twist, gravity }));

describe('district twists', () => {
  it('Clemente and Greece weight their pieces: rails, and curved rails', () => {
    const grinds = districtPieces(PIECES, 'grinds');
    const columns = districtPieces(PIECES, 'columns');
    expect(grinds.filter((p) => p.name === 'rail line')).toHaveLength(2);
    expect(columns.filter((p) => p.name === 'rail arch')).toHaveLength(3);
    expect(districtPieces(PIECES, undefined)).toHaveLength(PIECES.length);
  });

  it("Greece's ruins fall a moment after you land on them, and you drop with them", () => {
    const level = floors('columns', 8, 12).map((v) => v.level).find((l) => l.surfaces.some((s) => s.crumble))!;
    const ruin = level.surfaces.find((s) => s.crumble)!;
    expect(ruin.kind).toBe('ledge');
    //a long one, so you're still on it when it goes
    const long = { ...ruin, x1: ruin.x0 + 40 * TILE, y: ruin.y - 20 }; // (not level with any other ground)
    const sk = new Skater(level);
    Object.assign(sk, { x: long.x0 + 2, y: long.y, surface: long, mode: 'roll', hsp: PHYS.baseSpeed });
    for (let f = 0; f < PHYS.crumbleFrames - 2; f++) sk.step({ pressed: false, held: false });
    expect(sk.crumbling.has(long)).toBe(true);
    expect(sk.mode).toBe('roll');
    for (let f = 0; f < 4; f++) sk.step({ pressed: false, held: false });
    expect(sk.gone.has(long)).toBe(true);
    expect(sk.mode).toBe('air');
  });

  it('Atlantis currents push you forward or back in the air, not on the ground', () => {
    const { level } = floors('currents', 7, 1, BIOME_GRAVITY.atlantis)[0];
    expect(level.currents!.length).toBeGreaterThan(0);
    const c = level.currents![0];
    expect(currentAt(level, (c.x0 + c.x1) / 2)).toBe(c.push);
    const sk = new Skater(level);
    Object.assign(sk, { x: c.x0 + TILE, y: level.streetY - 60, surface: null, mode: 'air', vsp: -2, hsp: PHYS.baseSpeed });
    sk.step({ pressed: false, held: true });
    expect(sk.hsp - PHYS.baseSpeed).toBeCloseTo(c.push);
  });

  it('the Art Museum ceiling stops you rising, and sits over everything you can land on', () => {
    for (const { level } of floors('ceiling', 5, 4)) {
      for (const c of level.ceiling!) {
        for (const s of level.surfaces) if (s.x0 >= c.x0 && s.x1 <= c.x1) expect(c.y).toBeLessThan(Math.min(s.y, s.y1 ?? s.y) - PHYS.height);
        for (const p of level.pickups) if (p.x >= c.x0 && p.x < c.x1) expect(p.y).toBeGreaterThan(c.y);
      }
      const c = level.ceiling![1];
      const sk = new Skater(level);
      const under = ceilingAt(level, c.x0 + TILE)!;
      Object.assign(sk, { x: c.x0 + TILE, y: under + 4, surface: null, mode: 'air', vsp: -6, hsp: PHYS.baseSpeed });
      sk.step({ pressed: false, held: true });
      expect(sk.y).toBeGreaterThanOrEqual(under);
      expect(sk.vsp).toBeGreaterThanOrEqual(0);
    }
  });

  it('High-Tech conveyor rails run you faster or slower than a plain grind', () => {
    const level = floors('conveyors', 6, 12).map((v) => v.level).find((l) => l.surfaces.some((s) => s.conveyor))!;
    const belts = level.surfaces.filter((s) => s.conveyor);
    expect(belts.every((s) => s.kind === 'rail' && Math.abs(s.conveyor!) === TWIST.conveyor.speed)).toBe(true);
    const ride = (conveyor: number) => {
      const s = { ...belts[0], x0: 0, x1: 100 * TILE, conveyor };
      const sk = new Skater(level);
      Object.assign(sk, { x: TILE, y: s.y, surface: s, mode: 'grind', hsp: PHYS.grindSpeed });
      for (let f = 0; f < 60; f++) sk.step({ pressed: false, held: false });
      return sk.hsp;
    };
    expect(ride(TWIST.conveyor.speed)).toBeGreaterThan(ride(0));
    expect(ride(-TWIST.conveyor.speed)).toBeLessThan(ride(0));
  });

  it('the no-boon bot still clears every twist, mostly first try', () => {
    for (const [twist, g] of [['grinds', 1], ['columns', 1], ['currents', BIOME_GRAVITY.atlantis], ['ceiling', 1], ['conveyors', 1]] as const) {
      const vs = floors(twist, twist === 'columns' ? 9 : 8, 6, g);
      for (const v of vs) expect(botRun(v.level).result).toBe('exit');
      const tries = vs.reduce((n, v) => n + v.tries, 0) / vs.length;
      process.stderr.write(`${twist}: ${tries.toFixed(1)} tries\n`);
      expect(tries).toBeLessThan(4);
    }
  });
});
declare const process: { stderr: { write(s: string): void } };
