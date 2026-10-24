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
  decoyAt: 75, // Decoy: the first time Heat reaches this on a floor
  decoyTo: 35,
};

// what the COOL boons change about Heat
export interface HeatMods {
  rise: number; // multiplier on Heat gained (Low Profile)
  hopCool: number; // extra Heat off per car hop (Siren Song)
  decoy: boolean;
  slow: number; // multiplier on Heat from skating slow (Ghost Mode)
  airCool?: number; // multiplier on cooling while airborne (Keanu)
}

export const NO_HEAT_MODS: HeatMods = { rise: 1, hopCool: 0, decoy: false, slow: 1 };

export class Heat {
  value = 0;
  sinceSlam = Infinity; // frames
  holdT = 0; // the cruiser holds still while the skater remounts
  slamFree = false; // gnar state: slams cost no Heat
  mods: HeatMods = NO_HEAT_MODS;
  decoyFired = false; // this step
  private decoyUsed = false;

  // add Heat from outside the skater's events (the helicopter's light): gains are slowed by Low Profile
  add(d: number): void {
    this.value = Math.max(0, Math.min(HEAT.max, this.value + (d > 0 ? d * this.mods.rise : d)));
  }

  step(sk: Skater, events: readonly SkaterEvent[]): void {
    let d = 0;
    for (const e of events) {
      if (e.type === 'slam' || e.type === 'tuck') {
        if (!this.slamFree) d += HEAT.slam;
        this.sinceSlam = 0;
        this.holdT = PHYS.slamFrames;
      } else if (e.type === 'trick') d += HEAT.trick;
      else if (e.type === 'hop') d += HEAT.carHop - this.mods.hopCool;
    }
    if (sk.mode === 'roll' && sk.hsp < PHYS.baseSpeed - 0.01) d += (HEAT.slowPerSec / 60) * this.mods.slow;
    if (sk.mode === 'grind' || sk.mode === 'rail') d += HEAT.grindPerSec / 60;
    if (this.sinceSlam >= HEAT.cleanAfter) d += HEAT.cleanPerSec / 60;
    if (d < 0 && sk.mode === 'air') d *= this.mods.airCool ?? 1;
    this.sinceSlam++;
    if (this.holdT > 0) this.holdT--;
    this.add(d);
    //Decoy: once a floor, a decoy board pulls the cruiser back
    this.decoyFired = false;
    if (this.mods.decoy && !this.decoyUsed && this.value >= HEAT.decoyAt && this.value < HEAT.max) {
      this.decoyUsed = true;
      this.decoyFired = true;
      this.value = HEAT.decoyTo;
    }
  }

  get caught(): boolean {
    return this.value >= HEAT.max;
  }
}
