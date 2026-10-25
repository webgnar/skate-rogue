// What the playtest bot watches for on every sim step, in node and in the browser alike: falling through something
// solid, dropping through the street, rolling off the line of what you're on, NaN, getting stuck, leaving the world.
// Each is a finding with where and when it happened, so the report can point at the exact spot.
import { PHYS, TILE } from '../physics/constants';
import { isStreetAt, surfaceSlope, surfaceY, type Car, type CurvedRail } from '../physics/level';
import type { Mode } from '../physics/skater';
import type { FloorSim } from '../sim/floor';

export type FindingKind = 'fell-through' | 'through-street' | 'off-surface' | 'nan' | 'stuck' | 'out-of-world' | 'sky-high' | 'timeout';

export interface Finding {
  kind: FindingKind;
  message: string;
  frame: number; // sim steps into the floor
  x: number;
  y: number;
  col: number; // the layout column, as the validator reports bails
}

export const CHECKS = {
  stuckFrames: 4 * 60, // this long without getting a tile further along
  surfaceSlack: 2, // px a rolling skater's feet may sit off the line of what they're on
  maxFrames: 60 * 150,
  skyTiles: 30,
};

// where a straight path from (px, py) to (x, y) goes from on or above a line to under it, or null
// (the same test as tests/collision.test.ts)
function crossAt(px: number, py: number, x: number, y: number, x0: number, y0: number, m: number): number | null {
  const f0 = py - (y0 + m * (px - x0));
  const f1 = y - (y0 + m * (x - x0));
  if (f0 > 0.01 || f1 <= 0.5) return null;
  return px + Math.max(0, -f0 / (f1 - f0)) * (x - px);
}

export class FloorChecks {
  readonly findings: Finding[] = [];
  private frame = 0;
  private best = -Infinity; // the furthest x reached
  private bestAt = 0;
  private seen = new Set<string>();
  // the step before
  private px = 0;
  private py = 0;
  private mode: Mode = 'roll';
  private ignore: CurvedRail | null = null;
  private movers: { at: Car; car: Car }[] = []; // as each stood at the start of the step, and the thing itself

  constructor(private readonly sim: FloorSim) {}

  // call right before sim.step
  before(): void {
    const sk = this.sim.skater;
    this.px = sk.x;
    this.py = sk.boardY; // the board: what lands (src/physics/tuck.ts)
    this.mode = sk.mode;
    this.ignore = sk.railIgnore;
    //moving things as they stood at the start of the step
    this.movers = sk.movers.map((c) => ({ at: { ...c }, car: c }));
  }

  // call right after sim.step
  after(): void {
    const sim = this.sim;
    const sk = sim.skater;
    const level = sim.level;
    this.frame++;
    if (!Number.isFinite(sk.x) || !Number.isFinite(sk.y) || !Number.isFinite(sk.hsp) || !Number.isFinite(sk.vsp)) {
      this.add('nan', `the skater's position or speed went NaN (mode ${sk.mode})`);
      return;
    }
    if (sk.x < -TILE || sk.x > level.width + 4 * TILE) this.add('out-of-world', `left the world at (${Math.round(sk.x)}, ${Math.round(sk.y)})`, 'x', true);
    //way over the top of everything (Sky Line's ghost rails can stair-step you up and up)
    const top = Math.min(level.startY, ...level.surfaces.map((s) => s.y));
    if (sk.y < top - CHECKS.skyTiles * TILE) this.add('sky-high', `climbed over ${CHECKS.skyTiles} tiles above the highest thing on the floor`, '', true);
    //through the street: below the street with street under you, on this step and the last (a canal is a real fall)
    if (this.py <= level.streetY + 1 && sk.boardY > level.streetY + 4 && isStreetAt(level, this.px) && isStreetAt(level, sk.x) && sk.mode !== 'exit') {
      this.add('through-street', `dropped through the street (mode ${this.mode} to ${sk.mode})`);
    }
    //through the top of something solid, in the air from the start of the step to its end
    const air = this.mode === 'air' && sk.mode === 'air' && !sim.events.some((e) => e.type === 'hop' || e.type === 'tuck' || e.type === 'kicker');
    if (air) {
      for (const s of level.surfaces) {
        if (sk.gone.has(s)) continue; // Greece's ruins fall away
        const cx = crossAt(this.px, this.py, sk.x, sk.boardY, s.x0, s.y, surfaceSlope(s));
        if (cx !== null && cx >= s.x0 && cx <= s.x1) this.add('fell-through', `fell through a ${s.kind} (${s.kind === 'bank' || s.kind === 'stairs' ? 'sloped' : 'flat'})`, s.kind);
      }
      for (const c of level.cars) {
        const cx = crossAt(this.px, this.py, sk.x, sk.boardY, 0, c.roof, 0);
        if (cx !== null && cx + PHYS.width / 2 >= c.x0 && cx - PHYS.width / 2 <= c.x1) this.add('fell-through', `fell through a parked ${c.model ?? 'car'}'s roof`, 'car');
      }
      //moving things (traffic, buses, doors, drones) can slide out from under you in a step: only through the middle
      //(not one that pulled out of the lane this step: half into the back lane it's no longer under you, src/traffic)
      for (const { at: c, car } of this.movers) {
        if (!sk.movers.includes(car)) continue;
        const cx = crossAt(this.px, this.py, sk.x, sk.boardY, 0, c.roof, 0);
        if (cx !== null && cx >= c.x0 && cx <= c.x1) this.add('fell-through', `fell through the top of a moving ${c.model ?? 'car or drone'}`, 'mover');
      }
      for (const rail of level.rails) {
        if (rail === this.ignore || rail === sk.railIgnore) continue;
        const a = rail.yAt(this.px);
        const b = rail.yAt(sk.x);
        if (a !== undefined && b !== undefined && this.py <= a + 0.01 && sk.boardY > b + 0.5) this.add('fell-through', 'fell through a curved rail', 'rail');
      }
    }
    //rolling or grinding along a surface: the feet stay on its line
    if ((sk.mode === 'roll' || sk.mode === 'grind') && sk.surface && !sk.gone.has(sk.surface)) {
      const off = sk.y - surfaceY(sk.surface, sk.x);
      if (Math.abs(off) > CHECKS.surfaceSlack && sk.x >= sk.surface.x0 && sk.x <= sk.surface.x1) {
        this.add('off-surface', `${sk.mode === 'roll' ? 'rolling' : 'grinding'} ${Math.round(Math.abs(off))} px ${off > 0 ? 'under' : 'over'} a ${sk.surface.kind}`, sk.surface.kind);
      }
    }
    if (sim.state === 'skate') {
      if (sk.x > this.best + TILE) {
        this.best = sk.x;
        this.bestAt = this.frame;
      } else if (this.frame - this.bestAt > CHECKS.stuckFrames) {
        this.add('stuck', `no progress for ${CHECKS.stuckFrames / 60} s (mode ${sk.mode}, speed ${sk.hsp.toFixed(1)} px/f)`);
        this.bestAt = this.frame; // report it again only if it stays stuck
      }
      if (this.frame === CHECKS.maxFrames) this.add('timeout', `still on the floor after ${CHECKS.maxFrames / 60} s`);
    }
  }

  // one finding per kind and what was hit, per tile column, so a long slide doesn't fill the report
  private add(kind: FindingKind, message: string, what = '', once = false): void {
    const sk = this.sim.skater;
    const col = Math.floor(sk.x / TILE);
    const key = once ? `${kind}:${what}` : `${kind}:${what}:${col}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.findings.push({ kind, message, frame: this.frame, x: Math.round(sk.x), y: Math.round(sk.y), col });
  }
}
