// The skater controller: Quest For Stoken's movement rules (calc_movement, jumped, check_grind,
// player_grinding_state, player_rail_state) on Lou Gnar's one-button auto-run. Pure: no rendering, no DOM.
import { NO_MODS, type Mods } from '../boons/mods';
import { PHYS, TILE } from './constants';
import { isStreetAt, type Car, type CurvedRail, type Level, type Surface } from './level';

export type Mode = 'roll' | 'air' | 'grind' | 'rail' | 'bail' | 'exit';

export type SkaterEvent =
  | { type: 'ollie' }
  | { type: 'trick'; index: number }
  | { type: 'land' }
  | { type: 'grind' }
  | { type: 'rail' }
  | { type: 'hop' }
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

  constructor(
    readonly level: Level,
    readonly mods: Mods = NO_MODS,
  ) {
    this.x = level.startX;
    this.y = level.streetY;
    this.hsp = PHYS.baseSpeed; // rolling start
    this.jumps = this.maxJumps;
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

    if (this.x >= this.level.exitX && (this.mode as Mode) !== 'bail') {
      this.mode = 'exit';
      this.events.push({ type: 'exit' });
    }
  }

  private ollie(): void {
    //Rail Launch: grind speed adds to the pop
    const grindSpeed = this.mode === 'grind' ? Math.abs(this.hsp) : this.mode === 'rail' ? this.railV : 0;
    this.leaveGround();
    this.jumps = Math.max(0, this.jumps - 1);
    this.vsp = PHYS.ollie * this.mods.ollieScale - grindSpeed * this.mods.railLaunch;
    this.buffer = 0;
    this.coyote = 0;
    this.flipped = false;
    this.holdT = 1;
    this.events.push({ type: 'ollie' });
  }

  private trick(): void {
    if (this.jumps > 0) this.jumps--;
    else this.spare -= 1;
    this.vsp = PHYS.trick;
    this.buffer = 0;
    this.flipped = true;
    if (this.mods.floatyFlip) this.floatT = PHYS.floatyFrames;
    this.events.push({ type: 'trick', index: this.tricks++ });
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
    return PHYS.baseSpeed * k;
  }

  private stepMove(held: boolean): void {
    //horizontal speed
    if (this.mode === 'roll') {
      this.carry = Math.max(0, this.carry - PHYS.carryBleed * this.mods.carryBleedScale);
      const cap = Math.max(this.baseSpeed(), this.carry);
      this.hsp = this.hsp < cap ? Math.min(cap, this.hsp + PHYS.accel) : cap;
    } else if (this.mode === 'grind') {
      this.onRailT++;
      const frenzy = this.mods.feebleFrenzy ? 1 + PHYS.frenzyStep * Math.min(10, Math.floor(this.onRailT / 30)) : 1;
      const target = Math.max(PHYS.grindSpeed * this.mods.grindScale * frenzy, this.carry);
      this.hsp = Math.max(PHYS.grindMin, this.hsp < target ? Math.min(target, this.hsp + PHYS.grindAccel) : this.hsp);
    }

    //vertical speed
    if (this.mode === 'air') {
      let grav = PHYS.grav;
      if (this.floatT > 0) grav *= 0.5; // Floaty Flip
      if (this.mods.pressureFlip && this.holdT > PHYS.pressureFrames) grav *= 0.7; // Pressure Flip
      this.vsp = Math.min(this.vsp + grav, PHYS.maxFall);
      //let go while rising: a short hop (QFS variable jump); Late Flip keeps flips full height
      const cut = !(this.flipped && this.mods.lateFlip);
      if (cut && this.vsp < 0 && !held) this.vsp = Math.max(this.vsp, PHYS.ollie / PHYS.jumpCut);
      if (this.coyote > 0) this.coyote--;
    } else {
      this.vsp = 0;
    }

    const px = this.x;
    const py = this.y;
    this.x += this.hsp;
    this.y += this.vsp;

    if (this.mode === 'roll' || this.mode === 'grind') {
      if (!this.supported()) {
        //rolled off the edge: fall, keeping both jumps (QFS)
        const fromRail = this.mode === 'grind';
        this.leaveGround();
        if (!fromRail) this.coyote = PHYS.coyoteFrames;
      }
    } else if (this.mode === 'air' && this.vsp >= 0) {
      this.land(px, py);
    }

    this.checkHazards();

    //in the canal
    if (this.mode === 'air' && this.y > this.level.streetY + PHYS.bailDepth) {
      this.mode = 'bail';
      this.hsp = 0;
      this.events.push({ type: 'bail' });
    }
  }

  private railMin(): number {
    return PHYS.railMin * this.mods.grindScale;
  }

  // the level's ledges, roofs and rails, plus a live ghost rail
  private surfaces(): Surface[] {
    return this.ghost ? [...this.level.surfaces, this.ghost] : this.level.surfaces;
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
      if (py <= y + 0.01 && this.y >= y && y < bestY) {
        bestY = y;
        best = act;
      }
    };

    if (isStreetAt(this.level, x)) consider(this.level.streetY, () => this.touchDown(null));
    const magnet = this.mods.railMagnet;
    for (const s of this.surfaces()) {
      //Rail Magnet: rails reach out for you before their start
      const x0 = s.kind === 'rail' ? s.x0 - magnet : s.x0;
      if (x >= x0 && x <= s.x1) {
        consider(s.y, () => {
          this.x = Math.max(this.x, s.x0);
          this.touchDown(s);
        });
      }
    }
    for (const car of this.level.cars) {
      if (x + PHYS.width / 2 >= car.x0 && x - PHYS.width / 2 <= car.x1) consider(car.roof, () => this.carHop());
    }
    for (const rail of this.level.rails) {
      if (rail === this.railIgnore) continue;
      const start = rail.at(0);
      const near = magnet > 0 && x < start.x && x >= start.x - magnet;
      const ry = near ? start.y : rail.yAt(x);
      const pry = near ? start.y : rail.yAt(px);
      if (ry === undefined) continue;
      //compare against the rail's height where we were last step too, so a sloped rail can't slip past
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
      this.events.push({ type: 'grind' });
    } else {
      this.spare = 0;
      this.mode = 'roll';
      this.events.push({ type: 'land' });
    }
  }

  private carHop(): void {
    this.vsp = PHYS.carHop;
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
    this.railV += PHYS.grav * t.ty * PHYS.railGravMult;
    //Feeble Frenzy: a little more speed every 30 frames on the same rail
    if (this.mods.feebleFrenzy && ++this.onRailT % 30 === 0) this.railV *= 1 + PHYS.frenzyStep;
    this.railV = Math.min(PHYS.railMax, Math.max(this.railMin(), this.railV));
    this.railD += this.railV;

    if (this.railD >= rail.length) {
      //ride off the end: launch along the rail and keep the speed
      const e = rail.at(rail.length);
      this.hsp = this.railV * e.tx;
      this.vsp = this.railV * e.ty;
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
    for (const car of this.level.cars) {
      if (this.hitCars.has(car)) continue;
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

  private slam(): void {
    this.slamT = PHYS.slamFrames;
    this.carry = 0;
    this.hsp = PHYS.baseSpeed * PHYS.slamSpeed;
    this.events.push({ type: 'slam' });
  }
}

