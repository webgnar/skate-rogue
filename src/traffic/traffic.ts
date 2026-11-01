// Moving traffic in the skate lane (GDD: Traffic). The director spawns vehicles from the floor seed when the
// skater passes trigger points, so a slower skater sees the same street. Vehicles pull out of the skate lane
// before canals, parked cars and glass, so they never sit where the street can't hold them.
import { makeRng, randInt } from '../gen/rng';
import { PHYS, TILE } from '../physics/constants';
import { inHill, isStreetAt, type Car, type Level, type Surface } from '../physics/level';
import { CROSS, CrossCar, type Intersection } from './cross';
import { HillCross } from './hill-cross';
import { Cab } from './cab';
import { CarDoor, STOP, type BusStop } from './street';
import { TUNNEL, groundAt, mouthX, mouths } from './tunnel';

// robotaxis, buses and box trucks drive your way (slower than you); oncoming cars come at you; a 'car' turned
// onto your road from a cross street, a human driver who doesn't brake for you
export type VehicleKind = 'robotaxi' | 'oncoming' | 'bus' | 'truck' | 'car';

export interface Vehicle extends Car {
  id: number;
  kind: VehicleKind;
  speed: number; // px/frame, signed (+ = the skater's direction)
  cruise: number;
  lane: number; // 0 = the skate lane, 1 = pulled out to the back lane (no contact)
  leaving: boolean;
  look?: number; // which paint, for a car that came from a cross street (it keeps its colour)
  wrecked?: boolean; // car-hopped to scrap (src/traffic/damage.ts): rolling to a stop out of the lane
  stop?: { x: number; t: number }; // a bus pulling in at a bus stop: where its back stops, frames since it started
  tunnel?: number; // turning into a tunnel's mouth at the foot of a hill (src/traffic/tunnel.ts), 0 to 1: then it's gone
}

export interface Spawn {
  at: number; // spawns when the skater passes this x
  kind: VehicleKind;
  speed: number;
}

// how deep things stand across the street (z, tiles; the skate lane is 0, the wall at the back -3.5). The road
// runs from the curb to the front, with room behind the skate lane for a vehicle to pull into (the back lane:
// cars getting out of the way, wrecks, the Heat cruiser) without touching the sidewalk, where the people, lamps,
// bus stops and the L's columns stand
export const STREET_Z = {
  back: -1.5, // the back lane's middle: a 1.6 wide car reaches the curb, the skate lane's cars just clear it
  line: -0.2, // the painted centre line (kit.ts paints it 55% of the way from the back of the street)
  cruiser: 0.9, // the Heat cruiser's middle: the near lane, between the centre line and the camera (zack, 2026-11-01:
  //a 2 wide car in the back lane drove half on the sidewalk). Its near side clears the line, its far side the kerb
  curb: -2.3,
  lamp: -2.45, // street lamps, signals and the L's columns, at the curb
  walk: -2.8, // where people stand and stroll, and the bus stops and wanted posters
};

// The buildings out on the street: a rooftop over street, off the hills. From ARCADE.low tiles up one stands on
// pillars over a glass lobby at the back of the sidewalk, as Chicago's plazas do, and traffic drives under it
// between the pillars (zack, 2026-10-26: "cuz cars are driving through them"). A lower one is a kiosk, too low to
// drive under, so it stands in front of the back lane and vehicles pull out behind it.
export const ARCADE = {
  low: 2, // tiles: a rooftop this high or more stands on pillars
  soffit: 2.6, // tiles: the underside of its upper floors, at most (a bus is 2.25)
  deck: 0.7, // tiles: its upper floors are at least this thick
  kioskBack: -0.6, // z: a kiosk's back face, just in front of the back lane
};

// a building out on the street (see ARCADE)
export function streetBuilding(level: Level, s: Surface): boolean {
  if (s.kind !== 'roof' || s.el || s.sky || s.top || level.streetY - s.y < TILE / 2 || inHill(level, s.x0)) return false;
  for (let x = s.x0 + TILE / 2; x < s.x1; x += TILE) if (isStreetAt(level, x)) return true;
  return false;
}

// one too low for traffic to drive under
export const isKiosk = (level: Level, s: Surface) => streetBuilding(level, s) && level.streetY - s.y < ARCADE.low * TILE;

export const TRAFFIC = {
  carW: 2 * TILE,
  carH: 40,
  // a CTA bus: a long roof past a plain ollie (ollie and flip up the back, or hop on off a car), slow
  busW: 6 * TILE,
  busH: 72,
  busSpeed: 0.3,
  // a box truck with its tailgate down: the tailgate kicks you up onto the box
  truckW: 4 * TILE,
  truckH: 64,
  tailgate: TILE,
  bigFrom: 4, // buses and trucks join the traffic from this floor
  bigShare: 0.3, // of the vehicles going your way
  robotaxiSpeed: [0.35, 0.5], // share of base speed
  oncomingSpeed: -4,
  brakeRange: 3 * TILE, // robotaxis brake when the skater is this close behind
  brakeSpeed: 0.3,
  aheadRobotaxi: 16 * TILE, // where vehicles appear, ahead of the trigger point
  aheadOncoming: 30 * TILE,
  laneFrames: 20, // frames to pull out of the lane
  clearance: 2 * TILE, // pull out this far before a canal or a parked car
  offHill: 14 * TILE, // no vehicle appears this close after the foot of a stretch of hill
};

// floor 1-2 robotaxis only, oncoming from floor 3; density grows to 1 vehicle per 1.5 pieces by floor 8
export function spawnPlan(level: Level, seed: number): Spawn[] {
  const floor = level.layout.floor;
  const rng = makeRng(seed * 31 + floor * 31337);
  const pieces = level.layout.pieces.length;
  //danger 1-3 (the road's sign) scales it; rush hour also brings oncoming cars early
  const density = Math.min(0.67, 0.3 + 0.06 * (floor - 1)) * [0.7, 1, 1.5][(level.danger ?? 2) - 1];
  const plan: Spawn[] = [];
  for (let p = 1; p < pieces - 2; p++) {
    if (rng() >= density) continue;
    const oncoming = (floor >= 3 || level.danger >= 3) && rng() < 0.4;
    const [lo, hi] = TRAFFIC.robotaxiSpeed;
    const at = level.finaleX + p * 16 * TILE + randInt(rng, 8) * TILE;
    if (oncoming) {
      plan.push({ at, kind: 'oncoming', speed: TRAFFIC.oncomingSpeed });
      continue;
    }
    const big = floor >= TRAFFIC.bigFrom && rng() < TRAFFIC.bigShare;
    const kind: VehicleKind = big ? (rng() < 0.5 ? 'bus' : 'truck') : 'robotaxi';
    const speed = kind === 'bus' ? PHYS.baseSpeed * TRAFFIC.busSpeed : PHYS.baseSpeed * (lo + (hi - lo) * rng());
    plan.push({ at, kind, speed });
  }
  return plan;
}

// a vehicle's length and roof height, px
export function vehicleSize(kind: VehicleKind): [number, number] {
  if (kind === 'bus') return [TRAFFIC.busW, TRAFFIC.busH];
  if (kind === 'truck') return [TRAFFIC.truckW, TRAFFIC.truckH];
  return [TRAFFIC.carW, TRAFFIC.carH];
}

export class Traffic {
  vehicles: Vehicle[] = [];
  noBrake = false; // Spoofed Plate: robotaxis don't brake for the skater
  readonly cross: CrossCar[]; // cars crossing at intersections
  readonly hillCross: HillCross[]; // Chinatown's intersections on the hill, cars driving straight across
  readonly cabs: Cab[]; // Chinatown's cabs to skitch
  readonly doors: CarDoor[]; // back-lane parked cars' doors
  private readonly kiosks: Surface[]; // vehicles pull out behind these (ARCADE)
  private nextStop = 0;
  private next = 0;
  private ids = 0;

  constructor(
    private readonly level: Level,
    private readonly plan: Spawn[],
    intersections: Intersection[] = [],
    private readonly stops: BusStop[] = [],
    doors: number[] = [],
  ) {
    this.cross = intersections.map((i) => new CrossCar(i, level.streetY));
    this.hillCross = (level.hillCross ?? []).map((k, i) => new HillCross(k.x, k.y, level.layout.seed * 23 + level.layout.floor * 911 + i * 131));
    this.cabs = (level.cabs ?? []).map((r) => new Cab(r));
    this.kiosks = level.surfaces.filter((s) => isKiosk(level, s));
    this.doors = doors.map((x) => new CarDoor(x, level.streetY));
  }

  private blockedAt(x0: number, x1: number): boolean {
    if (this.kiosks.some((k) => k.x1 > x0 && k.x0 < x1)) return true;
    for (let x = x0; x <= x1; x += TILE / 2) if (!isStreetAt(this.level, x)) return true;
    if (this.level.cars.some((c) => c.x1 > x0 && c.x0 < x1)) return true;
    if (this.level.glass.some((g) => g.x1 > x0 && g.x0 < x1)) return true;
    return false;
  }

  private spawn(s: Spawn): void {
    const x0 = s.at + (s.kind === 'oncoming' ? TRAFFIC.aheadOncoming : TRAFFIC.aheadRobotaxi);
    const [w, h] = vehicleSize(s.kind);
    //a truck needs street for its tailgate behind it too
    const back = s.kind === 'truck' ? TRAFFIC.tailgate : 0;
    if (x0 + w > this.level.exitX || this.blockedAt(x0 - TILE - back, x0 + w + TILE)) return;
    //nor just off the foot of a stretch of hill, where you come down too fast to deal with it
    if (inHill(this.level, x0 - TRAFFIC.offHill)) return;
    const bottom = this.level.streetY;
    this.vehicles.push({
      id: this.ids++, kind: s.kind, speed: s.speed, cruise: s.speed, lane: 0, leaving: false,
      x0, x1: x0 + w, bottom, roof: bottom - h,
      ...(s.kind === 'truck' ? { kicker: TRAFFIC.tailgate } : {}),
    });
  }

  step(skaterX: number): void {
    for (const [i, c] of this.cross.entries()) {
      c.step(skaterX);
      if (c.turned) this.turnIn(c, i);
    }
    for (const h of this.hillCross) h.step(skaterX);
    for (const c of this.cabs) c.step(skaterX);
    while (this.next < this.plan.length && skaterX >= this.plan[this.next].at) this.spawn(this.plan[this.next++]);
    while (this.nextStop < this.stops.length && skaterX >= this.stops[this.nextStop].trigger) this.pullIn(this.stops[this.nextStop++]);
    for (const d of this.doors) d.step(skaterX);

    for (const v of this.vehicles) {
      if (v.tunnel !== undefined) {
        this.intoTunnel(v);
        continue;
      }
      if (v.stop) {
        this.atStop(v, v.stop);
        continue;
      }
      if (v.wrecked) {
        //rolling to a stop (the floor sim slows it) as it drifts out of the lane
      } else if (v.kind === 'car') v.speed += (v.cruise - v.speed) * 0.04; // pulling away from the corner
      else if (v.speed > 0 && !v.leaving && !(this.noBrake && v.kind === 'robotaxi')) {
        //brake hard when the skater rolls up behind
        const gap = v.x0 - skaterX;
        const target = gap > 0 && gap < TRAFFIC.brakeRange ? PHYS.baseSpeed * TRAFFIC.brakeSpeed : v.cruise;
        v.speed += (target - v.speed) * 0.15;
      }
      v.x0 += v.speed;
      v.x1 += v.speed;
      //pull out of the lane before anything the street can't carry
      if (!v.leaving) {
        const ahead = v.speed >= 0 ? [v.x1, v.x1 + TRAFFIC.clearance] : [v.x0 - TRAFFIC.clearance, v.x0];
        if (this.blockedAt(ahead[0], ahead[1]) || this.busAt(v, ahead[0], ahead[1])) v.leaving = true;
      }
      if (v.leaving) v.lane = Math.min(1, v.lane + 1 / TRAFFIC.laneFrames);
      //out of the lane and up to a tunnel's mouth at the foot of a hill: it turns in rather than drive into it
      if (v.leaving && !v.wrecked && v.lane > 0.5) {
        const m = mouths(this.level).find((t) => (v.speed > 0 ? t.way === 'in' && v.x1 >= mouthX(t) - TILE && v.x0 < mouthX(t) : t.way === 'out' && v.x0 <= mouthX(t) + TILE && v.x1 > mouthX(t)));
        if (m) v.tunnel = 0;
      }
    }
    //drop vehicles far behind the skater, gone into a tunnel, or (with no tunnel there) gone from the lane into
    //the hillside itself
    this.vehicles = this.vehicles.filter((v) => v.x1 > skaterX - 40 * TILE && v.x0 < skaterX + 60 * TILE && !((v.tunnel ?? 0) >= 1) && !(v.lane >= 1 && this.inHillside(v)));
  }

  // a vehicle stood in the hill, not on street-height ground
  private inHillside(v: Vehicle): boolean {
    const high = (x: number) => (groundAt(this.level, x) ?? 0) > TUNNEL.flat;
    return inHill(this.level, v.x0) && inHill(this.level, v.x1) && (high(v.x0) || high(v.x1));
  }

  // swinging into a tunnel's mouth: slowing, its middle drawn round to the opening
  private intoTunnel(v: Vehicle): void {
    const m = mouths(this.level).find((t) => Math.abs(mouthX(t) - (v.x0 + v.x1) / 2) < (TUNNEL.w + 3) * TILE);
    v.tunnel = Math.min(1, (v.tunnel ?? 0) + 1 / TUNNEL.turnFrames);
    const dx = m ? (mouthX(m) - (v.x0 + v.x1) / 2) * 0.12 : v.speed;
    v.speed = dx;
    v.x0 += dx;
    v.x1 += dx;
  }

  // a cross street's car has turned onto the road: from here it's traffic, driving your way
  private turnIn(c: CrossCar, i: number): void {
    const cruise = PHYS.baseSpeed * CROSS.speed;
    this.vehicles.push({
      id: this.ids++, kind: 'car', speed: cruise * 0.3, cruise, lane: 0, leaving: false, look: i,
      x0: c.box.x0, x1: c.box.x1, bottom: c.box.bottom, roof: c.box.roof,
    });
  }

  // a bus at its stop, in the way of another vehicle
  private busAt(v: Vehicle, x0: number, x1: number): boolean {
    return this.vehicles.some((b) => b !== v && b.stop && b.lane < 0.5 && b.x1 > x0 && b.x0 < x1);
  }

  // a bus comes up the back lane to its stop
  private pullIn(s: BusStop): void {
    const bottom = this.level.streetY;
    const x0 = s.x - STOP.pullFrom;
    this.vehicles.push({
      id: this.ids++, kind: 'bus', speed: 0, cruise: PHYS.baseSpeed * TRAFFIC.busSpeed, lane: 1, leaving: false,
      x0, x1: x0 + TRAFFIC.busW, bottom, roof: bottom - TRAFFIC.busH, stop: { x: s.x, t: 0 },
    });
  }

  // pulling in (easing into the skate lane and to a stop), then the dwell, then it's traffic again
  private atStop(v: Vehicle, stop: { x: number; t: number }): void {
    stop.t++;
    const k = Math.min(1, stop.t / STOP.pullFrames);
    const ease = 1 - (1 - k) * (1 - k);
    const x0 = stop.x - STOP.pullFrom * (1 - ease);
    v.speed = x0 - v.x0;
    v.x0 = x0;
    v.x1 = x0 + TRAFFIC.busW;
    v.lane = 1 - ease;
    if (stop.t >= STOP.pullFrames + STOP.dwell) {
      //pulling away: it eases up to its cruise like any bus
      v.stop = undefined;
      v.lane = 0;
      v.speed = v.cruise * 0.1;
    }
  }

  // signalling: a bus on its way into a stop, for the view's blinker
  get signalling(): Vehicle[] {
    return this.vehicles.filter((v) => v.stop && v.stop.t < STOP.pullFrames + STOP.dwell);
  }

  // vehicles the skater can touch: under half out in the back lane. One pulling out stays solid until it's half
  // out, the way a bus pulling in turns solid at half in (a roof doesn't vanish under you the frame it signals)
  get inLane(): Vehicle[] {
    return this.vehicles.filter((v) => v.lane < 0.5);
  }

  // open car doors, as boxes to hit or land on
  get doorBoxes(): Car[] {
    return this.doors.filter((d) => d.solid).map((d) => d.box);
  }

  // cross traffic in the skate lane right now (the street's and the hill's), and the cabs in it
  get crossing(): Car[] {
    const out = this.cross.filter((c) => c.inLane).map((c) => c.box);
    for (const h of this.hillCross) out.push(...h.inLane);
    for (const c of this.cabs) if (c.solid) out.push(c.box);
    return out;
  }
}
