import { describe, expect, it } from 'vitest';
import { validatedEscape } from '../src/gen/escape';
import { PHYS, TILE } from '../src/physics/constants';
import { isStreetAt } from '../src/physics/level';
import { CHASER } from '../src/sim/chaser';
import { SHOTS } from '../src/sim/shots';
import { FloorSim } from '../src/sim/floor';

// zack (2026-10-27): the guards chasing you on foot shoot, and you dodge the bullets
const chase = () => {
  for (let seed = 1; seed < 40; seed++) {
    const level = validatedEscape(seed * 7919, 3);
    if (level.escape?.chaseFrom === undefined) continue;
    const sim = new FloorSim(level);
    sim.traffic.vehicles.length = 0;
    // on a clear, flat stretch of street past where the chase starts
    const clear = (x: number) =>
      Array.from({ length: 24 }, (_, i) => x + i * TILE).every((c) => isStreetAt(level, c)) &&
      !level.cars.some((c) => c.x1 > x - 2 * TILE && c.x0 < x + 24 * TILE) &&
      !level.surfaces.some((s) => s.x1 > x && s.x0 < x + 24 * TILE && Math.min(s.y, s.y1 ?? s.y) > level.streetY - 3 * TILE);
    let from = level.escape.chaseFrom + 4 * TILE;
    while (from < level.exitX && !clear(from)) from += TILE;
    if (from >= level.exitX) continue;
    const sk = sim.skater;
    Object.assign(sk, { x: from, y: level.streetY, surface: null, mode: 'roll', vsp: 0, hsp: PHYS.baseSpeed });
    //jumped ahead past the traffic's spawn points: let them all spawn, then clear them off the street
    sim.traffic.step(sk.x);
    sim.traffic.vehicles.length = 0;
    sim.chaser!.step(sk, []);
    return sim;
  }
  throw new Error('no chase floor');
};

// run until the first shot reaches the skater; `ollieAt` frames after the shot (or never)
function firstShot(ollieAt = -1) {
  const sim = chase();
  const sh = sim.shooter!;
  sh.wait = 1;
  const seen: string[] = [];
  let shotAt = -1;
  let aimFrames = 0;
  for (let f = 0; f < 200; f++) {
    const press = shotAt >= 0 && f === shotAt + ollieAt;
    sim.step({ pressed: press, held: press || (shotAt >= 0 && f > shotAt + ollieAt && f < shotAt + ollieAt + 30) });
    if (sh.aimT > 0) aimFrames++;
    for (const e of sim.events) {
      if (e.type === 'aim' || e.type === 'shot' || e.type === 'shotHit' || e.type === 'dodge' || e.type === 'slam') seen.push(e.type);
      if (e.type === 'shot') shotAt = f;
    }
    if (seen.includes('shotHit') || seen.includes('dodge')) break;
  }
  return { seen, aimFrames, sim };
}

describe('the guards shoot', () => {
  it('aim first (the tell), then fire', () => {
    const { seen, aimFrames } = firstShot();
    expect(seen.slice(0, 2)).toEqual(['aim', 'shot']);
    expect(aimFrames).toBe(SHOTS.aim);
  });

  it('a bullet you stay on the ground for hits you: a slam', () => {
    const { seen } = firstShot();
    expect(seen).toContain('shotHit');
    expect(seen).toContain('slam');
  });

  it('ollie as it gets close and it goes under you', () => {
    //about 0.75 s from the bang to you: pop a little before it arrives
    const arrive = Math.round((CHASER.startGap - SHOTS.gun - PHYS.width / 2) / SHOTS.speed);
    const dodged = [-24, -16, -10].map((early) => firstShot(arrive + early).seen);
    for (const s of dodged) {
      expect(s).toContain('dodge');
      expect(s).not.toContain('shotHit');
    }
    //too late: still on the ground when it gets there
    expect(firstShot(arrive + 2).seen).toContain('shotHit');
  });

  it("up off the street, they can't draw a line on you", () => {
    const sim = chase();
    const sh = sim.shooter!;
    sh.wait = 1;
    //far above the street (a high line)
    for (let f = 0; f < 120; f++) {
      Object.assign(sim.skater, { y: sim.level.streetY - 6 * TILE, mode: 'roll', vsp: 0 });
      sh.step(sim.chaser!, sim.skater);
      expect(sh.events.some((e) => e.type === 'shot')).toBe(false);
    }
  });
});
