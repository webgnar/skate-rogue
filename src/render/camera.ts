// Lou Gnar's camera, ported from excaliburSkate (camera-effects-manager.ts and the scene's lockToActor):
//
// - Locked hard on the skater's feet, dead centre of the screen, in x and y. No lag and no lead.
// - At zoom 1 it shows at least an 800 x 600 box (FitScreenAndFill): the 75 px skater stands an eighth of the
//   screen's height, and a wider screen just sees more street to each side.
// - Every trick punches in to 1.4x for 0.7 s; grinding holds 1.3x. It eases in fast and back out slower, with the
//   same frame-rate independent easing (1 - e^(-speed x dt)).
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
