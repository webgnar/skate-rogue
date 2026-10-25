// Wires a run together: floors from the generator, the fixed-step skater, input, the view and the HUD.
import * as THREE from 'three';
import { addBoon, type Boon, type Held } from '../boons/defs';
import { carriedHeat, cursesHeld, dropBoon, startHeat, type UnderView } from '../run/spot';
import { skaterMods } from '../boons/mods';
import { offerBoons } from '../boons/offer';
import { floorLevel, type FloorSpec } from '../run/floor-level';
import { FloorPrefetch, specKey } from '../run/prefetch';
import { ACTS, actOf, endsAct, ESCAPE } from '../gen/escape';
import { FIRST_ROAD, floorRoad, label, ROADS, type Road } from '../gen/roads';
import { BOARD, newBoard, type EffectId, type Slots } from '../board/mods';
import { buy, buySlot, restock, restockPrice, rollStock, swap, type ShopState } from '../board/shop';
import { RunScore, SCORE } from '../run/score';
import { freshGear, GEAR, replace, type Gear, type GearPart } from '../run/gear';
import { loadSave, writeSave } from '../run/save';
import { gnarCards, gnarCarry, withGnar } from '../run/gnar';
import { buzzFor, cueFor, MOMENT } from '../audio/cues';
import type { Sound } from '../audio/sound';
import { buzz } from '../ui/settings';
import { cashScale, dayKey, DECK_SLOTS, FULL_LIBRARY, firstPick, STOCK, withLoadout, type Library, type Loadout } from '../run/meta';
import { PickupView } from '../render/pickups';

import type { Level } from '../physics/level';
import type { Skater } from '../physics/skater';
import { StreetView } from '../render/scene';
import { TrafficView } from '../render/traffic-view';
import { ElView } from '../render/el-view';
import { CableView } from '../render/cable-view';
import { Impacts } from '../render/impact';
import { Particles, TRICK_TRAIL } from '../render/particles';
import { FocusLines } from '../render/focus-lines';
import { SoundWords } from '../render/sound-word';
import { TimeWarp } from './time-warp';
import { Aura, inkify } from '../render/toon';
import { SpeedLines } from '../render/speed-lines';
import { FX } from '../render/fx-settings';
import { HeatCue } from '../render/heat-cue';
import { BoonFx } from '../render/boon-fx';
import { SmashFx, type SmashHit } from '../render/smash';
import { VisorGlint, VISOR_TINT } from '../render/visor-glint';
import { propPieces } from '../render/models';
import { hideProp, props, restyle } from '../render/props';
import { BIOMES, biomeMood, type BiomeId } from '../render/biomes';
import { clockFor, mixMood, moodAt, rainLevel, rainy, type Mood } from '../render/atmosphere';
import { puddleSpots } from '../render/puddles';
import { FloorSim } from '../sim/floor';
import { ChopperView } from '../render/chopper-view';
import { EscapeFx } from '../render/escape-fx';
import { DroneView } from '../render/drone-view';
import { CHASER_CALLS, chaserLook, ChaserView } from '../render/chaser-view';
import { PedView } from '../render/peds';
import { PhoneFx } from '../render/phone-fx';
import { CHASER } from '../sim/chaser';
import { TwistView } from '../render/twist-view';
import { BountyView } from '../render/bounty-view';
import { BOUNTY, bountyPay } from '../run/bounty';
import { PHYS, TILE } from '../physics/constants';
import { SkaterRig } from '../render/skater-rig';
import { trickName } from '../physics/tricks';
import { LANE_B_Z, toX, toY } from '../render/kit';
import { OneButton } from './input';
import { FixedStep } from './loop';
import { FEEL } from '../physics/feel';
import { Pilot, type PilotStyle } from '../bot/pilot';
import { FloorChecks, type Finding } from '../bot/checks';
import { reproQuery } from '../bot/repro';
import { makeRng } from '../gen/rng';
import { landDust, landKick } from '../render/land-fx';

export interface PickInfo {
  title: string;
  rerollCost: number; // below 0: no reroll on this pick
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
  daily: { best: number; newBest: boolean } | null; // on a daily run
}

// what the meta tree sets for a run: the skater and deck, the boon library, and whether it's the daily run
export interface RunMeta {
  loadout: Loadout;
  library: Library;
  daily: boolean;
  tutorial?: boolean; // start on the tutorial floor (a new phone, or ?tutorial)
  gnar?: number; // the Gnar level (src/run/gnar.ts): 0 is a normal run
  // test URLs (src/bot/repro.ts): boons held from the start, the first road's traffic, or start on an act's escape
  boons?: Held[];
  danger?: number;
  escape?: number;
}

// what the playtest bot reads off the game (?bot&debug): where it is, what it found, how its runs ended
export interface PlaytestState {
  seed: number;
  floor: number;
  label: string; // "floor 4", "escape 2" or "tutorial"
  district: BiomeId;
  state: string;
  sim: string;
  x: number;
  y: number;
  mode: string;
  speed: number;
  clip: string;
  boons: Held[];
  findings: (Finding & { label: string; url: string })[];
  floors: { label: string; url: string; result: string; seconds: number }[];
  runs: { floor: number; won: boolean; caught: boolean; score: number }[];
}

export type ShopPick = { stock: number } | { slot: number } | null;

export interface ShopView {
  shop: ShopState;
  picked: ShopPick;
  slotPrice: number;
  restockPrice: number;
  maxSlots: number;
  gear: Gear; // what your gear is at; the shop sells new parts
}

export interface Hud {
  floor(n: number, road: Road): void;
  callout(text: string, kind?: 'trick' | 'good' | 'bad'): void;
  debug(text: string): void;
  boons(held: Held[]): void;
  pick(offer: Boon[] | null, info?: PickInfo): void; // null hides the cards
  over(result: RunResult | null): void;
  money(cash: number, stoken: number): void;
  score(score: number, combo: number, stoke: number, gnar: number, pending: number): void; // stoke and gnar 0..1; pending: the live combo's points
  pause(paused: boolean): void; // show or hide the pause card
  heat(value: number): void;
  warn(show: boolean): void; // an oncoming car is on its way
  board(slots: Slots): void;
  fire(slot: number): void; // a board slot just fired
  shop(view: ShopView | null): void; // null hides the shop
  under(view: UnderView | null): void; // the underground spot; null hides it
  gear(gear: Gear): void; // how worn your deck, shoes, trucks and wheels are
}

type State = 'skate' | 'caught' | 'pick' | 'shop' | 'under' | 'over';

const CAUGHT_BEAT_MS = 800;
//one street: the floor ahead comes into view this far before the join (tiles), and the light and weather blend
//from one floor's to the next's over this long after it
const AHEAD_TILES = 44;
const MOOD_BLEND_SECS = 4;

const MENU_LOCK_MS = 300; // taps right after a menu opens are ignored
const SMASH_CHAIN = 4; // smashes in quick succession for a Wrecking Ball
const SMASH_CHAIN_SECS = 1.2;
//slam: hit-stop, then slow motion easing back to full speed
const SLAM_FREEZE = 0.09;
const SLAM_SLOW = 0.3;
const SLAM_EASE = 0.55;
//grind sparks per second at cruising speed
//speed lines fade in from FLOW_FROM x cruising speed and are full FLOW_RANGE x cruising speed above that.
//zack: only at real speed. A flat grind (5) stays clear; a steep rail run (up to 9) brings them in.
const FLOW_FROM = 1.8;
//flip trails show for this long after a trick; a landing this soon after the trick is sketchy
const FLIP_TRAIL_SECS = 0.35;
//drips a second off the roof edges in a downpour-strength rain
const DRIPS = 6;
const SKETCHY_SECS = 0.3;
const FLOW_RANGE = 0.7;
const GNAR_TRAIL = 40; // sparkles per second
const SPARKS_RAIL = 150;
const SPARKS_LEDGE = 70;

export class Game {
  private level: Level;
  private sim: FloorSim;
  private trafficView = new TrafficView();
  private elView = new ElView(); // the L's trains
  private cableView = new CableView(); // the cable cars up the later stretches of hill
  private prev = { x: 0, y: 0 };
  private loop = new FixedStep();
  private floor = 1;
  private boons: Held[] = [];
  private state: State = 'skate';
  paused = false; // frozen by the pause button, Esc / P, or the page going hidden
  sound: Sound | null = null; // set by main once the page is up
  private menuAt = 0;
  private offer: Boon[] = [];
  private last = performance.now();
  private run = new RunScore();
  private road: Road = FIRST_ROAD; // what this floor is
  private rerolls = 0;
  private readonly pickups = new PickupView();
  private nextRoad: Road = FIRST_ROAD;
  private smashChain = 0;
  private smashAt = -10;
  private carry = 0; // Heat carried into the next floor
  private swapping = false; // the pick on screen is the underground spot's swap
  private flip: { rgb: number[]; left: number; at: number } | null = null; // the last trick thrown this air
  private fallSpeed = 0;
  private dripEdges: { x: number; y: number }[] = []; // roof corners water drips from
  private dripT = 0; // how fast the skater was falling before this step
  private readonly impacts: Impacts;
  private readonly chopper = new ChopperView();
  private readonly droneView = new DroneView();
  private readonly chaserView = new ChaserView();
  private readonly pedView = new PedView();
  private readonly phoneFx = new PhoneFx();
  private readonly bountyView = new BountyView();
  private readonly twistView = new TwistView();
  private floorStoken = 0; // Stoken at the floor's start, for a bounty
  private bountySeen = false;
  private tutorial = false; // on the tutorial floor, before the run's first floor
  private tutorialOut = false; // through the tutorial's gate, rolling on to the run's first floor
  private lesson = 0; // the next tutorial prompt
  private get gnar(): number {
    return this.meta.gnar ?? 0;
  }
  private spotState = 'hunt';
  private readonly particles = new Particles();
  private readonly focus = new FocusLines();
  private readonly escapeFx = new EscapeFx(this.particles);
  private readonly words = new SoundWords();
  private readonly warp = new TimeWarp();
  private readonly speedLines = new SpeedLines();
  private readonly boonFx = new BoonFx(this.particles);
  readonly smashFx = new SmashFx(this.particles, {
    word: (x, y, w) => this.words.spawn(x, y, w),
    shake: (a) => this.view.shake(a),
    pieces: (prop) => propPieces(prop), // the Blender break pieces (art/props.py)
    hide: (index) => hideProp(index),
  });
  private biome: BiomeId = 'chicago';
  private readonly heatCue = new HeatCue(document.getElementById('app') ?? document.body);
  private perfT = 0;
  private perfWorst = 0;
  private perfText = '';
  private readonly aura: Aura;
  private readonly visor: VisorGlint;
  private gnarGlow = 0; // 0..1, eases with the gnar state
  private clock = 0;
  private readonly puddleRes = new THREE.Vector2();
  private ghostMesh: THREE.Mesh;
  private board: Slots = newBoard();
  private shop: ShopState | null = null;
  private shopPick: ShopPick = null;
  private shopVisits = 0;
  private gear: Gear = freshGear(); // worn down over the run, replaced at the shop
  // one street (zack: no stop or cut between floors): through the gate you roll on, and at the end of the floor the
  // next one is already there, built in the background while you skated this one
  private readonly prefetch = new FloorPrefetch();
  private pending: { floor: number; road: Road } | null = null; // where the run goes at the end of this floor
  private finished = false; // through this floor's gate, rolling on to the next
  private shown: { mood: Mood; rain: number } | null = null; // the light and weather on screen
  private moodBlend: { from: Mood; fromRain: number; to: Mood; toRain: number; t: number } | null = null;
  // the playtest bot (?bot): it skates and picks in place of the button, checking every step as it goes
  private autopilot: Pilot | null = null;
  private checks: FloorChecks | null = null;
  private botRng = makeRng(1);
  private floorFrames = 0;
  timeScale = 1; // ?bot&turbo=N runs the game N times faster
  readonly playtest: PlaytestState;

  constructor(
    private seed: number,
    private readonly fixedSeed: boolean,
    private readonly view: StreetView,
    private readonly sprite: SkaterRig,
    private readonly input: OneButton,
    private readonly hud: Hud,
    private readonly startAt = 1, // ?floor=: the first floor of every run, for testing
    private readonly meta: RunMeta = { loadout: STOCK, library: FULL_LIBRARY, daily: false },
  ) {
    this.floor = startAt;
    this.boons = meta.boons ?? [];
    this.tutorial = meta.tutorial ?? false;
    this.road = this.firstRoad();
    this.board = newBoard(DECK_SLOTS[meta.loadout.deck]);
    this.level = this.makeLevel();
    this.sim = new FloorSim(this.level);
    this.view.front.add(this.sprite.mesh);
    //the rig makes its own toon materials (it flashes them on hits); this adds the outlines
    inkify(this.sprite.mesh, { toon: false });
    this.aura = new Aura(this.sprite.mesh);
    this.visor = new VisorGlint(this.sprite.mesh);
    this.view.front.add(this.speedLines.mesh);
    this.impacts = new Impacts(() => this.view.resolution);
    this.view.front.add(this.impacts.group, this.particles.points, this.words.group, this.focus.mesh);
    this.view.scene.add(this.trafficView.group, this.elView.group, this.cableView.group, this.chopper.group, this.droneView.group, this.chaserView.group, this.bountyView.group, this.pedView.group, this.phoneFx.group, this.twistView.group);
    this.view.front.add(this.trafficView.heatLights.front);
    this.view.scene.add(this.pickups.group);
    this.ghostMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.12, 0.14),
      new THREE.MeshBasicMaterial({ color: 0x9ff3ff, transparent: true, opacity: 0.6 }),
    );
    this.ghostMesh.visible = false;
    this.view.scene.add(this.ghostMesh);
    this.view.scene.add(this.smashFx.group);
    this.playtest = { seed, floor: 0, label: '', district: this.biome, state: '', sim: '', x: 0, y: 0, mode: '', speed: 0, clip: '', boons: [], findings: [], floors: [], runs: [] };
    this.startFloor();
  }

  // hand the button to the playtest bot: 'ref' skates the validator's line, 'mash' presses at random
  setAutopilot(style: PilotStyle): void {
    this.autopilot = new Pilot(style, this.seed);
    this.botRng = makeRng(this.seed * 5 + 3);
    this.checks = new FloorChecks(this.sim);
  }

  // this floor's test URL query, as the bot would replay it
  private repro(): string {
    const escape = this.road.kind === 'escape' ? this.road.act : undefined;
    return reproQuery({ seed: this.seed, floor: this.floor, boons: this.boons, danger: this.road.danger, escape, gnar: this.gnar, bot: this.autopilot?.style });
  }

  private get floorLabel(): string {
    return this.tutorial ? 'tutorial' : this.road.kind === 'escape' ? `escape ${this.road.act}` : `floor ${this.floor}`;
  }

  // the floor's end, for the bot's report
  private logFloor(result: string): void {
    if (!this.autopilot) return;
    this.playtest.floors.push({ label: this.floorLabel, url: this.repro(), result, seconds: Math.round(this.floorFrames / 6) / 10 });
  }

  private updatePlaytest(): void {
    const t = this.playtest;
    const sk = this.skater;
    Object.assign(t, {
      seed: this.seed,
      floor: this.floor,
      label: this.floorLabel,
      district: this.biome,
      state: this.state,
      sim: this.sim.state,
      x: sk.x,
      y: sk.y,
      mode: sk.mode,
      speed: sk.hsp,
      clip: this.sprite.current,
      boons: this.boons,
    });
    if (this.checks && this.checks.findings.length > this.reported) {
      for (const f of this.checks.findings.slice(this.reported)) t.findings.push({ ...f, label: this.floorLabel, url: this.repro() });
      this.reported = this.checks.findings.length;
    }
  }
  private reported = 0;

  // the bot at a menu: a random boon card, lay low at the spot, walk out of the shop; a new run after a beat
  private botMenu(now: number): void {
    if (now - this.menuAt < MENU_LOCK_MS * 2) return;
    if (this.state === 'pick') this.choose(Math.floor(this.botRng() * this.offer.length));
    else if (this.state === 'under') this.underChoose('low');
    else if (this.state === 'shop') this.leaveShop();
    else if (this.state === 'over' && now - this.menuAt > 3000) this.newRun();
  }

  private makeLevel(): Level {
    return floorLevel({
      seed: this.seed,
      floor: this.floor,
      road: this.road,
      library: this.meta.library,
      gnar: this.gnar,
      tutorial: this.tutorial,
    });
  }

  private newRun(): void {
    if (!this.fixedSeed) this.seed = Math.floor(Math.random() * 1e6);
    this.floor = this.startAt;
    this.boons = this.meta.boons ?? [];
    this.board = newBoard(DECK_SLOTS[this.meta.loadout.deck]);
    this.gear = freshGear();
    this.shopVisits = 0;
    this.run = new RunScore();
    this.carry = 0;
    this.road = this.firstRoad();
    this.level = this.makeLevel();
    this.hud.over(null);
    this.startFloor();
    this.sound?.play(MOMENT.start);
  }

  // through the tutorial's gate: remember it, then the run proper starts on its first floor (no score carried)
  private endTutorial(): void {
    this.tutorial = false;
    writeSave({ ...loadSave(), tutorialDone: true });
    this.run = new RunScore();
    this.gear = freshGear();
    this.carry = 0;
    this.goTo(this.startAt, this.firstRoad());
    this.hud.callout("YOU'RE READY. LET'S GO!", 'good');
  }

  // the first floor is a boon street of your skater's type (GDD: Meta progression)
  private firstRoad(): Road {
    if (this.meta.escape) return { kind: 'escape', act: this.meta.escape, danger: 3 };
    return { ...FIRST_ROAD, boonType: firstPick(this.meta.loadout, this.meta.library), danger: this.meta.danger ?? FIRST_ROAD.danger } as Road;
  }

  private openMenu(state: State, now: number): void {
    this.state = state;
    this.menuAt = now;
    this.input.clear();
  }

  // a prop breaks (or rings, if it can't): the sim's smash events come through here
  smash(hit: SmashHit): void {
    //as the city shows it: an amphora in the old town breaks like pottery, not like the barrel the sim placed
    this.smashFx.smash({ ...hit, prop: props.placements[hit.index]?.shown ?? restyle(hit.prop, props.biome) ?? hit.prop });
  }

  // ?biome= previews one district's look (one fused world otherwise: the run never changes it)
  setBiome(id: BiomeId): void {
    this.goBiome(id);
  }

  private goBiome(id: BiomeId): void {
    this.biome = id;
    this.applyMood();
    void this.view.setBiome(id); // its kit, once the tiles are in
  }

  //the run's clock (afternoon into neon night), rain on some floors, graded to the district; returns the rain level.
  //`blend`: ease into it from what's on screen (rolling on from the last floor) rather than switch
  private applyMood(blend = false): number {
    const rain = BIOMES[this.biome].dry ? 0 : rainLevel(this.seed, this.floor); // no rain under the sea, indoors or in space
    const mood = moodAt(clockFor(this.floor));
    const look = biomeMood(rain > 0 ? rainy(mood) : mood, this.biome);
    if (blend && this.shown) this.moodBlend = { from: this.shown.mood, fromRain: this.shown.rain, to: look, toRain: rain, t: 0 };
    else {
      this.moodBlend = null;
      this.setLook(look, rain);
    }
    return rain;
  }

  private setLook(look: Mood, rain: number): void {
    this.shown = { mood: look, rain };
    this.view.setMood(look, rain);
    this.view.ambience.set(this.biome);
    this.trafficView.beams.setNight(look.neon);
    this.visor.setNight(look.neon, VISOR_TINT[this.biome]);
    this.phoneFx.setNight(look.neon);
  }

  private blendMood(dt: number): void {
    const b = this.moodBlend;
    if (!b) return;
    b.t = Math.min(1, b.t + dt / MOOD_BLEND_SECS);
    const t = b.t * b.t * (3 - 2 * b.t);
    this.setLook(mixMood(b.from, b.to, t), b.fromRain + (b.toRain - b.fromRain) * t);
    if (b.t >= 1) this.moodBlend = null;
  }

  // a floor begins: from a standstill at its start (a new run), or rolling on from the last floor (`from`, the
  // skater as they crossed the join; `dx`, `dy` move them into this floor's space, px)
  private startFloor(from?: { skater: Skater; dx: number; dy: number }): void {
    this.state = 'skate';
    this.finished = false;
    this.pending = null;
    if (!from) {
      this.warp.reset();
      this.particles.clear();
      this.smashFx.clear();
      this.input.clear();
    }
    this.boonFx.setBoons(this.boons);
    const roadHeat = this.road.kind === 'hot' ? ROADS.hotHeat : this.road.kind === 'escape' ? ESCAPE.startHeat : 0;
    const mods = withGnar(withLoadout(skaterMods(this.boons), this.meta.loadout), this.gnar);
    this.run.cashScale = cashScale(this.meta.loadout);
    this.sim = new FloorSim(this.level, mods, startHeat(roadHeat, this.carry), this.board, this.gear);
    if (from) this.sim.skater.carryOn(from.skater, from.dx, from.dy);
    //the last escape ends the run at its gate; every other floor rolls on into the next
    this.sim.rollOn = this.following().length > 0;
    if (this.autopilot) {
      this.checks = new FloorChecks(this.sim);
      this.reported = 0;
    }
    this.floorFrames = 0;
    if (!from) this.sprite.mesh.position.z = 0; // every floor starts in lane A (rolling on, it eases there)
    this.run.scoreScale = mods.scoreScale;
    this.run.slamStoke = mods.slamStoke;
    this.run.stokenScale = mods.stokenScale;
    this.run.nearScale = mods.nearScale;
    this.carry = 0;
    this.trafficView.clear();
    this.elView.clear();
    this.cableView.set(this.level);
    this.pickups.setLevel(this.level);
    this.bountyView.set(this.level);
    this.twistView.set(this.level);
    this.floorStoken = this.run.stoken;
    this.bountySeen = false;
    this.lesson = 0;
    this.prev = from ? { x: this.prev.x + from.dx, y: this.prev.y + from.dy } : { x: this.skater.x, y: this.skater.y };
    if (!from) this.view.setLevel(this.level, this.seed, this.floor);
    const rain = this.applyMood(!!from);
    this.view.puddles.set(puddleSpots(this.level, this.seed, this.floor), rain);
    this.dripEdges = this.level.surfaces
      .filter((s) => s.kind === 'roof' || s.kind === 'overpass')
      .flatMap((s) => [toX(s.x0), toX(s.x1)].map((x) => ({ x, y: toY(this.level, s.y) })))
      .filter((e) => e.y > 0.5);
    if (!from) {
      this.view.zoom.reset();
      this.view.follow(this.skater.x, this.skater.y);
      this.sprite.play('push');
    }
    this.wantAhead();
    this.hud.floor(this.floor, this.road);
    this.hud.boons(this.boons);
    this.hud.board(this.board);
    this.hud.gear(this.gear);
    this.hud.money(this.run.cash, this.run.stoken);
    if (this.road.kind === 'hot') this.hud.callout('RUSH HOUR', 'bad');
    if (this.road.kind === 'escape') {
      this.hud.callout(this.sim.chaser ? CHASER_CALLS[chaserLook()].start : `ESCAPE: ${label(this.road)}`, 'bad');
    }
  }

  // the floor's gate: pay floor clear, then this floor's reward; the road taken is the next floor
  private finishFloor(now: number): void {
    this.carry = carriedHeat(this.sim.heat.value, gnarCarry(this.gnar));
    this.gear = { ...this.sim.gear };
    this.sound?.play(MOMENT.gate);
    if (this.tutorial) return this.endTutorial();
    if (this.road.kind === 'escape') return this.clearAct(now, this.road.act);
    const pts = this.run.clearFloor(this.floor);
    //a wanted poster's bounty: the floor's Stoken again, for reaching the gate hot
    if (this.level.bounty) {
      const pay = bountyPay(this.run.stoken - this.floorStoken, this.sim.heat.value);
      this.run.stoken += pay;
      this.hud.callout(pay ? `BOUNTY CLAIMED +◆${pay}` : 'BOUNTY MISSED', pay ? 'good' : 'bad');
      if (pay) this.escapeFx.bounty(this.sprite.mesh.position.x, this.sprite.mesh.position.y);
    }
    const fork = this.level.fork;
    this.nextRoad = fork ? (this.sim.road === 'high' ? fork.high : fork.low) : FIRST_ROAD;
    const road = this.road;
    if (road.kind === 'boon' || road.kind === 'hot') {
      if (road.kind === 'hot') this.run.addCash(ROADS.hotCash(this.floor));
      this.rerolls = 0;
      this.showOffer();
      this.openMenu('pick', now);
    } else if (road.kind === 'cash') {
      const pay = this.run.addCash(ROADS.cashPayout(this.floor));
      this.advance();
      this.hud.callout(`+${pay} CASH`, 'good');
    } else {
      const pay = ROADS.stashStoken(this.floor) * this.run.stokenScale;
      this.run.stoken += pay;
      this.advance();
      this.hud.callout(`+${pay} STOKEN`, 'good');
    }
    if (road.kind !== 'cash' && road.kind !== 'stash') this.hud.callout(`FLOOR CLEAR +${pts}`, 'good');
  }

  // through an act's escape: pay out, and the last act wins the run; the road picked before it comes next
  private clearAct(now: number, act: number): void {
    const cash = this.run.addCash(ESCAPE.actCash(act));
    const stoken = ESCAPE.actStoken(act) * this.run.stokenScale;
    this.run.stoken += stoken;
    this.run.score += this.run.clearFloor(this.floor) * 2;
    if (act >= ACTS) return this.endRun(now, false, true);
    this.advance();
    this.hud.callout(`ACT ${act} CLEAR +$${cash} +◆${stoken}`, 'good');
  }

  private rerollCost(): number {
    //Lucky Reroll: the first one on each pick is free
    if (this.rerolls === 0 && skaterMods(this.boons).freeReroll) return 0;
    return 15 + 10 * this.rerolls;
  }

  private showOffer(): void {
    const road = this.road;
    const run = { floor: this.floor, boons: this.boons, library: this.meta.library };
    const extra = skaterMods(this.boons).extraCards; // Hustler
    this.offer =
      road.kind === 'hot'
        ? offerBoons(this.seed, run, gnarCards(4 + extra, this.gnar), undefined, this.rerolls)
        : offerBoons(this.seed, run, gnarCards(3 + extra, this.gnar), road.kind === 'boon' ? road.boonType : undefined, this.rerolls);
    const cost = this.rerollCost();
    this.hud.pick(this.offer, {
      title: road.kind === 'hot' ? 'HOT STREET: PICK ANY BOON' : `PICK A ${label(road)}`,
      rerollCost: cost,
      canReroll: this.run.cash >= cost,
    });
    this.hud.money(this.run.cash, this.run.stoken);
  }

  private reroll(): void {
    if (this.swapping) return;
    const cost = this.rerollCost();
    if (this.run.cash < cost) return;
    this.run.cash -= cost;
    this.rerolls++;
    this.showOffer();
  }

  private advance(): void {
    //an act ends with its escape, before the road picked at the third floor's fork
    if (endsAct(this.floor) && this.road.kind !== 'escape') return this.goTo(this.floor, { kind: 'escape', act: actOf(this.floor), danger: 3 });
    //the shop road: shop first, then the boon street after it; the same for the underground spot
    if (this.nextRoad.kind === 'shop') {
      this.openShop();
      return;
    }
    if (this.nextRoad.kind === 'spot') {
      this.openMenu('under', performance.now());
      this.hud.under({ step: 'menu', heat: this.carry, canSwap: this.boons.length > 0, curses: cursesHeld(this.boons).length });
      return;
    }
    this.goTo(this.floor + 1, this.nextRoad);
  }

  // the next floor is decided: skate on to it (the menus are closed; the switch itself is at the join, in cross)
  private goTo(floor: number, road: Road): void {
    this.pending = { floor, road };
    this.state = 'skate';
    this.input.clear();
    if (this.tutorial) {
      this.tutorial = false;
      this.tutorialOut = true;
    }
  }

  // what comes after this floor, by the road you leave it on (the same choices advance makes): the tutorial leads to
  // the run's first floor, the third floor of an act to its escape, the shop and the spot to the boon street after
  private next(road: Road): { floor: number; road: Road } {
    if (this.tutorial || this.tutorialOut) return { floor: this.startAt, road: this.firstRoad() };
    if (endsAct(this.floor) && this.road.kind !== 'escape') return { floor: this.floor, road: { kind: 'escape', act: actOf(this.floor), danger: 3 } };
    return { floor: this.floor + 1, road: floorRoad(road) };
  }

  // every floor this one can lead to: one per road at its fork (an escape goes on by the road picked before it)
  private following(): { floor: number; road: Road }[] {
    if (this.pending) return [{ ...this.pending, road: floorRoad(this.pending.road) }];
    if (this.road.kind === 'escape') return this.road.act >= ACTS ? [] : [this.next(this.nextRoad)];
    const fork = this.level.fork;
    return fork ? [this.next(fork.high), this.next(fork.low)] : [this.next(FIRST_ROAD)];
  }

  private spec(n: { floor: number; road: Road }): FloorSpec {
    return { seed: this.seed, floor: n.floor, road: n.road, library: this.meta.library, gnar: this.gnar, tutorial: false };
  }

  // start building every floor this one can lead to, in the background
  private wantAhead(): void {
    const specs = this.following().map((n) => this.spec(n));
    this.prefetch.keep(specs);
    for (const s of specs) this.prefetch.want(s);
    this.view.dropAheads(specs.map(specKey));
  }

  // the floor ahead on screen: the one the skater's road leads to (the low road until they take the high one).
  // Its scenery builds a step a frame once it's back from the worker, and shows when the skater nears the join
  private showAhead(): void {
    const all = this.following();
    if (!all.length) return this.view.showAhead(null);
    const road = this.sim.road ?? this.sim.roadAhead ?? 'low';
    const pick = all.length === 1 ? all[0] : all[road === 'high' ? 0 : 1];
    const key = specKey(this.spec(pick));
    //the picked road's floor builds first, then the other road's, so switching roads never waits on a build
    for (const n of [pick, ...all.filter((n) => n !== pick)]) {
      const spec = this.spec(n);
      const k = specKey(spec);
      if (this.view.hasAhead(k)) continue;
      const level = this.prefetch.ready(spec);
      if (level) this.view.buildAhead(k, level, this.seed, n.floor, this.level.width / TILE, -(level.streetY - level.startY) / TILE);
      break;
    }
    this.view.showAhead(this.skater.x > this.level.width - AHEAD_TILES * TILE ? key : null);
  }

  // the skater reached the end of the floor: the next one takes over where they are, at their speed. The world
  // moves back by the next floor's origin (the view, the effects and the skater alike), so nothing on screen jumps
  private cross(): void {
    const next = this.pending!;
    const old = this.level;
    const road = floorRoad(next.road);
    const spec = this.spec({ floor: next.floor, road });
    const level = this.prefetch.get(spec);
    const x = old.width / TILE;
    const y = -(level.streetY - level.startY) / TILE;
    this.view.promote(specKey(spec), level, this.seed, next.floor, x, y);
    for (const fx of [this.particles, this.impacts, this.words, this.smashFx]) fx.shift(-x, -y);
    const skater = this.skater;
    this.floor = next.floor;
    this.road = road;
    this.level = level;
    this.tutorialOut = false;
    this.startFloor({ skater, dx: -old.width, dy: level.startY - old.streetY });
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
      gear: this.gear,
    });
    this.hud.money(this.shop.cash, this.run.stoken);
  }

  // a card dropped in the shop (src/ui/shop-drag.ts): a mod onto a slot buys it there, a slot onto a slot swaps
  // them; the slot and gear cards buy as they land on the board or the gear
  shopDrop(card: HTMLElement, target: HTMLElement): void {
    if (this.state !== 'shop' || !this.shop) return;
    if (card.dataset.stock !== undefined || card.dataset.slot !== undefined) {
      if (target.dataset.slot === undefined) return;
      this.shopPick = card.dataset.stock !== undefined ? { stock: Number(card.dataset.stock) } : { slot: Number(card.dataset.slot) };
      this.shopTap(target);
    } else this.shopTap(card);
  }

  // a tap in the shop: pick a mod then a slot to buy it there, or two slots to swap them
  shopTap(target: Element): void {
    if (this.state !== 'shop') return;
    const s = this.shop;
    if (!s) return;
    const el = target.closest<HTMLElement>('[data-stock],[data-slot],[data-buyslot],[data-restock],[data-gear],[data-done]');
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
    } else if (el.dataset.gear !== undefined) {
      //a new part: fresh, paid from the shop's cash
      const part = el.dataset.gear as GearPart;
      const got = replace(this.gear, s.cash, part);
      if (got) {
        this.gear = got.gear;
        next = { ...s, cash: got.cash };
        this.hud.gear(this.gear);
        this.hud.callout(`NEW ${GEAR.names[part].toUpperCase()}`, 'good');
      } else if (this.gear[part] < 100) this.hud.callout('NOT ENOUGH CASH', 'bad');
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

  // a tap at the underground spot
  private underTap(target: Element): void {
    const el = target.closest<HTMLElement>('[data-under]');
    if (el) this.underChoose(el.dataset.under!);
  }

  private underChoose(v: string): void {
    if (v === 'low') {
      this.carry = 0;
      this.hud.callout('LAYING LOW: HEAT 0', 'good');
      this.leaveUnder();
    } else if (v === 'swap' && this.boons.length) {
      this.hud.under({ step: 'drop', boons: this.boons });
    } else if (v.startsWith('drop:')) {
      //drop it, then a pick of any type
      const dropped = v.slice(5) as Held['id'];
      this.boons = dropBoon(this.boons, dropped);
      this.hud.boons(this.boons);
      this.hud.under(null);
      this.nextRoad = floorRoad(this.nextRoad);
      //never the one you just dropped
      const offer = offerBoons(this.seed, { floor: this.floor, boons: this.boons, library: this.meta.library }, 4, undefined, 1000 + this.floor);
      this.offer = offer.filter((b) => b.id !== dropped).slice(0, 3);
      this.swapping = true;
      this.hud.pick(this.offer, { title: 'SWAP: PICK ANY BOON', rerollCost: -1, canReroll: false });
      this.openMenu('pick', performance.now());
    } else if (v === 'curse' && cursesHeld(this.boons).length) {
      this.hud.under({ step: 'lift', boons: cursesHeld(this.boons) });
    } else if (v.startsWith('lift:')) {
      //a curse comes off whole
      const id = v.slice(5) as Held['id'];
      this.boons = this.boons.filter((b) => b.id !== id);
      this.hud.boons(this.boons);
      this.hud.callout('CURSE LIFTED', 'good');
      this.leaveUnder();
    } else if (v === 'skip') {
      this.leaveUnder();
    }
  }

  private leaveUnder(): void {
    this.hud.under(null);
    this.nextRoad = floorRoad(this.nextRoad);
    this.advance();
  }

  private pickBoon(i: number): void {
    const boon = this.offer[i];
    if (!boon) return;
    this.swapping = false;
    this.boons = addBoon(this.boons, boon.id);
    this.hud.pick(null);
    this.advance();
    this.hud.callout(boon.name.toUpperCase(), 'good');
    this.sound?.play(MOMENT.pick);
  }

  private endRun(now: number, caught: boolean, won = false): void {
    if (this.autopilot) this.playtest.runs.push({ floor: this.floor, won, caught, score: this.run.score });
    this.openMenu('over', now);
    const save = loadSave();
    const newBest = this.run.score > save.best;
    const today = dayKey();
    const dailyBest = save.daily.day === today ? save.daily.best : 0;
    const daily = this.meta.daily ? { best: Math.max(dailyBest, this.run.score), newBest: this.run.score > dailyBest } : null;
    const next = {
      ...save,
      best: Math.max(save.best, this.run.score),
      stoken: save.stoken + this.run.stoken,
      wins: save.wins + (won ? 1 : 0),
      gnar: won ? Math.max(save.gnar, this.gnar) : save.gnar,
      daily: daily ? { day: today, best: daily.best } : save.daily,
    };
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
      daily,
    });
  }

  private get skater(): Skater {
    return this.sim.skater;
  }

  // a tap on a boon card, or keys 1-3
  choose(i: number): void {
    if (this.state === 'pick' && performance.now() - this.menuAt >= MENU_LOCK_MS) this.pickBoon(i);
  }

  // pause only while skating; the menus are already a pause
  setPaused(on: boolean): void {
    if (on && this.state !== 'skate') return;
    if (on === this.paused) return;
    this.paused = on;
    this.input.clear();
    this.hud.pause(on);
  }

  // the pause card's QUIT RUN: the run ends here, with its summary (it still banks its Stoken)
  quitRun(): void {
    if (!this.paused || this.state !== 'skate') return;
    this.setPaused(false);
    this.endRun(performance.now(), false);
  }

  frame(now: number): void {
    //never negative: a frame's timestamp can come from before the game was made, and a negative step would
    //poison the time warp (and through it the camera and the physics clock) with NaN
    const realDt = Math.max(0, Math.min(0.1, (now - this.last) / 1000));
    this.last = now;
    //paused: the street holds its last frame and presses are dropped
    if (this.paused) {
      this.input.clear();
      this.sound?.update({ mode: 'roll', speed: 0, heat: 0, skating: false, over: false, paused: true });
      return;
    }
    //game time: frozen on a slam's hit-stop, then slow motion
    const dt = realDt * this.warp.scale * this.timeScale;
    this.warp.update(realDt * this.timeScale);
    if (this.autopilot && this.state !== 'skate' && this.state !== 'caught') this.botMenu(now);

    if (this.state === 'pick') {
      const press = this.input.takePress();
      const card = press ? this.input.lastTarget?.closest<HTMLElement>('[data-pick]') : null;
      if (card) this.choose(Number(card.dataset.pick));
      else if (press && this.input.lastTarget?.closest('[data-reroll]')) this.reroll();
    } else if (this.state === 'under') {
      if (this.input.takePress() && this.input.lastTarget && now - this.menuAt >= MENU_LOCK_MS) this.underTap(this.input.lastTarget);
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
        this.sim.combo = this.run.combo;
        this.floorFrames++;
        if (this.autopilot) {
          this.input.clear();
          this.checks?.before();
          this.sim.step(this.autopilot.input(this.sim));
          this.checks?.after();
        } else this.sim.step(this.input.sample());
        this.run.step(this.skater.mode);
        for (const e of this.sim.events) this.handle(e);
        //rolled off the end of the floor: the next one carries on from here
        if (this.finished && this.pending && this.skater.x >= this.level.width) this.cross();
      }, 5 * this.timeScale);
    }
    if (this.state !== 'over') {
      this.showAhead();
      this.view.tick();
    }
    this.blendMood(dt);

    if (this.state === 'skate' && this.sim.state !== 'skate' && !this.finished) this.logFloor(this.sim.state === 'exit' ? 'exit' : `${this.sim.state} at col ${Math.floor(this.skater.x / TILE)}`);
    if (this.state === 'skate' && this.sim.state === 'exit' && !this.finished) {
      this.finished = true;
      this.finishFloor(now);
    } else if (this.state === 'skate' && this.sim.state === 'bail') {
      this.endRun(now, false);
    } else if (this.state === 'skate' && this.sim.state === 'caught') {
      this.state = 'caught';
      this.menuAt = now;
      this.hud.callout(this.sim.chaser?.caught ? CHASER_CALLS[chaserLook()].caught : 'BUSTED!', 'bad');
      buzz(200);
      this.sound?.play(MOMENT.busted);
    }

    //traffic, the cruiser and the warnings
    this.trafficView.sync(this.level, this.sim.traffic.vehicles);
    this.elView.sync(this.level, this.sim.trains);
    this.cableView.sync(this.level, this.skater.x);
    this.trafficView.syncCross(this.level, this.sim.traffic.cross);
    this.trafficView.syncStreet(this.level, this.sim.traffic);
    const heat = this.state === 'pick' || this.state === 'over' ? 0 : this.sim.heat.value;
    this.trafficView.chase(this.level, this.skater.x, heat, this.sim.heat.holdT > 0, this.state === 'caught', dt * 1000, this.skater.y);
    this.hud.heat(heat);
    this.sound?.update({
      mode: this.skater.mode,
      speed: Math.max(Math.abs(this.skater.hsp), this.skater.railV),
      heat,
      skating: this.state === 'skate',
      over: this.state === 'over',
      paused: false,
    });
    this.heatCue.update(heat, dt);
    this.view.night.update(dt, this.skater.x / TILE, heat);
    this.view.gates.setRoad(this.sim.roadAhead);
    this.view.gates.setBounty(!!this.level.bounty && this.sim.heat.value >= BOUNTY.heat);
    this.hud.warn(
      this.state === 'skate' &&
        (this.sim.traffic.inLane.some((v) => v.speed < 0 && v.x0 - this.skater.x > 17 * TILE) ||
          (this.sim.chaser !== null && this.sim.chaser.gap < CHASER.warnAt)),
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
    //weaving between lanes A and B (src/gen/lanes.ts): ease over to the lane's depth, like a car changing lanes
    const laneTo = sk.lane === 1 ? LANE_B_Z : 0;
    this.sprite.mesh.position.z += (laneTo - this.sprite.mesh.position.z) * Math.min(1, dt * 10);
    //the board's angle from the sim: where its trucks touch the ground, the rail's slope, easing level in the air
    this.sprite.update(dt * 1000, this.skater, sk.feel.pitch);
    this.sprite.setGear(this.sim.gear);
    //stood still on the board under a menu, hands up when busted
    this.sprite.hold(this.state === 'caught' ? 'busted' : this.state === 'skate' ? null : 'idle');
    this.impacts.update(dt);
    this.chopper.update(this.level, this.sim.chopper, dt);
    this.droneView.update(this.level, this.sim.swarm, dt);
    this.chaserView.update(this.level, this.sim.chaser, dt);
    this.twistView.update(dt, this.skater);
    if (this.state === 'skate') {
      const street = toY(this.level, this.level.streetY);
      const ch = this.sim.chopper;
      if (ch) this.escapeFx.chopper(toX(ch.x), street, ch.lit, ch.covers.some((c) => ch.x >= c.x0 && ch.x <= c.x1), dt);
      if (this.sim.chaser && this.chaserView.look) this.escapeFx.chaser(this.chaserView.look, this.chaserView.x, street, this.chaserView.surging, dt);
    }
    this.pedView.update(this.level, this.skater, dt, toX(this.skater.x), this.biome);
    this.phoneFx.update(this.pedView.phones());
    if (this.level.bounty && !this.bountySeen && this.state === 'skate' && this.skater.x >= this.level.bounty.x - 4 * TILE) {
      this.bountySeen = true;
      this.hud.callout(`WANTED: HEAT ${BOUNTY.heat}+ AT THE GATE PAYS 2× ◆`, 'trick');
    }
    const lesson = this.level.tutorial?.[this.lesson];
    if (lesson && this.state === 'skate' && this.skater.x >= lesson.x) {
      this.lesson++;
      this.hud.callout(lesson.text, 'trick');
    }
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
    this.smashFx.update(dt);
    this.visor.update(dt);
    this.words.update(realDt);
    this.focus.update(realDt, this.view.camera, this.sprite.mesh.position);
    this.flowFx(dt);
    this.hud.score(this.run.score, this.run.combo, this.run.stoke, this.run.gnarT / SCORE.gnarSecs, this.run.comboPoints * this.run.combo);
    this.hud.gear(this.sim.gear);
    this.view.zoom.update(dt, this.skater.mode);
    this.view.follow(x, y, dt);
    this.view.adapt(realDt * 1000);
    this.view.render();
    this.perf(realDt);
    this.updatePlaytest();
  }

  // the debug line: fps, the worst frame in the last second, draw calls, triangles, resolution and effects tier
  private perf(realDt: number): void {
    this.perfWorst = Math.max(this.perfWorst, realDt);
    this.perfT += realDt;
    if (this.perfT >= 1 || !this.perfText) {
      const info = this.view.renderer.info.render;
      this.perfText = `${Math.round(1 / Math.max(realDt, 1e-3))} fps · worst ${Math.round(this.perfWorst * 1000)} ms · ${info.calls} draws · ${Math.round(info.triangles / 1000)}k tris · res ${this.view.resolution.toFixed(2)} · fx ${FX.tier}`;
      this.perfT = 0;
      this.perfWorst = 0;
    }
    this.hud.debug(`${this.perfText} · ${this.skater.hsp.toFixed(1)} px/f`);
  }

  // speed lines past cruising speed, and the gnar state's glow and sparkle trail
  private flowFx(dt: number): void {
    const skating = this.state === 'skate';
    const gnar = skating && this.run.gnar;
    const sk = this.skater;
    const speed = sk.mode === 'rail' ? sk.railV : Math.abs(sk.hsp);
    const flow = skating ? Math.min(1, Math.max(0, (speed - PHYS.baseSpeed * FLOW_FROM) / (PHYS.baseSpeed * FLOW_RANGE))) : 0;
    this.clock += dt;
    if (skating) this.boonFx.update(dt, sk, this.sprite.mesh.position.x, this.sprite.mesh.position.y);
    if (this.flip && this.flip.left > 0) {
      this.flip.left -= dt;
      const p = this.sprite.mesh.position;
      if (this.skater.mode === 'air') this.particles.flipTrail(p.x, p.y + 0.08, this.flip.rgb, dt);
    }
    this.speedLines.update(dt, this.view.camera, FX.reduceMotion ? 0 : flow, gnar && !FX.reduceMotion);
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
    //in the rain, water drips off the roof edges round the view
    const rain = this.view.rain.amount;
    if (rain > 0 && this.dripEdges.length) {
      this.dripT -= dt * rain * DRIPS;
      while (this.dripT <= 0) {
        this.dripT += 1;
        const near = this.dripEdges.filter((e) => Math.abs(e.x - p.x) < 10);
        const e = near[Math.floor(Math.random() * near.length)];
        if (e) this.particles.spray(e.x + (Math.random() - 0.5) * 0.15, e.y - 0.05, { n: 1, colors: [[0.8, 0.9, 1]], life: [0.6, 0.9], size: [0.07, 0.09], speed: [0, 0.1], angle: [-Math.PI / 2, -Math.PI / 2], grav: 16, drag: 0, alpha: 0.8, z: 0.2, floor: 0 });
      }
    }
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
    //rails are metal; ledges, roof edges and banks are concrete
    this.particles.grind(x, y, 1, rate, dt, sk.material);
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
    //reduce motion: no hit-stop or focus lines; the burst, debris and sound word still land
    if (!FX.reduceMotion) {
      this.warp.hit(SLAM_FREEZE, SLAM_SLOW, SLAM_EASE);
      this.focus.trigger();
    }
    this.words.spawn(x, y);
    this.particles.debris(x, y, 1);
  }

  // a board mod fired: the effects the sim can't do itself
  private fire(effect: EffectId, slot: number): void {
    this.hud.fire(slot);
    this.boonFx.mod(effect, this.sprite.mesh.position.x, this.sprite.mesh.position.y);
    switch (effect) {
      case 'sparks':
        this.run.addStyle(BOARD.sparkStyle);
        this.particles.grindStart(...this.backTruck(), 1);
        this.particles.grindStart(...this.backTruck(), 1);
        break;
      case 'cashBurst':
        this.run.addCash(BOARD.cashBurst);
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

  // smashed a prop: a little style, maybe loot, and a Wrecking Ball for a quick chain; the break itself is the
  // effects' (src/render/smash.ts)
  private smashed(e: Extract<FloorSim['events'][number], { type: 'smash' }>): void {
    this.run.addStyle(SCORE.smash);
    this.smashChain = this.clock - this.smashAt < SMASH_CHAIN_SECS ? this.smashChain + 1 : 1;
    this.smashAt = this.clock;
    if (this.smashChain === SMASH_CHAIN) this.hud.callout('WRECKING BALL!', 'trick');
    if (e.loot === 'cash') {
      this.run.addCash(SCORE.smashCash);
      this.hud.money(this.run.cash, this.run.stoken);
    } else if (e.loot === 'stoken') {
      this.run.stoken += this.run.stokenScale;
      this.hud.money(this.run.cash, this.run.stoken);
      this.hud.callout('GOLDEN SMASH! STOKEN', 'good');
    }
    this.smash({ prop: e.prop, index: e.index, x: toX(e.x), y: toY(this.level, e.y), z: this.level.props[e.index]?.z, how: e.how, speed: Math.abs(this.skater.hsp) / PHYS.baseSpeed });
  }

  // a part of your gear wore past half, or is nearly done
  private worn(part: GearPart, level: 'worn' | 'busted'): void {
    const name = GEAR.names[part].toUpperCase();
    this.hud.callout(level === 'busted' ? `${name} BUSTED!` : `${name} WORN`, 'bad');
    const p = this.sprite.mesh.position;
    this.particles.gearWear(part, level === 'busted', p.x, p.y);
    this.hud.gear(this.sim.gear);
  }

  // stomped a drone: it's worth a trick's style, and goes down with a crunch
  private droneDown(index: number): void {
    const d = this.sim.swarm!.drones[index];
    this.run.addStyle(SCORE.drone);
    this.hud.callout('DRONE DOWN!', 'good');
    const x = toX(d.x) + 0.5;
    const y = toY(this.level, d.roof);
    this.particles.grindStart(x, y, -1);
    this.particles.grindStart(x, y, 1);
    this.words.spawn(x, y + 0.6, 'KRNCH!');
    this.view.shake(0.12);
  }

  private burst(size: number, shake: number): void {
    this.impacts.spawn(toX(this.skater.x), toY(this.level, this.skater.y), size);
    this.view.shake(shake);
  }

  private handle(e: FloorSim['events'][number]): void {
    this.sound?.play(cueFor(e));
    const b = buzzFor(e);
    if (b) buzz(b);
    if (e.type === 'mod') return this.fire(e.effect, e.slot);
    if (e.type === 'drone') return this.droneDown(e.index);
    if (e.type === 'smash') return this.smashed(e);
    if (e.type === 'wear') return this.worn(e.part, e.level);
    if (e.type !== 'pickup' && e.type !== 'near' && e.type !== 'decoy' && e.type !== 'slip') {
      this.sprite.onEvent(e);
      const p = this.sprite.mesh.position;
      this.boonFx.event(e, p.x, p.y, Math.max(this.skater.railV, Math.abs(this.skater.hsp)));
    }
    const wasGnar = this.run.gnar;
    const bank = this.run.onEvent(e, this.skater.hsp);
    const combo = this.run.combo > 1 ? ` x${this.run.combo}` : '';
    switch (e.type) {
      case 'trick':
        this.visor.ping();
        this.view.zoom.trick();
        this.flip = { rgb: TRICK_TRAIL[e.name] ?? TRICK_TRAIL.kickflip, left: FLIP_TRAIL_SECS, at: this.clock };
        this.hud.callout(trickName(e.name, e.fakie) + combo, 'trick');
        break;
      case 'grind':
        this.particles.grindStart(...this.backTruck(), 1);
        this.hud.callout(this.sprite.grindName + combo, 'trick');
        break;
      case 'rail':
        this.particles.grindStart(...this.backTruck(), 1);
        this.hud.callout(this.sprite.grindName + combo, 'trick');
        break;
      case 'hop':
        this.hud.callout('CAR HOP!' + combo, 'good');
        break;
      case 'lane': {
        //which road the lane leads to, from the fork's signs
        const fork = this.level.fork;
        const to = fork ? label(e.lane === 1 ? fork.high : fork.low) : '';
        this.hud.callout(`LANE ${e.lane === 1 ? 'B' : 'A'}${to ? ` · ${to}` : ''}`, 'good');
        break;
      }
      case 'kicker':
        this.view.zoom.trick();
        this.hud.callout('TAILGATE BOMB!' + combo, 'trick');
        this.particles.dust(toX(this.skater.x), toY(this.level, this.skater.y), 1);
        break;
      case 'pad':
        this.hud.callout('BUBBLE PADS!', 'good');
        this.particles.dust(toX(this.skater.x), toY(this.level, this.skater.y), 1);
        break;
      case 'tuck':
        this.hud.callout('TUCK AND ROLL!', 'good');
        this.view.shake(0.15);
        break;
      case 'slip':
        this.hud.callout('SLIPSTREAM!', 'trick');
        this.view.zoom.trick();
        break;
      case 'decoy':
        this.hud.callout('DECOY! HEAT 35', 'good');
        break;
      case 'near':
        //a slow-mo beat on a close call (GDD: Camera)
        this.warp.hit(0, 0.6, 0.35);
        this.hud.callout('CLOSE CALL!' + combo, 'good');
        break;
      case 'land':
        this.visor.ping();
        if (e.manual) this.hud.callout('MANUAL' + combo, 'trick');
        if (bank) {
          const how = bank.how === 'sketchy' ? 'SKETCHY ' : bank.how === 'big' ? 'BIG DROP ' : '';
          this.hud.callout(`${how}+${bank.points.toLocaleString()}` + (bank.cash ? ` · +${bank.cash} CASH` : ''), bank.how === 'sketchy' ? 'bad' : 'good');
          this.hud.money(this.run.cash, this.run.stoken);
        }
        //dust on every landing, scaled by how hard it came down (the sim's impact into the surface): a kiss barely
        //puffs, a heavy one bursts and kicks the camera, a sketchy one scuffs out lopsided. Slams have their own.
        {
          const impact = e.impact ?? this.fallSpeed;
          const x = toX(this.skater.x);
          const y = toY(this.level, this.skater.y);
          this.particles.dust(x, y, landDust(impact));
          if (impact >= FEEL.heavy) {
            this.burst(0.6, 0.12);
            this.view.shake(landKick(impact));
          }
          if (e.quality === 'sketchy' && !this.flip) this.particles.sketchyLanding(x, y, 1);
        }
        //a trick landed: clean if the board came round in good time, sketchy if it was caught at the last moment
        if (this.flip) {
          const x = toX(this.skater.x);
          const y = toY(this.level, this.skater.y);
          if (this.clock - this.flip.at < SKETCHY_SECS) {
            this.particles.sketchyLanding(x, y, 1);
            this.view.shake(0.12);
          } else this.particles.cleanLanding(x, y);
          this.flip = null;
        }
        //into a puddle: a crown of water, and a SPLSH! on a big drop
        {
          const x = toX(this.skater.x);
          const y = toY(this.level, this.skater.y);
          if (this.view.puddles.at(x, y)) {
            const big = (e.impact ?? this.fallSpeed) >= FEEL.heavy;
            this.particles.splash(x, y, big ? 1.5 : 0.8);
            if (big) this.words.spawn(x, y, 'SPLSH!');
          }
        }
        break;
      case 'slam':
        this.flip = null;
        this.slam();
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
