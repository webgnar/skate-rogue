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
  nearMiss: -5,
  cleanPerSec: -6,
  cleanAfter: 180, // frames without a slam before clean skating counts
  max: 100,
};

// what the COOL boons change about Heat
export interface HeatMods {
  rise: number; // multiplier on Heat gained (Low Profile)
  airCool?: number; // multiplier on cooling while airborne (Keanu)
}

export const NO_HEAT_MODS: HeatMods = { rise: 1 };

export class Heat {
  value = 0;
  sinceSlam = Infinity; // frames
  holdT = 0; // the cruiser holds still while the skater remounts
  slamFree = false; // gnar state: slams cost no Heat
  watched = false; // the top route's helicopter is on you: skating clean and grinding don't cool (src/sim/floor.ts)
  mods: HeatMods = NO_HEAT_MODS;

  // add Heat from outside the skater's events (the helicopter's light): gains are slowed by Low Profile
  add(d: number): void {
    this.value = Math.max(0, Math.min(HEAT.max, this.value + (d > 0 ? d * this.mods.rise : d)));
  }

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
    if ((sk.mode === 'grind' || sk.mode === 'rail') && !this.watched) d += HEAT.grindPerSec / 60;
    if (this.sinceSlam >= HEAT.cleanAfter && !this.watched) d += HEAT.cleanPerSec / 60;
    if (d < 0 && sk.mode === 'air') d *= this.mods.airCool ?? 1;
    this.sinceSlam++;
    if (this.holdT > 0) this.holdT--;
    this.add(d);
  }

  get caught(): boolean {
    return this.value >= HEAT.max;
  }
}
