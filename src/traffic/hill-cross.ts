// Chinatown's cross traffic (zack, 2026-10-30: "a new kind of downhill section that includes cross traffic"): at each
// intersection on the way down a Chinatown block, cars drive straight across the cross street, both ways, through
// your lane. You can't stop, so you skate the gap, ollie the car, or land on its roof for a car hop. Unlike the
// street's cross cars (src/traffic/cross.ts) they never turn onto your road. A car comes in from the far end of the
// cross street, so it shows a beat before it reaches your lane; from the near end it comes out past the camera. The
// stream starts when you're on your way down to it, its gaps from the floor seed, and stops once you're past. Pure.
import { makeRng } from '../gen/rng';
import { TILE } from '../physics/constants';
import type { Car } from '../physics/level';

export const HILL_CROSS = {
  w: 1.6 * TILE, // seen nose-on, its width along your street (as the street's cross cars)
  h: 40,
  laneZ: 0.9, // tiles either side of the skate lane's middle that count as in the lane
  farZ: -10, // tiles: where a car comes from up the cross street, behind
  nearZ: 7, // and from the near end, past the camera
  speedZ: 0.085, // tiles per frame: a through street, quicker than a car pulling out to turn
  gap: [55, 120], // frames between cars, by seed
  nearShare: 0.4, // of the cars, coming from the near end
  trigger: 30 * TILE, // the stream starts when you're this far up the hill from it
  stopPast: 12 * TILE, // and no new cars once you're this far past
  redZ: 5, // tiles: the light's red for you while a car's this close to your lane
};

export interface HillCar {
  t0: number; // the frame it set off
  dir: 1 | -1; // 1 from the far end toward the camera, -1 from the near end away
  look: number; // its paint
  z: number;
  readonly box: Car;
}

export class HillCross {
  cars: HillCar[] = [];
  private t = -1; // frames since the stream started; -1 waiting
  private next = 0; // the frame the next car sets off
  private stopped = false;
  private readonly rng;
  private looks = 0;

  constructor(
    readonly x: number, // the cross street's middle
    readonly y: number, // the ground's height
    seed: number,
  ) {
    this.rng = makeRng(seed);
    //the first car sets off partway into the stream, so the timing at your arrival changes with the seed
    this.next = Math.floor(this.rng() * HILL_CROSS.gap[1]);
  }

  step(skaterX: number): void {
    if (this.t < 0) {
      if (skaterX < this.x - HILL_CROSS.trigger) return;
      this.t = 0;
    } else this.t++;
    if (skaterX > this.x + HILL_CROSS.stopPast) this.stopped = true;
    if (!this.stopped && this.t >= this.next) {
      const dir = this.rng() < HILL_CROSS.nearShare ? -1 : 1;
      const half = HILL_CROSS.w / 2;
      this.cars.push({ t0: this.t, dir, look: this.looks++, z: dir > 0 ? HILL_CROSS.farZ : HILL_CROSS.nearZ, box: { x0: this.x - half, x1: this.x + half, roof: this.y - HILL_CROSS.h, bottom: this.y } });
      const [lo, hi] = HILL_CROSS.gap;
      this.next = this.t + lo + Math.floor(this.rng() * (hi - lo));
    }
    for (const c of this.cars) c.z = (c.dir > 0 ? HILL_CROSS.farZ : HILL_CROSS.nearZ) + c.dir * (this.t - c.t0) * HILL_CROSS.speedZ;
    this.cars = this.cars.filter((c) => (c.dir > 0 ? c.z < HILL_CROSS.nearZ : c.z > HILL_CROSS.farZ));
  }

  // red for you while a car is close to your lane
  get red(): boolean {
    return this.cars.some((c) => Math.abs(c.z) < HILL_CROSS.redZ);
  }

  // the cars in your lane right now
  get inLane(): Car[] {
    return this.cars.filter((c) => Math.abs(c.z) < HILL_CROSS.laneZ).map((c) => c.box);
  }
}
