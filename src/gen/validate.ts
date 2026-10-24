// Makes sure every floor can be cleared with no boons: a simple reference bot skates each generated layout, and
// layouts it can't clear are re-rolled from a sub-seed, then generated one tier lower. Pure and deterministic.
import { TILE } from '../physics/constants';
import { isStreetAt, type Car, type Level } from '../physics/level';
import { FloorSim } from '../sim/floor';
import type { Gear } from '../run/gear';
import type { Vehicle } from '../traffic/traffic';
import type { CrossCar } from '../traffic/cross';
import { buildFloor, type FloorOptions } from './descent';
import { maxTier } from './layout';
import { PIECES } from './pieces';

const REROLLS = 8;

function danger(level: Level, x: number, hsp: number, movers: Vehicle[], still: Car[], cross: CrossCar[]): boolean {
  for (let dx = 20; dx <= 70; dx += 4) {
    if (!isStreetAt(level, x + dx)) return true;
    if (level.cars.some((c) => x + dx >= c.x0 && x + dx <= c.x1)) return true;
    if (still.some((c) => x + dx >= c.x0 && x + dx <= c.x1)) return true;
    if (level.glass.some((g) => x + dx >= g.x0 && x + dx <= g.x1)) return true;
    //where moving cars will be by the time we get there
    const t = dx / Math.max(1, hsp);
    if (movers.some((v) => x + dx >= v.x0 + v.speed * t && x + dx <= v.x1 + v.speed * t)) return true;
    //cross traffic that will be in the lane by then
    if (cross.some((c) => x + dx >= c.box.x0 && x + dx <= c.box.x1 && (c.inLane || c.inLaneIn(t)))) return true;
  }
  return false;
}

// the next roof within a few tiles is above our feet
function blocked(cars: Car[], x: number, y: number): boolean {
  return cars.some((c) => c.x0 > x && c.x0 - x < 2.5 * TILE && c.roof < y - 4);
}

// the reference bot: ollies at canals and cars, rides rails to their ends, flips when falling short
export function botRun(level: Level): { result: string; slams: number; maxHeat: number; gear: Gear } {
  const sim = new FloorSim(level);
  const sk = sim.skater;
  let hold = 0;
  let slams = 0;
  let maxHeat = 0;
  for (let f = 0; f < 60 * 120; f++) {
    let pressed = false;
    const movers = sim.traffic.inLane;
    //the drone swarm: drones on their way down count as already there
    const drones = sim.swarm ? sim.swarm.drones.filter((d) => d.state === 'dive' || d.state === 'hover').map((d) => d.box) : [];
    const onSurface = sk.mode === 'grind' || (sk.mode === 'roll' && sk.surface !== null);
    if (sk.mode === 'roll' && !sk.surface && danger(level, sk.x, sk.hsp, movers, drones, sim.traffic.cross)) pressed = true;
    if (onSurface && sk.surface && sk.x > sk.surface.x1 - 24 && danger(level, sk.x, sk.hsp, movers, drones, sim.traffic.cross)) pressed = true;
    if (sk.mode === 'rail' && sk.rail && sk.railD > sk.rail.length - 30) pressed = true;
    // falling with no street ahead: flip for more air
    if (sk.mode === 'air' && sk.vsp > 0.5 && sk.jumps > 0 && !isStreetAt(level, sk.x + 40)) pressed = true;
    //a roadblock, a bus or a truck: falling toward the side of a taller vehicle ahead, flip up onto its roof
    if (sk.mode === 'air' && sk.vsp > -1 && sk.jumps > 0 && blocked([...level.cars, ...drones, ...movers], sk.x, sk.y)) pressed = true;
    if (pressed && sk.grounded) hold = 30;
    sim.step({ pressed, held: hold > 0 || pressed });
    if (hold > 0) hold--;
    slams += sim.events.filter((e) => e.type === 'slam').length;
    maxHeat = Math.max(maxHeat, sim.heat.value);
    if (sim.state === 'bail') return { result: `bail at col ${Math.floor(sk.x / TILE)}`, slams, maxHeat, gear: sim.gear };
    if (sim.state === 'caught') return { result: `caught at col ${Math.floor(sk.x / TILE)}`, slams, maxHeat, gear: sim.gear };
    if (sim.state === 'exit') return { result: 'exit', slams, maxHeat, gear: sim.gear };
  }
  return { result: 'timeout', slams, maxHeat, gear: sim.gear };
}

export function clearable(level: Level): boolean {
  return botRun(level).result === 'exit';
}

export interface Validated {
  level: Level;
  tries: number; // floors generated before one passed
  tierDrops: number;
}

export function validatedFloor(seed: number, floor: number, opts: FloorOptions = {}): Validated {
  let tries = 0;
  for (let top = maxTier(floor), drops = 0; top >= 1; top--, drops++) {
    const library = PIECES.filter((p) => p.tier <= top);
    for (let k = 0; k <= REROLLS; k++) {
      tries++;
      const level = buildFloor(seed + k * 15485863 + drops * 32452843, floor, library, opts);
      if (clearable(level)) return { level, tries, tierDrops: drops };
    }
  }
  //nothing passed (should not happen); hand back the original
  return { level: buildFloor(seed, floor, PIECES, opts), tries, tierDrops: -1 };
}
