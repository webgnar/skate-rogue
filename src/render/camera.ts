// Lou Gnar's camera, ported from excaliburSkate (camera-effects-manager.ts and the scene's lockToActor):
//
// - Locked on the skater's feet in x; y trails a jump a touch. The view pans so Lou sits a little left of and
//   below centre (more on phones), showing the street ahead.
// - At zoom 1 it shows at least an 800 x 600 box (FitScreenAndFill): the 75 px skater stands an eighth of the
//   screen's height, and a wider screen just sees more street to each side.
// - Every trick punches in to 1.4x for 0.7 s; grinding holds 1.3x. It eases in fast and back out slower, with the
//   same frame-rate independent easing (1 - e^(-speed x dt)).
//
// On phones (zack, 2026-10-25: "it's hard to see the player") the frame is much tighter and the lens wider: the
// camera dollies in close and opens the field of view, so Lou is big and the street around them bends with
// perspective. Zoom is a dolly, not a lens change: a punch-in rushes the camera at Lou while the lens widens (a
// little dolly zoom), and a pull-out backs it off and flattens. Big air and speed pull out, landings kick in.
import type { Mode } from '../physics/skater';

export const LOU_CAM = {
  viewH: 16, // tiles of height visible at zoom 1 (600 px round a 75 px skater; ours stands ~2.1 tiles)
  viewAspect: 4 / 3, // the 800 x 600 box it never shows less than
  normalZoom: 1.0,
  trickZoom: 1.4,
  grindZoom: 1.3,
  zoomInSpeed: 3.0,
  zoomOutSpeed: 1.5,
  trickSecs: 0.7,
};

// how the camera frames the skater on a screen: tiles of height at the skater at zoom 1, the lens (vertical fov in
// degrees at zoom 1), and where Lou sits: lead pans the view ahead by that share of the half-width (Lou left of
// centre), low pans it up by that share of the half-height (Lou below centre). punch scales the trick zooms.
export interface Framing {
  viewH: number;
  fov: number;
  lead: number;
  low: number;
  punch: number;
}

export const PHONE_CAM = {
  short: 600, // css px: a screen whose short side is this or less is a phone
  // (zack 2026-10-30, "the player character needs to be bigger": 8.75, then "pull out the camera a little": 9.5;
  // 10.5 both ways before)
  landscapeH: 9.5, // tiles of height on a phone held sideways (Lou ~a quarter of the screen; desktop shows 16)
  landscapeFov: 52,
  portraitW: 9.5, // tiles of width on a phone held upright (it showed 21; height follows from the aspect)
  portraitFov: 74, // tall screen, so a tall lens: about 40 degrees across
  lead: [0.22, 0.42], // landscape, portrait: Lou sits left of centre so more street ahead shows
  // landscape, portrait: Lou sits below centre, the roofs, wires and the L above in view (zack 2026-10-30: "move the
  // camera up. so the board is lower on the screen, and you can see up more": 0.12 and 0.14 before)
  low: [0.36, 0.3],
  punch: 1, // trick and grind zooms at this share of their strength (zack 2026-10-25: "zoom effects More")
};

export function framing(w: number, h: number): Framing {
  const aspect = w / h;
  if (Math.min(w, h) > PHONE_CAM.short) return { viewH: viewHeight(aspect), fov: 40, lead: 0.08, low: 0.05, punch: 1 };
  if (aspect >= 1) return { viewH: PHONE_CAM.landscapeH, fov: PHONE_CAM.landscapeFov, lead: PHONE_CAM.lead[0], low: PHONE_CAM.low[0], punch: PHONE_CAM.punch };
  return { viewH: PHONE_CAM.portraitW / aspect, fov: PHONE_CAM.portraitFov, lead: PHONE_CAM.lead[1], low: PHONE_CAM.low[1], punch: PHONE_CAM.punch };
}

// the moving parts on top of the trick/grind zoom: a pull-out for big air and for speed, and a landing kick
export const DYN_CAM = {
  airFrom: 0.35, // seconds in the air before the camera starts backing off
  airFull: 1.0, // and fully backed off by this long
  airPull: 0.28, // zoom out this much in big air (shows where you'll land)
  speedPull: 0.18, // and this much at full flow
  speedFov: 0, // degrees the lens opens at full flow (none: speed pulls out, and a pull-out narrows the lens)
  zoomFov: 45, // degrees of lens per unit of zoom in: a punch-in widens it (the dolly zoom)
  zoomOutFov: 75, // and per unit of zoom out: a pull-out narrows it hard as the camera backs off (zack, 2026-10-26)
  pullIn: 2.2, // easing rates
  pullOut: 1.2,
  kickDecay: 0.86, // a landing kick dies off by this per 60 Hz frame
  yawFrom: 1.1, // times cruising speed where the camera starts swinging to look ahead (zack, 2026-10-25; more, 10-26)
  yawFull: 1.9, // fully swung by this
  yaw: 0.42, // radians (about 24 degrees)
  yawIn: 1.2, // easing rates: swing round slowly, come back a bit quicker
  yawOut: 2,
  minDist: 6, // the camera never dollies closer than this (the foreground rows start at z 4.35)
};

export class CamDrift {
  pull = 1; // multiplies the zoom: under 1 backs off
  fovAdd = 0; // degrees on top of the lens
  kick = 0; // 0..1 landing punch, decaying
  yaw = 0; // radians the camera has swung round to look ahead, at speed
  private airT = 0;

  land(impact: number): void {
    this.kick = Math.max(this.kick, Math.min(1, impact));
  }

  // flow 0..1 (speed over cruising, as the speed lines use); speed: times cruising speed
  update(dt: number, mode: Mode, flow: number, speed = 1): void {
    const swing = Math.min(1, Math.max(0, (speed - DYN_CAM.yawFrom) / (DYN_CAM.yawFull - DYN_CAM.yawFrom)));
    const yaw = DYN_CAM.yaw * swing * swing * (3 - 2 * swing);
    this.yaw += (yaw - this.yaw) * (1 - Math.exp(-(yaw > this.yaw ? DYN_CAM.yawIn : DYN_CAM.yawOut) * dt));
    this.airT = mode === 'air' ? this.airT + dt : 0;
    const air = Math.min(1, Math.max(0, (this.airT - DYN_CAM.airFrom) / (DYN_CAM.airFull - DYN_CAM.airFrom)));
    const target = (1 - DYN_CAM.airPull * air) * (1 - DYN_CAM.speedPull * flow);
    const rate = target < this.pull ? DYN_CAM.pullOut : DYN_CAM.pullIn;
    this.pull += (target - this.pull) * (1 - Math.exp(-rate * dt));
    this.fovAdd += (DYN_CAM.speedFov * flow - this.fovAdd) * (1 - Math.exp(-2 * dt));
    this.kick *= Math.pow(DYN_CAM.kickDecay, dt * 60);
  }

  reset(): void {
    this.pull = 1;
    this.fovAdd = 0;
    this.kick = 0;
    this.yaw = 0;
    this.airT = 0;
  }
}

type ZoomState = 'normal' | 'trick' | 'grinding';

export class LouZoom {
  zoom: number = LOU_CAM.normalZoom;
  private target: number = LOU_CAM.normalZoom;
  private state: ZoomState = 'normal';
  private trickT = 0;
  private wasGrinding = false;

  trick(): void {
    this.state = 'trick';
    this.target = LOU_CAM.trickZoom;
    this.trickT = LOU_CAM.trickSecs;
  }

  update(dt: number, mode: Mode): void {
    const grinding = mode === 'grind' || mode === 'rail';
    if (this.trickT > 0) {
      this.trickT = Math.max(0, this.trickT - dt);
      if (this.trickT === 0) {
        this.state = grinding ? 'grinding' : 'normal';
        this.target = grinding ? LOU_CAM.grindZoom : LOU_CAM.normalZoom;
      }
    }
    if (this.state !== 'trick') {
      if (grinding && !this.wasGrinding) {
        this.state = 'grinding';
        this.target = LOU_CAM.grindZoom;
      } else if (!grinding && this.wasGrinding) {
        this.state = 'normal';
        this.target = LOU_CAM.normalZoom;
      }
      this.wasGrinding = grinding;
    }
    const speed = this.zoom < this.target ? LOU_CAM.zoomInSpeed : LOU_CAM.zoomOutSpeed;
    this.zoom += (this.target - this.zoom) * (1 - Math.exp(-speed * dt));
  }

  reset(): void {
    this.zoom = this.target = LOU_CAM.normalZoom;
    this.state = 'normal';
    this.trickT = 0;
    this.wasGrinding = false;
  }
}

// tiles of height to show for a screen aspect at zoom 1: the full box height, or more when the screen is narrower
export function viewHeight(aspect: number): number {
  return Math.max(LOU_CAM.viewH, (LOU_CAM.viewH * LOU_CAM.viewAspect) / aspect);
}

// The camera's rhythm (zack, 2026-10-25: "fisheye FOV and zoom to add to the rhythm of the game"). On top of the
// framing and the drift, the camera breathes with what the player does:
// - a pop bulges the lens and backs off a touch, so leaving the ground feels like a breath in
// - a combo winds the camera in step by step (and bends the lens a little more each trick), the tension of a line,
//   and lets it all go when the combo banks or slams
// - speed bends the lens (the fisheye of a filmer running alongside)
// CAM sets the lens's resting strength and whether the rhythm runs; ?lens=0..1 and ?rhythm=0 set them from the URL.
export const CAM = { lens: 0.75, rhythm: true, closeUp: true }; // fisheye strength (zack, 2026-10-26: full, toned down, then 0.75)

export function initCam(params: URLSearchParams): void {
  const lens = Number(params.get('lens'));
  if (params.has('lens') && Number.isFinite(lens)) CAM.lens = Math.min(1, Math.max(0, lens));
  if (params.get('rhythm') === '0') CAM.rhythm = false;
  if (params.get('closeup') === '0') CAM.closeUp = false;
}

export const RHYTHM = {
  popLens: 0.45, // lens bulge on a pop, dying off
  popZoom: 0.1, // and how far it backs off
  popDecay: 5, // per second
  comboSteps: 6, // a combo this long is fully wound
  comboZoom: 0.2, // zoom in when fully wound
  comboLens: 0.2,
  windIn: 3, // easing rates: wind up fast, let go slower
  letGo: 1.6,
  speedLens: 0.3, // lens at full flow
};

export class Rhythm {
  private pop = 0;
  private wind = 0;
  private windTarget = 0;
  private flow = 0;

  popped(): void {
    this.pop = 1;
  }

  combo(n: number): void {
    this.windTarget = Math.min(1, n / RHYTHM.comboSteps);
  }

  update(dt: number, flow: number): void {
    this.pop *= Math.exp(-RHYTHM.popDecay * dt);
    const rate = this.windTarget > this.wind ? RHYTHM.windIn : RHYTHM.letGo;
    this.wind += (this.windTarget - this.wind) * (1 - Math.exp(-rate * dt));
    this.flow += (flow - this.flow) * (1 - Math.exp(-2 * dt));
  }

  get zoom(): number {
    return (1 - RHYTHM.popZoom * this.pop) * (1 + RHYTHM.comboZoom * this.wind);
  }

  get lens(): number {
    return RHYTHM.popLens * this.pop + RHYTHM.comboLens * this.wind + RHYTHM.speedLens * this.flow;
  }

  reset(): void {
    this.pop = this.wind = this.windTarget = this.flow = 0;
  }
}

// A critically damped spring (zack, 2026-10-26: "camera movement needs to be smooth... can't be jumping"). Every
// camera value the effects push around (zoom, lens, field of view, the speed swing, a slam's roll) goes through one
// of these, so a punch or a combo letting go glides in and out with no snap in position or speed. omega is how
// stiff it is (rad/s): it settles in about 4 / omega seconds. Stepped in small slices so a slow frame stays stable.
export class Spring {
  v = 0;
  constructor(public x = 0) {}

  step(target: number, omega: number, dt: number): number {
    for (let left = dt; left > 1e-6; left -= 1 / 120) {
      const h = Math.min(left, 1 / 120);
      this.v += (omega * omega * (target - this.x) - 2 * omega * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }

  snap(x: number): number {
    this.v = 0;
    return (this.x = x);
  }
}

export const SMOOTH = {
  zoom: 9, // rad/s: a punch rises in about a fifth of a second and settles in under half
  fov: 8,
  lens: 7,
  yaw: 4, // the speed swing is slow and heavy
  roll: 10,
  tilt: 14, // gyro tilt: quick enough to follow the hand, soft enough to blend the jump when the screen flips
  frame: 3, // turning the phone: the framing glides over about a second and a half
};

// The close-up (zack, 2026-10-31: "when the player lands in a grind, or does a flip trick in more than 3 trick combo,
// move the camera up into the skater's business"). On top of everything else the camera rushes right in on Lou:
// landing in a grind holds it for the whole grind, and a flip trick from the 3rd trick of a combo on holds it a
// beat. It aims at Lou's middle (not the feet) and drops most of the lead, so Lou fills the middle of the screen,
// then eases back out to the normal framing. It can make you queasy, so the pause card switches it off
// (DYNAMIC ZOOM) and reduce motion skips it. ?closeup=0 turns it off from the URL.
export const CLOSE_CAM = {
  zoom: 2.1, // how much tighter than the framing at full close-up
  comboFrom: 3, // a flip trick this far into a combo (or further) gets one
  flipSecs: 0.9, // and holds it this long (seconds) before easing out
  grindAfter: 0.25, // a grind holds it this long after the grind ends
  aim: 0.85, // tiles above the feet it aims at (Lou's middle: the board clear of the bottom HUD, the whole body in view)
  centre: 0.8, // share of the framing's lead and low it drops, so Lou sits near the middle
  minShort: 4.2, // tiles across the screen's short side it never goes tighter than (Lou ~2.5 tall, all of them in)
  rushIn: 6, // spring rates (rad/s): rush in quick, glide back out slow
  easeOut: 2.4,
};

export class CloseUp {
  private holdT = 0;
  private grinding = false;
  private readonly spring = new Spring(0);

  // a flip trick, with the combo it's part of
  trick(combo: number): void {
    if (combo >= CLOSE_CAM.comboFrom) this.holdT = Math.max(this.holdT, CLOSE_CAM.flipSecs);
  }

  // landed in a grind or on a rail
  grind(): void {
    this.grinding = true;
  }

  // dt: real seconds (the camera's clock); on: whether close-ups are allowed (the setting, reduce motion)
  update(dt: number, mode: Mode, on: boolean): number {
    const grinding = mode === 'grind' || mode === 'rail';
    if (this.grinding && !grinding) {
      this.grinding = false;
      this.holdT = Math.max(this.holdT, CLOSE_CAM.grindAfter);
    } else if (this.grinding) this.holdT = Math.max(this.holdT, CLOSE_CAM.grindAfter);
    this.holdT = Math.max(0, this.holdT - dt);
    const target = on && (this.holdT > 0 || this.grinding) ? 1 : 0;
    this.spring.step(target, target > this.spring.x ? CLOSE_CAM.rushIn : CLOSE_CAM.easeOut, dt);
    return this.amount;
  }

  // 0 (none) to 1 (all the way in)
  get amount(): number {
    return Math.min(1, Math.max(0, this.spring.x));
  }

  reset(): void {
    this.holdT = 0;
    this.grinding = false;
    this.spring.snap(0);
  }
}

// the player's own zoom, set by pinching the street (or the pause card's CAMERA slider): multiplies the framing
export const USER_ZOOM = { min: 0.7, max: 1.6 };

export function clampUserZoom(z: number): number {
  return Number.isFinite(z) ? Math.min(USER_ZOOM.max, Math.max(USER_ZOOM.min, z)) : 1;
}

// x, but never under floor: a soft floor that bends in over knee so a spring hitting it doesn't jolt
export function softFloor(x: number, floor: number, knee: number): number {
  if (x >= floor + knee) return x;
  if (x <= floor - knee) return floor;
  const t = x - floor + knee;
  return floor + (t * t) / (4 * knee);
}
