// The skater controller: Quest For Stoken's movement rules (calc_movement, jumped, check_grind,
// player_grinding_state, player_rail_state) on Lou Gnar's one-button auto-run. Pure: no rendering, no DOM.
import { NO_MODS, type Mods } from '../boons/mods';
import { NO_WEAR, type GearScale } from '../run/gear';
import { PHYS, TILE } from './constants';
import { Feel, FEEL, MATERIALS, alongSlope, landQuality, normalImpact, type LandQuality, type Material } from './feel';
import { rollTrick, SPIN, TRICK_CATCH, type TrickId } from './tricks';
import { isStreetAt, surfaceMaterial, surfaceSlope, surfaceY, type Car, type CurvedRail, type Level, type Surface } from './level';

export type Mode = 'roll' | 'air' | 'grind' | 'rail' | 'bail' | 'exit';

export type SkaterEvent =
  | { type: 'ollie'; spin: 0 | 180; lip?: boolean } // lip: popped right at the edge of the ground (or just off it)
  | { type: 'trick'; index: number; name: TrickId; spin: 0 | 180; fakie: boolean } // fakie: the stance it was thrown from
  | { type: 'land'; impact?: number; quality?: LandQuality } // impact: px/frame into the surface, along its normal
  | { type: 'grind' }
  | { type: 'rail' }
  | { type: 'hop' }
  | { type: 'kicker' } // launched off a box truck's tailgate
  | { type: 'pad' } // a slam the Bubble Pads took
  | { type: 'tuck' } // Tuck and Roll: fell in a gap and bounced back out
  | { type: 'slam' }
  | { type: 'bail' }
  | { type: 'exit' };

export interface StepInput {
  pressed: boolean; // the button went down this step
  held: boolean;
}

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
  floatT = 0; // Floaty Flip frames left
  flipped = false; // last jump was a flip trick (Late Flip)
  holdT = 0; // frames the button has stayed held since the ollie (Pressure Flip)
  spare = 0; // banked bonus jump (Spare Change)
  onRailT = 0; // frames on the current rail (Feeble Frenzy)
  ghost: (Surface & { ttl: number }) | null = null; // Ghost Rail
  fakie = false; // riding with the other foot forward, after a 180
  gravFlipT = 0; // frames of upward gravity left (the Gravity Flip mod)
  pads = 0; // Bubble Pads slams left this floor
  tucks = 0; // Tuck and Roll saves left this floor
  rocket = false; // Rocket Grind: jumps come back at the top of this launch
  kicked = false; // launched by a kicker: the pop is the ramp's, so letting go doesn't cut it short
  gear: GearScale = NO_WEAR; // worn gear holds you back (GDD: Gear and wear), set by the floor sim
  movers: Car[] = []; // moving traffic in the skate lane, set each step by the floor sim
  readonly feel = new Feel(); // the body and board response (src/physics/feel.ts)
  trickT = 0; // frames since the last flip trick
  trickCatch = 0; // frames that flip takes to catch (0: no flip going)

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

  get grounded(): boolean {
    return this.mode === 'roll' || this.mode === 'grind' || this.mode === 'rail';
  }

  step(input: StepInput): void {
    if (this.mode === 'bail' || this.mode === 'exit') return;
    if (input.pressed) this.buffer = PHYS.bufferFrames;
    if (this.railIgnoreT > 0 && --this.railIgnoreT === 0) this.railIgnore = null;
    if (this.slamT > 0) this.slamT--;
    if (this.floatT > 0) this.floatT--;
    if (this.gravFlipT > 0) this.gravFlipT--;
    if (this.ghost && --this.ghost.ttl <= 0 && this.surface !== this.ghost) this.ghost = null;
    this.holdT = input.held && this.holdT > 0 ? this.holdT + 1 : 0;

    //the button: ollie from the ground (or just after leaving it), flip trick in the air
    if (this.buffer > 0) {
      if (this.grounded || (this.mode === 'air' && this.coyote > 0)) this.ollie();
      else if (this.mode === 'air' && (this.jumps > 0 || this.spare >= 1)) this.trick();
      if (this.buffer > 0) this.buffer--;
    }

    if (this.mode === 'rail') this.stepRail();
    else this.stepMove(input.held);
    if ((this.mode as Mode) !== 'bail') this.feel.step(this.grounded, this.groundPitch(), this.mode === 'rail' ? this.railV : this.hsp);

    if (this.x >= this.level.exitX && (this.mode as Mode) !== 'bail') {
      this.mode = 'exit';
      this.events.push({ type: 'exit' });
    }
  }

  private ollie(): void {
    //Rail Launch: grind speed adds to the pop
    const grindSpeed = this.mode === 'grind' ? Math.abs(this.hsp) : this.mode === 'rail' ? this.railV : 0;
    //the pop adds to the way the ground was already carrying you: up off a bank, down off a handrail
    const carried = this.groundVsp();
    const lip = this.coyote > 0 || (this.mode === 'roll' && this.nearEdge());
    this.leaveGround();
    this.jumps = Math.max(0, this.jumps - 1);
    this.vsp = PHYS.ollie * this.mods.ollieScale * this.gear.ollie - grindSpeed * this.mods.railLaunch + carried;
    //Rocket Grind: off a fast grind you go straight up, and the pop is the rail's, so letting go doesn't cut it
    if (this.mods.rocketGrind && grindSpeed >= PHYS.grindSpeed) {
      this.vsp *= PHYS.rocketPop;
      this.rocket = true;
      this.kicked = true;
    }
    this.buffer = 0;
    this.coyote = 0;
    this.flipped = false;
    this.holdT = 1;
    this.events.push({ type: 'ollie', spin: 0, lip });
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
      if (o === s || o.kind === 'rail' || x < o.x0 || x > o.x1) continue;
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

  // how much of the flip in the air has been caught (1: none going, or caught)
  get caught(): number {
    return this.trickCatch > 0 ? Math.min(1, this.trickT / this.trickCatch) : 1;
  }

  // what's under the trucks while grinding
  get material(): Material {
    if (this.mode === 'rail' && this.rail) return this.rail.material;
    return this.surface ? surfaceMaterial(this.surface) : 'concrete';
  }

  private trick(): void {
    this.kicked = false;
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
    this.events.push({ type: 'trick', index: this.tricks++, name, spin, fakie: this.fakie });
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
    if (!this.mods.ghostRail || this.surface === this.ghost) return;
    this.ghost = { kind: 'rail', x0: this.x, x1: this.x + PHYS.ghostTiles * TILE, y, row: -1, ttl: PHYS.ghostFrames };
  }

  private leaveGround(): void {
    this.kicked = false;
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
      if (m !== 0) {
        const pull = this.grav * FEEL.slopeGrav * (m / Math.hypot(1, m));
        this.carry = pull > 0 ? Math.max(this.carry, this.hsp) + pull : Math.max(0, this.carry + pull);
      }
      const excess = Math.max(0, this.carry - PHYS.baseSpeed);
      const bleed = Math.max(PHYS.carryBleedMin, excess * PHYS.carryDecay) * this.mods.carryBleedScale;
      this.carry = Math.max(0, this.carry - bleed);
      const cap = Math.max(this.baseSpeed(), this.carry);
      this.hsp = this.hsp < cap ? Math.min(cap, this.hsp + PHYS.accel) : cap;
    } else if (this.mode === 'grind') {
      this.onRailT++;
      const frenzy = this.mods.feebleFrenzy ? 1 + PHYS.frenzyStep * Math.min(10, Math.floor(this.onRailT / 30)) : 1;
      const mat = MATERIALS[this.material];
      const target = Math.max(PHYS.grindSpeed * this.mods.grindScale * this.gear.grind * mat.grindScale * frenzy, this.carry);
      const accel = PHYS.grindAccel * mat.grindAccel;
      this.hsp = Math.max(PHYS.grindMin, this.hsp < target ? Math.min(target, this.hsp + accel) : this.hsp);
    }

    //vertical speed
    if (this.mode === 'air') {
      let grav = this.grav;
      if (this.floatT > 0) grav *= 0.5; // Floaty Flip
      if (this.mods.pressureFlip && this.holdT > PHYS.pressureFrames) grav *= 0.7; // Pressure Flip
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
      if (cut && this.vsp < 0 && !held) this.vsp = Math.max(this.vsp, PHYS.ollie / PHYS.jumpCut);
      if (this.coyote > 0) this.coyote--;
      if (this.trickCatch > 0) this.trickT++;
    } else {
      this.vsp = 0;
    }

    const px = this.x;
    const py = this.y;
    this.x += this.hsp;
    this.y += this.vsp;

    if (this.mode === 'roll' || this.mode === 'grind') {
      if (this.surface?.y1 !== undefined && this.supported()) this.y = surfaceY(this.surface, this.x);
      if (!this.supported() && !this.rollOnto()) {
        //rolled off the edge: fall, keeping both jumps (QFS); a slope throws you along its angle (bank kick)
        const fromRail = this.mode === 'grind';
        const slope = this.surface ? surfaceSlope(this.surface) : 0;
        this.leaveGround();
        this.vsp = slope * this.hsp;
        if (!fromRail) this.coyote = PHYS.coyoteFrames;
      }
    } else if (this.mode === 'air') {
      this.land(px, py);
    }

    this.checkHazards();

    //in the canal
    if (this.mode === 'air' && this.y > this.level.streetY + PHYS.bailDepth && this.tucks > 0) {
      //Tuck and Roll: bounce back up out of the gap with your jumps back, for a slam's Heat
      this.tucks--;
      this.vsp = PHYS.tuckBounce;
      this.hsp = Math.max(this.hsp, PHYS.baseSpeed);
      this.jumps = this.maxJumps;
      this.kicked = true;
      this.events.push({ type: 'tuck' });
    } else if (this.mode === 'air' && this.y > this.level.streetY + PHYS.bailDepth) {
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
    return this.movers.length ? [...this.level.cars, ...this.movers] : this.level.cars;
  }

  // the level's ledges, roofs and rails, plus a live ghost rail
  private surfaces(): Surface[] {
    return this.ghost ? [...this.level.surfaces, this.ghost] : this.level.surfaces;
  }

  // rolling off one piece of ground straight onto the next at the same height: terrace to stairs, bank to roof
  private rollOnto(): boolean {
    if (this.mode !== 'roll') return false;
    for (const s of this.level.surfaces) {
      if (s === this.surface || s.kind === 'rail' || this.x < s.x0 || this.x > s.x1) continue;
      if (Math.abs(surfaceY(s, this.x) - this.y) > 8) continue;
      this.y = surfaceY(s, this.x);
      this.surface = s;
      if (s.kind === 'stairs') this.slam();
      return true;
    }
    if (this.surface && isStreetAt(this.level, this.x) && Math.abs(this.level.streetY - this.y) <= 8) {
      this.y = this.level.streetY;
      this.surface = null;
      return true;
    }
    return false;
  }

  private supported(): boolean {
    if (this.surface) return this.x >= this.surface.x0 && this.x <= this.surface.x1;
    return isStreetAt(this.level, this.x);
  }

  // falling: find the highest surface the feet crossed this step
  private land(px: number, py: number): void {
    const x = this.x;
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
    const crossAt = (x0: number, y0: number, m: number): number | null => {
      const f0 = py - (y0 + m * (px - x0));
      const f1 = this.y - (y0 + m * (x - x0));
      if (f0 > 0.01 || f1 < 0) return null;
      const t = f1 - f0 > 1e-9 ? Math.min(1, Math.max(0, -f0 / (f1 - f0))) : 0;
      return px + t * (x - px);
    };
    //...over [a, b], where it crossed or (as before) where the feet ended up, so clipping a near corner still lands
    const hits = (x0: number, y0: number, m: number, a: number, b: number): boolean => {
      const cx = crossAt(x0, y0, m);
      return cx !== null && ((cx >= a && cx <= b) || (x >= a && x <= b));
    };

    const sx = crossAt(0, this.level.streetY, 0);
    if (sx !== null && (isStreetAt(this.level, sx) || isStreetAt(this.level, x))) consider(this.level.streetY, () => this.touchDown(null));
    const magnet = this.mods.railMagnet;
    for (const s of this.surfaces()) {
      //Rail Magnet: rails reach out for you before their start
      if (!hits(s.x0, s.y, surfaceSlope(s), s.kind === 'rail' ? s.x0 - magnet : s.x0, s.x1)) continue;
      //touched down on it this step: if the step carried you past its far end, you land on the edge
      const lx = Math.min(Math.max(x, s.x0), s.x1);
      consider(surfaceY(s, lx), () => {
        this.x = lx;
        this.touchDown(s);
      });
    }
    const half = PHYS.width / 2;
    for (const car of this.cars()) {
      if (!hits(0, car.roof, 0, car.x0 - half, car.x1 + half)) continue;
      //Roof Rider: a parked roof is a ledge to grind
      const parked = this.mods.roofRider && this.level.cars.includes(car);
      consider(car.roof, parked ? () => this.touchDown(roofLedge(car)) : () => this.carHop());
    }
    for (const rail of this.level.rails) {
      if (rail === this.railIgnore) continue;
      const start = rail.at(0);
      const near = magnet > 0 && x < start.x && x >= start.x - magnet;
      const ry = near ? start.y : rail.yAt(x);
      const pry = near ? start.y : rail.yAt(px);
      if (ry === undefined) continue;
      //compare against the rail's height where we were last step too, so a sloped rail can't slip past (rising or falling)
      if ((pry === undefined || py <= pry + 0.01) && this.y >= ry && ry < bestY) {
        bestY = ry;
        best = () => {
          if (near) this.x = start.x;
          this.catchRail(rail);
        };
      }
    }
    if (best) {
      this.y = bestY;
      (best as () => void)();
    }
  }

  private touchDown(s: Surface | null): void {
    const m = s ? surfaceSlope(s) : 0;
    const impact = normalImpact(this.hsp, this.vsp, m);
    const caught = this.caught;
    const vsp = this.vsp;
    this.trickCatch = 0;
    this.surface = s;
    this.vsp = 0;
    this.jumps = this.maxJumps;
    this.coyote = 0;
    this.flipped = false;
    this.floatT = 0;
    if (s?.kind === 'rail') {
      this.mode = 'grind';
      this.onRailT = 0;
      const enter = this.mods.grindInstant ? PHYS.grindSpeed * this.mods.grindScale : PHYS.grindMin;
      this.hsp = Math.max(this.hsp, enter);
      this.bankSpare();
      this.feel.railEntry(impact, surfaceMaterial(s), this.looseTrucks);
      this.events.push({ type: 'grind' });
    } else {
      this.spare = 0;
      this.mode = 'roll';
      //Speed Wobbles: come down too fast and the board shakes you off
      const wobbly = this.mods.wobbles && Math.abs(this.hsp) > PHYS.baseSpeed * this.mods.speedScale * PHYS.wobbleOver;
      //Butter: the air speed rolls on (it bleeds off like rail speed)
      if (this.mods.butter) this.carry = Math.max(this.carry, Math.abs(this.hsp));
      //on a slope you keep the speed along it: a bank that falls away turns the drop into speed
      //(cruising speed still holds: an uphill bank only eats flow speed)
      if (m !== 0) {
        const along = alongSlope(this.hsp, vsp, m);
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
      this.events.push({ type: 'land', impact, quality });
      if (quality === 'slam') this.slam();
    }
  }

  private carHop(): void {
    //the knees take the roof and fire you back up; caught mid-flip, the board's only half under you and you rock
    this.feel.bounce(Math.max(0, this.vsp), this.caught < 1 ? this.looseWheels : 0);
    this.trickCatch = 0;
    this.kicked = false;
    this.vsp = PHYS.carHop * this.mods.hopScale;
    this.jumps = this.maxJumps;
    this.flipped = false;
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
    this.feel.railEntry(Math.abs(this.vsp * t.tx - this.hsp * t.ty), rail.material, this.looseTrucks);
    this.trickCatch = 0;
    this.mode = 'rail';
    this.onRailT = 0;
    this.flipped = false;
    this.floatT = 0;
    this.bankSpare();
    this.jumps = this.maxJumps;
    this.vsp = 0;
    this.events.push({ type: 'rail' });
  }

  private stepRail(): void {
    const rail = this.rail!;
    const t = rail.at(this.railD);
    //gravity pulls along the rail: downhill (ty > 0 in y-down) speeds you up (QFS player_rail_state)
    this.railV += this.grav * t.ty * PHYS.railGravMult;
    //and friction under the trucks, from how hard the rail pushes back (the cos of its angle)
    this.railV -= this.grav * MATERIALS[rail.material].mu * t.tx;
    //Feeble Frenzy: a little more speed every 30 frames on the same rail
    if (this.mods.feebleFrenzy && ++this.onRailT % 30 === 0) this.railV *= 1 + PHYS.frenzyStep;
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
      if (this.hitCars.has(car)) continue;
      //a dropped tailgate: roll up it and it kicks you up over the box, with a burst of speed (a bomb)
      if (car.kicker && this.mode === 'roll' && !this.surface && this.x + half >= car.x0 - car.kicker && this.x < car.x0) {
        this.hitCars.add(car);
        this.kick();
        continue;
      }
      const overlapX = this.x + half > car.x0 && this.x - half < car.x1;
      const overlapY = this.y > car.roof + 6 && this.y - PHYS.height < car.bottom;
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
    this.events.push({ type: 'kicker' });
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
