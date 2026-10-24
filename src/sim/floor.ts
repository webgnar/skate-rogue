// One floor of a run, stepped at 60 Hz: traffic, then the skater, pickups, then Heat. Pure, so the game, the
// validator's bot and tests all run the same thing.
import type { Mods } from '../boons/mods';
import { BOARD, fires, type EffectId, type Slots, type TriggerId } from '../board/mods';
import { PHYS, TILE } from '../physics/constants';
import { Heat, HEAT } from '../heat/heat';
import { Chopper, CHOPPER } from './chopper';
import { Swarm } from './drones';
import type { Car, Level, PickupKind } from '../physics/level';
import { Skater, type Mode, type SkaterEvent, type StepInput } from '../physics/skater';
import { spawnPlan, Traffic } from '../traffic/traffic';
import { crossPlan } from '../traffic/cross';

export type FloorState = 'skate' | 'bail' | 'exit' | 'caught';

export type FloorEvent =
  | SkaterEvent
  | { type: 'pickup'; kind: PickupKind; index: number }
  | { type: 'mod'; effect: EffectId; slot: number } // a board mod fired
  | { type: 'drone'; index: number } // stomped a drone out of the sky
  | { type: 'near' }; // a close call: cleared a vehicle by a few px without touching it

// which board trigger a skater event is
const TRIGGERS: Partial<Record<SkaterEvent['type'], TriggerId>> = {
  ollie: 'onOllie',
  land: 'onLand',
  grind: 'onGrind',
  rail: 'onGrind',
  trick: 'onTrick',
  hop: 'onHop',
};

export const NEAR_MISS = 10; // px of air between your wheels and a roof that counts as a close call
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
  readonly chopper: Chopper | null; // the helicopter escape's spotlight
  readonly swarm: Swarm | null; // the drone swarm escape
  private pops: number[] = []; // frames until each Double Pop
  private wasGrinding = false;
  private near = new Map<Car, { gap: number; touched: boolean }>(); // vehicles we're over: the closest pass, and any contact

  constructor(
    readonly level: Level,
    mods?: Mods,
    startHeat = 0,
    readonly board: Slots = [],
  ) {
    this.skater = new Skater(level, mods);
    this.heat.value = startHeat;
    this.taken = level.pickups.map(() => false);
    const esc = level.escape;
    this.chopper = esc?.chopperFrom !== undefined ? new Chopper(esc.chopperFrom, esc.covers, level.startX) : null;
    this.swarm = esc?.drones ? new Swarm(esc.drones, level.streetY) : null;
    //traffic comes from the layout's own seed, so a re-rolled floor gets re-rolled traffic too
    this.traffic = new Traffic(level, spawnPlan(level, level.layout.seed), crossPlan(level, level.layout.seed));
  }

  step(input: StepInput): void {
    if (this.state !== 'skate') return;
    this.traffic.step(this.skater.x);
    this.swarm?.step(this.skater);
    const crossing = this.traffic.crossing;
    this.skater.movers = this.swarm || crossing.length ? [...this.traffic.inLane, ...crossing, ...(this.swarm?.boxes ?? [])] : this.traffic.inLane;
    this.skater.step(input);
    const skaterEvents = this.skater.events.slice();
    this.skater.events.length = 0;
    this.events = skaterEvents;
    if (this.swarm?.stomp(this.skater, skaterEvents)) {
      for (const e of this.swarm.events) if (e.type === 'down') this.events.push({ type: 'drone', index: e.index });
    }
    this.runBoard(skaterEvents);
    this.collect();
    this.closeCalls(skaterEvents);
    this.heat.step(this.skater, skaterEvents);
    //in the helicopter's light, the Heat climbs
    if (this.chopper?.step(this.skater)) this.heat.value = Math.min(100, this.heat.value + CHOPPER.heatPerSec / 60);
    if (this.skater.mode === 'bail') this.state = 'bail';
    else if (this.skater.mode === 'exit') {
      this.state = 'exit';
      //on (or above) the overpass at the gate = the high road
      const fork = this.level.fork;
      this.road = fork && this.skater.y <= fork.y + 1 ? 'high' : 'low';
    } else if (this.heat.caught) this.state = 'caught';
  }

  // the board: each trigger event fires its effects; effects on the skater and traffic land here, the rest
  // (sparks, cash, slow-mo) go out as events for the run and the view
  private runBoard(events: readonly SkaterEvent[]): void {
    const sk = this.skater;
    this.pops = this.pops.filter((t) => {
      if (t > 1) return true;
      if (sk.mode === 'air') sk.vsp = Math.min(sk.vsp, PHYS.ollie * BOARD.doublePop);
      return false;
    }).map((t) => t - 1);
    const grinding = isGrind(sk.mode);
    const triggers: TriggerId[] = [];
    for (const e of events) {
      const t = TRIGGERS[e.type];
      if (t) triggers.push(t);
    }
    if (this.wasGrinding && !grinding && sk.mode !== 'bail' && sk.mode !== 'exit') triggers.unshift('onGrindEnd');
    this.wasGrinding = grinding;
    for (const t of triggers) {
      for (const f of fires(this.board, t)) {
        this.apply(f.effect);
        this.events.push({ type: 'mod', effect: f.effect, slot: f.slot });
      }
    }
  }

  private apply(effect: EffectId): void {
    const sk = this.skater;
    switch (effect) {
      case 'doublePop':
        this.pops.push(BOARD.doublePopFrames);
        break;
      case 'speedKick':
        //kicks stack, up to a cap
        if (sk.mode === 'rail') sk.railV = Math.min(PHYS.railMax, sk.railV + BOARD.speedKick);
        else sk.hsp = Math.max(sk.hsp, Math.min(BOARD.speedKickMax, sk.hsp + BOARD.speedKick));
        sk.carry = Math.max(sk.carry, Math.abs(sk.mode === 'rail' ? sk.railV : sk.hsp));
        break;
      case 'jumpRefill':
        sk.spare += BOARD.jumpRefill;
        break;
      case 'gravFlip':
        if (sk.mode === 'air') sk.gravFlipT = BOARD.gravFlipFrames;
        break;
      case 'shockwave':
        for (const v of this.traffic.vehicles) {
          if (Math.abs((v.x0 + v.x1) / 2 - sk.x) < BOARD.shockwaveTiles * TILE) v.leaving = true;
        }
        break;
    }
  }

  // close calls: over a vehicle (or it under you) the whole way in the air, the wheels within a few px of its roof
  private closeCalls(events: readonly SkaterEvent[]): void {
    const sk = this.skater;
    const half = PHYS.width / 2;
    const contact = sk.mode !== 'air' || events.some((e) => e.type === 'hop' || e.type === 'slam' || e.type === 'kicker');
    const cars = sk.movers.length ? [...this.level.cars, ...sk.movers] : this.level.cars;
    for (const c of cars) {
      const over = sk.x + half > c.x0 && sk.x - half < c.x1;
      const n = this.near.get(c);
      if (over) {
        const touched = contact || sk.hitCars.has(c);
        if (!n) this.near.set(c, { gap: c.roof - sk.y, touched });
        else {
          n.gap = Math.min(n.gap, c.roof - sk.y);
          n.touched ||= touched;
        }
      } else if (n) {
        this.near.delete(c);
        if (!n.touched && n.gap >= 0 && n.gap < NEAR_MISS) {
          this.events.push({ type: 'near' });
          this.heat.value = Math.max(0, this.heat.value + HEAT.nearMiss);
        }
      }
    }
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

function isGrind(mode: Mode): boolean {
  return mode === 'grind' || mode === 'rail';
}
