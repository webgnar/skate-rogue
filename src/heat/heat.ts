// Heat: how close the enforcer cruiser is (GDD: The chase). 0 = off screen, 100 = caught. Numbers are the GDD's
// first guess and live here for tuning.
import { PHYS } from '../physics/constants';
import type { Skater, SkaterEvent } from '../physics/skater';

export const HEAT = {
  slam: 35,
  slowPerSec: 10, // below base speed (remounting after a slam)
  trick: -3,
  grindPerSec: -4,
  carHop: -8,
  cleanPerSec: -6,
  cleanAfter: 180, // frames without a slam before clean skating counts
  max: 100,
};

export class Heat {
  value = 0;
  sinceSlam = Infinity; // frames
  holdT = 0; // the cruiser holds still while the skater remounts
  slamFree = false; // gnar state: slams cost no Heat

  step(sk: Skater, events: readonly SkaterEvent[]): void {
    let d = 0;
    for (const e of events) {
      if (e.type === 'slam') {
        if (!this.slamFree) d += HEAT.slam;
        this.sinceSlam = 0;
        this.holdT = PHYS.slamFrames;
      } else if (e.type === 'trick') d += HEAT.trick;
      else if (e.type === 'hop') d += HEAT.carHop;
    }
    if (sk.mode === 'roll' && sk.hsp < PHYS.baseSpeed - 0.01) d += HEAT.slowPerSec / 60;
    if (sk.mode === 'grind' || sk.mode === 'rail') d += HEAT.grindPerSec / 60;
    if (this.sinceSlam >= HEAT.cleanAfter) d += HEAT.cleanPerSec / 60;
    this.sinceSlam++;
    if (this.holdT > 0) this.holdT--;
    this.value = Math.max(0, Math.min(HEAT.max, this.value + d));
  }

  get caught(): boolean {
    return this.value >= HEAT.max;
  }
}
