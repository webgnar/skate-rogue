// The playtest bot's hands: what it presses each step. 'ref' is the floor validator's reference bot (ollies at
// canals and cars, rides rails to their ends, flips when falling short); 'mash' presses at random like a new player,
// to shake out states the reference line never reaches. Pure, so the validator, the sim playtest and the game's
// ?bot autopilot all press the same way.
import { PHYS, TILE } from '../physics/constants';
import { isStreetAt, surfaceY, type Car, type CurvedRail, type Level } from '../physics/level';
import type { Skater, StepInput } from '../physics/skater';
import type { FloorSim } from '../sim/floor';
import type { Vehicle } from '../traffic/traffic';
import type { CrossCar } from '../traffic/cross';
import { makeRng } from '../gen/rng';

// 'high' is the reference bot going for the top route (src/gen/top-route.ts): it ollies off the end of each rooftop
export type PilotStyle = 'ref' | 'mash' | 'high';

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

const EDGE = 6;

// does another rail, or a roof, pick up where this rail ends?
function continues(level: Level, rail: CurvedRail): boolean {
  const [x, y] = [rail.xs[rail.xs.length - 1], rail.ys[rail.ys.length - 1]];
  if (level.rails.some((r) => r !== rail && Math.abs(r.xs[0] - x) < 4 && Math.abs(r.ys[0] - y) < 8)) return true;
  return level.surfaces.some((s) => Math.abs(s.x0 - x) < 4 && Math.abs(s.y - y) < 8);
}

// follow a fall (no more presses) from (x, y) at vsp: does it come down on a manual pad, or (any) on anything?
function landsOn(level: Level, sk: Skater, x: number, y: number, vsp: number, any: boolean): boolean {
  for (let f = 0; f < 120 && y < level.streetY + 1; f++) {
    vsp = Math.min(vsp + sk.grav, PHYS.maxFall);
    const ny = y + vsp;
    x += sk.hsp;
    if (any && ny >= level.streetY && isStreetAt(level, x)) return true;
    for (const s of level.surfaces) {
      //a few px in from the ends: the projection is a guess, and a corner isn't a landing to count on
      if ((!any && !s.manual) || x < s.x0 + EDGE || x > s.x1 - EDGE) continue;
      const sy = surfaceY(s, x);
      if (y <= sy && ny >= sy) return true;
    }
    //and rails: the top route's next wire
    if (any && level.rails.some((r) => r !== sk.railIgnore && (r.yAt(x) ?? -1e9) >= y && (r.yAt(x) ?? 1e9) <= ny)) return true;
    y = ny;
  }
  return false;
}

// follow a fall from (x, y) at vsp: does it come down on the top route (a power line or a rooftop)?
function landsTop(level: Level, sk: Skater, x: number, y: number, vsp: number): boolean {
  for (let f = 0; f < 120 && y < level.streetY; f++) {
    vsp = Math.min(vsp + sk.grav, PHYS.maxFall);
    const ny = y + vsp;
    x += sk.hsp;
    if (level.surfaces.some((s) => s.top && x >= s.x0 + EDGE && x <= s.x1 - EDGE && y <= s.y && ny >= s.y)) return true;
    if (level.rails.some((r) => r.top && (r.yAt(x) ?? -1e9) >= y && (r.yAt(x) ?? 1e9) <= ny)) return true;
    y = ny;
  }
  return false;
}

// falling with no street ahead: flip now, or hold it while a later flip still lands where this one wouldn't (at
// full stoke's speed a flip straight away can sail over a short roof)
function flipNow(level: Level, sk: Skater): boolean {
  const flip = PHYS.trick * sk.gear.trick;
  if (landsOn(level, sk, sk.x, sk.y, flip, true)) return true;
  let { x, y, vsp } = sk;
  for (let k = 1; k <= 30 && y < level.streetY; k++) {
    vsp = Math.min(vsp + sk.grav, PHYS.maxFall);
    x += sk.hsp;
    y += vsp;
    if (landsOn(level, sk, x, y, flip, true)) return false;
  }
  return true;
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
    if (this.style !== 'mash' && pressed && sim.skater.grounded) this.hold = 30;
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
    //(not where another rail picks up right where this one ends: the top route's wires, pole to pole)
    if (sk.mode === 'rail' && sk.rail && sk.railD > sk.rail.length - 30 && !continues(level, sk.rail)) pressed = true;
    if (this.style === 'high' && onSurface && sk.surface?.top && sk.x > sk.surface.x1 - 24) pressed = true;
    //pop off a launch ramp's lip, and flip near the top of the arc if that's what reaches the top route
    if (this.style === 'high' && sk.mode === 'roll' && sk.surface?.launch && sk.x > sk.surface.x1 - 8) pressed = true;
    if (this.style === 'high' && sk.mode === 'air' && sk.jumps > 0 && sk.vsp > -1.5 && !landsTop(level, sk, sk.x, sk.y, sk.vsp) && landsTop(level, sk, sk.x, sk.y, PHYS.trick * sk.gear.trick)) pressed = true;
    //pigeons sitting on the top route ahead: ollie over them
    if ((onSurface || sk.mode === 'rail') && sim.sky.flocks.some((f) => f.state === 'perch' && f.x - sk.x > 0 && f.x - sk.x < 8 * Math.max(sk.hsp, sk.railV) && Math.abs(f.y - sk.y) < 20)) pressed = true;
    // falling with no street ahead: flip for more air
    //(unless this fall already lands on a manual pad)
    if (sk.mode === 'air' && sk.jumps > 0 && !isStreetAt(level, sk.x + 40) && !landsOn(level, sk, sk.x, sk.y, sk.vsp, false)) {
      if (sk.vsp > 0.5 && flipNow(level, sk)) pressed = true;
      //near the top of the arc: flip already if that lands on something and coming down as we are wouldn't
      else if (sk.vsp > -2 && sk.vsp <= 0.5 && landsOn(level, sk, sk.x, sk.y, PHYS.trick * sk.gear.trick, true) && !landsOn(level, sk, sk.x, sk.y, sk.vsp, true)) pressed = true;
    }
    //a roadblock, a bus or a truck: falling toward the side of a taller vehicle ahead, flip up onto its roof
    if (sk.mode === 'air' && sk.vsp > -1 && sk.jumps > 0 && blocked([...level.cars, ...drones, ...movers], sk.x, sk.y)) pressed = true;
    return pressed;
  }
}
