// One floor of a run, stepped at 60 Hz: traffic, then the skater, pickups, then Heat. Pure, so the game, the
// validator's bot and tests all run the same thing.
import type { Mods } from '../boons/mods';
import { Heat } from '../heat/heat';
import type { Level, PickupKind } from '../physics/level';
import { Skater, type SkaterEvent, type StepInput } from '../physics/skater';
import { spawnPlan, Traffic } from '../traffic/traffic';

export type FloorState = 'skate' | 'bail' | 'exit' | 'caught';

export type FloorEvent = SkaterEvent | { type: 'pickup'; kind: PickupKind; index: number };

export const PICKUP_RADIUS = 26; // px around the skater's middle
const BODY = 24; // the skater's middle, above their feet

export class FloorSim {
  readonly skater: Skater;
  readonly traffic: Traffic;
  readonly heat = new Heat();
  events: FloorEvent[] = [];
  state: FloorState = 'skate';
  readonly taken: boolean[]; // pickups collected
  road: 'high' | 'low' | null = null; // which road the skater left the floor on

  constructor(
    readonly level: Level,
    mods?: Mods,
    startHeat = 0,
  ) {
    this.skater = new Skater(level, mods);
    this.heat.value = startHeat;
    this.taken = level.pickups.map(() => false);
    //traffic comes from the layout's own seed, so a re-rolled floor gets re-rolled traffic too
    this.traffic = new Traffic(level, spawnPlan(level, level.layout.seed));
  }

  step(input: StepInput): void {
    if (this.state !== 'skate') return;
    this.traffic.step(this.skater.x);
    this.skater.movers = this.traffic.inLane;
    this.skater.step(input);
    const skaterEvents = this.skater.events.slice();
    this.skater.events.length = 0;
    this.events = skaterEvents;
    this.collect();
    this.heat.step(this.skater, skaterEvents);
    if (this.skater.mode === 'bail') this.state = 'bail';
    else if (this.skater.mode === 'exit') {
      this.state = 'exit';
      //on (or above) the overpass at the gate = the high road
      const fork = this.level.fork;
      this.road = fork && this.skater.y <= fork.y + 1 ? 'high' : 'low';
    } else if (this.heat.caught) this.state = 'caught';
  }

  private collect(): void {
    const sk = this.skater;
    const r2 = PICKUP_RADIUS * PICKUP_RADIUS;
    this.level.pickups.forEach((p, i) => {
      if (this.taken[i] || Math.abs(p.x - sk.x) > PICKUP_RADIUS) return;
      const dy = p.y - (sk.y - BODY);
      if ((p.x - sk.x) ** 2 + dy * dy > r2) return;
      this.taken[i] = true;
      this.events.push({ type: 'pickup', kind: p.kind, index: i });
    });
  }
}
