// The skater controller: Quest For Stoken's movement rules (calc_movement, jumped, check_grind,
// player_grinding_state, player_rail_state) on Lou Gnar's one-button auto-run. Pure: no rendering, no DOM.
import { NO_MODS, type Mods } from '../boons/mods';
import { NO_WEAR, type GearScale } from '../run/gear';
import { PHYS, TILE } from './constants';
import { Feel, FEEL, MATERIALS, MOMENTUM, misalign, alongSlope, landQuality, normalImpact, type LandQuality, type Material } from './feel';
import { Tuck } from './tuck';
import { LEDGE_GRINDS, MANUALS, NOSE_STANCES, RAIL_GRINDS, rollTrick, SPIN, TRICK_CATCH, type TrickId } from './tricks';
import { PIT, ceilingAt, currentAt, isStreetAt, pitAt, pits, surfaceMaterial, surfaceSlope, surfaceY, type Car, type CurvedRail, type Level, type Surface } from './level';

export type Mode = 'roll' | 'air' | 'grind' | 'rail' | 'bail' | 'exit';

export type SkaterEvent =
  | { type: 'ollie'; spin: 0 | 180; lip?: boolean; nose?: boolean } // lip: popped right at the edge of the ground (or just off it); nose: off a nose grind or nose manual
  | { type: 'trick'; index: number; name: TrickId; spin: 0 | 180; fakie: boolean; nollie?: boolean } // fakie: the stance it was thrown from; nollie: in the air off the nose
  | { type: 'land'; impact?: number; quality?: LandQuality; manual?: boolean; pad?: string; drop?: ImpactTier; lock?: number; lined?: number; spare?: number; flush?: number } // impact: px/frame into the surface, along its normal; manual: onto a manual pad (pad: a manual or a nose manual); drop: how big a drop it was, and lock: the frames of no-ollie it gave (not on a manual); lined: 0..1, how lined up with a falling slope (?momentum=transfer); spare: frames between a flip's catch and the touchdown (only after a flip); flush: rad off the line of a slope that falls away (only on one)
  | { type: 'grind'; name: string } // name: the grind (its clip), LEDGE_GRINDS or RAIL_GRINDS
  | { type: 'rail'; name: string }
  | { type: 'hop' }
  | { type: 'kicker' } // launched off a box truck's tailgate
  | { type: 'skitch'; on: boolean } // grabbed a cab's back bumper (on), or let go of it
  | { type: 'pad' } // a slam the Bubble Pads took
  | { type: 'tuck' } // Tuck and Roll: fell in a gap and bounced back out
  | { type: 'firecracker' } // Firecracker: rolled into a stair set and rode it down instead of slamming
  | { type: 'clack'; step: number } // a firecracker's tail hitting the next step down
  | { type: 'slam' }
  | { type: 'bail' }
  | { type: 'exit' };

export interface StepInput {
  pressed: boolean; // the button went down this step
  held: boolean;
}

export type ImpactTier = (typeof PHYS.impactTiers)[number]['drop'];
// how big a landing was, from the px fallen since the top of the air
export function impactTier(drop: number): (typeof PHYS.impactTiers)[number] {
  return PHYS.impactTiers.find((t) => drop < t.under) ?? PHYS.impactTiers[PHYS.impactTiers.length - 1];
}

const SKITCH_GAP = 4; // px between the board's nose and a cab's bumper, hanging on

export class Skater {
  x: number;
  y: number; // feet
  hsp = 0;
  vsp = 0;
  mode: Mode = 'roll';
  jumps: number = PHYS.jumps;
  carry = 0; // speed above the cap, from rails (QFS rail_carry)
  slamT = 0; // frames left of slam recovery
  boost = 1; // cruising speed multiplier (the gnar state)
  buffer = 0; // frames a press stays valid
  impactT = 0; // frames left of the landing's impact: no ollie, and a press then is lost (Lou Gnar's LANDING state)
  impactTaps = 0; // presses during this impact (Strong Legs: the second one ollies anyway)
  topY = 0; // the highest point of this air (px; y points down), for how big the drop was
  coyote = 0;
  tricks = 0; // counts flip tricks, so the animation choice is deterministic
  surface: Surface | null = null; // what we're rolling or grinding on (null = the street)
  rail: CurvedRail | null = null;
  railD = 0;
  railV = 0;
  railIgnore: CurvedRail | null = null;
  railIgnoreT = 0;
  hitCars = new Set<Car>();
  hitGlass = new Set<number>();
  events: SkaterEvent[] = [];
  // boon state
  floatT = 0; // Boostin frames left
  flipped = false; // last jump was a flip trick (Late Flip)
  holdT = 0; // frames the button has stayed held since the ollie (Mad Pop)
  spare = 0; // banked bonus jump (Spare Change)
  onRailT = 0; // frames on the current rail (More Wax)
  ghost: (Surface & { ttl: number }) | null = null; // Ghost Rail
  fakie = false; // riding with the other foot forward, after a 180
  stance = ''; // the grind or manual being ridden (its clip name), '' for none
  nose = false; // in the air off the nose (a nose grind or nose manual): flips up here are nollie flips
  ledgeGrinds = 0; // grinds and manuals so far, to take turns
  railGrinds = 0;
  manuals = 0;
  gravFlipT = 0; // frames of upward gravity left (the Gravity Flip mod)
  pads = 0; // Bubble Pads slams left this floor
  tucks = 0; // Tuck and Roll saves left this floor
  walled = false; // hit a pit's far wall (see wall()): no more pops or flips, just the drop
  private tuckOut = false; // bouncing up out of a pit (Tuck and Roll): you slide up its wall, not into it
  cracker: Surface | null = null; // Firecracker: the stair set we're riding down
  crackStep = -1; // the last step the tail clacked on
  rocket = false; // Rocket Grind: jumps come back at the top of this launch
  kicked = false; // launched by a kicker: the pop is the ramp's, so letting go doesn't cut it short
  snap = false; // rising off an ollie: the pop's fast climb and hang at the top (PHYS.popSnap)
  gear: GearScale = NO_WEAR; // worn gear holds you back (GDD: Gear and wear), set by the floor sim
  movers: Car[] = []; // moving traffic in the skate lane, set each step by the floor sim
  skitching: Car | null = null; // a Chinatown cab you're hanging on to (src/traffic/cab.ts)
  private skitchX = 0; // its back bumper last step
  readonly feel = new Feel(); // the body and board response (src/physics/feel.ts)
  readonly tuck = new Tuck(); // the board's lift above the feet in the air, from the clips (src/physics/tuck.ts)
  private roofs = new WeakMap<Car, number>(); // each vehicle's roof as of the last step
  trickT = 0; // frames since the last flip trick
  trickCatch = 0; // frames that flip takes to catch (0: no flip going)
  readonly crumbling = new Map<Surface, number>(); // Greece's ruins: frames until each ledge you've stood on falls
  readonly gone = new Set<Surface>(); // ruins that have fallen
  readonly wrecked = new Set<Car>(); // cars hopped to scrap (src/traffic/damage.ts): no roof, no sides, out of the way
  hopped: Car | null = null; // the roof the last car hop came off
  rollOn = false; // through the gate you keep skating onto the next floor (src/game/game.ts) instead of stopping
  exited = false; // through the gate, rolling on

  constructor(
    readonly level: Level,
    readonly mods: Mods = NO_MODS,
  ) {
    this.x = level.startX;
    this.y = level.startY;
    //starting up on a rooftop
    this.surface = level.surfaces.find((s) => s.kind !== 'rail' && s.x0 <= this.x && s.x1 >= this.x && s.y === this.y) ?? null;
    this.hsp = PHYS.baseSpeed; // rolling start
    this.jumps = this.maxJumps;
    this.pads = this.mods.bubblePads;
    this.tucks = this.mods.tuckAndRoll;
  }

  // the world's gravity: QFS's, scaled by the floor's biome (GDD: Atlantis 0.8, Outer Space 0.6)
  get grav(): number {
    return PHYS.grav * (this.level.gravity ?? 1);
  }

  // worn trucks (loose bushings) rock you more on rails, worn wheels (coned, flat-spotted) on landings
  private get looseTrucks(): number {
    return 1 + FEEL.wornRock * (1 - this.gear.grind);
  }

  private get looseWheels(): number {
    return 1 + FEEL.wornRock * 1.5 * (1 - this.gear.speed);
  }

  get maxJumps(): number {
    return PHYS.jumps + this.mods.jumps;
  }

  // Firecracker: riding a stair set down in a manual, the tail clacking on each step
  get firecracking(): boolean {
    return this.mode === 'roll' && this.cracker !== null && this.surface === this.cracker;
  }

  // riding a manual pad in a manual
  get manualing(): boolean {
    return this.mode === 'roll' && !!this.surface?.manual;
  }

  // the height of what lands: the board, lifted off the feet by the clip in the air, else the feet
  get boardY(): number {
    return this.mode === 'air' ? this.y - this.tuck.lift : this.y;
  }

  get grounded(): boolean {
    return this.mode === 'roll' || this.mode === 'grind' || this.mode === 'rail';
  }

  step(input: StepInput): void {
    if (this.mode === 'bail' || this.mode === 'exit') return;
    this.tuck.step(this.mode === 'air');
    const from = this.events.length;
    this.advance(input);
    //the clip the rig starts on a pop or a flip lifts the board (see tuck.ts)
    for (let i = from; i < this.events.length; i++) {
      const e = this.events[i];
      if (e.type === 'ollie' || e.type === 'hop' || e.type === 'kicker') this.tuck.start('ollie');
      else if (e.type === 'trick') this.tuck.start(e.name);
    }
    //where each roof was this step, so a landing next step sees one that has since moved (see land())
    for (const car of this.cars()) this.roofs.set(car, car.roof);
  }

  private advance(input: StepInput): void {
    if (input.pressed && !this.walled) this.buffer = PHYS.bufferFrames;
    if (this.railIgnoreT > 0 && --this.railIgnoreT === 0) this.railIgnore = null;
    if (this.slamT > 0) this.slamT--;
    if (this.floatT > 0) this.floatT--;
    if (this.gravFlipT > 0) this.gravFlipT--;
    if (this.ghost && --this.ghost.ttl <= 0 && this.surface !== this.ghost) this.ghost = null;
    this.stepRuins();
    this.holdT = input.held && this.holdT > 0 ? this.holdT + 1 : 0;

    if (this.mode !== 'air') this.topY = this.y; // the drop is measured from the ground you left
    //the button: ollie from the ground (or just after leaving it), flip trick in the air
    if (this.mode !== 'roll') this.impactT = 0;
    if (this.impactT > 0) {
      //Strong Legs: tapping again because nothing happened (zack, 2026-10-26) cuts the impact short and pops
      if (input.pressed && this.mods.strongLegs && ++this.impactTaps >= 2) this.impactT = 0;
      else {
        this.buffer = 0;
        this.impactT--;
      }
    }
    if (this.buffer > 0) {
      if (this.grounded || (this.mode === 'air' && this.coyote > 0)) this.ollie();
      else if (this.mode === 'air' && (this.jumps > 0 || this.spare >= 1)) this.trick();
      if (this.buffer > 0) this.buffer--;
    }

    if (this.mode === 'rail') this.stepRail();
    else this.stepMove(input.held);
    if ((this.mode as Mode) !== 'bail') this.feel.step(this.grounded, this.groundPitch(), this.mode === 'rail' ? this.railV : this.hsp, this.mode === 'air' ? this.below() : null);

    //off the end of a nose grind or nose manual, you're up off the nose; rolled off a manual pad, the manual's done
    if (this.stance && (this.mode as Mode) === 'air') {
      if (NOSE_STANCES.has(this.stance)) this.nose = true;
      this.stance = '';
    } else if (this.stance && (this.mode as Mode) === 'roll' && !this.surface?.manual) this.stance = '';

    if (this.x >= this.level.exitX && (this.mode as Mode) !== 'bail' && !this.exited) {
      if (this.rollOn) this.exited = true;
      else this.mode = 'exit';
      this.events.push({ type: 'exit' });
    }
  }

  // the run flows on from the last floor (src/game/game.ts): pick up where `from` left off, moved (dx, dy) px into
  // this floor's space, at the same speed, in the same air, mid-trick. The floor's own saves (pads, tucks) are new.
  carryOn(from: Skater, dx: number, dy: number): void {
    this.x = from.x + dx;
    this.y = from.y + dy;
    this.hsp = from.hsp;
    this.vsp = from.vsp;
    this.jumps = from.jumps;
    this.carry = from.carry;
    this.slamT = from.slamT;
    this.boost = from.boost;
    this.buffer = from.buffer;
    this.impactT = from.impactT;
    this.impactTaps = from.impactTaps;
    this.topY = from.topY + dy;
    this.coyote = from.coyote;
    this.tricks = from.tricks;
    this.floatT = from.floatT;
    this.flipped = from.flipped;
    this.holdT = from.holdT;
    this.spare = from.spare;
    this.fakie = from.fakie;
    this.stance = from.stance;
    this.nose = from.nose;
    this.ledgeGrinds = from.ledgeGrinds;
    this.railGrinds = from.railGrinds;
    this.manuals = from.manuals;
    this.gravFlipT = from.gravFlipT;
    this.rocket = from.rocket;
    this.kicked = from.kicked;
    this.snap = from.snap;
    this.trickT = from.trickT;
    this.trickCatch = from.trickCatch;
    Object.assign(this.feel, from.feel);
    this.rail = null;
    this.railV = 0;
    if (from.mode === 'air' || from.mode === 'bail') {
      this.mode = 'air';
      this.surface = null;
      return;
    }
    //on the ground: whatever is underfoot here (the next floor's first roof, or its street), else falling
    const under = this.level.surfaces.find((s) => s.kind !== 'rail' && s.x0 <= this.x && s.x1 >= this.x && Math.abs(surfaceY(s, this.x) - this.y) < 2);
    if (under) {
      this.mode = 'roll';
      this.surface = under;
      this.y = surfaceY(under, this.x);
    } else if (isStreetAt(this.level, this.x) && Math.abs(this.y - this.level.streetY) < 2) {
      this.mode = 'roll';
      this.surface = null;
      this.y = this.level.streetY;
    } else {
      this.mode = 'air';
      this.surface = null;
    }
  }

  private ollie(): void {
    //Full Sail: grind speed adds to the pop
    const grindSpeed = this.mode === 'grind' ? Math.abs(this.hsp) : this.mode === 'rail' ? this.railV : 0;
    //the pop adds to the way the ground was already carrying you: up off a bank, down off a handrail
    const carried = this.groundVsp();
    const lip = this.coyote > 0 || (this.mode === 'roll' && this.nearEdge());
    const nose = NOSE_STANCES.has(this.stance);
    this.stance = '';
    this.nose = nose;
    this.leaveGround();
    this.jumps = Math.max(0, this.jumps - 1);
    this.vsp = PHYS.ollie * this.mods.ollieScale * this.gear.ollie - grindSpeed * this.mods.railLaunch + carried;
    //Rocket Grind: off a fast grind you go straight up, and the pop is the rail's, so letting go doesn't cut it
    if (this.mods.rocketGrind && grindSpeed >= PHYS.grindSpeed) {
      this.vsp *= PHYS.rocketPop;
      this.rocket = true;
      this.kicked = true;
    }
    this.snapUp();
    this.buffer = 0;
    this.coyote = 0;
    this.flipped = false;
    this.holdT = 1;
    this.events.push({ type: 'ollie', spin: 0, lip, ...(nose ? { nose } : {}) });
  }

  // vertical speed the ground gives you: rolling a slope, or riding a rail
  private groundVsp(): number {
    if (this.mode === 'rail' && this.rail) return this.railV * this.rail.at(this.railD).ty;
    if (this.mode === 'roll' && this.surface) return surfaceSlope(this.surface) * this.hsp;
    return 0;
  }

  // the ground ends within a lip's reach ahead, and the next ground (if any) is lower
  private nearEdge(): boolean {
    const ahead = this.x + FEEL.lipPx;
    if (this.supportAt(ahead) !== null) return false;
    return true;
  }

  // the height of the ground under x that the wheels would be on, near our height (null: nothing there)
  private supportAt(x: number): number | null {
    const s = this.surface;
    if (s && x >= s.x0 && x <= s.x1) return surfaceY(s, x);
    if (this.mode === 'grind') return null;
    for (const o of this.level.surfaces) {
      if (o === s || o.kind === 'rail' || x < o.x0 || x > o.x1 || this.gone.has(o)) continue;
      const y = surfaceY(o, x);
      if (Math.abs(y - this.y) <= 8) return y;
    }
    if (isStreetAt(this.level, x) && Math.abs(this.level.streetY - this.y) <= 8) return this.level.streetY;
    return null;
  }

  // the board's angle on the ground, from where its two trucks touch (null in the air): it tips over a bank's lip
  // and stays level with a truck hanging over an edge, as a real board does
  private groundPitch(): number | null {
    if (this.mode === 'rail' && this.rail) {
      const t = this.rail.at(this.railD);
      return Math.atan2(-t.ty, t.tx);
    }
    if (this.mode === 'grind') return 0;
    if (this.mode !== 'roll') return null;
    const half = FEEL.wheelbase / 2;
    const back = this.supportAt(this.x - half);
    const front = this.supportAt(this.x + half);
    if (back === null && front === null) return 0;
    return Math.atan2((back ?? front!) - (front ?? back!), FEEL.wheelbase);
  }

  // In the air: a ray straight down from the feet to the first thing it hits in your lane (a roof, bank, stair set,
  // bar, curved rail, car roof or the street), with that ground's angle (+ nose up, as groundPitch) and how far down
  below(): { angle: number; depth: number } | null {
    const x = this.x;
    let depth = Infinity;
    let angle = 0;
    const from = this.boardY; // the ray starts at the board (tuck.ts)
    const hit = (y: number, m: number) => {
      const d = y - from;
      if (d >= -1 && d < depth) {
        depth = Math.max(0, d);
        angle = Math.atan(-m);
      }
    };
    for (const s of this.level.surfaces) {
      if (x < s.x0 || x > s.x1 || this.gone.has(s)) continue;
      hit(surfaceY(s, x), surfaceSlope(s));
    }
    for (const rail of this.level.rails) {
      if (rail === this.railIgnore) continue;
      const y = rail.yAt(x);
      const a = rail.yAt(x - 1);
      const b = rail.yAt(x + 1);
      if (y !== undefined) hit(y, a !== undefined && b !== undefined ? (b - a) / 2 : 0);
    }
    for (const car of this.cars()) if (x >= car.x0 && x <= car.x1) hit(car.roof, 0);
    if (isStreetAt(this.level, x)) hit(this.level.streetY, 0);
    return depth === Infinity ? null : { angle, depth };
  }

  // how much of the flip in the air has been caught (1: none going, or caught)
  get caught(): number {
    return this.trickCatch > 0 ? Math.min(1, this.trickT / this.trickCatch) : 1;
  }

  // what's under the trucks while grinding
  get material(): Material {
    if (this.mode === 'rail' && this.rail) return this.rail.material;
    return this.surface ? surfaceMaterial(this.surface) : 'concrete';
  }

  // the pop snaps up: the same height, popSnap times quicker (a fall off a handrail stays a fall)
  snapUp(): void {
    if (this.vsp >= 0) return;
    this.vsp *= PHYS.popSnap;
    this.snap = true;
  }

  private trick(): void {
    this.kicked = false;
    this.snap = false;
    if (this.jumps > 0) this.jumps--;
    else this.spare -= 1;
    this.vsp = PHYS.trick * this.gear.trick;
    this.buffer = 0;
    this.flipped = true;
    if (this.mods.floatyFlip) this.floatT = PHYS.floatyFrames;
    const name = rollTrick(this.tricks);
    const spin = SPIN[name];
    this.trickT = 0;
    this.trickCatch = Math.round(TRICK_CATCH[name] * 60);
    //off the nose it's a nollie flip; riding fakie, the nose pop is a fakie flip (the callout says fakie)
    this.events.push({ type: 'trick', index: this.tricks++, name, spin, fakie: this.fakie, ...(this.nose && !this.fakie ? { nollie: true } : {}) });
    //a 180 lands you riding the other way round
    if (spin === 180) this.fakie = !this.fakie;
    //Sky Line: a ghost rail under your feet to come down on
    if (this.mods.skyLine) this.ghost = { kind: 'rail', x0: this.x, x1: this.x + PHYS.skyLineTiles * TILE, y: this.y + PHYS.skyLineDrop, row: -1, ttl: PHYS.ghostFrames };
  }

  private bankSpare(): void {
    this.spare += this.mods.spareChange;
  }

  // Ghost Rail: the rail we just left keeps going for a while
  private spawnGhost(y: number): void {
    if (!this.mods.ghostRail || (this.ghost && this.surface === this.ghost)) return;
    this.ghost = { kind: 'rail', x0: this.x, x1: this.x + PHYS.ghostTiles * TILE, y, row: -1, ttl: PHYS.ghostFrames };
  }

  private leaveGround(): void {
    this.letGo();
    this.kicked = false;
    this.snap = false;
    this.rocket = false;
    if (this.mode === 'grind' || this.mode === 'rail') this.carry = Math.max(this.carry, Math.abs(this.hsp));
    if (this.mode === 'grind' && this.surface) this.spawnGhost(this.surface.y);
    else if (this.mode === 'rail') this.spawnGhost(this.y);
    this.onRailT = 0;
    if (this.mode === 'rail' && this.rail) {
      this.railIgnore = this.rail;
      this.railIgnoreT = PHYS.railIgnoreFrames;
    }
    this.rail = null;
    this.surface = null;
    this.mode = 'air';
  }

  // off a cab's bumper, keeping its speed (it bleeds off like rail speed)
  private letGo(): void {
    if (!this.skitching) return;
    this.skitching = null;
    this.events.push({ type: 'skitch', on: false });
  }

  // hanging on to a cab: it pulls you along at its speed, the board just behind its bumper. It moved first this step
  private skitch(): void {
    const cab = this.skitching!;
    if (!cab.skitch || this.mode !== 'roll') {
      this.letGo();
      return;
    }
    const v = Math.max(0, cab.x0 - this.skitchX);
    this.skitchX = cab.x0;
    this.carry = Math.max(this.carry, v);
    this.hsp = Math.max(v, this.hsp * 0.9);
    this.x = cab.x0 - PHYS.width / 2 - SKITCH_GAP - this.hsp;
  }

  private baseSpeed(): number {
    //after a slam you're back to full speed over slamFrames
    const k = this.slamT > 0 ? 1 - (1 - PHYS.slamSpeed) * (this.slamT / PHYS.slamFrames) : 1;
    return PHYS.baseSpeed * k * this.boost * this.mods.speedScale * this.gear.speed;
  }

  private stepMove(held: boolean): void {
    //horizontal speed
    if (this.mode === 'roll') {
      //a slope: gravity along it adds flow speed downhill and takes it away uphill (base speed holds)
      const m = this.surface ? surfaceSlope(this.surface) : 0;
      const tow = this.surface?.tow ?? 0;
      //a cable car climb: the cable takes you up at its own speed, the slope doesn't slow you
      if (tow > 0) this.carry = Math.max(this.carry, tow);
      //(a kicker's too short to slow you: you hit its lip at the speed you hit its foot)
      else if (m !== 0 && !this.surface?.kicker) {
        const pull = this.grav * FEEL.slopeGrav * (m / Math.hypot(1, m));
        this.carry = pull > 0 ? Math.max(this.carry, this.hsp) + pull : Math.max(0, this.carry + pull);
      }
      const excess = Math.max(0, this.carry - PHYS.baseSpeed);
      const bleed = Math.max(PHYS.carryBleedMin, excess * PHYS.carryDecay) * this.mods.carryBleedScale;
      this.carry = Math.max(0, this.carry - bleed);
      const cap = Math.max(this.baseSpeed(), this.carry);
      this.hsp = this.hsp < cap ? Math.min(cap, this.hsp + PHYS.accel) : cap;
      if (this.skitching) this.skitch();
    } else if (this.mode === 'grind') {
      this.onRailT++;
      //More Wax: builds on a flat ledge, not a sloped one
      const flat = !this.surface || Math.abs(surfaceSlope(this.surface)) < PHYS.frenzyFlat;
      const frenzy = this.mods.feebleFrenzy && flat ? 1 + PHYS.frenzyStep * Math.min(10, Math.floor(this.onRailT / 30)) : 1;
      const mat = MATERIALS[this.material];
      //a High-Tech conveyor rail runs you faster, or holds you back
      const belt = this.surface?.conveyor ?? 0;
      const target = Math.max(PHYS.grindSpeed * this.mods.grindScale * this.gear.grind * mat.grindScale * frenzy, this.carry) + belt;
      const accel = PHYS.grindAccel * mat.grindAccel;
      const slowed = belt < 0 ? Math.max(target, this.hsp - accel) : this.hsp;
      this.hsp = Math.max(PHYS.grindMin, this.hsp < target ? Math.min(target, this.hsp + accel) : slowed);
    }

    //vertical speed
    if (this.mode === 'air') {
      let grav = this.grav;
      if (this.snap && this.vsp >= PHYS.popHang) this.snap = false;
      if (this.snap) grav *= this.vsp < -PHYS.popHang ? PHYS.popSnap * PHYS.popSnap : PHYS.popHangGrav;
      if (this.floatT > 0) grav *= 0.5; // Boostin
      if (this.mods.pressureFlip && this.holdT > PHYS.pressureFrames) grav *= 0.7; // Mad Pop
      //Gravity Flip mod: a fall stops dead and gravity pulls up, to a cap (never slowing a faster rise)
      if (this.gravFlipT > 0) this.vsp = Math.min(this.vsp, Math.max(PHYS.ollie * 1.2, Math.min(this.vsp, 0) - this.grav));
      else this.vsp = Math.min(this.vsp + grav, PHYS.maxFall);
      //Rocket Grind: at the top, every jump comes back
      if (this.rocket && this.vsp >= 0) {
        this.rocket = false;
        this.jumps = this.maxJumps;
      }
      //let go while rising: a short hop (QFS variable jump); Late Flip keeps flips full height
      const cut = !(this.flipped && this.mods.lateFlip) && this.gravFlipT === 0 && !this.kicked;
      //(off a snapped-up pop, letting go goes straight to the hang at the top)
      if (cut && this.vsp < 0 && !held) this.vsp = Math.max(this.vsp, this.snap ? -PHYS.popHang : PHYS.ollie / PHYS.jumpCut);
      if (this.coyote > 0) this.coyote--;
      if (this.trickCatch > 0) this.trickT++;
      this.topY = Math.min(this.topY, this.y);
      //Atlantis: a current pushes you forward or back while you're off the ground
      const push = currentAt(this.level, this.x);
      if (push) this.hsp = Math.max(1, this.hsp + push);
    } else {
      this.vsp = 0;
      this.snap = false;
    }

    const px = this.x;
    const py = this.y;
    this.x += this.hsp;
    this.y += this.vsp;
    //the Art Museum's low ceiling: you bump your head and come down
    const ceiling = this.mode === 'air' ? ceilingAt(this.level, this.x) : undefined;
    if (ceiling !== undefined && this.y < ceiling) {
      //ducking under it: the knees fold up as fast as you were rising
      this.feel.bounce(Math.max(0, -this.vsp), 0);
      this.y = ceiling;
      this.vsp = Math.max(0, this.vsp);
    }

    if (this.mode === 'roll' || this.mode === 'grind') {
      //a kicker ramp standing on the street: you roll up onto it
      if (this.mode === 'roll' && (!this.surface || this.surface.kind === 'roof')) {
        const ramp = this.level.surfaces.find((s) => s.kicker && this.x >= s.x0 && this.x <= s.x1 && Math.abs(surfaceY(s, this.x) - this.y) <= 8);
        if (ramp && ramp !== this.surface) this.surface = ramp;
      }
      if (this.surface?.y1 !== undefined && this.supported()) this.y = surfaceY(this.surface, this.x);
      //ground under the middle of the board first, then a truck still on the edge holds you
      if (!this.underFeet() && !this.rollOnto() && !this.supported()) {
        //rolled off the edge: fall, keeping both jumps (QFS); a slope throws you along its angle (bank kick)
        const fromRail = this.mode === 'grind';
        const slope = this.surface ? surfaceSlope(this.surface) : 0;
        this.leaveGround();
        this.vsp = slope * this.hsp;
        if (!fromRail) this.coyote = PHYS.coyoteFrames;
      }
    } else if (this.mode === 'air') {
      this.land(px, py);
      if (this.mode === 'air') this.wall(px);
    }

    this.stepCracker();
    this.checkHazards();

    //in the canal, or down a pit on the hill
    const bottom = pitAt(this.level, this.x)?.floor ?? this.level.streetY + PHYS.bailDepth;
    if (this.mode === 'air' && this.y > bottom && this.tucks > 0) {
      //Tuck and Roll: bounce back up out of the gap with your jumps back, for a slam's Heat
      this.tucks--;
      this.walled = false;
      this.tuckOut = true;
      this.vsp = PHYS.tuckBounce;
      this.snap = false;
      this.hsp = Math.max(this.hsp, PHYS.baseSpeed);
      this.jumps = this.maxJumps;
      this.kicked = true;
      this.events.push({ type: 'tuck' });
    } else if (this.mode === 'air' && this.y > bottom) {
      this.y = Math.min(this.y, bottom);
      this.mode = 'bail';
      this.hsp = 0;
      this.events.push({ type: 'bail' });
    }
  }

  private railMin(): number {
    return PHYS.railMin * this.mods.grindScale * this.gear.grind;
  }

  // parked cars plus moving traffic
  private cars(): Car[] {
    const all = this.movers.length ? [...this.level.cars, ...this.movers] : this.level.cars;
    return this.wrecked.size ? all.filter((c) => !this.wrecked.has(c)) : all;
  }

  // the level's ledges, roofs and rails, plus a live ghost rail
  private surfaces(): Surface[] {
    const all = this.gone.size ? this.level.surfaces.filter((s) => !this.gone.has(s)) : this.level.surfaces;
    return this.ghost ? [...all, this.ghost] : all;
  }

  // a ruin starts to crumble once you're on it, and falls a moment later (you drop if you're still there)
  private stepRuins(): void {
    const s = this.surface;
    if (s?.crumble && this.grounded && !this.crumbling.has(s) && !this.gone.has(s)) this.crumbling.set(s, PHYS.crumbleFrames);
    for (const [ruin, t] of this.crumbling) {
      if (t > 1) this.crumbling.set(ruin, t - 1);
      else {
        this.crumbling.delete(ruin);
        this.gone.add(ruin);
      }
    }
  }

  // rolling off one piece of ground straight onto the next at the same height: terrace to stairs, bank to roof
  private rollOnto(): boolean {
    if (this.mode !== 'roll') return false;
    for (const s of this.level.surfaces) {
      if (s === this.surface || s.kind === 'rail' || this.x < s.x0 || this.x > s.x1 || this.gone.has(s)) continue;
      if (Math.abs(surfaceY(s, this.x) - this.y) > 8) continue;
      this.y = surfaceY(s, this.x);
      this.surface = s;
      if (s.kind === 'stairs') this.intoStairs(s);
      return true;
    }
    if (this.surface && isStreetAt(this.level, this.x) && Math.abs(this.level.streetY - this.y) <= 8) {
      this.y = this.level.streetY;
      this.surface = null;
      return true;
    }
    return false;
  }

  // the ground we're on is under the middle of the board
  private underFeet(): boolean {
    const s = this.surface;
    if (s) return this.x >= s.x0 && this.x <= s.x1 && !this.gone.has(s);
    return isStreetAt(this.level, this.x);
  }

  // still on the ground: flat ground holds you while a truck is on it (the board stays level, one truck hanging over
  // the edge, the way a real board does), slopes, stairs and rails under the feet
  private supported(): boolean {
    const s = this.surface;
    if (s) {
      const r = truckReach(s);
      return this.x + r >= s.x0 && this.x - r <= s.x1 && !this.gone.has(s);
    }
    return this.streetUnder(this.x);
  }

  // street under either truck
  private streetUnder(x: number): boolean {
    const r = FEEL.wheelbase / 2;
    return isStreetAt(this.level, x) || isStreetAt(this.level, x - r) || isStreetAt(this.level, x + r);
  }

  // falling: find the highest surface the feet crossed this step
  private land(px: number, py0: number): void {
    const x = this.x;
    //in the air the board is what lands, lifted off the feet by the clip (tuck.ts)
    const py = py0 - this.tuck.prev;
    const fy = this.y - this.tuck.lift;
    let bestY = Infinity;
    let best: (() => void) | null = null;
    const consider = (y: number, act: () => void) => {
      if (y < bestY) {
        bestY = y;
        best = act;
      }
    };
    //Where the feet's path this step goes from on or above the line through (x0, y0) with slope m to on or under it
    //(null if it doesn't). Swept, so nothing slips through between two frames: not the face of a bank that climbs
    //faster than you're rising, not the corner of a roof you drop past at speed.
    //`was` is where the line was at the start of the step, for roofs that move (a bobbing drone, a lifting bus)
    const crossAt = (x0: number, y0: number, m: number, was = y0): number | null => {
      const f0 = py - (was + m * (px - x0));
      const f1 = fy - (y0 + m * (x - x0));
      if (f0 > 0.01 || f1 < 0) return null;
      const t = f1 - f0 > 1e-9 ? Math.min(1, Math.max(0, -f0 / (f1 - f0))) : 0;
      return px + t * (x - px);
    };
    //...over [a, b], where it crossed or (as before) where the feet ended up, so clipping a near corner still lands
    const hits = (x0: number, y0: number, m: number, a: number, b: number, was = y0): boolean => {
      const cx = crossAt(x0, y0, m, was);
      return cx !== null && ((cx >= a && cx <= b) || (x >= a && x <= b));
    };

    const sx = crossAt(0, this.level.streetY, 0);
    if (sx !== null && (this.streetUnder(sx) || this.streetUnder(x))) consider(this.level.streetY, () => this.touchDown(null));
    const magnet = this.mods.railMagnet;
    for (const s of this.surfaces()) {
      //Rail Magnet: rails reach out for you before their start
      //flat ground catches a truck: you land with the other one hanging over the edge
      const r = truckReach(s);
      if (!hits(s.x0, s.y, surfaceSlope(s), s.kind === 'rail' ? s.x0 - magnet : s.x0 - r, s.x1 + r)) continue;
      //touched down on it this step: if the step carried you past its far end, you land on the edge
      const lx = Math.min(Math.max(x, s.x0 - r), s.x1 + r);
      consider(surfaceY(s, Math.min(Math.max(lx, s.x0), s.x1)), () => {
        this.x = lx;
        this.touchDown(s);
      });
    }
    const half = PHYS.width / 2;
    for (const car of this.cars()) {
      if (!hits(0, car.roof, 0, car.x0 - half, car.x1 + half, this.roofs.get(car) ?? car.roof)) continue;
      //Roof Rider: a parked roof is a ledge to grind
      const parked = this.mods.roofRider && this.level.cars.includes(car);
      //an L train's roof is always a grind
      const ledge = car.ledge ?? (parked ? roofLedge(car) : null);
      consider(car.roof, ledge ? () => this.touchDown(ledge) : () => this.carHop(car));
    }
    for (const rail of this.level.rails) {
      if (rail === this.railIgnore) continue;
      const start = rail.at(0);
      const near = magnet > 0 && x < start.x && x >= start.x - magnet;
      const ry = near ? start.y : rail.yAt(x);
      //last step's x before its start: its start's height (coming in under the start isn't landing on it: that
      //snapped a skater well below a high power line up onto it, zack 2026-10-25)
      const pry = near ? start.y : (rail.yAt(px) ?? start.y);
      if (ry === undefined) continue;
      //compare against the rail's height where we were last step too, so a sloped rail can't slip past (rising or falling)
      if (py <= pry + 0.01 && fy >= ry && ry < bestY) {
        bestY = ry;
        best = () => {
          if (near) this.x = start.x;
          this.catchRail(rail);
        };
      }
    }
    if (best) {
      //the feet come down to the board: the rig is drawn that much lower and eases up as the legs extend
      this.feel.settle(this.tuck.lift);
      this.y = bestY;
      (best as () => void)();
    }
  }

  // a pit's far wall (level.ts pits()): come up short of the lip, under it, and the board hits the wall. You slam into
  // it, stop dead, and drop straight down the pit to bail at the bottom (zack, 2026-10-28: you used to pass through
  // the wall and fall glitching through the hill). Just short of the lip, you get up onto it.
  private wall(px: number): void {
    const fy = this.boardY;
    for (const p of pits(this.level)) {
      const at = p.x1 - truckReach(p.far);
      if (px > at || this.x <= at || fy <= p.lip) continue;
      this.x = at;
      if (fy - p.lip <= PIT.catch && !this.walled) {
        this.feel.settle(this.tuck.lift);
        this.y = p.lip;
        this.touchDown(p.far);
        return;
      }
      //bouncing up out of the pit (Tuck and Roll), you slide up the wall and over the lip
      if (this.tuckOut && this.vsp < 0) return;
      this.hsp = 0;
      this.carry = 0;
      if (this.walled) return;
      this.walled = true;
      this.fakie = false;
      this.events.push({ type: 'slam' });
      return;
    }
  }

  private touchDown(s: Surface | null): void {
    const m = s ? surfaceSlope(s) : 0;
    const impact = normalImpact(this.hsp, this.vsp, m);
    const caught = this.caught;
    const spare = this.trickCatch > 0 && caught >= 1 ? this.trickT - this.trickCatch : -1;
    const vsp = this.vsp;
    this.trickCatch = 0;
    this.surface = s;
    this.vsp = 0;
    this.tuckOut = false;
    this.jumps = this.maxJumps;
    this.coyote = 0;
    this.flipped = false;
    this.floatT = 0;
    this.nose = false;
    if (s?.kind === 'rail') {
      this.mode = 'grind';
      this.onRailT = 0;
      const enter = this.mods.grindInstant ? PHYS.grindSpeed * this.mods.grindScale : PHYS.grindMin;
      this.hsp = Math.max(this.hsp, enter);
      this.bankSpare();
      this.feel.railEntry(impact, surfaceMaterial(s), this.looseTrucks);
      this.stance = s.row === -1 ? LEDGE_GRINDS[this.ledgeGrinds++ % LEDGE_GRINDS.length] : RAIL_GRINDS[this.railGrinds++ % RAIL_GRINDS.length];
      this.events.push({ type: 'grind', name: this.stance });
    } else {
      this.spare = 0;
      this.mode = 'roll';
      //Speed Wobbles: come down too fast and the board shakes you off
      const wobbly = this.mods.wobbles && Math.abs(this.hsp) > PHYS.baseSpeed * this.mods.speedScale * PHYS.wobbleOver;
      //Butter: the air speed rolls on (it bleeds off like rail speed)
      if (this.mods.butter) this.carry = Math.max(this.carry, Math.abs(this.hsp));
      //on a slope you keep the speed along it: a bank that falls away turns the drop into speed
      //(cruising speed still holds: an uphill bank only eats flow speed)
      let lined = 0;
      let flush = -1;
      if (m !== 0) {
        let along = alongSlope(this.hsp, vsp, m);
        const mo = MOMENTUM.mode;
        const uphill = m * (this.hsp < 0 ? -1 : 1) < 0;
        if (!uphill) flush = misalign(this.hsp, vsp, m);
        //soften (being explored): coming down on the face of an up ramp keeps most of your speed; the rest of the
        //climb still slows you, as if you'd rolled up to there
        if (uphill && (mo === 'soften' || mo === 'both')) along = Math.max(along, this.hsp * MOMENTUM.keep);
        //transfer (being explored): coming down in line with a slope that falls away carries you on faster
        if (!uphill && (mo === 'transfer' || mo === 'both')) {
          lined = Math.max(0, 1 - misalign(this.hsp, vsp, m) / MOMENTUM.align);
          along *= 1 + MOMENTUM.boost * lined;
        }
        if (along > this.hsp) this.carry = Math.max(this.carry, along);
        else if (!this.mods.butter) this.carry = Math.min(this.carry, Math.max(0, along));
        this.hsp = Math.max(along, Math.min(this.hsp, this.baseSpeed()));
      }
      //landing on the steps, or before the board's back under your feet
      const quality = s?.kind === 'stairs' || wobbly ? 'slam' : landQuality(impact, caught, m > 0);
      //a hard landing to flat costs flow speed (never base speed); Butter soaks it up, not a sketchy one
      if (quality === 'heavy' && m === 0 && !this.mods.butter) this.carry *= Math.max(0, 1 - FEEL.heavyScrub * (impact - FEEL.heavy));
      if (quality === 'sketchy') this.carry *= 1 - FEEL.sketchyScrub;
      this.feel.land(impact, quality, this.looseWheels);
      //a manual pad: you ride it in a manual (unless you slammed onto it)
      const manual = !!s?.manual && quality !== 'slam';
      this.stance = manual ? MANUALS[this.manuals++ % MANUALS.length] : '';
      //the bigger the drop, the longer the knees take to come back up before you can pop again
      const tier = impactTier(this.y - this.topY);
      const lock = manual ? undefined : tier.frames;
      this.events.push({ type: 'land', impact, quality, ...(manual ? { manual, pad: this.stance } : { drop: tier.drop, lock }), ...(lined > 0 ? { lined } : {}), ...(spare >= 0 ? { spare } : {}), ...(flush >= 0 ? { flush } : {}) });
      if (!s?.manual || quality === 'slam') {
        this.impactT = tier.frames;
        this.impactTaps = 0;
      }
      if (quality === 'slam') this.slam();
    }
  }

  // rolled into a stair set without popping: a slam, unless you've got Firecracker (zack, 2026-10-26: "a trick where you
  // kinda manual down stair sets hitting the tail on each step")
  private intoStairs(s: Surface): void {
    if (!this.mods.firecracker) {
      this.slam();
      return;
    }
    this.cracker = s;
    this.crackStep = -1;
    this.events.push({ type: 'firecracker' });
  }

  // a firecracker: the tail clacks down onto each step as you pass its edge (a step is a tile along the set)
  private stepCracker(): void {
    if (!this.cracker) return;
    if (!this.firecracking) {
      this.cracker = null;
      return;
    }
    const s = this.cracker;
    const step = Math.floor((this.x - s.x0) / TILE);
    if (step > this.crackStep && step < Math.round((s.x1 - s.x0) / TILE)) {
      this.crackStep = step;
      this.events.push({ type: 'clack', step });
    }
  }

  private carHop(car: Car): void {
    this.hopped = car;
    //the knees take the roof and fire you back up; caught mid-flip, the board's only half under you and you rock
    this.feel.bounce(Math.max(0, this.vsp), this.caught < 1 ? this.looseWheels : 0);
    this.trickCatch = 0;
    this.kicked = false;
    this.snap = false;
    this.vsp = PHYS.carHop * this.mods.hopScale;
    this.topY = this.y; // off the roof: the drop is from this bounce
    this.jumps = this.maxJumps;
    this.flipped = false;
    this.nose = false;
    this.mode = 'air';
    this.events.push({ type: 'hop' });
  }

  private catchRail(rail: CurvedRail): void {
    const d = rail.dAtX(this.x);
    const t = rail.at(d);
    this.rail = rail;
    this.railD = d;
    //speed along the rail: our velocity projected on its direction, always rolling forward
    this.railV = Math.min(PHYS.railMax, Math.max(this.railMin(), this.hsp * t.tx + this.vsp * t.ty));
    //Ledge Butter: straight up to full grind speed, the same as on a flat ledge
    if (this.mods.grindInstant) this.railV = Math.min(PHYS.railMax, Math.max(this.railV, PHYS.grindSpeed * this.mods.grindScale * this.gear.grind));
    this.feel.railEntry(Math.abs(this.vsp * t.tx - this.hsp * t.ty), rail.material, this.looseTrucks);
    this.trickCatch = 0;
    this.mode = 'rail';
    this.onRailT = 0;
    this.flipped = false;
    this.floatT = 0;
    this.bankSpare();
    this.jumps = this.maxJumps;
    this.vsp = 0;
    this.nose = false;
    this.stance = RAIL_GRINDS[this.railGrinds++ % RAIL_GRINDS.length];
    this.events.push({ type: 'rail', name: this.stance });
  }

  private stepRail(): void {
    const rail = this.rail!;
    const t = rail.at(this.railD);
    //gravity pulls along the rail: downhill (ty > 0 in y-down) speeds you up (QFS player_rail_state)
    this.railV += this.grav * t.ty * PHYS.railGravMult;
    //and friction under the trucks, from how hard the rail pushes back (the cos of its angle)
    //(Ledge Butter and anything else that grinds faster cuts it; Moon Shoes adds to it)
    this.railV -= (this.grav * MATERIALS[rail.material].mu * t.tx) / this.mods.grindScale;
    //More Wax: a little more speed every 30 frames on the same rail, where it runs flat (a power line, the L), not down a
    //handrail (zack, 2026-10-26)
    if (this.mods.feebleFrenzy && ++this.onRailT % 30 === 0 && Math.abs(t.ty) < PHYS.frenzyFlat) this.railV *= 1 + PHYS.frenzyStep;
    this.railV = Math.min(PHYS.railMax, Math.max(this.railMin(), this.railV));
    this.railD += this.railV;

    if (this.railD >= rail.length) {
      //ride off the end: launch along the rail and keep the speed
      const e = rail.at(rail.length);
      //Slingshot: launches harder, up to a cap
      const v = Math.min(PHYS.slingshotMax, this.railV * this.mods.slingshot);
      this.hsp = Math.max(this.railV * e.tx, v * e.tx);
      this.vsp = this.railV * e.ty * (e.ty < 0 ? v / this.railV : 1);
      this.x = e.x;
      this.y = e.y;
      this.carry = Math.abs(this.hsp);
      this.jumps = this.maxJumps;
      this.spawnGhost(e.y);
      this.onRailT = 0;
      this.railIgnore = rail;
      this.railIgnoreT = PHYS.railIgnoreFrames;
      this.rail = null;
      this.mode = 'air';
      return;
    }
    const p = rail.at(this.railD);
    this.x = p.x;
    this.y = p.y;
    this.hsp = this.railV * p.tx;
    this.vsp = this.railV * p.ty;
  }

  // car sides and broken glass: a slam, never the end of the run
  private checkHazards(): void {
    const half = PHYS.width / 2;
    for (const car of this.cars()) {
      //an L train is a one-way platform (zack, 2026-10-25): you pass through it from below and the sides, and only
      //its roof counts, as a grind
      if (this.hitCars.has(car) || car.ledge || car === this.skitching) continue;
      //a cab's back bumper, rolling up to it on the ground: you grab on (a cab you let go of, you can catch again)
      if (car.skitch && this.mode === 'roll' && this.x + half >= car.x0 - SKITCH_GAP && this.x < car.x0 && Math.abs(this.y - car.bottom) <= 8) {
        this.skitching = car;
        this.skitchX = car.x0;
        this.events.push({ type: 'skitch', on: true });
        continue;
      }
      //a dropped tailgate: roll up it and it kicks you up over the box, with a burst of speed (a bomb)
      if (car.kicker && this.mode === 'roll' && !this.surface && this.x + half >= car.x0 - car.kicker && this.x < car.x0) {
        this.hitCars.add(car);
        this.kick();
        continue;
      }
      const overlapX = this.x + half > car.x0 && this.x - half < car.x1;
      //tucked in the air, the body balls up: its bottom is the lifted board
      const overlapY = this.y - (this.mode === 'air' ? this.tuck.lift : 0) > car.roof + 6 && this.y - PHYS.height < car.bottom;
      if (overlapX && overlapY) {
        this.hitCars.add(car);
        this.slam();
      }
    }
    if (this.mode === 'roll' && !this.surface) {
      this.level.glass.forEach((g, i) => {
        if (!this.hitGlass.has(i) && this.x >= g.x0 && this.x <= g.x1) {
          this.hitGlass.add(i);
          this.slam();
        }
      });
    }
  }

  private kick(): void {
    //rolling up the tailgate loads the knees before it throws you
    this.feel.bounce(this.hsp, 0);
    this.leaveGround();
    this.y = this.level.streetY - PHYS.tailgateLip;
    this.vsp = PHYS.kickerPop * this.mods.kickerScale;
    this.kicked = true;
    this.hsp = Math.max(this.hsp, PHYS.bombSpeed * this.mods.kickerScale);
    this.carry = Math.max(this.carry, PHYS.bombSpeed * this.mods.kickerScale);
    this.jumps = this.maxJumps;
    this.flipped = false;
    this.nose = false;
    this.events.push({ type: 'kicker' });
  }

  // hit by a guard's bullet (src/sim/shots.ts): down you go, as a slam (Bubble Pads take it)
  shot(): void {
    this.slam();
  }

  private slam(): void {
    if (this.pads > 0) {
      this.pads--;
      this.events.push({ type: 'pad' });
      return;
    }
    this.slamT = PHYS.slamFrames;
    this.carry = 0;
    this.hsp = PHYS.baseSpeed * PHYS.slamSpeed;
    this.fakie = false; // you get back on the way you like
    this.events.push({ type: 'slam' });
  }
}

// Roof Rider: a parked car's roof as a grind (a flat-bar surface), the same object each time
const ROOFS = new WeakMap<Car, Surface>();
function roofLedge(car: Car): Surface {
  let s = ROOFS.get(car);
  if (!s) {
    s = { kind: 'rail', x0: car.x0, x1: car.x1, y: car.roof, row: -1 };
    ROOFS.set(car, s);
  }
  return s;
}

// how far past the end of a piece of ground the board still stands on it: half the wheelbase on flat ground (a truck
// is on it), none on slopes, stairs and rails (the feet have to be on those)
function truckReach(s: Surface): number {
  return s.kind === 'rail' || s.kind === 'stairs' || surfaceSlope(s) !== 0 ? 0 : FEEL.wheelbase / 2;
}
