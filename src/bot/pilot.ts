// The playtest bot's hands: what it presses each step. 'ref' is the floor validator's reference bot (ollies at
// canals and cars, rides rails to their ends, flips when falling short); 'mash' presses at random like a new player,
// to shake out states the reference line never reaches. Pure, so the validator, the sim playtest and the game's
// ?bot autopilot all press the same way.
import { PHYS, TILE } from '../physics/constants';
import { isStreetAt, type Car, type Level } from '../physics/level';
import type { Skater, StepInput } from '../physics/skater';
import type { FloorSim } from '../sim/floor';
import type { Vehicle } from '../traffic/traffic';
import type { CrossCar } from '../traffic/cross';
import { makeRng } from '../gen/rng';

export type PilotStyle = 'ref' | 'mash';

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

// follow the fall as it goes (no more presses): does it come down on a manual pad?
function landsOnPad(level: Level, sk: Skater): boolean {
  const pads = level.surfaces.filter((s) => s.manual && s.y >= sk.y);
  let { x, y, vsp } = sk;
  for (let f = 0; f < 120 && y < level.streetY; f++) {
    vsp = Math.min(vsp + sk.grav, PHYS.maxFall);
    const ny = y + vsp;
    x += sk.hsp;
    if (pads.some((s) => y <= s.y && ny >= s.y && x >= s.x0 && x <= s.x1)) return true;
    y = ny;
  }
  return false;
}

export class Pilot {
  private hold = 0;
  private readonly rng: () => number;

  constructor(
    readonly style: PilotStyle = 'ref',
    seed = 1,
  ) {
    this.rng = makeRng(seed * 7 + 31);
  }

  // the button for the sim's next step
  input(sim: FloorSim): StepInput {
    const pressed = this.style === 'mash' ? this.mash() : this.ref(sim);
    if (this.style === 'ref' && pressed && sim.skater.grounded) this.hold = 30;
    const held = this.hold > 0 || pressed;
    if (this.hold > 0) this.hold--;
    return { pressed, held };
  }

  private mash(): boolean {
    const pressed = this.rng() < 0.04;
    if (pressed) this.hold = Math.floor(this.rng() * 30);
    return pressed;
  }

  private ref(sim: FloorSim): boolean {
    const level = sim.level;
    const sk = sim.skater;
    const movers = sim.traffic.inLane;
    //the drone swarm: drones on their way down count as already there
    const drones = sim.swarm ? sim.swarm.drones.filter((d) => d.state === 'dive' || d.state === 'hover').map((d) => d.box) : [];
    const onSurface = sk.mode === 'grind' || (sk.mode === 'roll' && sk.surface !== null);
    let pressed = false;
    if (sk.mode === 'roll' && !sk.surface && danger(level, sk.x, sk.hsp, movers, drones, sim.traffic.cross)) pressed = true;
    if (onSurface && sk.surface && sk.x > sk.surface.x1 - 24 && danger(level, sk.x, sk.hsp, movers, drones, sim.traffic.cross)) pressed = true;
    if (sk.mode === 'rail' && sk.rail && sk.railD > sk.rail.length - 30) pressed = true;
    // falling with no street ahead: flip for more air
    //(unless this fall already lands on a manual pad)
    if (sk.mode === 'air' && sk.vsp > 0.5 && sk.jumps > 0 && !isStreetAt(level, sk.x + 40) && !landsOnPad(level, sk)) pressed = true;
    //a roadblock, a bus or a truck: falling toward the side of a taller vehicle ahead, flip up onto its roof
    if (sk.mode === 'air' && sk.vsp > -1 && sk.jumps > 0 && blocked([...level.cars, ...drones, ...movers], sk.x, sk.y)) pressed = true;
    return pressed;
  }
}
