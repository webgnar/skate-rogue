// The helicopter escape (GDD: How a run ends, act 2). zack's pick (2026-10-24, logged overnight): outrun it, hide
// under the L. The AI's helicopter sweeps its spotlight along the street hunting the skater. Once the light finds
// you it locks on and follows, and every second in it adds Heat. It can't quite hold a skater going faster than
// cruising (rail speed, kicks), a slam lets it catch right up, and the L tracks overhead block it: duck under them
// and it loses you, overshoots, and has to turn back and search again. Pure, stepped at 60 Hz with the floor.
import { PHYS, TILE } from '../physics/constants';
import type { Skater } from '../physics/skater';

export interface Cover {
  x0: number;
  x1: number;
  y: number; // underside of the L tracks
}

export const CHOPPER = {
  radius: 1.4 * TILE, // the lit circle on the street
  huntSpeed: 1.4, // x base speed, closing in
  lockSpeed: 1.04, // x base speed: the most it can follow at; faster skating pulls out of it
  lockGain: 0.08, // how hard the light pulls toward the skater when locked
  lostFrames: 70, // after losing you under cover it overshoots this long before turning back
  heatPerSec: 14,
  startBehind: 14 * TILE, // the light comes in from behind the skater
};

export type ChopperState = 'hunt' | 'lock' | 'lost';

export class Chopper {
  x: number;
  v = 0; // px per frame
  state: ChopperState = 'hunt';
  lit = false; // the skater is in the light this step
  private lostT = 0;

  constructor(
    readonly from: number, // it joins the chase when the skater passes this x
    readonly covers: Cover[],
    startX: number,
  ) {
    this.x = startX - CHOPPER.startBehind;
  }

  covered(sk: Skater): boolean {
    return this.covers.some((c) => sk.x >= c.x0 && sk.x <= c.x1 && sk.y > c.y);
  }

  step(sk: Skater): boolean {
    if (sk.x < this.from) {
      //waiting off screen behind
      this.x = Math.min(this.x, sk.x - CHOPPER.startBehind);
      this.lit = false;
      return false;
    }
    const base = PHYS.baseSpeed;
    const dx = sk.x - this.x;
    const hidden = this.covered(sk);
    if (this.state === 'lost') {
      //overshoots, then turns back to hunt
      this.v += (base * CHOPPER.huntSpeed * Math.sign(this.v || 1) - this.v) * 0.05;
      if (--this.lostT <= 0) this.state = 'hunt';
    } else if (this.state === 'hunt') {
      const target = Math.sign(dx) * base * CHOPPER.huntSpeed;
      this.v += (target - this.v) * 0.06;
      if (Math.abs(dx) < CHOPPER.radius * 0.6 && !hidden) this.state = 'lock';
    } else {
      //locked: follows, but no faster than it can fly
      const want = this.v + dx * CHOPPER.lockGain;
      const max = base * CHOPPER.lockSpeed;
      this.v = Math.max(-max, Math.min(max, want * 0.7 + this.v * 0.3));
      if (hidden) {
        this.state = 'lost';
        this.lostT = CHOPPER.lostFrames;
        this.v = Math.max(this.v, base);
      } else if (Math.abs(dx) > CHOPPER.radius * 1.6) this.state = 'hunt';
    }
    this.x += this.v;
    this.lit = !hidden && Math.abs(sk.x - this.x) < CHOPPER.radius && sk.mode !== 'exit';
    return this.lit;
  }
}
