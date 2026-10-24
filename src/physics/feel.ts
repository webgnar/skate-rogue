// How a landing, a slope or a rail feels: the sim's side of the body and board response. Landing impact and
// quality, grind materials, and a few springs (knees, torso lean, heel-toe wobble) plus the board's pitch from where
// its two trucks touch the ground. Stepped at 60 Hz with the skater, so the rig, the effects and the tests all read
// the same numbers. Units are the sim's: px and frames.
import { PHYS } from './constants';

export type Material = 'metal' | 'concrete';

// grinds by what you grind on. Flat bars pull you up to their speed (QFS), curved rails only lose a little to
// friction (gravity along the rail does the rest); a concrete ledge bites harder than a steel bar and wobbles less
// (it's wider under the trucks)
export const MATERIALS: Record<Material, { mu: number; grindScale: number; grindAccel: number; wobble: number }> = {
  metal: { mu: 0.05, grindScale: 1, grindAccel: 1, wobble: 1 },
  concrete: { mu: 0.12, grindScale: 0.88, grindAccel: 0.6, wobble: 0.55 },
};

export type LandQuality = 'clean' | 'heavy' | 'sketchy' | 'slam';

export const FEEL = {
  // landing impact: speed into the surface along its normal, px/frame
  soft: 4.5, // under this a landing is a kiss (a 1 tile drop is 4)
  heavy: 7, // about a 3 tile drop to flat
  huge: 9.5, // about 5.5 tiles to flat: too much to soak up clean
  heavyScrub: 0.08, // share of flow speed lost per px/frame of impact over `heavy`, landing flat
  sketchyScrub: 0.4, // share of flow speed a sketchy landing loses
  slamCatch: 0.6, // a flip landed before this share of its catch: the board isn't under you, a slam
  slopeGrav: 1, // rolling a bank: PHYS.grav along the slope times this
  lipPx: 12, // an ollie this close to the end of the ground (or in coyote time) pops off the lip
  wheelbase: 17, // px between the truck bolts (BOARD.bolts * 2 in tiles)
  // springs, per frame: stiffness k, damping c
  squash: { k: 0.12, c: 0.5, kick: 0.13 }, // kick: knee velocity per px/frame of impact; the knees bend about 0.7 x kick x impact
  lean: { k: 0.08, c: 0.45, slope: 0.35, accel: 4, max: 0.25 },
  wobble: { k: 0.09, c: 0.05, sketchy: 0.05, rail: 0.006, max: 0.3 },
  airLevel: 0.12, // in the air the board eases back to level this share a frame
} as const;

export class Feel {
  squash = 0; // 0..1, how far the knees are bent soaking something up
  lean = 0; // rad, torso toward the way you skate (+)
  wobble = 0; // rad, heel-toe rock after a sketchy landing or a hard rail entry; signed, decays
  pitch = 0; // rad, the board's angle, + nose up
  impact = 0; // px/frame of the last landing
  quality: LandQuality = 'clean';
  private squashV = 0;
  private leanV = 0;
  private wobbleV = 0;
  private side = 1; // sketchy landings rock one way, then the other
  private lastHsp: number = PHYS.baseSpeed;

  // a landing: the knees take the impact, a sketchy one rocks you
  land(impact: number, quality: LandQuality): void {
    this.impact = impact;
    this.quality = quality;
    this.squashV += impact * FEEL.squash.kick;
    if (quality === 'sketchy') this.rock(FEEL.wobble.sketchy);
  }

  // locking onto a rail or bar: the harder you come in across it, the more you rock
  railEntry(impact: number, material: Material): void {
    this.squashV += impact * FEEL.squash.kick * 0.6;
    this.rock(impact * FEEL.wobble.rail * MATERIALS[material].wobble);
  }

  private rock(v: number): void {
    this.wobbleV += v * this.side;
    this.side = -this.side;
  }

  // one step: `pitch` is the board's target angle on the ground (null in the air), `hsp` the speed now
  step(grounded: boolean, pitch: number | null, hsp: number): void {
    //knees
    const s = FEEL.squash;
    this.squashV += -s.k * this.squash - s.c * this.squashV;
    this.squash += this.squashV;
    if (this.squash < 0) {
      this.squash = 0;
      this.squashV = Math.max(0, this.squashV);
    } else if (this.squash > 1) {
      this.squash = 1;
      this.squashV = Math.min(0, this.squashV);
    }

    //board: follows the ground under the trucks; levels out in the air
    if (pitch !== null) this.pitch = pitch;
    else this.pitch -= this.pitch * FEEL.airLevel;

    //torso: partly with the slope, forward when speeding up, back when slowing
    const l = FEEL.lean;
    const accel = Math.max(-l.max, Math.min(l.max, (hsp - this.lastHsp) * l.accel));
    const target = grounded ? this.pitch * l.slope + accel : 0;
    this.leanV += l.k * (target - this.lean) - l.c * this.leanV;
    this.lean += this.leanV;
    this.lastHsp = hsp;

    //heel-toe rock
    const w = FEEL.wobble;
    this.wobbleV += -w.k * this.wobble - w.c * this.wobbleV;
    this.wobble = Math.max(-w.max, Math.min(w.max, this.wobble + this.wobbleV));
  }
}

// impact into a surface sloping m (dy/dx, y down) of a skater moving (hsp, vsp): the velocity along its normal
export function normalImpact(hsp: number, vsp: number, m: number): number {
  return Math.max(0, (vsp - hsp * m) / Math.hypot(1, m));
}

// horizontal speed left after landing on a slope m: the velocity projected along it
export function alongSlope(hsp: number, vsp: number, m: number): number {
  return (hsp + vsp * m) / (1 + m * m);
}

// what kind of landing it was. `caught`: the share of the flip's catch done (1 if no flip is going), `downhill`:
// landing on a slope that falls away (a bank or transition soaks up even a big drop)
export function landQuality(impact: number, caught: number, downhill: boolean): LandQuality {
  if (caught < FEEL.slamCatch) return 'slam';
  if (caught < 1) return 'sketchy';
  if (impact >= FEEL.huge && !downhill) return 'sketchy';
  return impact >= FEEL.heavy ? 'heavy' : 'clean';
}
