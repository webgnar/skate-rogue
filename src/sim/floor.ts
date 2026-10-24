// One floor of a run, stepped at 60 Hz: traffic, then the skater, pickups, then Heat. Pure, so the game, the
// validator's bot and tests all run the same thing.
import type { Mods } from '../boons/mods';
import { BOARD, fires, type EffectId, type Slots, type TriggerId } from '../board/mods';
import { PHYS, TILE } from '../physics/constants';
import { Heat, HEAT } from '../heat/heat';
import { Chopper, CHOPPER } from './chopper';
import { Swarm } from './drones';
import type { Car, Level, PickupKind } from '../physics/level';
import { PROP_SIZE } from '../gen/props';
import { Skater, type Mode, type SkaterEvent, type StepInput } from '../physics/skater';
import { spawnPlan, Traffic } from '../traffic/traffic';
import { crossed, freshGear, GEAR, GEAR_PARTS, gearScale, type Gear, type GearPart } from '../run/gear';

export type FloorState = 'skate' | 'bail' | 'exit' | 'caught';

export type FloorEvent =
  | SkaterEvent
  | { type: 'pickup'; kind: PickupKind; index: number }
  | { type: 'mod'; effect: EffectId; slot: number } // a board mod fired
  | { type: 'drone'; index: number } // stomped a drone out of the sky
  | { type: 'near' } // a close call: cleared a vehicle by a few px without touching it
  | { type: 'decoy' } // the Decoy boon pulled the cruiser back
  | { type: 'slip' } // Slipstream: drafted a car long enough for a burst
  | { type: 'wear'; part: GearPart; level: 'worn' | 'busted' } // a part of your gear just wore past a line
  | { type: 'smash'; index: number; prop: string; x: number; y: number; how: SmashHow; loot?: 'cash' | 'stoken' };

// how a prop got smashed (GDD: Smashables), for the effects to tell apart
export type SmashHow = 'roll' | 'land' | 'grind' | 'hop' | 'slam' | 'bomb';

export const SMASH = {
  bigLanding: 8, // px/frame of fall: a landing this hard breaks everything near you
  landReach: 2 * TILE,
  bombReach: 5 * TILE, // a kicker's bomb blows props away this far ahead
  slamReach: 1.5 * TILE,
  aiCool: 3, // Heat off for smashing the AI's stuff
};

// which board trigger a skater event is
const TRIGGERS: Partial<Record<SkaterEvent['type'], TriggerId>> = {
  ollie: 'onOllie',
  land: 'onLand',
  grind: 'onGrind',
  rail: 'onGrind',
  trick: 'onTrick',
  hop: 'onHop',
};

export const SLIP = { reach: 4 * TILE }; // Slipstream: how close behind a car counts as drafting
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
  private slipT = 0; // frames drafting behind a car
  readonly broken: boolean[]; // props smashed
  private fall = 0; // how fast we were falling before this step
  readonly gear: Gear; // worn down as you skate; the run takes it to the next floor
  private near = new Map<Car, { gap: number; touched: boolean }>(); // vehicles we're over: the closest pass, and any contact

  constructor(
    readonly level: Level,
    mods?: Mods,
    startHeat = 0,
    readonly board: Slots = [],
    gear: Gear = freshGear(),
  ) {
    this.skater = new Skater(level, mods);
    this.gear = { ...gear };
    this.skater.gear = gearScale(this.gear);
    this.heat.value = startHeat;
    if (mods) this.heat.mods = { rise: mods.heatRise, hopCool: mods.hopCool, decoy: mods.decoy, slow: mods.slowHeat, airCool: mods.airCool };
    this.taken = level.pickups.map(() => false);
    this.broken = level.props.map(() => false);
    const esc = level.escape;
    this.chopper = esc?.chopperFrom !== undefined ? new Chopper(esc.chopperFrom, esc.covers, level.startX) : null;
    this.swarm = esc?.drones ? new Swarm(esc.drones, level.streetY) : null;
    //traffic comes from the layout's own seed, so a re-rolled floor gets re-rolled traffic too
    this.traffic = new Traffic(level, spawnPlan(level, level.layout.seed), level.crossings);
    this.traffic.noBrake = mods?.spoofed ?? false;
  }

  step(input: StepInput): void {
    if (this.state !== 'skate') return;
    this.traffic.step(this.skater.x);
    this.swarm?.step(this.skater);
    this.fall = this.skater.mode === 'air' ? this.skater.vsp : 0;
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
    this.slipstream();
    this.smash(skaterEvents);
    this.wear(skaterEvents);
    this.heat.step(this.skater, skaterEvents);
    //in the helicopter's light, the Heat climbs
    if (this.chopper?.step(this.skater)) this.heat.add(CHOPPER.heatPerSec / 60);
    if (this.heat.decoyFired) this.events.push({ type: 'decoy' });
    if (this.skater.mode === 'bail') this.state = 'bail';
    else if (this.skater.mode === 'exit') {
      this.state = 'exit';
      //on (or above) the overpass at the gate = the high road
      const fork = this.level.fork;
      this.road = fork && this.skater.y <= fork.y + 1 ? 'high' : 'low';
    } else if (this.heat.caught) this.state = 'caught';
  }

  // which road the skater is on right now, once they reach the fork's overpass (null before it, or no fork)
  get roadAhead(): 'high' | 'low' | null {
    const fork = this.level.fork;
    if (!fork || this.skater.x < fork.x0) return null;
    return this.skater.y <= fork.y + 1 ? 'high' : 'low';
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
        if (!n.touched && n.gap >= 0 && n.gap < NEAR_MISS * this.skater.mods.nearScale) {
          this.events.push({ type: 'near' });
          this.heat.add(HEAT.nearMiss);
        }
      }
    }
  }

  // Slipstream: rolling within a few tiles behind a car going your way builds a draft; held long enough, it
  // throws you forward with a burst of speed (then ollie it)
  private slipstream(): void {
    const sk = this.skater;
    const need = sk.mods.slipFrames;
    if (!need) return;
    const drafting = sk.mode === 'roll' && !sk.surface && this.traffic.inLane.some((v) => v.speed > 0 && v.x0 - sk.x > 0 && v.x0 - sk.x < SLIP.reach);
    this.slipT = drafting ? this.slipT + 1 : 0;
    if (this.slipT >= need) {
      this.slipT = 0;
      sk.hsp = Math.max(sk.hsp, PHYS.bombSpeed);
      sk.carry = Math.max(sk.carry, PHYS.bombSpeed);
      this.events.push({ type: 'slip' });
    }
  }

  // smashables: skate through them, land hard near them, grind them off a ledge, slam into them, bomb past them
  private smash(events: readonly SkaterEvent[]): void {
    const props = this.level.props;
    if (!props.length) return;
    const sk = this.skater;
    const has = (t: SkaterEvent['type']) => events.some((e) => e.type === t);
    const slam = has('slam');
    const land = has('land');
    const bombing = sk.carry >= PHYS.bombSpeed - 0.5;
    const how: SmashHow = slam ? 'slam' : sk.mode === 'grind' || sk.mode === 'rail' ? 'grind' : has('hop') ? 'hop' : land ? 'land' : bombing ? 'bomb' : 'roll';
    const half = PHYS.width / 2;
    props.forEach((p, i) => {
      if (!p.breaks || this.broken[i]) return;
      const size = PROP_SIZE[p.name] ?? { w: 8, h: 16 };
      const dx = p.x - sk.x;
      //on the same ground (within a step) and side by side
      const level = Math.abs(sk.y - p.y) < 10;
      let by: SmashHow | null = null;
      const touching = Math.abs(dx) < size.w + half && sk.y > p.y - size.h && sk.y - PHYS.height < p.y;
      if (touching) by = how;
      else if (land && this.fall >= SMASH.bigLanding && level && Math.abs(dx) < SMASH.landReach) by = 'land';
      else if (slam && level && Math.abs(dx) < SMASH.slamReach) by = 'slam';
      else if (has('kicker') && dx > 0 && dx < SMASH.bombReach && Math.abs(p.y - this.level.streetY) < 2) by = 'bomb';
      if (!by) return;
      this.broken[i] = true;
      this.events.push({ type: 'smash', index: i, prop: p.name, x: p.x, y: p.y, how: by, ...(p.loot ? { loot: p.loot } : {}) });
      if (p.ai) this.heat.add(-SMASH.aiCool);
    });
  }

  // gear wear: the deck from ollies, the shoes from flip tricks, the trucks from grinding, the wheels from speed
  private wear(events: readonly SkaterEvent[]): void {
    const sk = this.skater;
    const use: Gear = { deck: 0, shoes: 0, trucks: 0, wheels: 0 };
    for (const e of events) {
      if (e.type === 'ollie') use.deck += GEAR.ollie;
      else if (e.type === 'trick') use.shoes += GEAR.flip;
    }
    if (isGrind(sk.mode)) use.trucks += GEAR.grindSec / 60;
    const speed = Math.abs(sk.mode === 'rail' ? sk.railV : sk.hsp);
    if (speed > PHYS.baseSpeed * sk.mods.speedScale * GEAR.fastOver) use.wheels += GEAR.fastSec / 60;
    let changed = false;
    for (const part of GEAR_PARTS) {
      if (!use[part]) continue;
      const before = this.gear[part];
      this.gear[part] = Math.max(0, before - use[part] * sk.mods.wearScale);
      const line = crossed(before, this.gear[part]);
      if (line) this.events.push({ type: 'wear', part, level: line });
      changed = true;
    }
    if (changed) sk.gear = gearScale(this.gear);
  }

  private collect(): void {
    const sk = this.skater;
    const reach = PICKUP_RADIUS * sk.mods.magnet;
    const r2 = reach * reach;
    this.level.pickups.forEach((p, i) => {
      if (this.taken[i] || Math.abs(p.x - sk.x) > reach) return;
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
