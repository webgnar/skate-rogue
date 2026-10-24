// One floor of a run, stepped at 60 Hz: traffic, then the skater, then Heat. Pure, so the game, the validator's
// bot and tests all run the same thing.
import type { Mods } from '../boons/mods';
import { Heat } from '../heat/heat';
import type { Level } from '../physics/level';
import { Skater, type SkaterEvent, type StepInput } from '../physics/skater';
import { spawnPlan, Traffic } from '../traffic/traffic';

export type FloorState = 'skate' | 'bail' | 'exit' | 'caught';

export class FloorSim {
  readonly skater: Skater;
  readonly traffic: Traffic;
  readonly heat = new Heat();
  events: SkaterEvent[] = [];
  state: FloorState = 'skate';

  constructor(
    readonly level: Level,
    mods?: Mods,
  ) {
    this.skater = new Skater(level, mods);
    //traffic comes from the layout's own seed, so a re-rolled floor gets re-rolled traffic too
    this.traffic = new Traffic(level, spawnPlan(level, level.layout.seed));
  }

  step(input: StepInput): void {
    if (this.state !== 'skate') return;
    this.traffic.step(this.skater.x);
    this.skater.movers = this.traffic.inLane;
    this.skater.step(input);
    this.events = this.skater.events.slice();
    this.skater.events.length = 0;
    this.heat.step(this.skater, this.events);
    if (this.skater.mode === 'bail') this.state = 'bail';
    else if (this.skater.mode === 'exit') this.state = 'exit';
    else if (this.heat.caught) this.state = 'caught';
  }
}
