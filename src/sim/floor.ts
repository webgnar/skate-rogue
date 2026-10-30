// One floor of a run, stepped at 60 Hz: traffic, then the skater, pickups, then Heat. Pure, so the game, the
// validator's bot and tests all run the same thing.
import type { Mods } from '../boons/mods';
import { BOARD, fires, type EffectId, type Slots, type TriggerId } from '../board/mods';
import { PHYS, TILE } from '../physics/constants';
import { Heat, HEAT } from '../heat/heat';
import { Chopper, CHOPPER } from './chopper';
import { TOP } from '../gen/top-route';
import { Chaser } from './chaser';
import { Shooter, type ShotEvent } from './shots';
import { Swarm } from './drones';
import type { Car, Level, PickupKind } from '../physics/level';
import { PROP_SIZE } from '../gen/props';
import { makeRng } from '../gen/rng';
import { Skater, type Mode, type SkaterEvent, type StepInput } from '../physics/skater';
import { spawnPlan, Traffic, type Vehicle } from '../traffic/traffic';
import { CAR_HEALTH, DAMAGE, parkedKind, stageOf, type CarRef, type DamageKind, type Stage } from '../traffic/damage';
import { ElTrain } from '../traffic/el';
import { Sky, SKY } from './sky';
import { crossed, freshGear, GEAR, GEAR_PARTS, gearScale, type Gear, type GearPart } from '../run/gear';

export type FloorState = 'skate' | 'bail' | 'exit' | 'caught';

export type FloorEvent =
  | SkaterEvent
  | { type: 'pickup'; kind: PickupKind; index: number }
  | { type: 'mod'; effect: EffectId; slot: number } // a board mod fired
  | { type: 'drone'; index: number } // stomped a drone out of the sky
  | { type: 'near' } // a close call: cleared a vehicle by a few px without touching it
  | { type: 'decoy' } // the Decoy boon pulled the cruiser back
  | { type: 'birds' } // a bird strike on the top route (src/sim/sky.ts)
  | { type: 'slip' } // Slipstream: drafted a car long enough for a burst
  | { type: 'doorSlam'; x: number; y: number } // a car hop slammed an open car door shut (px: the door's top)
  | { type: 'wear'; part: GearPart; level: 'worn' | 'busted' } // a part of your gear just wore past a line
  | { type: 'puddle'; x: number; y: number } // rolled into a puddle: it washes out the bearings
  | ShotEvent // the guards shooting at you on a chase (src/sim/shots.ts)
  | { type: 'smash'; index: number; prop: string; x: number; y: number; how: SmashHow; loot?: 'cash' | 'stoken' }
  // a car hop dented a car (src/traffic/damage.ts): x is its middle and y its roof, px; stage 3 is wrecked
  | { type: 'dent'; car: CarRef; kind: DamageKind; hits: number; health: number; stage: Stage; x: number; y: number };

// how a prop got smashed (GDD: Smashables), for the effects to tell apart
export type SmashHow = 'roll' | 'land' | 'grind' | 'hop' | 'slam' | 'bomb' | 'car'; // 'car': traffic ran it over

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

// the furthest any smash below can reach: a bomb, a big landing or a slam, or touching the widest prop
const SMASH_FAR = Math.max(SMASH.bombReach, SMASH.landReach, SMASH.slamReach, ...Object.values(PROP_SIZE).map((s) => s.w), 8) + PHYS.width / 2 + 1;

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
  up = false; // on the top route (src/gen/top-route.ts)
  readonly sky: Sky; // its pigeons and helicopter
  readonly swarm: Swarm | null; // the drone swarm escape
  readonly chaser: Chaser | null; // act 3's chaser
  readonly shooter: Shooter | null; // and its guards' guns
  readonly trains: ElTrain[]; // the L's trains, one line per stretch of track
  private pops: number[] = []; // frames until each Double Pop
  private wasGrinding = false;
  private later: { effect: EffectId; slot: number; t: number }[] = []; // board effects waiting to fire
  combo = 0; // the run's live combo count, set by the game each step (Combo Only reads it)
  // the puddle at (x, y), once it's formed enough to splash through (the view's own test: Puddles.at)
  puddleAt(x: number, y: number): object | null {
    const t = this.frames / 60;
    for (const p of this.puddles) {
      const g = Math.min(1, Math.max(0, (t - p.delay) / p.grow)) * p.k;
      if (g > 0.3 && Math.abs(p.y - y) < 0.2 * TILE && Math.abs(x - p.x) < p.w * (0.15 + 0.75 * g)) return p;
    }
    return null;
  }

  private readonly flip: () => number; // the board's coin flips, from the floor seed
  private slipT = 0; // frames drafting behind a car
  // Rain puddles (the view's, src/render/puddles.ts, set by the game on a rainy floor): rolling through one washes
  // out the bearings. x, y: centre and surface (px); w: half width when full (px); delay: seconds before it starts to form,
  // grow: seconds to form; k: how far it forms in a light rain (1 in a full one)
  puddles: { x: number; y: number; w: number; delay: number; grow: number; k: number }[] = [];
  private frames = 0; // steps this floor, for how formed the puddles are
  private wading: object | null = null; // the puddle we're rolling through
  readonly broken: boolean[]; // props smashed
  private fall = 0; // how fast we were falling before this step
  readonly gear: Gear; // worn down as you skate; the run takes it to the next floor
  private near = new Map<Car, { gap: number; touched: boolean }>(); // vehicles we're over: the closest pass, and any contact
  private readonly hits = new Map<Car, number>(); // car hops each car has taken

  constructor(
    readonly level: Level,
    mods?: Mods,
    startHeat = 0,
    readonly board: Slots = [],
    gear: Gear = freshGear(),
  ) {
    this.skater = new Skater(level, mods);
    this.flip = makeRng(level.layout.seed * 7 + 99);
    this.gear = { ...gear };
    this.skater.gear = gearScale(this.gear);
    this.heat.value = startHeat;
    if (mods) this.heat.mods = { rise: mods.heatRise, hopCool: mods.hopCool, decoy: mods.decoy, slow: mods.slowHeat, airCool: mods.airCool };
    //the tutorial teaches the moves first: nothing makes Heat rise
    if (level.tutorial) this.heat.mods = { ...this.heat.mods, rise: 0 };
    this.taken = level.pickups.map(() => false);
    this.broken = level.props.map(() => false);
    const esc = level.escape;
    this.sky = new Sky(level);
    this.chopper = esc?.chopperFrom !== undefined ? new Chopper(esc.chopperFrom, esc.covers, level.startX) : null;
    this.swarm = esc?.drones ? new Swarm(esc.drones, level.streetY) : null;
    this.chaser = esc?.chaseFrom !== undefined ? new Chaser(esc.chaseFrom, level.startX) : null;
    this.shooter = this.chaser ? new Shooter(level.layout.seed, level.streetY) : null;
    //traffic comes from the layout's own seed, so a re-rolled floor gets re-rolled traffic too
    this.traffic = new Traffic(level, level.tutorial ? [] : spawnPlan(level, level.layout.seed), level.crossings, level.busStops ?? [], level.doors ?? []);
    this.traffic.noBrake = mods?.spoofed ?? false;
    this.trains = (level.el ?? []).map((s) => new ElTrain(s));
  }

  // through the gate the skater rolls on (the game hands them to the next floor at the end of this one): the sim
  // keeps stepping in the 'exit' state, and nothing after the gate can end the floor again
  set rollOn(on: boolean) {
    this.skater.rollOn = on;
  }

  step(input: StepInput): void {
    if (this.state !== 'skate' && !(this.state === 'exit' && this.skater.rollOn)) return;
    this.frames++;
    this.traffic.step(this.skater.x);
    for (const t of this.trains) t.step(this.skater.x);
    this.swarm?.step(this.skater);
    this.fall = this.skater.mode === 'air' ? this.skater.vsp : 0;
    const crossing = this.traffic.crossing;
    const doors = this.traffic.doorBoxes;
    const trains = this.trains.length ? this.trains.flatMap((t) => t.inLane) : [];
    this.skater.movers =
      this.swarm || crossing.length || doors.length || trains.length
        ? [...this.traffic.inLane, ...crossing, ...doors, ...trains, ...(this.swarm?.boxes ?? [])]
        : this.traffic.inLane;
    if (this.chaser) this.shooter?.step(this.chaser, this.skater);
    this.skater.step(input);
    for (const c of this.traffic.cabs) c.pulled = this.skater.skitching === c.box;
    const skaterEvents = this.skater.events.slice();
    this.skater.events.length = 0;
    this.events = skaterEvents;
    if (this.shooter?.events.length) this.events.push(...this.shooter.events);
    if (this.swarm?.stomp(this.skater, skaterEvents)) {
      for (const e of this.swarm.events) if (e.type === 'down') this.events.push({ type: 'drone', index: e.index });
    }
    this.dent(skaterEvents);
    this.runBoard(skaterEvents);
    this.collect();
    this.closeCalls(skaterEvents);
    this.slipstream();
    this.smash(skaterEvents);
    this.runOver();
    this.wear(skaterEvents);
    this.heat.step(this.skater, skaterEvents);
    //in the helicopter's light, the Heat climbs
    if (this.chopper?.step(this.skater)) this.heat.add(CHOPPER.heatPerSec / 60);
    //up on the top route the police helicopter sees you (zack: "the upper route could have heat with a
    //helicopter"): from getting onto a top wire or rooftop until you're back on the ground below
    const sk = this.skater;
    if (sk.rail?.top || sk.surface?.top) this.up = true;
    else if (sk.grounded && sk.surface?.kind !== 'overpass') this.up = false;
    if (this.up) this.heat.add(TOP.heatPerSec / 60);
    this.heat.watched = this.up;
    if (this.sky.step(sk, this.up)) {
      this.heat.add(SKY.strikeHeat);
      this.events.push({ type: 'birds' });
    }
    this.chaser?.step(this.skater, skaterEvents);
    if (this.heat.decoyFired) this.events.push({ type: 'decoy' });
    if (this.state === 'exit') return;
    if (this.skater.mode === 'bail') this.state = 'bail';
    else if (this.skater.mode === 'exit' || this.skater.exited) {
      this.state = 'exit';
      //on (or above) the overpass at the gate = the high road
      const fork = this.level.fork;
      this.road = fork && this.skater.y <= fork.y + 1 ? 'high' : 'low';
    } else if (this.heat.caught || this.chaser?.caught) this.state = 'caught';
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
      //a small ollie, so it snaps up like one (PHYS.popSnap)
      const pop = PHYS.ollie * BOARD.doublePop * PHYS.popSnap;
      if (sk.mode === 'air' && sk.vsp > pop) {
        sk.vsp = pop;
        sk.snap = true;
      }
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
        if (f.comboOnly && this.combo < BOARD.comboOnly) continue;
        const times = f.coinFlip ? (this.flip() < 0.5 ? 0 : 3 * f.times) : f.times;
        for (let k = 0; k < times; k++) this.later.push({ effect: f.effect, slot: f.slot, t: f.delay });
      }
    }
    //effects whose time has come (a Delay holds them back), firing in order
    const now = this.later.filter((l) => l.t <= 0);
    this.later = this.later.filter((l) => l.t > 0).map((l) => ({ ...l, t: l.t - 1 }));
    for (const l of now) {
      this.apply(l.effect);
      this.events.push({ type: 'mod', effect: l.effect, slot: l.slot });
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
        if (sk.mode === 'air') {
          sk.gravFlipT = BOARD.gravFlipFrames;
          sk.snap = false;
        }
        break;
      case 'shockwave':
        for (const v of this.traffic.vehicles) {
          if (Math.abs((v.x0 + v.x1) / 2 - sk.x) < BOARD.shockwaveTiles * TILE) v.leaving = true;
        }
        break;
    }
  }

  // car hops dent the car they came off, and enough of them total it: it stops being solid and rolls out of the lane
  private dent(events: readonly SkaterEvent[]): void {
    const sk = this.skater;
    for (const v of this.traffic.vehicles) if (v.wrecked) v.speed *= DAMAGE.wreckDrift;
    if (!sk.hopped || !events.some((e) => e.type === 'hop')) return;
    const car = sk.hopped;
    sk.hopped = null;
    //an open door takes hops but no damage (its car is back in the other lane): the hop slams it shut
    const door = this.traffic.doors.find((d) => d.box === car);
    if (door) {
      door.slam();
      this.events.push({ type: 'doorSlam', x: (car.x0 + car.x1) / 2, y: car.roof });
      return;
    }
    const parked = car;
    const p = this.level.cars.indexOf(parked);
    const v: Vehicle | undefined = p < 0 ? this.traffic.vehicles.find((t) => t === car) : undefined;
    //cross cars mid-turn, the L's trains and the swarm's drones take hops but no damage
    if (p < 0 && !v) return;
    const kind = v ? v.kind : parkedKind(parked);
    const health = CAR_HEALTH[kind];
    const hits = (this.hits.get(parked) ?? 0) + 1;
    this.hits.set(parked, hits);
    const stage = stageOf(hits, health);
    if (stage === 3) {
      sk.wrecked.add(parked);
      if (v) {
        v.wrecked = true;
        v.leaving = true;
        v.stop = undefined;
        v.cruise = 0;
      }
      //wrecking the AI's robotaxi cools you off, like smashing its stuff
      if (kind === 'robotaxi') this.heat.add(-SMASH.aiCool);
    }
    const ref: CarRef = v ? { vehicle: v.id } : { parked: p };
    this.events.push({ type: 'dent', car: ref, kind, hits, health, stage, x: (parked.x0 + parked.x1) / 2, y: parked.roof });
  }

  // close calls: over a vehicle (or it under you) the whole way in the air, the wheels within a few px of its roof
  private closeCalls(events: readonly SkaterEvent[]): void {
    const sk = this.skater;
    const half = PHYS.width / 2;
    const contact = sk.mode !== 'air' || events.some((e) => e.type === 'hop' || e.type === 'slam' || e.type === 'kicker');
    const cars = sk.movers.length ? [...this.level.cars, ...sk.movers] : this.level.cars;
    for (const c of cars) {
      if (sk.wrecked.has(c)) continue;
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
      const dx = p.x - sk.x;
      if (Math.abs(dx) > SMASH_FAR) return; // out of reach of every way below (the floor has hundreds)
      const size = PROP_SIZE[p.name] ?? { w: 8, h: 16 };
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

  // traffic in the skate lane doesn't drive through the street's smashables, it knocks them flying. Nothing for the
  // skater (no style, no loot), except the floor's golden prop, which a car leaves standing for you
  private runOver(): void {
    const props = this.level.props;
    if (!props.length) return;
    const cars = [...this.traffic.inLane, ...this.traffic.crossing];
    if (!cars.length) return;
    props.forEach((p, i) => {
      if (!p.breaks || this.broken[i] || p.loot === 'stoken' || Math.abs(p.y - this.level.streetY) > 2) return;
      const w = (PROP_SIZE[p.name] ?? { w: 8 }).w;
      if (!cars.some((c) => c.x1 > p.x - w && c.x0 < p.x + w && c.bottom >= p.y - 2)) return;
      this.broken[i] = true;
      this.events.push({ type: 'smash', index: i, prop: p.name, x: p.x, y: p.y, how: 'car' });
    });
  }

  // gear wear: the deck from ollies, the shoes from flip tricks, the trucks from grinding, the wheels from speed and
  // glass, the bearings from grit and puddles
  private wear(events: readonly SkaterEvent[]): void {
    const sk = this.skater;
    const use: Gear = { deck: 0, shoes: 0, trucks: 0, wheels: 0, bearings: 0 };
    for (const e of events) {
      if (e.type === 'ollie') use.deck += GEAR.ollie;
      else if (e.type === 'trick') use.shoes += GEAR.flip;
      else if (e.type === 'glass') use.wheels += GEAR.glass;
    }
    if (sk.mode === 'roll') use.bearings += GEAR.rollSec / 60;
    //(the top route's power line is a long, smooth grind: it wears your trucks and wheels a lot less)
    const soft = sk.rail?.top ? TOP.wear : 1;
    if (isGrind(sk.mode)) use.trucks += (GEAR.grindSec / 60) * soft;
    //rolling into a puddle washes out the bearings (zack, 2026-10-30), and drags you: fresh wheels push through it,
    //worn ones bog down
    const wet = sk.mode === 'roll' ? this.puddleAt(sk.x, sk.y) : null;
    if (wet && wet !== this.wading) {
      use.bearings += GEAR.puddle;
      const drag = GEAR.puddleDrag.fresh + (GEAR.puddleDrag.dead - GEAR.puddleDrag.fresh) * (1 - sk.gear.grip);
      sk.hsp *= 1 - drag;
      sk.carry *= 1 - drag;
      this.events.push({ type: 'puddle', x: sk.x, y: sk.y });
    }
    this.wading = wet;
    const speed = Math.abs(sk.mode === 'rail' ? sk.railV : sk.hsp);
    if (speed > PHYS.baseSpeed * sk.mods.speedScale * GEAR.fastOver) use.wheels += (GEAR.fastSec / 60) * soft;
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
