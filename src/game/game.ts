// Wires a run together: floors from the generator, the fixed-step skater, input, the view and the HUD.
import * as THREE from 'three';
import { addBoon, type Boon, type Held } from '../boons/defs';
import { skaterMods } from '../boons/mods';
import { offerBoons } from '../boons/offer';
import { validatedFloor } from '../gen/validate';
import { ACTS, actOf, endsAct, ESCAPE, validatedEscape } from '../gen/escape';
import { FIRST_ROAD, floorRoad, label, rollFork, ROADS, type Road } from '../gen/roads';
import { BOARD, newBoard, type EffectId, type Slots } from '../board/mods';
import { buy, buySlot, restock, restockPrice, rollStock, swap, type ShopState } from '../board/shop';
import { RunScore, SCORE } from '../run/score';
import { loadSave, writeSave } from '../run/save';
import { PickupView } from '../render/pickups';

import { surfaceSlope, type Level } from '../physics/level';
import type { Skater } from '../physics/skater';
import { StreetView } from '../render/scene';
import { TrafficView } from '../render/traffic-view';
import { Impacts } from '../render/impact';
import { Particles } from '../render/particles';
import { FocusLines } from '../render/focus-lines';
import { SoundWords } from '../render/sound-word';
import { TimeWarp } from './time-warp';
import { Aura, inkify } from '../render/toon';
import { SpeedLines } from '../render/speed-lines';
import { clockFor, moodAt, rainLevel, rainy } from '../render/atmosphere';
import { puddleSpots } from '../render/puddles';
import { FloorSim } from '../sim/floor';
import { ChopperView } from '../render/chopper-view';
import { PHYS, TILE } from '../physics/constants';
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
  act: number;
  won: boolean; // escaped the city
  wins: number;
  boons: Held[];
  caught: boolean;
  score: number;
  best: number;
  newBest: boolean;
  stoken: number; // earned this run
  bank: number; // Stoken kept across runs
}

export type ShopPick = { stock: number } | { slot: number } | null;

export interface ShopView {
  shop: ShopState;
  picked: ShopPick;
  slotPrice: number;
  restockPrice: number;
  maxSlots: number;
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
  board(slots: Slots): void;
  fire(slot: number): void; // a board slot just fired
  shop(view: ShopView | null): void; // null hides the shop
}

type State = 'skate' | 'caught' | 'pick' | 'shop' | 'over';

const CAUGHT_BEAT_MS = 800;

const MENU_LOCK_MS = 300; // taps right after a menu opens are ignored
const BIG_LANDING = 8; // px/frame of fall: a drop of about 4 tiles or more
//slam: hit-stop, then slow motion easing back to full speed
const SLAM_FREEZE = 0.09;
const SLAM_SLOW = 0.3;
const SLAM_EASE = 0.55;
//grind sparks per second at cruising speed
//speed lines fade in from FLOW_FROM x cruising speed and are full FLOW_RANGE x cruising speed above that.
//zack: only at real speed. A flat grind (5) stays clear; a steep rail run (up to 9) brings them in.
const FLOW_FROM = 1.8;
const FLOW_RANGE = 0.7;
const GNAR_TRAIL = 40; // sparkles per second
const SPARKS_RAIL = 150;
const SPARKS_LEDGE = 70;

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
  private readonly chopper = new ChopperView();
  private spotState = 'hunt';
  private readonly particles = new Particles();
  private readonly focus = new FocusLines();
  private readonly words = new SoundWords();
  private readonly warp = new TimeWarp();
  private readonly speedLines = new SpeedLines();
  private readonly aura: Aura;
  private gnarGlow = 0; // 0..1, eases with the gnar state
  private clock = 0;
  private readonly puddleRes = new THREE.Vector2();
  private ghostMesh: THREE.Mesh;
  private board: Slots = newBoard();
  private shop: ShopState | null = null;
  private shopPick: ShopPick = null;
  private shopVisits = 0;

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
    //the rig makes its own toon materials (it flashes them on hits); this adds the outlines
    inkify(this.sprite.mesh, { toon: false });
    this.aura = new Aura(this.sprite.mesh);
    this.view.front.add(this.speedLines.mesh);
    this.impacts = new Impacts(() => this.view.resolution);
    this.view.front.add(this.impacts.group, this.particles.points, this.words.group, this.focus.mesh);
    this.view.scene.add(this.trafficView.group, this.chopper.group);
    this.view.front.add(this.trafficView.heatLights.front);
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
    if (this.road.kind === 'escape') return validatedEscape(this.seed, this.road.act);
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
    this.board = newBoard();
    this.shopVisits = 0;
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
    this.warp.reset();
    this.particles.clear();
    this.input.clear();
    this.sim = new FloorSim(this.level, skaterMods(this.boons), this.road.kind === 'hot' ? ROADS.hotHeat : this.road.kind === 'escape' ? ESCAPE.startHeat : 0, this.board);
    this.trafficView.clear();
    this.pickups.setLevel(this.level);
    this.prev = { x: this.skater.x, y: this.skater.y };
    this.view.setLevel(this.level);
    //the run's clock: afternoon into neon night, rain on some floors
    const rain = rainLevel(this.seed, this.floor);
    const mood = moodAt(clockFor(this.floor));
    this.view.setMood(rain > 0 ? rainy(mood) : mood, rain);
    this.view.puddles.set(puddleSpots(this.level, this.seed, this.floor), rain);
    this.view.zoom.reset();
    this.view.follow(this.skater.x, this.skater.y);
    this.sprite.play('push');
    this.hud.floor(this.floor, this.road);
    this.hud.boons(this.boons);
    this.hud.board(this.board);
    this.hud.money(this.run.cash, this.run.stoken);
    if (this.road.kind === 'hot') this.hud.callout('RUSH HOUR', 'bad');
    if (this.road.kind === 'escape') this.hud.callout(`ESCAPE: ${label(this.road)}`, 'bad');
  }

  // the floor's gate: pay floor clear, then this floor's reward; the road taken is the next floor
  private finishFloor(now: number): void {
    if (this.road.kind === 'escape') return this.clearAct(now, this.road.act);
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

  // through an act's escape: pay out, and the last act wins the run; the road picked before it comes next
  private clearAct(now: number, act: number): void {
    const cash = ESCAPE.actCash(act);
    const stoken = ESCAPE.actStoken(act);
    this.run.cash += cash;
    this.run.stoken += stoken;
    this.run.score += this.run.clearFloor(this.floor) * 2;
    if (act >= ACTS) return this.endRun(now, false, true);
    this.advance();
    this.hud.callout(`ACT ${act} CLEAR +$${cash} +◆${stoken}`, 'good');
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
    //an act ends with its escape, before the road picked at the third floor's fork
    if (endsAct(this.floor) && this.road.kind !== 'escape') {
      this.road = { kind: 'escape', act: actOf(this.floor), danger: 3 };
      this.level = this.makeLevel();
      this.startFloor();
      return;
    }
    //the shop road: shop first, then the boon street after it
    if (this.nextRoad.kind === 'shop') {
      this.openShop();
      return;
    }
    this.floor++;
    this.road = this.nextRoad;
    this.level = this.makeLevel();
    this.startFloor();
  }

  private openShop(): void {
    this.shopVisits++;
    this.shop = { cash: this.run.cash, board: this.board.slice(), stock: rollStock(this.seed, this.shopVisits, 0), restocks: 0 };
    this.shopPick = null;
    this.openMenu('shop', performance.now());
    this.showShop();
  }

  private showShop(): void {
    if (!this.shop) return;
    this.hud.shop({
      shop: this.shop,
      picked: this.shopPick,
      slotPrice: BOARD.slotPrice,
      restockPrice: restockPrice(this.shop),
      maxSlots: BOARD.maxSlots,
    });
    this.hud.money(this.shop.cash, this.run.stoken);
  }

  // a tap in the shop: pick a mod then a slot to buy it there, or two slots to swap them
  private shopTap(target: Element): void {
    const s = this.shop;
    if (!s) return;
    const el = target.closest<HTMLElement>('[data-stock],[data-slot],[data-buyslot],[data-restock],[data-done]');
    if (!el) return;
    const pick = this.shopPick;
    let next: ShopState | null = s;
    if (el.dataset.stock !== undefined) {
      const i = Number(el.dataset.stock);
      this.shopPick = pick && 'stock' in pick && pick.stock === i ? null : s.stock[i] ? { stock: i } : null;
    } else if (el.dataset.slot !== undefined) {
      const j = Number(el.dataset.slot);
      if (pick && 'stock' in pick) next = buy(s, pick.stock, j);
      else if (pick && 'slot' in pick) next = pick.slot === j ? s : swap(s, pick.slot, j);
      else {
        this.shopPick = { slot: j };
        next = s;
      }
      if (pick) this.shopPick = null;
      if (!next) {
        this.hud.callout('NOT ENOUGH CASH', 'bad');
        next = s;
      }
    } else if (el.dataset.buyslot !== undefined) {
      next = buySlot(s) ?? s;
      this.shopPick = null;
    } else if (el.dataset.restock !== undefined) {
      next = restock(s, this.seed, this.shopVisits) ?? s;
      this.shopPick = null;
    } else if (el.dataset.done !== undefined) {
      this.leaveShop();
      return;
    }
    this.shop = next;
    this.showShop();
  }

  private leaveShop(): void {
    if (!this.shop) return;
    this.run.cash = this.shop.cash;
    this.board = this.shop.board;
    this.shop = null;
    this.hud.shop(null);
    this.nextRoad = floorRoad(this.nextRoad);
    this.advance();
  }

  private pickBoon(i: number): void {
    const boon = this.offer[i];
    if (!boon) return;
    this.boons = addBoon(this.boons, boon.id);
    this.hud.pick(null);
    this.advance();
    this.hud.callout(boon.name.toUpperCase(), 'good');
  }

  private endRun(now: number, caught: boolean, won = false): void {
    this.openMenu('over', now);
    const save = loadSave();
    const newBest = this.run.score > save.best;
    const next = { best: Math.max(save.best, this.run.score), stoken: save.stoken + this.run.stoken, wins: save.wins + (won ? 1 : 0) };
    writeSave(next);
    this.hud.over({
      floor: this.floor,
      act: actOf(this.floor),
      won,
      wins: next.wins,
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
    //never negative: a frame's timestamp can come from before the game was made, and a negative step would
    //poison the time warp (and through it the camera and the physics clock) with NaN
    const realDt = Math.max(0, Math.min(0.1, (now - this.last) / 1000));
    this.last = now;
    //game time: frozen on a slam's hit-stop, then slow motion
    const dt = realDt * this.warp.scale;
    this.warp.update(realDt);

    if (this.state === 'pick') {
      const press = this.input.takePress();
      const card = press ? this.input.lastTarget?.closest<HTMLElement>('[data-pick]') : null;
      if (card) this.choose(Number(card.dataset.pick));
      else if (press && this.input.lastTarget?.closest('[data-reroll]')) this.reroll();
    } else if (this.state === 'shop') {
      if (this.input.takePress() && this.input.lastTarget && now - this.menuAt >= MENU_LOCK_MS) this.shopTap(this.input.lastTarget);
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
    this.chopper.update(this.level, this.sim.chopper, dt);
    const spot = this.sim.chopper?.state ?? 'hunt';
    if (spot !== this.spotState && this.state === 'skate') {
      if (spot === 'lock') this.hud.callout('SPOTTED!', 'bad');
      else if (spot === 'lost') this.hud.callout("LOST 'EM", 'good');
    }
    this.spotState = spot;
    this.pickups.update(dt);
    this.sparks(dt);
    this.water(dt);
    this.particles.update(dt, this.view.pointScale);
    this.words.update(realDt);
    this.focus.update(realDt, this.view.camera, this.sprite.mesh.position);
    this.flowFx(dt);
    this.hud.score(this.run.score, this.run.combo, this.run.stoke, this.run.gnarT / SCORE.gnarSecs);
    this.view.zoom.update(dt, this.skater.mode);
    this.view.follow(x, y, dt);
    this.view.adapt(realDt * 1000);
    this.view.render();
    this.hud.debug(`${Math.round(1 / Math.max(realDt, 1e-3))} fps · ${this.skater.hsp.toFixed(1)} px/f · res ${this.view.resolution.toFixed(2)}`);
  }

  // speed lines past cruising speed, and the gnar state's glow and sparkle trail
  private flowFx(dt: number): void {
    const skating = this.state === 'skate';
    const gnar = skating && this.run.gnar;
    const sk = this.skater;
    const speed = sk.mode === 'rail' ? sk.railV : Math.abs(sk.hsp);
    const flow = skating ? Math.min(1, Math.max(0, (speed - PHYS.baseSpeed * FLOW_FROM) / (PHYS.baseSpeed * FLOW_RANGE))) : 0;
    this.clock += dt;
    this.speedLines.update(dt, this.view.camera, flow, gnar);
    this.gnarGlow += ((gnar ? 1 : 0) - this.gnarGlow) * Math.min(1, dt * 6);
    this.aura.set(this.gnarGlow, this.clock, this.view.resolution);
    if (gnar) {
      const p = this.sprite.mesh.position;
      this.particles.trail(p.x - 0.2, p.y + 0.9, GNAR_TRAIL, dt, this.clock);
    }
  }

  // rolling through puddles: spray off the wheels and a wake in the reflection
  private water(dt: number): void {
    const sk = this.skater;
    const p = this.sprite.mesh.position;
    const wading = this.state === 'skate' && sk.mode === 'roll' && this.view.puddles.at(p.x, p.y) !== null;
    if (wading) this.particles.wade(p.x, p.y, Math.abs(sk.hsp) / PHYS.baseSpeed, dt);
    const glow = this.trafficView.heatLights.glow;
    this.view.puddles.update(dt, this.view.renderer.getDrawingBufferSize(this.puddleRes), glow.k > 0 ? [glow] : [], p, wading);
  }

  // sparks off the back truck while grinding: a rail throws more than a ledge, and more the faster you go
  private sparks(dt: number): void {
    const sk = this.skater;
    if (this.state !== 'skate' || (sk.mode !== 'rail' && sk.mode !== 'grind')) return;
    const speed = sk.mode === 'rail' ? sk.railV : Math.abs(sk.hsp);
    const rate = (sk.mode === 'rail' ? SPARKS_RAIL : SPARKS_LEDGE) * Math.min(2, Math.max(0.4, speed / PHYS.baseSpeed));
    const [x, y] = this.backTruck();
    this.particles.grind(x, y, 1, rate, dt);
  }

  // where the back truck meets the rail, from the rig's tilt
  private backTruck(): [number, number] {
    const a = this.sprite.mesh.rotation.z;
    const p = this.sprite.mesh.position;
    return [p.x - 0.3 * Math.cos(a), p.y - 0.3 * Math.sin(a)];
  }

  //into the gnar state: the word in the world, no freeze or camera move (zack: the freeze was jarring)
  private gnarOn(): void {
    const x = toX(this.skater.x);
    const y = toY(this.level, this.skater.y);
    this.words.spawn(x, y, 'GNAR!');
    this.impacts.spawn(x, y, 0.7);
  }

  private slam(): void {
    const x = toX(this.skater.x);
    const y = toY(this.level, this.skater.y);
    this.burst(1, 0.45);
    this.view.punch(1);
    this.warp.hit(SLAM_FREEZE, SLAM_SLOW, SLAM_EASE);
    this.focus.trigger();
    this.words.spawn(x, y);
    this.particles.debris(x, y, 1);
  }

  // a board mod fired: the effects the sim can't do itself
  private fire(effect: EffectId, slot: number): void {
    this.hud.fire(slot);
    switch (effect) {
      case 'sparks':
        this.run.addStyle(BOARD.sparkStyle);
        this.particles.grindStart(...this.backTruck(), 1);
        this.particles.grindStart(...this.backTruck(), 1);
        break;
      case 'cashBurst':
        this.run.cash += BOARD.cashBurst;
        this.hud.money(this.run.cash, this.run.stoken);
        break;
      case 'slowMo':
        //no freeze: drop to half speed and ease back over the half second
        this.warp.hit(0, BOARD.slowMoScale, BOARD.slowMoSecs);
        break;
      case 'shockwave':
        this.burst(0.5, 0.15);
        break;
    }
  }

  private burst(size: number, shake: number): void {
    this.impacts.spawn(toX(this.skater.x), toY(this.level, this.skater.y), size);
    this.view.shake(shake);
  }

  private handle(e: FloorSim['events'][number]): void {
    if (e.type === 'mod') return this.fire(e.effect, e.slot);
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
        this.particles.grindStart(...this.backTruck(), 1);
        this.hud.callout(this.sprite.grindName + combo, 'trick');
        break;
      case 'rail':
        this.particles.grindStart(...this.backTruck(), 1);
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
        //dust on every landing; a big drop also lands with a smaller burst
        this.particles.dust(toX(this.skater.x), toY(this.level, this.skater.y), Math.min(1.5, Math.max(0.5, this.fallSpeed / BIG_LANDING)));
        if (this.fallSpeed >= BIG_LANDING) this.burst(0.6, 0.12);
        //into a puddle: a crown of water, and a SPLSH! on a big drop
        {
          const x = toX(this.skater.x);
          const y = toY(this.level, this.skater.y);
          if (this.view.puddles.at(x, y)) {
            const big = this.fallSpeed >= BIG_LANDING;
            this.particles.splash(x, y, big ? 1.5 : 0.8);
            if (big) this.words.spawn(x, y, 'SPLSH!');
          }
        }
        break;
      case 'slam':
        this.slam();
        navigator.vibrate?.(60);
        break;
      case 'pickup':
        this.pickups.take(e.index);
        this.hud.money(this.run.cash, this.run.stoken);
        if (e.kind === 'stoken') this.hud.callout('STOKEN!', 'good');
        break;
    }
    if (!wasGnar && this.run.gnar) this.gnarOn();
  }
}
