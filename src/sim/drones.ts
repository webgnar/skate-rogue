// The drone swarm escape (GDD: How a run ends, act 4): "drones dive in patterns; car-hop them to stay ahead."
// Logged overnight (2026-10-24): each drone waits high over the street ahead and, when the skater comes within
// range, dives down to hover across the skate lane at car-roof or head height. A drone is a car roof you can land
// on: stomping one is a car hop (refills your jumps, cools the Heat) and knocks it out of the sky. Ride into one
// and it's a slam. They come in patterns: a single, a pair to chain, a step up, and a head-high wall that needs an
// ollie and a flip. Pure, stepped at 60 Hz with the floor.
import { PHYS, TILE } from '../physics/constants';
import type { Car } from '../physics/level';
import type { Skater, SkaterEvent } from '../physics/skater';

export interface DroneSpot {
  x: number; // where it hovers (its left edge)
  h: number; // its roof above the street, px
}

export const DRONE = {
  w: 1.5 * TILE, // the solid box: wide enough that a plain ollie has a fair window to land on it
  h: TILE / 2,
  diveLead: 11 * TILE, // starts its dive when the skater is this close
  diveFrames: 30,
  from: 6 * TILE, // dives from this far above its hover height
  ahead: 3 * TILE, // and this far further on, swooping back toward the skater
  bob: 1.5, // px
};

// patterns of [tiles along, roof height px]. 40 is a parked car's roof (one ollie), 56 is past an ollie's 50 and
// low enough to hit your head: an ollie and a flip, or a hop off the drone before it
export const PATTERNS: Record<'single' | 'pair' | 'step' | 'wall', [number, number][]> = {
  single: [[0, 40]],
  pair: [[0, 40], [3.5, 40]],
  step: [[0, 40], [3, 64], [6.5, 40]],
  wall: [[0, 56]],
};

export type DroneState = 'wait' | 'dive' | 'hover' | 'down';

export class Drone {
  state: DroneState = 'wait';
  t = 0; // frames into the dive, or since it went down
  x: number;
  roof: number; // the solid box's top, y-down
  vx = 0;
  vy = 0;
  readonly box: Car;

  constructor(
    readonly spot: DroneSpot,
    readonly streetY: number,
  ) {
    this.x = spot.x + DRONE.ahead;
    this.roof = streetY - spot.h - DRONE.from;
    this.box = { x0: spot.x, x1: spot.x + DRONE.w, roof: streetY - spot.h, bottom: streetY - spot.h + DRONE.h };
  }

  get solid(): boolean {
    return this.state === 'hover';
  }
}

export class Swarm {
  readonly drones: Drone[];
  downed = 0;
  events: { type: 'dive' | 'down'; index: number }[] = [];
  private t = 0;

  constructor(spots: DroneSpot[], streetY: number) {
    this.drones = spots.map((s) => new Drone(s, streetY));
  }

  // the drones that are solid this step, as car boxes for the skater
  get boxes(): Car[] {
    return this.drones.filter((d) => d.solid).map((d) => d.box);
  }

  // before the skater moves: dives start and finish, hovering drones bob
  step(sk: Skater): void {
    this.events = [];
    this.t++;
    this.drones.forEach((d, i) => {
      const hoverRoof = d.streetY - d.spot.h;
      if (d.state === 'wait') {
        if (d.spot.x - sk.x < DRONE.diveLead && d.spot.x > sk.x) {
          d.state = 'dive';
          d.t = 0;
          this.events.push({ type: 'dive', index: i });
        }
      } else if (d.state === 'dive') {
        //an eased swoop down and back toward the skater
        const k = ++d.t / DRONE.diveFrames;
        const e = 1 - (1 - k) ** 3;
        d.x = d.spot.x + DRONE.ahead * (1 - e);
        d.roof = hoverRoof - DRONE.from * (1 - e);
        if (d.t >= DRONE.diveFrames) d.state = 'hover';
      } else if (d.state === 'hover') {
        d.x = d.spot.x;
        d.roof = hoverRoof + Math.sin((this.t + i * 17) / 9) * DRONE.bob;
        d.box.roof = d.roof;
        d.box.bottom = d.roof + DRONE.h;
      } else {
        //knocked down: tumbles away and drops off the street
        d.t++;
        d.vy += PHYS.grav;
        d.x += d.vx;
        d.roof += d.vy;
      }
    });
  }

  // after the skater moves: a hop off a hovering drone's roof knocks it out of the sky
  stomp(sk: Skater, events: readonly SkaterEvent[]): number {
    if (!events.some((e) => e.type === 'hop')) return 0;
    let n = 0;
    this.drones.forEach((d, i) => {
      if (!d.solid) return;
      const overX = sk.x + PHYS.width / 2 >= d.box.x0 && sk.x - PHYS.width / 2 <= d.box.x1;
      if (!overX || Math.abs(sk.y - d.box.roof) > 2) return;
      d.state = 'down';
      d.t = 0;
      d.vx = sk.hsp * 0.6;
      d.vy = 1.5;
      this.downed++;
      n++;
      this.events.push({ type: 'down', index: i });
    });
    return n;
  }
}

// lay out drone waves along a stretch of flat street, from x0 to x1: one pattern every so often
export function droneSpots(x0: number, x1: number, rnd: () => number): DroneSpot[] {
  const order: (keyof typeof PATTERNS)[] = ['single', 'pair', 'step', 'wall'];
  const spots: DroneSpot[] = [];
  let x = x0;
  let i = 0;
  while (x < x1 - 8 * TILE) {
    //the first two waves teach (a single, a pair), then any pattern
    const name = i < 2 ? order[i] : order[Math.floor(rnd() * order.length)];
    const pat = PATTERNS[name];
    for (const [dx, h] of pat) spots.push({ x: x + dx * TILE, h });
    const span = pat[pat.length - 1][0] * TILE + DRONE.w;
    x += span + (10 + Math.floor(rnd() * 5)) * TILE;
    i++;
  }
  return spots;
}
