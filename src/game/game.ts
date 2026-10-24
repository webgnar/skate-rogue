// Wires a run together: floors from the generator, the fixed-step skater, input, the view and the HUD.
import * as THREE from 'three';
import { addBoon, type Boon, type Held } from '../boons/defs';
import { skaterMods } from '../boons/mods';
import { offerBoons } from '../boons/offer';
import { validatedFloor } from '../gen/validate';
import { FIRST_ROAD, label, rollFork, ROADS, type Road } from '../gen/roads';
import { RunScore, SCORE } from '../run/score';
import { loadSave, writeSave } from '../run/save';
import { PickupView } from '../render/pickups';

import { surfaceSlope, type Level } from '../physics/level';
import type { Skater } from '../physics/skater';
import { StreetView } from '../render/scene';
import { TrafficView } from '../render/traffic-view';
import { Impacts } from '../render/impact';
import { FloorSim } from '../sim/floor';
import { TILE } from '../physics/constants';
import { SkaterRig, TRICKS, TRICK_NAMES } from '../render/skater-rig';
import { toX, toY } from '../render/kit';
import { OneButton } from './input';
import { FixedStep } from './loop';

export interface PickInfo {
  title: string;
  rerollCost: number;
  canReroll: boolean;
}

export interface RunResult {
  floor: number;
  boons: Held[];
  caught: boolean;
  score: number;
  best: number;
  newBest: boolean;
  stoken: number; // earned this run
  bank: number; // Stoken kept across runs
}

export interface Hud {
  floor(n: number, road: Road): void;
  callout(text: string, kind?: 'trick' | 'good' | 'bad'): void;
  debug(text: string): void;
  boons(held: Held[]): void;
  pick(offer: Boon[] | null, info?: PickInfo): void; // null hides the cards
  over(result: RunResult | null): void;
  money(cash: number, stoken: number): void;
  score(score: number, combo: number, stoke: number, gnar: number): void; // stoke and gnar 0..1
  heat(value: number): void;
  warn(show: boolean): void; // an oncoming car is on its way
}

type State = 'skate' | 'caught' | 'pick' | 'over';

const CAUGHT_BEAT_MS = 800;

const MENU_LOCK_MS = 300; // taps right after a menu opens are ignored
const BIG_LANDING = 8; // px/frame of fall: a drop of about 4 tiles or more

export class Game {
  private level: Level;
  private sim: FloorSim;
  private trafficView = new TrafficView();
  private prev = { x: 0, y: 0 };
  private loop = new FixedStep();
  private floor = 1;
  private boons: Held[] = [];
  private state: State = 'skate';
  private menuAt = 0;
  private offer: Boon[] = [];
  private last = performance.now();
  private run = new RunScore();
  private road: Road = FIRST_ROAD; // what this floor is
  private rerolls = 0;
  private readonly pickups = new PickupView();
  private nextRoad: Road = FIRST_ROAD;
  private fallSpeed = 0; // how fast the skater was falling before this step
  private readonly impacts: Impacts;
  private ghostMesh: THREE.Mesh;

  constructor(
    private seed: number,
    private readonly fixedSeed: boolean,
    private readonly view: StreetView,
    private readonly sprite: SkaterRig,
    private readonly input: OneButton,
    private readonly hud: Hud,
  ) {
    this.level = this.makeLevel();
    this.sim = new FloorSim(this.level);
    this.view.front.add(this.sprite.mesh);
    this.impacts = new Impacts(() => this.view.resolution);
    this.view.front.add(this.impacts.group);
    this.view.scene.add(this.trafficView.group);
    this.view.scene.add(this.pickups.group);
    this.ghostMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.12, 0.14),
      new THREE.MeshBasicMaterial({ color: 0x9ff3ff, transparent: true, opacity: 0.6 }),
    );
    this.ghostMesh.visible = false;
    this.view.scene.add(this.ghostMesh);
    this.startFloor();
  }

  private makeLevel(): Level {
    return validatedFloor(this.seed, this.floor, {
      fork: rollFork(this.seed, this.floor),
      danger: this.road.danger,
      short: this.road.kind === 'stash',
    }).level;
  }

  private newRun(): void {
    if (!this.fixedSeed) this.seed = Math.floor(Math.random() * 1e6);
    this.floor = 1;
    this.boons = [];
    this.run = new RunScore();
    this.road = FIRST_ROAD;
    this.level = this.makeLevel();
    this.hud.over(null);
    this.startFloor();
  }

  private openMenu(state: State, now: number): void {
    this.state = state;
    this.menuAt = now;
    this.input.clear();
  }

  private startFloor(): void {
    this.state = 'skate';
    this.input.clear();
    this.sim = new FloorSim(this.level, skaterMods(this.boons), this.road.kind === 'hot' ? ROADS.hotHeat : 0);
    this.trafficView.clear();
    this.pickups.setLevel(this.level);
    this.prev = { x: this.skater.x, y: this.skater.y };
    this.view.setLevel(this.level);
    this.view.zoom.reset();
    this.view.follow(this.skater.x, this.skater.y);
    this.sprite.play('push');
    this.hud.floor(this.floor, this.road);
    this.hud.boons(this.boons);
    this.hud.money(this.run.cash, this.run.stoken);
    if (this.road.kind === 'hot') this.hud.callout('RUSH HOUR', 'bad');
  }

  // the floor's gate: pay floor clear, then this floor's reward; the road taken is the next floor
  private finishFloor(now: number): void {
    const pts = this.run.clearFloor(this.floor);
    const fork = this.level.fork;
    this.nextRoad = fork ? (this.sim.road === 'high' ? fork.high : fork.low) : FIRST_ROAD;
    const road = this.road;
    if (road.kind === 'boon' || road.kind === 'hot') {
      if (road.kind === 'hot') this.run.cash += ROADS.hotCash(this.floor);
      this.rerolls = 0;
      this.showOffer();
      this.openMenu('pick', now);
    } else if (road.kind === 'cash') {
      const pay = ROADS.cashPayout(this.floor);
      this.run.cash += pay;
      this.advance();
      this.hud.callout(`+${pay} CASH`, 'good');
    } else {
      const pay = ROADS.stashStoken(this.floor);
      this.run.stoken += pay;
      this.advance();
      this.hud.callout(`+${pay} STOKEN`, 'good');
    }
    if (road.kind !== 'cash' && road.kind !== 'stash') this.hud.callout(`FLOOR CLEAR +${pts}`, 'good');
  }

  private rerollCost(): number {
    return 15 + 10 * this.rerolls;
  }

  private showOffer(): void {
    const road = this.road;
    const run = { floor: this.floor, boons: this.boons };
    this.offer =
      road.kind === 'hot'
        ? offerBoons(this.seed, run, 4, undefined, this.rerolls)
        : offerBoons(this.seed, run, 3, road.kind === 'boon' ? road.boonType : undefined, this.rerolls);
    const cost = this.rerollCost();
    this.hud.pick(this.offer, {
      title: road.kind === 'hot' ? 'HOT STREET: PICK ANY BOON' : `PICK A ${label(road)}`,
      rerollCost: cost,
      canReroll: this.run.cash >= cost,
    });
    this.hud.money(this.run.cash, this.run.stoken);
  }

  private reroll(): void {
    const cost = this.rerollCost();
    if (this.run.cash < cost) return;
    this.run.cash -= cost;
    this.rerolls++;
    this.showOffer();
  }

  private advance(): void {
    this.floor++;
    this.road = this.nextRoad;
    this.level = this.makeLevel();
    this.startFloor();
  }

  private pickBoon(i: number): void {
    const boon = this.offer[i];
    if (!boon) return;
    this.boons = addBoon(this.boons, boon.id);
    this.hud.pick(null);
    this.advance();
    this.hud.callout(boon.name.toUpperCase(), 'good');
  }

  private endRun(now: number, caught: boolean): void {
    this.openMenu('over', now);
    const save = loadSave();
    const newBest = this.run.score > save.best;
    const next = { best: Math.max(save.best, this.run.score), stoken: save.stoken + this.run.stoken };
    writeSave(next);
    this.hud.over({
      floor: this.floor,
      boons: this.boons,
      caught,
      score: this.run.score,
      best: next.best,
      newBest,
      stoken: this.run.stoken,
      bank: next.stoken,
    });
  }

  private get skater(): Skater {
    return this.sim.skater;
  }

  // a tap on a boon card, or keys 1-3
  choose(i: number): void {
    if (this.state === 'pick' && performance.now() - this.menuAt >= MENU_LOCK_MS) this.pickBoon(i);
  }

  frame(now: number): void {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;

    if (this.state === 'pick') {
      const press = this.input.takePress();
      const card = press ? this.input.lastTarget?.closest<HTMLElement>('[data-pick]') : null;
      if (card) this.choose(Number(card.dataset.pick));
      else if (press && this.input.lastTarget?.closest('[data-reroll]')) this.reroll();
    } else if (this.state === 'over') {
      if (this.input.takePress() && now - this.menuAt >= MENU_LOCK_MS) this.newRun();
    } else if (this.state === 'caught') {
      //the cruiser cuts in, then the summary
      if (now - this.menuAt >= CAUGHT_BEAT_MS) {
        this.endRun(now, true);
      }
    } else {
      this.loop.advance(dt, () => {
        this.prev = { x: this.skater.x, y: this.skater.y };
        this.fallSpeed = this.skater.mode === 'air' ? this.skater.vsp : 0;
        //the gnar state: faster cruising, slams cost no Heat
        this.skater.boost = this.run.gnar ? SCORE.gnarBoost : 1;
        this.sim.heat.slamFree = this.run.gnar;
        this.sim.step(this.input.sample());
        this.run.step(this.skater.mode);
        for (const e of this.sim.events) this.handle(e);
      });
    }

    if (this.state === 'skate' && this.sim.state === 'exit') {
      this.finishFloor(now);
    } else if (this.state === 'skate' && this.sim.state === 'bail') {
      this.endRun(now, false);
    } else if (this.state === 'skate' && this.sim.state === 'caught') {
      this.state = 'caught';
      this.menuAt = now;
      this.hud.callout('BUSTED!', 'bad');
      navigator.vibrate?.(200);
    }

    //traffic, the cruiser and the warnings
    this.trafficView.sync(this.level, this.sim.traffic.vehicles);
    const heat = this.state === 'pick' || this.state === 'over' ? 0 : this.sim.heat.value;
    this.trafficView.chase(this.level, this.skater.x, heat, this.sim.heat.holdT > 0, this.state === 'caught', dt * 1000);
    this.hud.heat(heat);
    this.hud.warn(
      this.state === 'skate' &&
        this.sim.traffic.inLane.some((v) => v.speed < 0 && v.x0 - this.skater.x > 17 * TILE),
    );

    const ghost = this.skater.ghost;
    this.ghostMesh.visible = ghost !== null;
    if (ghost) {
      const w = toX(ghost.x1 - ghost.x0);
      this.ghostMesh.scale.x = w;
      this.ghostMesh.position.set(toX(ghost.x0) + w / 2, toY(this.level, ghost.y) - 0.06, 0);
      (this.ghostMesh.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.4 * Math.min(1, ghost.ttl / 60);
    }

    const a = this.loop.alpha;
    const x = this.prev.x + (this.skater.x - this.prev.x) * a;
    const y = this.prev.y + (this.skater.y - this.prev.y) * a;
    this.sprite.mesh.position.x = toX(x);
    this.sprite.mesh.position.y = toY(this.level, y);
    const sk = this.skater;
    const angle =
      sk.mode === 'rail'
        ? Math.atan2(-sk.vsp, sk.hsp)
        : sk.mode === 'roll' && sk.surface?.kind === 'bank'
          ? Math.atan(-surfaceSlope(sk.surface))
          : 0;
    this.sprite.update(dt * 1000, this.skater, angle);
    this.impacts.update(dt);
    this.pickups.update(dt);
    this.hud.score(this.run.score, this.run.combo, this.run.stoke, this.run.gnarT / SCORE.gnarSecs);
    this.view.zoom.update(dt, this.skater.mode);
    this.view.follow(x, y, dt);
    this.view.adapt(dt * 1000);
    this.view.render();
    this.hud.debug(`${Math.round(1 / Math.max(dt, 1e-3))} fps · ${this.skater.hsp.toFixed(1)} px/f · res ${this.view.resolution.toFixed(2)}`);
  }

  private burst(size: number, shake: number): void {
    this.impacts.spawn(toX(this.skater.x), toY(this.level, this.skater.y), size);
    this.view.shake(shake);
  }

  private handle(e: FloorSim['events'][number]): void {
    if (e.type !== 'pickup') this.sprite.onEvent(e);
    const wasGnar = this.run.gnar;
    const bank = this.run.onEvent(e, this.skater.hsp);
    const combo = this.run.combo > 1 ? ` x${this.run.combo}` : '';
    switch (e.type) {
      case 'trick':
        this.view.zoom.trick();
        this.hud.callout(TRICK_NAMES[TRICKS[e.index % TRICKS.length]] + combo, 'trick');
        break;
      case 'grind':
        this.hud.callout(this.sprite.grindName + combo, 'trick');
        break;
      case 'rail':
        this.hud.callout('BOARDSLIDE' + combo, 'trick');
        break;
      case 'hop':
        this.hud.callout('CAR HOP!' + combo, 'good');
        break;
      case 'land':
        if (bank) {
          this.hud.callout(`+${bank.points.toLocaleString()}` + (bank.cash ? ` · +${bank.cash} CASH` : ''), 'good');
          this.hud.money(this.run.cash, this.run.stoken);
        }
        //a big drop lands with a smaller burst
        if (this.fallSpeed >= BIG_LANDING) this.burst(0.6, 0.12);
        break;
      case 'slam':
        this.hud.callout('SLAM!', 'bad');
        this.burst(1, 0.45);
        navigator.vibrate?.(60);
        break;
      case 'pickup':
        this.pickups.take(e.index);
        this.hud.money(this.run.cash, this.run.stoken);
        if (e.kind === 'stoken') this.hud.callout('STOKEN!', 'good');
        break;
    }
    if (!wasGnar && this.run.gnar) this.hud.callout('GNAR!', 'good');
  }
}
