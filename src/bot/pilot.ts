// The playtest bot's hands: what it presses each step. 'ref' is the floor validator's reference bot (ollies at
// canals and cars, rides rails to their ends, flips when falling short); 'mash' presses at random like a new player,
// to shake out states the reference line never reaches. Pure, so the validator, the sim playtest and the game's
// ?bot autopilot all press the same way.
import { PHYS, TILE } from '../physics/constants';
import { isStreetAt, sewerAt, surfaceY, type Car, type CurvedRail, type Level, type Surface } from '../physics/level';
import type { Skater, StepInput } from '../physics/skater';
import type { FloorSim } from '../sim/floor';
import type { Vehicle } from '../traffic/traffic';
import type { CrossCar } from '../traffic/cross';
import { makeRng } from '../gen/rng';

// 'high' is the reference bot going for the top route (src/gen/top-route.ts): it ollies off the end of each rooftop;
// 'sewer' goes for the sewer route (src/gen/sewer.ts): it rolls into each open drain and keeps its feet down there;
// 'sky' stays up on the sky route's line (src/gen/sky-beats.ts, src/gen/clouds.ts): it ollies off the end of each
// sky piece and flips when that's what reaches the next one, the line a good player skates
export type PilotStyle = 'ref' | 'mash' | 'high' | 'sewer' | 'sky';

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

// the surfaces and rails a look-ahead from here could reach: every fall below runs at most 150 steps of hsp from the
// skater, so the forecasts loop over these few instead of the whole floor's (the same answers, much faster)
interface Near {
  surfaces: Surface[];
  rails: CurvedRail[];
}

const NONE: Near = { surfaces: [], rails: [] };
const REACH = 152; // steps of hsp: flipNow's 30 and a fall's 120, and a little over

const spans = new WeakMap<CurvedRail, [number, number]>();
function spanOf(r: CurvedRail): [number, number] {
  let span = spans.get(r);
  if (!span) spans.set(r, (span = [Math.min(...r.xs), Math.max(...r.xs)]));
  return span;
}

function nearby(level: Level, sk: Skater): Near {
  const lo = Math.min(sk.x, sk.x + REACH * sk.hsp);
  const hi = Math.max(sk.x, sk.x + REACH * sk.hsp);
  return {
    surfaces: level.surfaces.filter((s) => s.x1 >= lo && s.x0 <= hi),
    rails: level.rails.filter((r) => spanOf(r)[1] >= lo && spanOf(r)[0] <= hi),
  };
}

// follow a fall (no more presses) from the feet at (x, y) at vsp: does the board come down on a manual pad, or (any)
// on anything? `flip`: vsp is a flip thrown now, which lifts the board its own way (src/physics/tuck.ts)
function landsOn(level: Level, near: Near, sk: Skater, x: number, y: number, vsp: number, any: boolean, flip = false): boolean {
  const tuck = sk.tuck.ahead(flip);
  let by = y - sk.tuck.lift;
  for (let f = 0; f < 120 && by < level.streetY + 1; f++) {
    vsp = Math.min(vsp + sk.grav, PHYS.maxFall);
    y += vsp;
    tuck.step(true);
    const ny = y - tuck.lift;
    x += sk.hsp;
    if (any && ny >= level.streetY && isStreetAt(level, x)) return true;
    for (const s of near.surfaces) {
      //a few px in from the ends: the projection is a guess, and a corner isn't a landing to count on
      if ((!any && !s.manual) || x < s.x0 + EDGE || x > s.x1 - EDGE) continue;
      const sy = surfaceY(s, x);
      if (by <= sy && ny >= sy) return true;
    }
    //and rails: the top route's next wire
    if (any && near.rails.some((r) => r !== sk.railIgnore && (r.yAt(x) ?? -1e9) >= by && (r.yAt(x) ?? 1e9) <= ny)) return true;
    by = ny;
  }
  return false;
}

// follow a fall from the feet at (x, y) at vsp: does the board come down on the top route (a power line or a rooftop)?
function landsTop(level: Level, near: Near, sk: Skater, x: number, y: number, vsp: number, flip = false): boolean {
  const tuck = sk.tuck.ahead(flip);
  let by = y - sk.tuck.lift;
  for (let f = 0; f < 120 && by < level.streetY; f++) {
    vsp = Math.min(vsp + sk.grav, PHYS.maxFall);
    y += vsp;
    tuck.step(true);
    const ny = y - tuck.lift;
    x += sk.hsp;
    if (near.surfaces.some((s) => s.top && x >= s.x0 + EDGE && x <= s.x1 - EDGE && by <= s.y && ny >= s.y)) return true;
    if (near.rails.some((r) => r.top && (r.yAt(x) ?? -1e9) >= by && (r.yAt(x) ?? 1e9) <= ny)) return true;
    by = ny;
  }
  return false;
}

// follow a fall from the feet at (x, y) at vsp: does the board come down on a sky piece (a deck, a cloud, a wire,
// a rainbow, or a moving deck's top)?
function landsSky(level: Level, near: Near, decks: Surface[], sk: Skater, x: number, y: number, vsp: number, flip = false): boolean {
  const tuck = sk.tuck.ahead(flip);
  let by = y - sk.tuck.lift;
  const sky = (s: Surface) => !!(s.sky || s.top);
  for (let f = 0; f < 150 && by < level.streetY; f++) {
    vsp = Math.min(vsp + sk.grav, PHYS.maxFall);
    y += vsp;
    tuck.step(true);
    const ny = y - tuck.lift;
    x += sk.hsp;
    for (const s of [...near.surfaces, ...decks]) {
      if (!sky(s) || x < s.x0 + EDGE || x > s.x1 - EDGE) continue;
      const sy = surfaceY(s, x);
      if (by <= sy && ny >= sy) return true;
    }
    if (near.rails.some((r) => (r.sky || r.top) && r !== sk.railIgnore && (r.yAt(x) ?? -1e9) >= by && (r.yAt(x) ?? 1e9) <= ny)) return true;
    by = ny;
  }
  return false;
}

// falling with no street ahead: flip now, or hold it while a later flip still lands where this one wouldn't (at
// full stoke's speed a flip straight away can sail over a short roof)
function flipNow(level: Level, near: Near, sk: Skater): boolean {
  const flip = sk.flipPop();
  if (landsOn(level, near, sk, sk.x, sk.y, flip, true, true)) return true;
  let { x, vsp } = sk;
  let y = sk.y;
  for (let k = 1; k <= 30 && y < level.streetY; k++) {
    vsp = Math.min(vsp + sk.grav, PHYS.maxFall);
    x += sk.hsp;
    y += vsp;
    if (landsOn(level, near, sk, x, y, flip, true, true)) return false;
  }
  return true;
}

// down in the sewer (src/gen/sewer.ts): ollie a kick-out (to stay down), the alligator, a rat pack running at you
// and the subway's gap, at the last moment the ollie still clears it; ride the bowl, and ollie off the end of a pipe
// (railEnd: the reference line's press there)
function sewerPress(sim: FloorSim, railEnd: boolean): boolean {
  const sk = sim.skater;
  if (sk.mode === 'rail') return railEnd;
  if (sk.mode !== 'roll' || sk.impactT > 0) return false;
  const s = sewerAt(sim.level, sk.x);
  if (!s) return false;
  const v = Math.max(1, sk.hsp);
  const ahead = (x: number, lo: number, hi: number) => x - sk.x > lo && x - sk.x < hi;
  if (s.kicks?.some((k) => ahead(k.x0, 0, Math.max(10, 3 * v)))) return true;
  //(up on a stair set's landing: off its edge onto the handrail)
  if (s.stairs?.some((t) => sk.y < s.y - t.h / 2 && ahead(t.top, 0, Math.max(12, 2 * v)))) return true;
  const half = PHYS.width / 2;
  if (s.gator && ahead(s.gator[0] - half, 0, 3 * v)) return true;
  const p = s.piece;
  if (p?.kind === 'subway' && ahead(p.x0, 0, Math.max(12, 3 * v))) return true;
  const pack = sim.sewer.tunnels.find((t) => t.s === s)?.pack;
  if (pack?.awake && pack.rats.some((r) => r.alive && ahead(r.x - half, 0, 3 * (v + 1.6)))) return true;
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
    const pressed = this.style === 'mash' ? this.mash() : this.style === 'sky' ? this.sky(sim) : this.ref(sim);
    //hold through the pop: a flip let go at once is cut short, and the look-ahead counts on a full one
    if (this.style !== 'mash' && pressed) this.hold = sim.skater.grounded ? 30 : this.style === 'sky' ? Math.max(this.hold, 20) : 20;
    const held = this.hold > 0 || pressed;
    if (this.hold > 0) this.hold--;
    return { pressed, held };
  }

  // the sky line: off the end of each piece at the last moment the ollie still makes the next, flip if that's what
  // makes it; down on the ground below it skates as the reference bot does
  private sky(sim: FloorSim): boolean {
    const sk = sim.skater;
    const piece = sk.mode === 'rail' ? sk.rail?.sky || sk.rail?.top : sk.surface?.sky || sk.surface?.top;
    //on the street or the hill: a big ollie when the first piece of the sky is just ahead and in reach (the flip comes
    //in the air, below), else skate as the reference bot does
    if (!piece && sk.mode !== 'air') {
      const up = sim.level.surfaces.some((s) => s.sky && s.x0 - sk.x > 2.5 * sk.hsp * 6 && s.x0 - sk.x < 2.5 * sk.hsp * 9 && sk.y - s.y > TILE && sk.y - s.y < 3.5 * TILE);
      if (up && sk.grounded && sk.mode !== 'rail') return true;
      return this.ref(sim);
    }
    const level = sim.level;
    const near = nearby(level, sk);
    const decks = sim.sky.pieces.map((p) => p.ledge).filter((l) => l.x1 > sk.x);
    if (sk.mode === 'rail' && sk.rail) {
      if (sk.railD > sk.rail.length - 30 && !continues(level, sk.rail)) return true;
      return false;
    }
    if (sk.grounded && sk.surface) {
      //ollie off the end at the last few steps, as a good player does
      return sk.surface.x1 - sk.x < Math.max(12, 3 * sk.hsp);
    }
    //rolled off the end while the landing still had the knees bent: the ollie's still there a moment after the edge
    if (sk.mode === 'air' && sk.coyote > 0 && sk.jumps === sk.maxJumps) return true;
    if (sk.mode === 'air' && sk.jumps > 0 && sk.vsp > -2) {
      if (landsSky(level, near, decks, sk, sk.x, sk.y, sk.vsp)) return false;
      if (landsSky(level, near, decks, sk, sk.x, sk.y, sk.flipPop(), true)) return true;
      //nothing to make yet: hold the flip for later in the fall, unless it's now or never
      return sk.vsp > 3;
    }
    return false;
  }

  private mash(): boolean {
    const pressed = this.rng() < 0.04;
    if (pressed) this.hold = Math.floor(this.rng() * 30);
    return pressed;
  }

  private ref(sim: FloorSim): boolean {
    const level = sim.level;
    const sk = sim.skater;
    const near = sk.mode === 'air' ? nearby(level, sk) : NONE; // the look-aheads all run in the air
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
    //flip near the top of an arc if that's what reaches the top route
    if (this.style === 'high' && sk.mode === 'air' && sk.jumps > 0 && sk.vsp > -1.5 && !landsTop(level, near, sk, sk.x, sk.y, sk.vsp) && landsTop(level, near, sk, sk.x, sk.y, sk.flipPop(), true)) pressed = true;
    //a guard's bullet coming up behind at waist height: ollie so it goes under (feet clear of it ~6-34 frames in)
    if (sk.grounded && sim.shooter?.bullets.some((b) => {
      const eta = (sk.x - PHYS.width / 2 - b.x) / Math.max(0.1, b.vx - Math.abs(sk.hsp));
      return eta > 0 && eta < 10 && b.y > sk.y - PHYS.height && b.y < sk.y;
    })) pressed = true;
    //pigeons sitting on the top route ahead: ollie over them
    if ((onSurface || sk.mode === 'rail') && sim.sky.flocks.some((f) => f.state === 'perch' && f.x - sk.x > 0 && f.x - sk.x < 8 * Math.max(sk.hsp, sk.railV) && Math.abs(f.y - sk.y) < 20)) pressed = true;
    // falling with no street ahead: flip for more air
    //(unless this fall already lands on a manual pad)
    if (sk.mode === 'air' && sk.jumps > 0 && !isStreetAt(level, sk.x + 40) && !landsOn(level, near, sk, sk.x, sk.y, sk.vsp, false)) {
      if (sk.vsp > 0.5 && flipNow(level, near, sk)) pressed = true;
      //near the top of the arc: flip already if that lands on something and coming down as we are wouldn't
      else if (sk.vsp > -2 && sk.vsp <= 0.5 && landsOn(level, near, sk, sk.x, sk.y, sk.flipPop(), true, true) && !landsOn(level, near, sk, sk.x, sk.y, sk.vsp, true)) pressed = true;
    }
    //a roadblock, a bus or a truck: falling toward the side of a taller vehicle ahead, flip up onto its roof
    if (sk.mode === 'air' && sk.vsp > -1 && sk.jumps > 0 && blocked([...level.cars, ...drones, ...movers], sk.x, sk.boardY)) pressed = true;
    //down in the sewer: no flips (the street's overhead), only an ollie over what's on the floor ahead
    if (sim.down) return sewerPress(sim, pressed && sk.mode === 'rail');
    if (this.style === 'sewer') {
      //roll on into a drain ahead, and no flips on the way down (the street's underside is overhead)
      const drain = level.sewers?.find((w) => w.drain[1] > w.drain[0] && w.drain[0] - sk.x > -TILE && w.drain[0] - sk.x < 4 * TILE);
      if (drain && sk.y <= level.streetY + 1 && sk.mode === 'roll' && (!sk.surface || Math.abs(sk.surface.y - level.streetY) < 1)) pressed = false;
      if (sk.mode === 'air' && sewerAt(level, sk.x) && sk.y > level.streetY - 4) pressed = false;
      //a pit on the hill that's the sewer's shaft: roll on into it, and no flips on the way down
      if (level.sewers?.some((w) => w.entry === 'shaft' && sk.x > w.drain[0] - 8 * TILE && sk.x < w.drain[1] + TILE)) pressed = false;
      //and no big ollie off the top of a hill (that's the way up into the sky): roll on down where the hill goes on
      const on = sk.surface;
      if (on && sk.mode === 'roll' && !on.sky && !on.top && on.x1 - sk.x < 30 && level.surfaces.some((o) => o !== on && !o.sky && !o.top && o.kind !== 'rail' && o.x0 <= on.x1 + 4 && o.x1 > on.x1 + 4 && Math.abs(surfaceY(o, on.x1 + 4) - surfaceY(on, on.x1)) < 10)) pressed = false;
    }
    return pressed;
  }
}
