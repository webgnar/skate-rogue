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
import { buy, buyGrip, buySlot, restock, restockPrice, rollStock, swap, type ShopState } from '../board/shop';
import { GRIP, gripDef, gripFor, type GripId } from '../board/grips';
import { RunScore, SCORE } from '../run/score';
import { SKY, skyMult } from '../sim/sky';
import { firstCloud } from '../gen/clouds';
import { freshGear, GEAR, replace, type Gear, type GearPart } from '../run/gear';
import { loadSave, whole, writeSave } from '../run/save';
import { NO_HEAD_START, prizeText, pullAll, type Pull } from '../run/slots';
import { boonsOfType, Missions, statsOf, type MissionsView, type MissionTick, type Stat } from '../run/missions';
import { gnarCards, gnarCarry, withGnar } from '../run/gnar';
import { buzzFor, cueFor, MOMENT } from '../audio/cues';
import type { Sound } from '../audio/sound';
import { SETTINGS, buzz } from '../ui/settings';
import { CAM } from '../render/camera';
import { cashScale, dayKey, DECK_SLOTS, FULL_LIBRARY, firstPick, STOCK, withLoadout, type Library, type Loadout } from '../run/meta';
import { PickupView } from '../render/pickups';

import { inHill, pitAt, type Level } from '../physics/level';
import type { Skater } from '../physics/skater';
import { StreetView } from '../render/scene';
import { TrafficView } from '../render/traffic-view';
import { STREET_Z } from '../traffic/traffic';
import { INTERP, at, keep } from './interp';
import { ElView } from '../render/el-view';
import { ChinatownView } from '../render/chinatown-view';
import { CableView } from '../render/cable-view';
import { Impacts } from '../render/impact';
import { GrindImpacts } from '../render/grind-impact';
import { WaterSplashes } from '../render/water-splash';
import { Particles, TRICK_TRAIL } from '../render/particles';
import { FocusLines } from '../render/focus-lines';
import { SoundWords } from '../render/sound-word';
import { TimeWarp } from './time-warp';
import { BulletTime, landCall } from './bullet-time';
import { glowMaterial, INK, inkify, outlineMaterial, silhouetteInk } from '../render/toon';
import { SpeedLines } from '../render/speed-lines';
import { FlipLines } from '../render/flip-lines';
import { FX } from '../render/fx-settings';
import { HeatCue } from '../render/heat-cue';
import { BoonFx } from '../render/boon-fx';
import { SmashFx, type SmashHit } from '../render/smash';
import { VisorGlint, VISOR_TINT } from '../render/visor-glint';
import { flatGeometry, propPieces } from '../render/models';
import { hideProp, propsFor, restyle } from '../render/props';
import { BIOMES, biomeMood, type BiomeId } from '../render/biomes';
import { SkaterLight } from '../render/skater-light';
import { clockFor, mixMood, moodAt, rainLevel, rainy, WEATHER, type Mood } from '../render/atmosphere';
import { chinatownPuddles, puddleSpots } from '../render/puddles';
import { FloorSim, type FloorEvent } from '../sim/floor';
import { ChopperView } from '../render/chopper-view';
import { SkyView } from '../render/sky-view';
import { SewerView } from '../render/sewer-view';
import { EscapeFx } from '../render/escape-fx';
import { shopSpot } from '../render/shop-front';
import { DroneView } from '../render/drone-view';
import { CHASER_CALLS, chaserLook, ChaserView } from '../render/chaser-view';
import { PedView } from '../render/peds';
import { PhoneFx } from '../render/phone-fx';
import { CHASER } from '../sim/chaser';
import { SHOTS, type ShotEvent } from '../sim/shots';
import { ShotsView } from '../render/shots-view';
import { TwistView } from '../render/twist-view';
import { BountyView } from '../render/bounty-view';
import { BOUNTY, bountyPay } from '../run/bounty';
import { PHYS, TILE } from '../physics/constants';
import { LIFT, SkaterRig } from '../render/skater-rig';
import { ShardAura } from '../render/shard-aura';
import { SLIDES, trickName } from '../physics/tricks';
import { parkedPaint, toX, toY, WATER_TOP } from '../render/kit';
import { CarHopFx, damageParked, parkedDamage, slideParked } from '../render/car-damage';
import { OneButton } from './input';
import { FixedStep } from './loop';
import { FEEL } from '../physics/feel';
import { Pilot, type PilotStyle } from '../bot/pilot';
import { FloorChecks, type Finding } from '../bot/checks';
import { reproQuery } from '../bot/repro';
import { makeRng } from '../gen/rng';
import { landDust, landKick } from '../render/land-fx';
import { CollisionDebug } from '../render/collision-debug';
import { DEV, devSpeed, takeStep } from '../ui/dev';

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
  continues: number; // continues used this run
}

// a run-ending fall offers a continue (zack, 2026-10-25: "i want to give the player 3 Continues, before they have to
// start all over")
export interface ContinueView {
  caught: boolean;
  left: number; // continues left, this one included
  floor: number;
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

// the skater's ink outline in CSS px (the city's is INK.width, 2.2): thicker since Lou grew (zack, 2026-10-30)
const SKATER_INK = 3;
// the paper-white line round the skater's ink, as a fraction of the ink's width (zack: "half the thickness", then thinner: a third)
const SKATER_HALO = 0.33;
const PAPER = 0xfffaeb; // the flip lines' paper white (flip-lines.ts HALO_RGB)

export interface ShopView {
  shop: ShopState;
  picked: ShopPick;
  slotPrice: number;
  restockPrice: number;
  maxSlots: number;
  gear: Gear; // what your gear is at; the shop sells new parts
  grip: GripId; // the grip on the board; the shop sells one other colour (shop.grip)
  gripPrice: number;
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
  noGround?(n: number, mult: number, bonus: number, banked: boolean, label?: string): void; // NO GROUND's meter (src/sim/sky.ts), or DOWNSTREAM's (src/sim/floor.ts)
  pause(paused: boolean): void; // show or hide the pause card
  heat(value: number): void;
  warn(show: boolean): void; // an oncoming car is on its way
  board(slots: Slots): void;
  fire(slot: number): void; // a board slot just fired
  shop(view: ShopView | null): void; // null hides the shop
  under(view: UnderView | null): void; // the underground spot; null hides it
  gear(gear: Gear): void; // how worn your deck, shoes, trucks, wheels and bearings are
  gearTick(part: GearPart): void; // a part just took a hit of wear (a puddle, broken glass)
  cont(view: ContinueView | null): void; // the continue card after a bail or a bust; null hides it
  continues(left: number): void; // continues left this run
  missions(view: MissionsView): void; // the three missions and Skater Rank (pause card and run summary)
  missionTick?(t: MissionTick): void; // a mission moved on mid-run: the popup above the gear wear
  missionDone?(t: MissionTick): void; // a mission finished mid-run: the popup goes gold
  slots(view: SlotsView | null): void; // the end-of-run slot machine, before the summary; null hides it
  slotsSkip(): void; // stop every reel where it lands
}

// the slot machine: one machine per spin token, all pulled at once
export interface SlotsView {
  pulls: { reels: Pull['reels']; text: string; big: boolean }[];
}

export const SLOT_MS = 1500; // the reels spin this long before the last one stops (src/ui/slots-panel.ts)

type State = 'skate' | 'caught' | 'cont' | 'pick' | 'shop' | 'under' | 'slots' | 'over';

// continues a run: each puts you back at the start of the floor you fell on, as you were when you started it (score,
// cash, gear, Heat), so a continue can't farm a floor's cash; after the last, a fall ends the run
export const CONTINUES = 3;

const CAUGHT_BEAT_MS = 800;
//one street: the floor ahead comes into view this far before the join (tiles), and the light and weather blend
//from one floor's to the next's over this long after it
const AHEAD_TILES = 44;
const MOOD_BLEND_SECS = 4;

// going under in a canal: how deep (world units, enough to cover him) and how long, and when the continue card comes up
const SINK = { depth: 4.5, secs: 1.5, wait: 1.7 };
const MENU_LOCK_MS = 300; // taps right after a menu opens are ignored
const CONT_LOCK_MS = 700;
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
const SLIDE_FLAKES = 0.8; // paint flakes per spark the same grind would throw: fewer, they hang around longer

export class Game {
  private level: Level;
  private sim: FloorSim;
  private trafficView = new TrafficView();
  private elView = new ElView(); // the L's trains
  private chinatownView = new ChinatownView(); // Chinatown's cross traffic and cabs
  private cableView = new CableView(); // the cable cars up the later stretches of hill
  private prev = { x: 0, y: 0 };
  private loop = new FixedStep();
  private floor = 1;
  private boons: Held[] = [];
  private state: State = 'skate';
  // ?clouds: each new floor starts up on its cloud layer's first cloud, to try it without the climb
  startOnClouds(): void {
    this.cloudStart = true;
    this.toClouds();
    this.view.follow(this.skater.x, this.skater.y);
  }

  // ?sewer (or ?sewer=rats, surge, bowl, subway, gator, kick, gate): each new floor starts on the street just before
  // the way into one of its sewers (src/gen/sewer.ts), the one with that piece if there is one, to try it straight away
  startInSewer(want: string): void {
    this.sewerStart = want || 'any';
    this.toSewer();
    this.view.follow(this.skater.x, this.skater.y);
  }

  private toSewer(): void {
    const all = this.level.sewers ?? [];
    const want = this.sewerStart;
    const s =
      all.find((w) => w.piece?.kind === want || (want === 'gator' && w.gator) || (want === 'kick' && w.kicks?.length) || (want === 'gate' && w.gate) || (want === 'stairs' && w.stairs?.length)) ?? all[0];
    if (s) Object.assign(this.sim.skater, { x: s.drain[0] - 3 * TILE, y: this.level.streetY, mode: 'roll', surface: null, hsp: 3.5, carry: 0, vsp: 0 });
  }

  // ?shop: the run starts on act 1's escape, skating up to its gate with the shop picked: GNAR SUPPLY stands
  // behind the gate and the shop opens there (main.ts sets ?escape=1 for it)
  startAtShop(): void {
    this.nextRoad = { kind: 'shop', boonType: 'POP', danger: 1 };
    Object.assign(this.sim.skater, { x: this.level.exitX - 24 * TILE, y: this.level.streetY, mode: 'roll', surface: null, hsp: 3.5, carry: 0, vsp: 0 });
    this.view.standShop(this.shopAtGate());
    this.view.follow(this.skater.x, this.skater.y);
  }

  // where the shop's front stands on this floor (tiles), if its gate leads to the shop: an escape's gate does when
  // the road picked before it was the shop's; a floor with the shop at its fork does unless it ends an act (its
  // gate leads to the escape, and the shop comes after that)
  private shopAtGate(): number | null {
    const at = shopSpot(this.level);
    if (at === null || this.tutorial) return null;
    if (this.road.kind === 'escape') return this.nextRoad.kind === 'shop' ? at : null;
    return endsAct(this.floor) ? null : at;
  }

  private toClouds(): void {
    const c = firstCloud(this.level);
    if (c) Object.assign(this.sim.skater, { x: c.x0 + 8, y: c.y - 2, mode: 'air', hsp: 5, carry: 5, vsp: 0 });
  }

  private skyBonus = 0; // NO GROUND: extra cash the live line has paid
  private skyBanked: { n: number; mult: number; bonus: number; t: number; label?: string } | null = null; // the last line, held up a moment
  private sewerStart = ''; // ?sewer: each new floor starts at the way into a sewer
  private cloudStart = false; // ?clouds: each new floor starts up on its cloud layer (src/gen/clouds.ts)
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
  private readonly grindFlash = new GrindImpacts();
  private readonly splashes: WaterSplashes;
  private sink: { at: number; x: number; top: number; bubble: number } | null = null; // went into the canal: going under
  private readonly chopper = new ChopperView();
  private readonly topChopper = new ChopperView(); // over the top route (src/sim/sky.ts)
  private readonly skyView = new SkyView();
  private readonly sewerView = new SewerView();
  private readonly droneView = new DroneView();
  private readonly chaserView = new ChaserView();
  private readonly shotsView = new ShotsView();
  private shotsCalled = false; // told the player this floor that the guards shoot
  private readonly pedView = new PedView();
  private readonly phoneFx = new PhoneFx();
  private readonly bountyView = new BountyView();
  private readonly twistView = new TwistView();
  private floorStoken = 0; // Stoken at the floor's start, for a bounty
  private continuesLeft = CONTINUES;
  private contCaught = false; // the continue card is up after a bust (not a bail)
  // the run as it was when this floor started: a continue puts it back
  private floorStart: { run: RunScore; gear: Gear; carry: number } | null = null;
  private bountySeen = false;
  private tutorial = false; // on the tutorial floor, before the run's first floor
  private tutorialOut = false; // through the tutorial's gate, rolling on to the run's first floor
  private lesson = 0; // the next tutorial prompt
  private get gnar(): number {
    return this.meta.gnar ?? 0;
  }
  private spotState = 'hunt';
  private readonly particles = new Particles();
  private paint: number[][] = [[0.78, 0.19, 0.17]]; // the deck's colours, for a slide's paint flakes (SkaterRig.deckPaint)
  private readonly focus = new FocusLines();
  private readonly escapeFx = new EscapeFx(this.particles);
  private readonly words = new SoundWords();
  private readonly warp = new TimeWarp();
  private readonly bullet = new BulletTime();
  private readonly speedLines = new SpeedLines();
  private readonly flipLines = new FlipLines(FX.flipLines);
  private readonly boonFx = new BoonFx(this.particles);
  readonly smashFx = new SmashFx(this.particles, {
    word: (x, y, w) => this.words.spawn(x, y, w),
    shake: (a) => this.view.shake(a),
    pieces: (prop) => propPieces(prop), // the Blender break pieces (art/props.py)
    hide: (index) => hideProp(this.level, index),
    geometry: (prop) => flatGeometry(prop), // the prop's own model, to break into pieces when it has none of its own
  });
  private readonly carFx = new CarHopFx(this.particles, this.smashFx, {
    word: (x, y, w) => this.words.spawn(x, y, w),
    shake: (a) => this.view.shake(a),
  });
  private pendingJolt: number | null = null; // a vehicle just hopped: squash it once it's rebuilt at its new stage
  private biome: BiomeId = 'chicago';
  private readonly heatCue = new HeatCue(document.getElementById('app') ?? document.body);
  private perfT = 0;
  private perfWorst = 0;
  private perfCpu = 0; // ms the game spent on its frames this second, and how many
  private perfFrames = 0;
  private frameAt = 0;
  private perfText = '';
  private readonly aura: ShardAura;
  private readonly skaterInk = glowMaterial(SKATER_INK, INK.color, 0);
  private readonly boardInk = glowMaterial(SKATER_INK, INK.color, 0);
  private readonly halo = [glowMaterial(SKATER_INK, PAPER, 0), glowMaterial(SKATER_INK, PAPER, 0)] as [THREE.ShaderMaterial, THREE.ShaderMaterial];
  private readonly visor: VisorGlint;
  private readonly skaterLight: SkaterLight;
  private gnarGlow = 0; // 0..1, eases with the gnar state
  private lastBeat = 0; // the soundtrack's beat count last frame (the gnar glow steps on each)
  private clock = 0;
  private readonly puddleRes = new THREE.Vector2();
  private ghostMesh: THREE.Mesh;
  private board: Slots = newBoard();
  private shop: ShopState | null = null;
  private shopPick: ShopPick = null;
  private shopVisits = 0;
  private gear: Gear = freshGear(); // worn down over the run, replaced at the shop
  private grip: GripId = loadSave().tape ?? GRIP.start; // the grip tape's colour, kept between runs (src/board/grips.ts)
  // the three missions and Skater Rank (src/run/missions.ts), kept between runs
  private readonly missions = new Missions(loadSave().missions);
  private floorSlams = 0; // slams this floor, for "clear a floor without slamming"
  private floorBusted = false; // a part busted this floor
  private overResult: RunResult | null = null; // the summary, shown once the slot machine's done
  private slotsEnd = 0; // when the slot machine's last reel stops
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
  private colDebug: CollisionDebug | null = null; // the collision overlay (?debug=collision, C), made on first use
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
    this.skyView.reset(this.sim.sky);
    this.sewerView.reset(this.level, this.sim.sewer);
    this.view.actor.add(this.sprite.mesh);
    //the rig makes its own toon materials (it flashes them on hits); this adds the outlines
    inkify(this.sprite.mesh, { toon: false });
    //the skater's ink a touch thicker than the city's, so it holds up at Lou's bigger size (SKATER_INK), and only
    //round the outside (silhouetteInk)
    silhouetteInk(this.sprite.mesh, this.sprite.boardGroup, outlineMaterial(), this.skaterInk, this.boardInk, this.halo);
    this.sprite.setGrip(gripDef(this.grip).color);
    this.aura = new ShardAura(this.sprite.mesh, this.sprite.boardGroup);
    this.visor = new VisorGlint(this.sprite.mesh);
    this.skaterLight = new SkaterLight(this.sprite.mesh);
    this.view.front.add(this.skaterLight.group);
    this.view.over.add(this.speedLines.mesh);
    this.view.withActor.add(this.grindFlash.group); // the grind-entry flash: the board cuts across it
    this.view.withActor.add(this.flipLines.mesh); // in depth with the skater: the board covers the lines (zack)
    this.impacts = new Impacts(() => this.view.resolution);
    this.splashes = new WaterSplashes(() => this.view.resolution);
    this.view.over.add(this.impacts.group, this.splashes.group, this.shotsView.front, this.particles.points, this.words.group, this.focus.mesh);
    this.view.scene.add(this.trafficView.group, this.elView.group, this.cableView.group, this.chinatownView.group, this.chopper.group, this.topChopper.group, this.skyView.group, this.sewerView.group, this.droneView.group, this.chaserView.group, this.shotsView.group, this.bountyView.group, this.pedView.group, this.phoneFx.group, this.twistView.group);
    this.view.front.add(this.trafficView.heatLights.front);
    this.view.scene.add(this.pickups.group);
    this.view.scene.add(this.particles.behind); // grind sparks: in the level's pass, so the skater draws over them
    this.ghostMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.12, 0.14),
      new THREE.MeshBasicMaterial({ color: 0x9ff3ff, transparent: true, opacity: 0.6 }),
    );
    this.ghostMesh.visible = false;
    this.view.scene.add(this.ghostMesh);
    this.view.scene.add(this.smashFx.group, this.smashFx.warm);
    this.hud.missions(this.missions.view(loadSave().stoken));
    if (!this.tutorial) this.headStart();
    this.playtest = { seed, floor: 0, label: '', district: this.biome, state: '', sim: '', x: 0, y: 0, mode: '', speed: 0, clip: '', boons: [], findings: [], floors: [], runs: [] };
    this.startFloor();
  }

  // the collision debug overlay (src/render/collision-debug.ts): on, off, or flipped
  toggleCollision(on = !this.colDebug?.on): void {
    if (on && !this.colDebug) this.colDebug = new CollisionDebug(document.getElementById('app')!, this.view.canvas);
    this.colDebug?.show(on);
    DEV.collision = on;
  }

  get pilot(): PilotStyle | null {
    return this.autopilot?.style ?? null;
  }

  get collision(): CollisionDebug | null {
    return this.colDebug?.on ? this.colDebug : null;
  }

  // hand the button to the playtest bot: 'ref' skates the validator's line, 'mash' presses at random (null: back to you)
  setAutopilot(style: PilotStyle | null): void {
    if (!style) {
      this.autopilot = null;
      this.checks = null;
      return;
    }
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
    //the playtest counts each fall as a run's end, as before continues
    else if (this.state === 'cont') {
      this.hud.cont(null);
      this.endRun(now, this.contCaught);
    }
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
    this.continuesLeft = CONTINUES;
    this.missions.reset('run');
    this.headStart();
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
    this.headStart();
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
    const own = propsFor(this.level);
    this.smashFx.smash({ ...hit, prop: own.placements[hit.index]?.shown ?? restyle(hit.prop, own.biome) ?? hit.prop });
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
    const rain = WEATHER.rain ?? (BIOMES[this.biome].dry ? 0 : rainLevel(this.seed, this.floor)); // no rain under the sea, indoors or in space
    const mood = moodAt(WEATHER.clock ?? clockFor(this.floor));
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
    this.skaterLight.setNight(look.neon, rain);
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
    this.sink = null;
    this.view.ghostOff = false;
    this.pending = null;
    this.colDebug?.reset();
    if (!from) {
      this.warp.reset();
      this.bullet.reset();
      this.particles.clear();
      this.splashes.clear();
      this.smashFx.clear();
      this.input.clear();
    }
    this.boonFx.setBoons(this.boons);
    this.floorStart = { run: Object.assign(new RunScore(), this.run), gear: { ...this.gear }, carry: this.carry };
    const roadHeat = this.road.kind === 'hot' ? ROADS.hotHeat : this.road.kind === 'escape' ? ESCAPE.startHeat : 0;
    const mods = withGnar(withLoadout(skaterMods(this.boons), this.meta.loadout), this.gnar);
    this.run.cashScale = cashScale(this.meta.loadout);
    this.sim = new FloorSim(this.level, mods, startHeat(roadHeat, this.carry), this.board, this.gear);
    this.skyView.reset(this.sim.sky);
    this.sewerView.reset(this.level, this.sim.sewer);
    if (from) this.sim.skater.carryOn(from.skater, from.dx, from.dy);
    else if (this.cloudStart) this.toClouds();
    else if (this.sewerStart) this.toSewer();
    //the last escape ends the run at its gate; every other floor rolls on into the next
    this.sim.rollOn = this.following().length > 0;
    if (this.autopilot) {
      this.checks = new FloorChecks(this.sim);
      this.reported = 0;
    }
    this.floorFrames = 0;
    this.run.scoreScale = mods.scoreScale;
    this.run.slamStoke = mods.slamStoke;
    this.run.stokenScale = mods.stokenScale;
    this.run.nearScale = mods.nearScale;
    this.carry = 0;
    this.trafficView.clear(!!from);
    this.elView.clear();
    this.cableView.set(this.level);
    this.chinatownView.clear();
    this.pickups.setLevel(this.level);
    this.bountyView.set(this.level);
    this.twistView.set(this.level);
    this.floorStoken = this.run.stoken;
    this.missions.reset('floor');
    this.floorSlams = 0;
    this.floorBusted = false;
    this.mission('floor', this.floor);
    this.bountySeen = false;
    this.lesson = 0;
    this.shotsCalled = false;
    this.prev = from ? { x: this.prev.x + from.dx, y: this.prev.y + from.dy } : { x: this.skater.x, y: this.skater.y };
    if (!from) this.view.setLevel(this.level, this.seed, this.floor);
    this.view.standShop(this.shopAtGate());
    const rain = this.applyMood(!!from);
    this.view.puddles.set(puddleSpots(this.level, this.seed, this.floor), rain, chinatownPuddles(this.level, this.seed, this.floor));
    //the sim wears the deck rolling through them, so it needs them in its own units
    this.sim.puddles = this.view.puddles.forSim().map((p) => ({ ...p, x: p.x * TILE, y: this.level.streetY - p.y * TILE, w: p.w * TILE }));
    this.dripEdges = this.level.surfaces
      .filter((s) => s.kind === 'roof' || s.kind === 'overpass')
      .flatMap((s) => [toX(s.x0), toX(s.x1)].map((x) => ({ x, y: toY(this.level, s.y) })))
      .filter((e) => e.y > 0.5);
    if (!from) {
      this.view.zoom.reset();
      this.view.drift.reset();
      this.view.rhythm.reset();
      this.view.close.reset();
      this.view.follow(this.skater.x, this.skater.y);
      this.sprite.play('push');
    }
    this.wantAhead();
    this.hud.floor(this.floor, this.road);
    this.hud.boons(this.boons);
    this.hud.board(this.board);
    this.hud.gear(this.gear);
    this.hud.continues(this.continuesLeft);
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
    if (!this.floorSlams) this.mission('cleanFloor');
    if (!this.floorBusted) this.mission('unbusted');
    if (this.sim.road === 'high') this.mission('topRoute');
    if (this.road.kind === 'escape') return this.clearAct(now, this.road.act);
    const pts = this.run.clearFloor(this.floor);
    //a wanted poster's bounty: the floor's Stoken again, for reaching the gate hot
    if (this.level.bounty) {
      const pay = bountyPay(this.run.stoken - this.floorStoken, this.sim.heat.value);
      this.run.stoken += pay;
      this.hud.callout(pay ? `BOUNTY CLAIMED +◆${whole(pay)}` : 'BOUNTY MISSED', pay ? 'good' : 'bad');
      if (pay) this.escapeFx.bounty(this.sprite.mesh.position.x, this.sprite.mesh.position.y);
    }
    const fork = this.level.fork;
    this.nextRoad = fork ? (this.sim.road === 'high' ? fork.high : this.sim.road === 'sewer' && fork.sewer ? fork.sewer : fork.low) : FIRST_ROAD;
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
      this.hud.callout(`+${whole(pay)} STOKEN`, 'good');
    }
    if (road.kind !== 'cash' && road.kind !== 'stash') this.hud.callout(`FLOOR CLEAR +${pts}`, 'good');
  }

  // through an act's escape: pay out, and the last act wins the run; the road picked before it comes next
  private clearAct(now: number, act: number): void {
    const cash = this.run.addCash(ESCAPE.actCash(act));
    const stoken = ESCAPE.actStoken(act) * this.run.stokenScale;
    this.run.stoken += stoken;
    this.run.score += this.run.clearFloor(this.floor) * 2;
    this.mission('act', act);
    if (act >= ACTS) {
      this.mission('escape');
      return this.endRun(now, false, true);
    }
    this.advance();
    this.hud.callout(`ACT ${act} CLEAR +$${cash} +◆${whole(stoken)}`, 'good');
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
    return fork ? [this.next(fork.high), this.next(fork.low), ...(fork.sewer ? [this.next(fork.sewer)] : [])] : [this.next(FIRST_ROAD)];
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
    const pick = all.length === 1 ? all[0] : all[road === 'high' ? 0 : road === 'sewer' && all[2] ? 2 : 1];
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
    this.trafficView.handOff(old);
    for (const fx of [this.particles, this.impacts, this.grindFlash, this.splashes, this.words, this.smashFx]) fx.shift(-x, -y);
    for (const ch of [this.chopper, this.topChopper]) ch.shift(-x, -y);
    const skater = this.skater;
    this.floor = next.floor;
    this.road = road;
    this.level = level;
    this.tutorialOut = false;
    this.startFloor({ skater, dx: -old.width, dy: level.startY - old.streetY });
  }

  private openShop(): void {
    this.shopVisits++;
    this.shop = { cash: this.run.cash, board: this.board.slice(), stock: rollStock(this.seed, this.shopVisits, 0), restocks: 0, grip: gripFor(this.seed, this.shopVisits, this.grip) };
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
      grip: this.grip,
      gripPrice: GRIP.price,
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
    const el = target.closest<HTMLElement>('[data-stock],[data-slot],[data-buyslot],[data-restock],[data-gear],[data-grip],[data-done]');
    if (!el) return;
    const pick = this.shopPick;
    let next: ShopState | null = s;
    if (el.dataset.stock !== undefined) {
      //zack: a tap buys the card into the first empty slot; with the board full, it's picked and the next slot
      //tapped is the one it replaces
      const i = Number(el.dataset.stock);
      const empty = s.board.indexOf(null);
      if (pick && 'stock' in pick && pick.stock === i) this.shopPick = null;
      else if (!s.stock[i]) this.shopPick = null;
      else if (empty >= 0) {
        next = buy(s, i, empty);
        this.shopPick = null;
        if (!next) {
          this.hud.callout('NOT ENOUGH CASH', 'bad');
          next = s;
        }
      } else this.shopPick = { stock: i };
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
    } else if (el.dataset.grip !== undefined) {
      //a new grip colour: on the board at once, and kept for later runs
      const id = s.grip;
      const got = buyGrip(s);
      if (got && id) {
        next = got;
        this.setGrip(id);
        this.hud.callout(`${gripDef(id).name.toUpperCase()} GRIP`, 'good');
      } else if (id) this.hud.callout('NOT ENOUGH CASH', 'bad');
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

  private setGrip(id: GripId): void {
    this.grip = id;
    this.sprite.setGrip(gripDef(id).color);
    writeSave({ ...loadSave(), tape: id });
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
    this.mission('grindBoons', boonsOfType(this.boons, 'GRIND'));
    this.mission('popBoons', boonsOfType(this.boons, 'POP'));
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
      stoken: save.stoken + whole(this.run.stoken),
      wins: save.wins + (won ? 1 : 0),
      gnar: won ? Math.max(save.gnar, this.gnar) : save.gnar,
      daily: daily ? { day: today, best: daily.best } : save.daily,
      missions: this.missionsKept(save),
    };
    //the spin tokens pull the slot machine: everything it pays is banked now, and shown before the summary
    const pulls = this.autopilot ? [] : this.spinSlots(next);
    writeSave(next);
    this.hud.missions(this.missions.view(next.stoken));
    const result: RunResult = {
      floor: this.floor,
      act: actOf(this.floor),
      won,
      wins: next.wins,
      boons: this.boons,
      caught,
      score: this.run.score,
      best: next.best,
      newBest,
      stoken: whole(this.run.stoken),
      bank: next.stoken,
      daily,
      continues: CONTINUES - this.continuesLeft,
    };
    if (!pulls.length) return this.hud.over(result);
    this.overResult = result;
    this.openMenu('slots', now);
    this.slotsEnd = now + SLOT_MS;
    this.hud.slots({ pulls: pulls.map((p) => ({ reels: p.reels, text: prizeText(p.prize, (id) => gripDef(id).name), big: p.reels[0] === p.reels[1] && p.reels[1] === p.reels[2] })) });
  }

  // pull the slot machine once per spin token; its winnings go into the save (Stoken, the next run's head start, a grip)
  private spinSlots(save: ReturnType<typeof loadSave>): Pull[] {
    if (!this.run.spins) return [];
    const won = pullAll(Math.random, this.run.spins, save.headStart, this.grip);
    save.stoken += won.stoken;
    save.headStart = won.head;
    if (won.grip !== this.grip) {
      save.tape = won.grip;
      this.grip = won.grip;
      this.sprite.setGrip(gripDef(won.grip).color);
    }
    return won.pulls;
  }

  // the slot machine's tap: the first stops the reels, the next goes on to the summary
  private slotsTap(now: number): void {
    if (now < this.slotsEnd) {
      this.hud.slotsSkip();
      this.slotsEnd = now;
      this.menuAt = now;
      return;
    }
    this.hud.slots(null);
    this.openMenu('over', now);
    if (this.overResult) this.hud.over(this.overResult);
    this.overResult = null;
  }

  // what the slot machine won last run: cash, free boons and a continue to start this one with
  private headStart(): void {
    if (this.autopilot) return;
    const save = loadSave();
    const h = save.headStart;
    if (!h.cash && !h.boons && !h.continues) return;
    writeSave({ ...save, headStart: NO_HEAD_START });
    if (h.cash) {
      this.run.cash += h.cash;
      this.hud.callout(`HEAD START +$${h.cash}`, 'good');
    }
    for (let i = 0; i < h.boons; i++) {
      const boon = offerBoons(this.seed + 977 * (i + 1), { floor: 1, boons: this.boons, library: this.meta.library }, 1)[0];
      if (!boon) continue;
      this.boons = addBoon(this.boons, boon.id);
      this.hud.callout(`FREE BOON: ${boon.name.toUpperCase()}`, 'good');
    }
    if (h.continues) {
      this.continuesLeft += h.continues;
      this.hud.callout(`+${h.continues} SAVED CONTINUE${h.continues > 1 ? 'S' : ''}`, 'good');
    }
  }

  // a bail or a bust: a continue while there are any left, else the run's over
  private fell(now: number, caught: boolean): void {
    if (this.continuesLeft <= 0 || !this.floorStart) return this.endRun(now, caught);
    this.contCaught = caught;
    this.openMenu('cont', now);
    this.hud.cont({ caught, left: this.continuesLeft, floor: this.floor });
  }

  // back to the start of this floor as you were when you started it
  private continueRun(): void {
    const at = this.floorStart;
    if (!at || this.continuesLeft <= 0) return;
    this.continuesLeft--;
    this.missions.reset('floor');
    this.run = Object.assign(new RunScore(), at.run);
    this.gear = { ...at.gear };
    this.carry = at.carry;
    this.hud.cont(null);
    this.startFloor();
    const left = this.continuesLeft;
    this.hud.callout(left ? `CONTINUE! ${left} LEFT` : 'LAST CHANCE!', left ? 'good' : 'bad');
    this.sound?.play(MOMENT.start);
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
    if (on) {
      const save = loadSave();
      if (this.missionsOn) writeSave({ ...save, missions: this.missionsKept(save) });
      this.hud.missions(this.missions.view(save.stoken));
    }
    this.hud.pause(on);
  }

  // the pause card's QUIT RUN: the run ends here, with its summary (it still banks its Stoken)
  quitRun(): void {
    if (!this.paused || this.state !== 'skate') return;
    this.setPaused(false);
    this.endRun(performance.now(), false);
  }

  // before a step: what everything that moves is drawn from, so it's drawn between steps like the skater (interp.ts)
  private keepForDrawing(): void {
    const sim = this.sim;
    for (const v of sim.traffic.vehicles) keep(v, 'x0', 'x1', 'lane', 'tunnel');
    for (const c of sim.traffic.cross) {
      keep(c, 'z', 'turn');
      keep(c.box, 'x0', 'x1');
    }
    for (const d of sim.traffic.doors) keep(d, 'open');
    for (const h of sim.traffic.hillCross) for (const c of h.cars) keep(c, 'z');
    for (const c of sim.traffic.cabs) {
      keep(c, 'turn', 'z');
      keep(c.box, 'x0', 'x1');
    }
    for (const t of sim.trains) {
      keep(t, 't');
      for (const b of t.boxes) keep(b, 'x0', 'x1');
    }
    if (sim.chaser) keep(sim.chaser, 'x');
    if (sim.chopper) keep(sim.chopper, 'x');
    keep(sim.sky.chopper, 'x');
    for (const f of sim.sky.flocks) keep(f, 'x', 'y');
    for (const p of sim.sky.pieces) keep(p, 'y', 'angle', 'x');
    for (const d of sim.swarm?.drones ?? []) keep(d, 'x', 'roof');
    for (const t of sim.sewer.tunnels) {
      for (const r of t.pack?.rats ?? []) keep(r, 'x');
      if (t.surge) keep(t.surge, 'front');
      if (t.train) keep(t.train, 't');
    }
  }

  frame(now: number): void {
    this.frameAt = performance.now();
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
    //the dev tools' slow motion (0: frozen, stepped a frame at a time)
    const col = this.collision;
    const frozen = devSpeed() === 0;
    const scale = this.timeScale * devSpeed();
    const dt = realDt * this.warp.scale * scale;
    this.warp.update(realDt * scale);
    this.bullet.update(realDt * scale);
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
    } else if (this.state === 'slots') {
      if (this.input.takePress() && now - this.menuAt >= MENU_LOCK_MS) this.slotsTap(now);
    } else if (this.state === 'over') {
      if (this.input.takePress() && now - this.menuAt >= MENU_LOCK_MS) this.newRun();
    } else if (this.state === 'cont') {
      //tap to continue; END RUN gives up
      //(a longer lock: you were likely mashing the button as you went down)
      if (this.input.takePress() && now - this.menuAt >= CONT_LOCK_MS) {
        if (this.input.lastTarget?.closest('[data-giveup]')) {
          this.hud.cont(null);
          this.endRun(now, this.contCaught);
        } else this.continueRun();
      }
    } else if (this.state === 'caught') {
      //the cruiser cuts in, then the summary
      if (now - this.menuAt >= CAUGHT_BEAT_MS) {
        this.fell(now, true);
      }
    } else {
      const step = () => {
        this.prev = { x: this.skater.x, y: this.skater.y };
        this.keepForDrawing();
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
        col?.afterStep(this.skater);
        this.run.step(this.skater.mode);
        for (const e of this.sim.events) this.handle(e);
        //rolled off the end of the floor: the next one carries on from here
        if (this.finished && this.pending && this.skater.x >= this.level.width) this.cross();
      };
      if (frozen) {
        if (takeStep()) step();
        this.loop.alpha = 1; // show exactly where the sim is
      } else this.loop.advance(dt, step, 5 * this.timeScale);
    }
    INTERP.alpha = this.loop.alpha;
    if (this.state !== 'over' && this.state !== 'slots') {
      this.showAhead();
      this.view.tick();
    }
    this.blendMood(dt);

    if (this.state === 'skate' && this.sim.state !== 'skate' && !this.finished && !this.sink) this.logFloor(this.sim.state === 'exit' ? 'exit' : `${this.sim.state} at col ${Math.floor(this.skater.x / TILE)}`);
    if (this.state === 'skate' && this.sim.state === 'exit' && !this.finished) {
      this.finished = true;
      this.finishFloor(now);
    } else if (this.state === 'skate' && this.sim.state === 'bail') {
      //into the canal: the splash, and he goes under before the continue card comes up
      if (!this.sink && this.inWater()) this.splashDown(now);
      if (!this.sink || now - this.sink.at >= SINK.wait * 1000) this.fell(now, false);
    } else if (this.state === 'skate' && this.sim.state === 'caught') {
      this.state = 'caught';
      this.menuAt = now;
      this.hud.callout(this.sim.chaser?.caught ? CHASER_CALLS[chaserLook()].caught : 'BUSTED!', 'bad');
      buzz(200);
      this.sound?.play(MOMENT.busted);
    }

    //where the skater is drawn this frame, between the sim's last two steps (the camera follows it)
    const a = this.loop.alpha;
    const x = this.prev.x + (this.skater.x - this.prev.x) * a;
    const y = this.prev.y + (this.skater.y - this.prev.y) * a;
    //traffic, the cruiser and the warnings
    this.trafficView.sync(this.level, this.sim.traffic.vehicles);
    if (this.pendingJolt !== null) {
      this.carFx.jolt(this.trafficView.meshOf(this.pendingJolt));
      this.pendingJolt = null;
    }
    this.elView.sync(this.level, this.sim.trains);
    this.cableView.sync(this.level, x);
    this.trafficView.syncCross(this.level, this.sim.traffic.cross);
    this.chinatownView.sync(this.level, this.sim.traffic);
    this.trafficView.syncStreet(this.level, this.sim.traffic);
    const heat = this.state === 'pick' || this.state === 'over' || this.state === 'slots' ? 0 : this.sim.heat.value;
    this.trafficView.chase(this.level, x, heat, this.sim.heat.holdT > 0, this.state === 'caught', dt * 1000, y, this.view.camera);
    if (this.trafficView.cruiserShown) this.trafficView.jets.exhaust(this.particles, toY(this.level, this.level.streetY), dt);
    this.hud.heat(heat);
    this.sound?.update({
      mode: this.skater.mode,
      speed: Math.max(Math.abs(this.skater.hsp), this.skater.railV),
      heat,
      skating: this.state === 'skate',
      over: this.state === 'over' || this.state === 'slots',
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

    this.sprite.mesh.position.x = toX(x);
    //landed on a lifted board: drawn lower while the legs reach down to it (src/physics/tuck.ts)
    //plus the lift that keeps the hero-sized board's wheels on the ground (skater-rig.ts BOARD_SIZE)
    this.sprite.mesh.position.y = toY(this.level, y + this.skater.feel.drop) + LIFT * this.sprite.mesh.scale.y - this.sinking(now, realDt);
    const sk = this.skater;
    //the board's angle from the sim: where its trucks touch the ground, the rail's slope, easing level in the air
    this.sprite.grab = sk.skitching ? this.chinatownView.grab(this.level, sk.skitching) : this.cableView.grab(sk.surface);
    this.sprite.update(dt * 1000, this.skater, sk.feel.pitch);
    this.sprite.setGear(this.sim.gear);
    //stood still on the board under a menu, hands up when busted
    this.sprite.hold(this.state === 'caught' ? 'busted' : this.state === 'skate' ? null : 'idle');
    this.impacts.update(dt);
    this.grindFlash.update(dt);
    this.splashes.update(realDt);
    this.chopper.update(this.level, this.sim.chopper, dt);
    const top = this.sim.sky.chopper;
    this.topChopper.update(this.level, this.sim.chopper || top.gone ? null : top, dt, { y: toY(this.level, this.sim.up ? y : this.level.streetY), pool: this.skater.grounded && this.sim.up });
    this.skyView.update(this.level, this.sim.sky, x, y, this.sim.up, dt, this.skater.gone);
    this.sewerView.update(dt);
    this.droneView.update(this.level, this.sim.swarm, dt);
    this.chaserView.update(this.level, this.sim.chaser, dt, (this.sim.shooter?.aimT ?? 0) > 0);
    this.shotsView.update(this.level, this.sim.shooter, this.chaserView.x + SHOTS.gun / TILE, this.sprite.mesh.position.x, dt);
    this.twistView.update(dt, this.skater);
    if (this.state === 'skate') {
      const street = toY(this.level, this.level.streetY);
      const ch = this.sim.chopper;
      if (ch) this.escapeFx.chopper(toX(at(ch, 'x')), street, ch.lit, ch.covers.some((c) => ch.x >= c.x0 && ch.x <= c.x1), dt);
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
    slideParked(this.view.currentKit, dt);
    this.carFx.update(dt, [...parkedDamage(this.view.currentKit), ...this.trafficView.damaged()]);
    this.visor.update(dt);
    this.words.update(realDt);
    this.focus.update(realDt, this.view.camera, this.sprite.mesh.position);
    this.flowFx(dt);
    this.hud.score(this.run.score, this.run.combo, this.run.stoke, this.run.gnarT / SCORE.gnarSecs, this.run.comboPoints * this.run.combo);
    //NO GROUND's meter: the live line, or the one just banked for a moment after
    //(down in the sewer the same meter is DOWNSTREAM's)
    const flow = this.sim.down ? this.sim.flowLine : 0;
    const line = Math.max(this.sim.skyLine, flow);
    const label = flow > this.sim.skyLine ? 'DOWNSTREAM' : 'NO GROUND';
    if (line >= 2) this.hud.noGround?.(line, skyMult(line), this.skyBonus, false, label);
    else if (this.skyBanked && this.skyBanked.t > 0) {
      this.skyBanked.t -= dt;
      this.hud.noGround?.(this.skyBanked.n, this.skyBanked.mult, this.skyBanked.bonus, true, this.skyBanked.label ?? 'NO GROUND');
    } else this.hud.noGround?.(0, 1, 0, false, label);
    if (line === 0) this.skyBonus = 0;
    this.hud.gear(this.sim.gear);
    this.view.zoom.update(dt, this.skater.mode);
    this.view.close.update(realDt * this.timeScale * devSpeed(), this.skater.mode, CAM.closeUp && SETTINGS.closeUp && !FX.reduceMotion);
    this.view.follow(x, y, dt, realDt * this.timeScale * devSpeed());
    this.view.adapt(realDt * 1000);
    this.view.render();
    this.perf(realDt);
    if (this.colDebug?.on) this.colDebug.draw(this.level, this.skater, this.view.camera, realDt, this.perfText, { x, y });
    this.updatePlaytest();
  }

  // the debug line: fps, the worst frame in the last second, draw calls, triangles, resolution and effects tier
  private perf(realDt: number): void {
    this.perfWorst = Math.max(this.perfWorst, realDt);
    this.perfT += realDt;
    //the game's own time on this frame (the GPU's share of a slow frame is the rest of it)
    this.perfCpu += performance.now() - this.frameAt;
    this.perfFrames++;
    if (this.perfT >= 1 || !this.perfText) {
      const info = this.view.renderer.info.render;
      //a shader compiled mid-run is a hitch: the loading screen should have made them all (StreetView.warm)
      const shaders = this.view.compiled ? ` · ${this.view.compiled} new shader${this.view.compiled > 1 ? 's' : ''}` : '';
      this.view.compiled = 0;
      const cpu = this.perfCpu / Math.max(1, this.perfFrames);
      this.perfCpu = this.perfFrames = 0;
      this.perfText = `${Math.round(1 / Math.max(realDt, 1e-3))} fps · worst ${Math.round(this.perfWorst * 1000)} ms · cpu ${cpu.toFixed(1)} ms · ${info.calls} draws · ${Math.round(info.triangles / 1000)}k tris · res ${this.view.resolution.toFixed(2)} · fx ${FX.tier}${shaders}`;
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
      if (this.skater.mode === 'air' && FX.flipLines === 'pixels') this.particles.flipTrail(p.x, p.y + 0.08, this.flip.rgb, dt);
    }
    this.flipLines.style = FX.reduceMotion ? 'pixels' : FX.flipLines;
    this.flipLines.update(dt, this.sprite.deck, this.view.camera, skating && !!this.flip && this.skater.mode === 'air');
    this.speedLines.update(dt, this.view.camera, FX.reduceMotion ? 0 : flow, gnar && !FX.reduceMotion);
    //the camera backs off in big air and at speed (reduce motion keeps the frame still)
    this.view.drift.update(dt, FX.reduceMotion ? 'roll' : sk.mode, FX.reduceMotion ? 0 : flow, skating && !FX.reduceMotion ? speed / PHYS.baseSpeed : 1);
    this.view.rhythm.combo(skating ? this.run.combo : 0);
    this.view.rhythm.update(dt, skating ? flow : 0);
    this.gnarGlow += ((gnar ? 1 : 0) - this.gnarGlow) * Math.min(1, dt * 6);
    //the glow's shards step on the soundtrack's beat (a steady 0.58 s pulse when there's no music to follow)
    const beat = this.sound?.beatIndex() ?? Math.floor(this.clock / 0.58);
    if (beat !== this.lastBeat && this.gnarGlow > 0.01) this.aura.beat();
    this.lastBeat = beat;
    //and dances to it: bass, mids and highs (bands.ts), held still with reduce motion
    const bands = this.sound?.bands(dt) ?? null;
    this.aura.set(this.gnarGlow, this.clock, this.view.resolution, FX.reduceMotion ? null : bands);
    this.skaterInk.uniforms.uWidth.value = Math.max(1, SKATER_INK * this.view.resolution);
    this.boardInk.uniforms.uWidth.value = this.skaterInk.uniforms.uWidth.value;
    for (const h of this.halo) h.uniforms.uWidth.value = Math.max(1.5, SKATER_INK * (1 + SKATER_HALO) * this.view.resolution);
    this.skaterLight.update(dt, this.sprite.mesh.position, (x, y, out) => this.view.night.lights.lightAt(x, y, out), this.gnarGlow > 0.01, this.view.resolution);
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
    this.grindFlash.follow(...(SLIDES.has(sk.stance) ? this.deckMiddle() : this.backTruck()));
    //a slide shreds the deck's paint off its middle; rails are metal; ledges, roof edges and banks are concrete
    if (SLIDES.has(sk.stance)) this.particles.slide(...this.deckMiddle(), 1, rate * SLIDE_FLAKES, dt, this.paint);
    else this.particles.grind(...this.backTruck(), 1, rate, dt, sk.material);
  }

  // a grind or slide locked on: sparks off the back truck, or a slide's burst of paint
  private grindStart(): void {
    if (!SLIDES.has(this.skater.stance)) {
      this.grindFlash.spawn(...this.backTruck());
      return this.particles.grindStart(...this.backTruck(), 1);
    }
    this.grindFlash.spawn(...this.deckMiddle());
    this.paint = this.sprite.deckPaint(); // as worn now
    this.particles.slideStart(...this.deckMiddle(), 1, this.paint);
  }

  // where the middle of the deck's underside meets the rail
  private deckMiddle(): [number, number] {
    const p = this.sprite.mesh.position;
    return [p.x, p.y];
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

  // bailed into a canal, not down a pit on the hill
  private inWater(): boolean {
    const x = this.skater.x;
    return !pitAt(this.level, x) && !inHill(this.level, x);
  }

  // broke the water: the comic splash (water-splash.ts), drops all round, a word, a shake
  private splashDown(now: number): void {
    const x = toX(this.skater.x);
    const top = toY(this.level, this.level.streetY) + WATER_TOP;
    this.sink = { at: now, x, top, bubble: 0.35 };
    this.view.ghostOff = true; // under the water he's hidden, not drawn through it as the ghost
    this.splashes.spawn(x, top, 1.3);
    this.particles.splash(x, top, 2.2);
    this.particles.splash(x, top, 1.4);
    this.words.spawn(x, top + 0.8, 'SPLOOSH!');
    this.view.shake(0.3);
    if (!FX.reduceMotion) this.view.punch(0.6);
  }

  // how far under the water the skater is drawn, world units; bubbles come up as he goes
  private sinking(now: number, dt: number): number {
    const s = this.sink;
    if (!s) return 0;
    const t = Math.min(1, (now - s.at) / 1000 / SINK.secs);
    s.bubble -= dt;
    if (s.bubble <= 0 && t < 1) {
      s.bubble = 0.22 + Math.random() * 0.2;
      this.splashes.ripple(s.x + (Math.random() - 0.5) * 0.4, s.top, 1 + Math.random() * 0.8);
      this.particles.splash(s.x + (Math.random() - 0.5) * 0.4, s.top, 0.12);
    }
    //drops in fast, then sinks slower and slower
    return SINK.depth * (1 - Math.pow(1 - t, 2.2));
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

  // bullet time (src/game/bullet-time.ts): a huge combo or a close call over a car glides the game into slow motion. Reduce motion skips it,
  // like the slam's hit-stop
  private bulletTime(combo: number, near = false): void {
    const speed = Math.abs(this.skater.hsp) / PHYS.baseSpeed;
    const s = near ? this.bullet.near(combo, speed) : this.bullet.combo(combo, speed);
    if (!s) return;
    if (!near) this.hud.callout(`x${combo} COMBO!`, 'trick');
    if (FX.reduceMotion) return;
    this.warp.glide(s.enter, s.slow, s.hold, s.ease);
    this.view.zoom.trick();
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
    //traffic ran it over: just the break
    if (e.how === 'car') {
      this.smash({ prop: e.prop, index: e.index, x: toX(e.x), y: toY(this.level, e.y), z: this.level.props[e.index]?.z, how: e.how, speed: 0.6 });
      return;
    }
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
    } else if (e.loot === 'spin') {
      this.run.spins++;
      this.hud.callout(this.level.props[e.index]?.stash ? `${this.sim.down ? 'DIY' : 'SKY'} STASH! SPIN TOKEN` : 'SPIN TOKEN!', 'trick');
    }
    this.smash({ prop: e.prop, index: e.index, x: toX(e.x), y: toY(this.level, e.y), z: this.level.props[e.index]?.z, how: e.how, speed: Math.abs(this.skater.hsp) / PHYS.baseSpeed });
  }

  // burst through a paper billboard up in the sky: it tears away in a comic burst, with cash in it
  private bustFx(e: Extract<FloorEvent, { type: 'bust' }>): void {
    this.skyBonus += Math.max(0, this.run.addCash(SKY.bustCash * e.mult) - SKY.bustCash);
    this.run.addStyle(SCORE.smash * 4);
    this.hud.money(this.run.cash, this.run.stoken);
    this.hud.callout('BILLBOARD BUST!', 'trick');
    const x = toX(e.x);
    const y = toY(this.level, e.y) + 0.8;
    this.skyView.bust(e.index);
    this.impacts.spawn(x, y, 0.8);
    this.words.spawn(x, y + 0.4, 'RRIP!');
    this.particles.dust(x, y, 0.8, true);
    this.view.shake(0.1);
  }

  // a car hop dented a car (src/traffic/damage.ts): it shows its new stage, and springs and dust burst out of it
  private dented(e: Extract<FloorEvent, { type: 'dent' }>): void {
    let paint = 0x9ea2aa;
    let z = 0;
    if ('vehicle' in e.car) {
      const id = e.car.vehicle;
      this.trafficView.damage(id, e.stage);
      //rebuilt as its new stage on the next sync; it squashes on the hop either way
      this.pendingJolt = id;
      const v = this.sim.traffic.vehicles.find((t) => t.id === id);
      if (v) {
        paint = this.trafficView.paintOf(v);
        z = v.lane * STREET_Z.back;
      }
    } else {
      this.carFx.jolt(damageParked(this.view.currentKit, this.level, e.car.parked, e.stage));
      paint = parkedPaint(this.level, e.car.parked);
    }
    this.carFx.hop(toX(e.x), toY(this.level, e.y), toY(this.level, this.level.streetY), z, e.stage, paint);
    //totaled: the comic burst and a punch in
    if (e.stage === 3) {
      this.impacts.spawn(toX(e.x), toY(this.level, e.y), 1.3);
      this.view.zoom.trick();
    }
  }

  // a part of your gear wore past half, or is nearly done
  private worn(part: GearPart, level: 'worn' | 'busted'): void {
    const name = GEAR.names[part].toUpperCase();
    this.hud.callout(level === 'busted' ? `${name} BUSTED!` : `${name} WORN`, 'bad');
    const p = this.sprite.mesh.position;
    this.particles.gearWear(part, level === 'busted', p.x, p.y);
    this.hud.gear(this.sim.gear);
  }

  // the guards shooting (src/sim/shots.ts): the tell, the bang, a hit or a dodge
  private shotFx(e: ShotEvent): void {
    const x = toX(e.x);
    const y = toY(this.level, e.y);
    switch (e.type) {
      case 'aim':
        //the first time on a floor, say what to do
        if (!this.shotsCalled) this.hud.callout('THEY SHOOT! OLLIE THE BULLETS!', 'bad');
        this.shotsCalled = true;
        break;
      case 'shot':
        this.shotsView.fired();
        this.chaserView.fired();
        this.view.shake(0.05);
        break;
      case 'shotHit':
        this.shotsView.hit(this.particles, x, y);
        this.words.spawn(x, y + 0.4, 'BLAM!');
        this.view.shake(0.25);
        break;
      case 'dodge':
        this.shotsView.dodged(this.particles, x, y);
        this.hud.callout('DODGED!', 'good');
        break;
    }
  }

  // the sewer's moving pieces (src/sim/sewer.ts): rats cleared or tripped over, the surge, the alligator, the subway
  private sewerFx(e: Extract<FloorSim['events'][number], { type: 'rats' | 'ratBump' | 'surge' | 'washed' | 'gator' | 'bite' | 'subway' }>): void {
    const x = toX(e.x);
    const y = toY(this.level, e.y);
    switch (e.type) {
      case 'rats':
        this.run.addStyle(SCORE.drone);
        this.hud.callout(`RAT HOP x${e.n}!`, 'good');
        this.words.spawn(x, y + 0.6, 'SKREE!');
        break;
      case 'ratBump':
        this.hud.callout('RATS!', 'bad');
        this.words.spawn(x, y + 0.4, 'SQUEAK!');
        this.view.shake(0.08);
        break;
      case 'surge':
        this.hud.callout('FLOOD! OUTRUN IT!', 'bad');
        this.view.shake(0.2);
        break;
      case 'washed':
        this.hud.callout('WASHED OUT!', 'bad');
        this.particles.splash(x, y, 1.6);
        this.words.spawn(x, y + 0.6, 'SPLOOSH!');
        this.hud.gearTick('deck');
        this.view.shake(0.25);
        break;
      case 'gator':
        //the sewer alligator: a spin token, in a burst of gold
        this.run.spins++;
        this.run.addStyle(SCORE.drone);
        this.hud.callout('SEWER GATOR! SPIN TOKEN', 'trick');
        this.particles.coin(x, y + 0.8, 0);
        break;
      case 'bite':
        this.hud.callout('CHOMP!', 'bad');
        this.words.spawn(x, y + 0.6, 'CHOMP!');
        this.view.shake(0.25);
        break;
      case 'subway':
        this.run.addStyle(SCORE.drone);
        this.hud.callout('SUBWAY GAP!', 'good');
        break;
    }
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

  // a perfect landing or grind: a pop of light and a kick of speed lines
  private perfectFx(): void {
    this.burst(0.5, 0.06);
    if (!FX.reduceMotion) this.view.zoom.trick();
  }

  private burst(size: number, shake: number): void {
    this.impacts.spawn(toX(this.skater.x), toY(this.level, this.skater.y), size);
    this.view.shake(shake);
  }

  // missions count for real runs only: not the tutorial floor or the playtest bot
  private get missionsOn(): boolean {
    return !this.tutorial && !this.autopilot;
  }

  // the save's missions after this run: ours, unless the bot or the tutorial was skating
  private missionsKept(save: ReturnType<typeof loadSave>) {
    return this.missionsOn ? this.missions.state : save.missions;
  }

  // count a stat towards the missions: a finished one calls out and swaps for the next, and a rank pays at once
  private mission(stat: Stat, n = 1): void {
    if (!this.missionsOn) return;
    const done = this.missions.add1(stat, n);
    for (const t of this.missions.ticked) this.hud.missionTick?.(t);
    if (!done.length) return;
    const save = loadSave();
    let bank = save.stoken;
    let tape = save.tape;
    for (const d of done) {
      this.hud.missionDone?.({ text: d.text, count: d.goal, goal: d.goal });
      this.sound?.play(MOMENT.pick);
      if (d.rank === undefined) continue;
      bank += d.pay ?? 0;
      this.hud.callout(`SKATER RANK ${d.rank}! +◆${d.pay}`, 'good');
      if (d.grip) {
        tape = d.grip;
        this.grip = d.grip;
        this.sprite.setGrip(gripDef(d.grip).color);
        this.hud.callout(`${gripDef(d.grip).name.toUpperCase()} GRIP!`, 'trick');
      }
    }
    writeSave({ ...save, stoken: bank, missions: this.missions.state, ...(tape ? { tape } : {}) });
    this.hud.missions(this.missions.view(bank));
  }

  // the pause card's or run summary's SKIP: a little Stoken for a new mission
  skipMission(i: number): void {
    if (!this.missionsOn || !(this.paused || this.state === 'over')) return;
    const save = loadSave();
    const bank = this.missions.skip(i, save.stoken);
    if (bank === null) return;
    writeSave({ ...save, stoken: bank, missions: this.missions.state });
    this.hud.missions(this.missions.view(bank));
  }

  private handle(e: FloorSim['events'][number]): void {
    this.sound?.play(cueFor(e));
    const b = buzzFor(e);
    if (b) buzz(b);
    //every event counts towards the missions first: smashes, door slams, wrecks and drones return early below
    for (const st of statsOf(e)) this.mission(st);
    if (e.type === 'mod') return this.fire(e.effect, e.slot);
    if (e.type === 'drone') return this.droneDown(e.index);
    if (e.type === 'smash') return this.smashed(e);
    if (e.type === 'dent') return this.dented(e);
    if (e.type === 'wear') {
      if (e.level === 'busted') this.floorBusted = true;
      return this.worn(e.part, e.level);
    }
    if (e.type === 'aim' || e.type === 'shot' || e.type === 'shotHit') return this.shotFx(e);
    if (e.type === 'dodge') this.shotFx(e);
    if (e.type === 'puddle') {
      //rolled through a puddle: a sheet of water off the wheels, and the bearings' bar ticks down blue
      const x = toX(e.x);
      const y = toY(this.level, e.y);
      this.particles.splash(x, y, 0.9);
      this.words.spawn(x, y + 0.3, 'SPLSH!');
      this.hud.gearTick('bearings');
      return;
    }
    if (e.type === 'glass') {
      //rolled over broken glass on good wheels: shards kicked out, a crunch, and the wheels' bar ticks down
      const x = toX(this.skater.x);
      const y = toY(this.level, this.skater.y);
      this.particles.shards(x, y);
      this.words.spawn(x, y + 0.3, 'CRNCH!');
      this.hud.gearTick('wheels');
      return;
    }
    if (e.type === 'skyChain') {
      //NO GROUND: another sky piece on the line, the coins up here worth more
      this.hud.callout(`NO GROUND! COINS x${e.mult}`, 'trick');
      return;
    }
    if (e.type === 'skyBank') {
      this.hud.callout(`SKY LINE x${e.mult}! +$${this.skyBonus}`, 'good');
      this.skyBanked = { n: e.n, mult: e.mult, bonus: this.skyBonus, t: 1.6 };
      this.skyBonus = 0;
      return;
    }
    if (e.type === 'bust') return this.bustFx(e);
    if (e.type === 'goldBird') {
      //the golden pigeon: a spin token, in a burst of gold
      this.run.spins++;
      this.hud.callout('GOLDEN PIGEON! SPIN TOKEN', 'trick');
      this.particles.coin(toX(e.x), toY(this.level, e.y) + 0.8, 0);
      return;
    }
    if (e.type === 'repair') {
      //a sky stash's fresh part: your most worn one, good as new
      this.hud.callout(`${this.sim.down ? 'DIY' : 'SKY'} STASH! FRESH ${GEAR.names[e.part].toUpperCase()}`, 'good');
      this.hud.gear(this.sim.gear);
      return;
    }
    if (e.type === 'sewer') {
      //into the sewer route: out of sight, the Heat cools; and back up through the outlet (or a kick-out's grate)
      this.hud.callout(e.down ? 'DOWN THE DRAIN!' : e.kicked ? 'KICKED OUT!' : 'BACK UP!', e.kicked ? 'bad' : 'good');
      return;
    }
    if (e.type === 'flowChain') {
      //DOWNSTREAM: another sewer piece on the line, the coins down here worth more
      this.hud.callout(`DOWNSTREAM! COINS x${e.mult}`, 'trick');
      return;
    }
    if (e.type === 'flowBank') {
      this.hud.callout(`FLOW LINE x${e.mult}! +$${this.skyBonus}`, 'good');
      this.skyBanked = { n: e.n, mult: e.mult, bonus: this.skyBonus, t: 1.6, label: 'DOWNSTREAM' };
      this.skyBonus = 0;
      return;
    }
    if (e.type === 'rats' || e.type === 'ratBump' || e.type === 'surge' || e.type === 'washed' || e.type === 'gator' || e.type === 'bite' || e.type === 'subway') return this.sewerFx(e);
    if (e.type === 'doorSlam') {
      //BAM: the door slams shut under the hop, a puff off its edge and a jolt
      this.hud.callout('DOOR SLAM!', 'good');
      this.particles.dust(toX(e.x), toY(this.level, e.y), 0.6);
      this.view.shake(0.12);
      return;
    }
    if (e.type !== 'pickup' && e.type !== 'near' && e.type !== 'decoy' && e.type !== 'slip' && e.type !== 'birds' && e.type !== 'dodge') {
      this.sprite.onEvent(e);
      const p = this.sprite.mesh.position;
      this.boonFx.event(e, p.x, p.y, Math.max(this.skater.railV, Math.abs(this.skater.hsp)));
    }
    const wasGnar = this.run.gnar;
    const before = this.run.combo;
    const cashBefore = this.run.cash;
    const bank = this.run.onEvent(e, this.skater.hsp);
    if (e.type === 'pickup' && e.mult) this.skyBonus += Math.max(0, this.run.cash - cashBefore - SCORE.cashCoin);
    if (this.run.combo > before) this.bulletTime(this.run.combo);
    if (bank) {
      this.mission('combo', bank.count);
      this.mission('bank', bank.points);
      if (bank.cash) this.mission('cashOut');
    }
    if (e.type === 'slam') this.floorSlams++;
    if (before > 0 && this.run.combo === 0) this.missions.reset('combo');
    const combo = this.run.combo > 1 ? ` x${this.run.combo}` : '';
    if (e.type === 'ollie' || e.type === 'hop' || e.type === 'kicker') this.view.rhythm.popped();
    switch (e.type) {
      case 'trick':
        this.visor.ping();
        this.view.zoom.trick();
        this.view.close.trick(this.run.combo);
        this.flip = { rgb: TRICK_TRAIL[e.name] ?? TRICK_TRAIL.kickflip, left: FLIP_TRAIL_SECS, at: this.clock };
        this.flipLines.trick(this.flip.rgb);
        this.hud.callout(trickName(e.name, e.fakie, e.nollie) + combo, 'trick');
        break;
      case 'grind':
      case 'rail':
        this.grindStart();
        this.view.close.grind();
        if (e.perfect) this.perfectFx();
        this.hud.callout((e.perfect ? 'PERFECT ' : '') + this.sprite.grindName + combo, 'trick');
        break;
      case 'hop':
        this.hud.callout('CAR HOP!' + combo, 'good');
        //the slam's comic burst on the roof, a third the size (zack)
        this.impacts.spawn(toX(this.skater.x), toY(this.level, this.skater.y), 1 / 3);
        break;
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
      case 'firecracker':
        this.hud.callout('FIRECRACKER!' + combo, 'trick');
        this.view.zoom.trick();
        break;
      case 'clack': {
        //the tail hits the step: concrete sparks and a puff off the edge, behind the feet
        const tail = toX(this.skater.x) - 0.4;
        const at = toY(this.level, this.skater.y);
        this.particles.grind(tail, at, -1, 720, 1 / 60, 'concrete');
        this.particles.dust(tail, at, 0.25);
        this.view.shake(0.04);
        break;
      }
      case 'slip':
        this.hud.callout('SLIPSTREAM!', 'trick');
        this.view.zoom.trick();
        break;
      case 'decoy':
        this.hud.callout('DECOY! HEAT 35', 'good');
        break;
      case 'birds':
        this.hud.callout('BIRD STRIKE!', 'bad');
        this.view.shake(0.2);
        break;
      case 'near':
        //bullet time on a close call (GDD: Camera), gliding in
        this.bulletTime(this.run.combo, true);
        this.hud.callout('CLOSE CALL!' + combo, 'good');
        break;
      case 'land': {
        this.visor.ping();
        //a flip caught right before the wheels touch, or a landing flush into a falling slope: a callout (slow-mo
        //here felt like running into something, zack 2026-10-26)
        const moment = landCall(e.quality, e.spare, e.flush);
        const called = e.perfect ? 'PERFECT! ' : moment === 'flush' ? 'FLUSH! ' : '';
        //PERFECT: a flip caught right before the wheels touched rolls away faster (src/physics/skater.ts)
        if (e.perfect) this.perfectFx();
        if (called && !bank) this.hud.callout(called.trim(), 'good');
        if (e.manual) this.hud.callout(this.sprite.manualName + combo, 'trick');
        if (bank) {
          const how = called || (bank.how === 'sketchy' ? 'SKETCHY ' : bank.how === 'big' ? 'BIG DROP ' : '');
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
          //every landing kicks the camera in a touch, a heavy one hard
          if (!FX.reduceMotion) this.view.drift.land(Math.min(1, 0.25 + impact / (FEEL.heavy * 1.4)));
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
          if (this.clock - this.flip.at < SKETCHY_SECS && moment !== 'clutch') {
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
      }
      case 'slam':
        this.flip = null;
        this.slam();
        break;
      case 'pickup':
        {
          const at = this.pickups.take(e.index);
          if (at) this.particles.coin(at.x, at.y, at.z);
        }
        this.hud.money(this.run.cash, this.run.stoken);
        if (e.kind === 'stoken') this.hud.callout('STOKEN!', 'good');
        if (e.kind === 'spin') this.hud.callout('SPIN TOKEN!', 'trick');
        break;
    }
    if (!wasGnar && this.run.gnar) this.gnarOn();
  }
}
