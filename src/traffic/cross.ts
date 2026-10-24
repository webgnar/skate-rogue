// Cross traffic (GDD: Traffic): at intersections, cars come out of the cross street and turn onto your road.
// Logged overnight (2026-10-24): from floor 5, a floor gets an intersection or two on open street. Each has a
// traffic light and a car that pulls out when the skater comes within range, timed from the floor seed so it
// sometimes blocks the lane as you arrive (ollie it, or land on its roof for a car hop), sometimes is just turning,
// and sometimes you beat it out. zack: it turns onto the skater's road, your way, and drives off as a car you catch
// and can car-hop like any other. The light turns red the moment it pulls off, and the car shows in the back lane
// for over a second first, so it's always readable. Then it keeps cycling. Pure.
import { makeRng } from '../gen/rng';
import { PHYS, TILE } from '../physics/constants';
import { isStreetAt, type Car, type Level } from '../physics/level';

export const CROSS = {
  from: 5, // floors with cross traffic
  w: 1.6 * TILE, // the car seen nose-on: its width along the street
  h: 40,
  laneZ: 0.9, // tiles either side of the skate lane's middle that count as in the lane
  startZ: -9, // tiles: up the cross street it comes from
  speedZ: 0.06, // tiles per frame out to the skate lane
  turnFrames: 30, // then it swings round onto your road, your way
  period: 260, // frames between cars once it starts cycling: 180 out and turning, then a gap on green
  speed: 0.45, // share of base speed it drives off at, once it's turned
  stopPast: 30 * TILE, // no more cars once the skater is this far past
  clear: 4 * TILE, // open street needed either side
  every: 40 * TILE, // at most one intersection per this much street
  street: 1.6, // tiles: half the cross street's width, either side of the car's middle
};

// frames from pulling off to reaching the skate lane, and to its middle (where it turns)
export const ARRIVE = (-CROSS.laneZ - CROSS.startZ) / CROSS.speedZ;
export const TURN_AT = Math.round(-CROSS.startZ / CROSS.speedZ);
const GONE_AT = TURN_AT + CROSS.turnFrames;

export interface Intersection {
  x: number; // the car's left edge
  trigger: number; // starts across when the skater passes this x
}

export class CrossCar {
  z: number = CROSS.startZ;
  turn = 0; // 0 nose to the camera, 1 turned onto your road
  t = -1; // frames since it pulled off; -1 waiting
  turned = false; // this step it finished turning: the traffic takes it from here
  stopped = false; // the skater is well past: no more cars
  readonly box: Car;
  private readonly mid: number;

  constructor(
    readonly at: Intersection,
    streetY: number,
  ) {
    this.mid = at.x + CROSS.w / 2;
    this.box = { x0: at.x, x1: at.x + CROSS.w, roof: streetY - CROSS.h, bottom: streetY };
  }

  // out on the street this cycle (not yet handed to the traffic)
  get out(): boolean {
    return this.t >= 0 && this.t % CROSS.period < GONE_AT && !this.stopped;
  }

  get inLane(): boolean {
    return this.out && Math.abs(this.z) < CROSS.laneZ;
  }

  // will it be in the lane `frames` from now?
  inLaneIn(frames: number): boolean {
    if (this.t < 0 || this.stopped) return false;
    const k = (this.t + frames) % CROSS.period;
    return k >= ARRIVE && k < GONE_AT;
  }

  zAt(t: number): number {
    return Math.min(0, CROSS.startZ + (t % CROSS.period) * CROSS.speedZ);
  }

  // red for the skater's street while a car is pulling out or about to
  get red(): boolean {
    return this.out;
  }

  step(skaterX: number): void {
    this.turned = false;
    if (this.t < 0) {
      if (skaterX >= this.at.trigger) this.t = 0;
      else return;
    } else this.t++;
    const k = this.t % CROSS.period;
    //a new car pulls out only while the skater is still near
    if (k === 0 && skaterX > this.mid + CROSS.stopPast) this.stopped = true;
    this.z = this.zAt(this.t);
    this.turn = Math.min(1, Math.max(0, (k + 1 - TURN_AT) / CROSS.turnFrames));
    //its length swings from nose-on to side-on as it turns
    const w = CROSS.w + (TRAFFIC_CAR_W - CROSS.w) * this.turn;
    this.box.x0 = this.mid - w / 2;
    this.box.x1 = this.mid + w / 2;
    if (k === GONE_AT - 1 && !this.stopped) this.turned = true;
  }
}

const TRAFFIC_CAR_W = 2 * TILE; // the length of a car on the road (TRAFFIC.carW)

// where a floor's intersections go: open flat street, away from canals, parked cars, glass and the gate
export function crossPlan(level: Level, seed: number): Intersection[] {
  const floor = level.layout.floor;
  if (floor < CROSS.from || level.escape) return [];
  const rng = makeRng(seed * 17 + floor * 7919);
  const open = (x0: number, x1: number) => {
    for (let x = x0; x <= x1; x += TILE / 2) if (!isStreetAt(level, x)) return false;
    if (level.cars.some((c) => c.x1 > x0 && c.x0 < x1)) return false;
    return !level.glass.some((g) => g.x1 > x0 && g.x0 < x1);
  };
  const out: Intersection[] = [];
  let x = level.finaleX + 12 * TILE + Math.floor(rng() * 16) * TILE;
  while (x < level.exitX - 12 * TILE) {
    if (open(x - CROSS.clear, x + CROSS.w + CROSS.clear)) {
      //when the skater (at cruising speed) gets here relative to the car reaching the lane: -15 = just ahead of
      //it, 0-30 = it's in the lane, past 35 = it's clearing
      const k = -15 + Math.floor(rng() * 55);
      out.push({ x, trigger: x - PHYS.baseSpeed * (ARRIVE + k) });
      x += CROSS.every + Math.floor(rng() * 16) * TILE;
    } else x += 2 * TILE;
  }
  return out;
}
