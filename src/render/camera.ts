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
  landscapeH: 10.5, // tiles of height on a phone held sideways (Lou ~a fifth of the screen; desktop shows 16)
  landscapeFov: 52,
  portraitW: 10.5, // tiles of width on a phone held upright (it showed 21; height follows from the aspect)
  portraitFov: 74, // tall screen, so a tall lens: about 40 degrees across
  lead: [0.22, 0.42], // landscape, portrait: Lou sits left of centre so more street ahead shows
  low: [0.12, 0.14], // landscape, portrait: Lou sits below centre, the roofs, wires and the L above in view
  punch: 0.6, // trick and grind zooms at this share of their strength: the frame is tight already
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
  airPull: 0.2, // zoom out this much in big air (shows where you'll land)
  speedPull: 0.14, // and this much at full flow
  speedFov: 9, // degrees the lens opens at full flow
  zoomFov: 32, // degrees of lens per unit of zoom: punch in = wider, pull out = narrower (the dolly zoom)
  pullIn: 2.2, // easing rates
  pullOut: 1.2,
  kickDecay: 0.86, // a landing kick dies off by this per 60 Hz frame
  minDist: 6, // the camera never dollies closer than this (the foreground rows start at z 4.35)
};

export class CamDrift {
  pull = 1; // multiplies the zoom: under 1 backs off
  fovAdd = 0; // degrees on top of the lens
  kick = 0; // 0..1 landing punch, decaying
  private airT = 0;

  land(impact: number): void {
    this.kick = Math.max(this.kick, Math.min(1, impact));
  }

  // flow 0..1 (speed over cruising, as the speed lines use)
  update(dt: number, mode: Mode, flow: number): void {
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
