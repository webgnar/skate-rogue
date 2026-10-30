// Chinatown's cabs (zack, 2026-10-30: "taxis that you can skitch on like the trolly, that give you speed on the flat
// parts- which get you speed to hit kickers that blast you up to the powerlines"). On a cab flat, a cab rolls your way
// slower than you; roll into its back bumper and you grab on (src/physics/skater.ts). Then it floors it, pulling you
// along the flat at well over your own speed, until it turns off at the corner before the kicker and lets you go
// with all that speed. Ollie to let go sooner. A cab you never catch turns off at the corner all the same. Pure.
import { PHYS, TILE } from '../physics/constants';
import type { CabRun, Car } from '../physics/level';

export const CAB = {
  w: 2 * TILE,
  h: 40,
  trigger: 3 * TILE, // it pulls off when you're this far behind its back bumper, so you catch it in a beat
  cruise: 0.35, // share of base speed, before you grab on: you catch it
  speed: 2.5, // share of base speed it floors it to, pulling you
  accel: 0.2, // px/frame per frame: it floors it
  turnFrames: 34, // turning off at the corner, out of your lane and up the side street
};

export type CabState = 'wait' | 'cruise' | 'pull' | 'turn' | 'gone';

export class Cab {
  state: CabState = 'wait';
  speed = 0;
  turn = 0; // 0 down your street, 1 turned off up the side street
  pulled = false; // set by the floor sim: the skater's hanging on this step
  readonly box: Car;

  constructor(readonly run: CabRun) {
    this.box = { x0: run.x, x1: run.x + CAB.w, roof: run.y - CAB.h, bottom: run.y, skitch: true };
  }

  // solid: in your lane, to grab, hop or hit
  get solid(): boolean {
    return this.state === 'cruise' || this.state === 'pull';
  }

  step(skaterX: number): void {
    if (this.state === 'wait') {
      if (skaterX < this.run.x - CAB.trigger) return;
      this.state = 'cruise';
      this.speed = PHYS.baseSpeed * CAB.cruise;
    }
    if (this.state === 'gone') return;
    if (this.state === 'cruise' && this.pulled) this.state = 'pull';
    if (this.state === 'pull') this.speed = Math.min(PHYS.baseSpeed * CAB.speed, this.speed + CAB.accel);
    if (this.state === 'turn') {
      //braking round the corner
      this.turn = Math.min(1, this.turn + 1 / CAB.turnFrames);
      this.speed *= 0.93;
      if (this.turn >= 1) this.state = 'gone';
    }
    this.box.x0 += this.speed;
    this.box.x1 += this.speed;
    //at the corner it turns off and lets go
    if (this.solid && this.box.x1 >= this.run.turnX) {
      this.state = 'turn';
      this.box.skitch = false;
    }
  }
}
