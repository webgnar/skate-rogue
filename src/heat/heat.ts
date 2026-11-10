// Heat: how close the enforcer cruiser is (GDD: The chase). 0 = off screen, 100 = caught. Numbers are the GDD's
// first guess and live here for tuning.
//
// Stoke raises the stakes (zack, Nov 9, 2026): the stoke meter is the AI's detector. The louder you are to it, the
// more a slam costs (+25 at an empty meter up to +50 at a full one), and the slow skating after a slam scales the
// same way. Full stoke (the gnar state) is the alarm: slams are no longer free, the cruiser drives faster while it
// lasts, and clean skating doesn't cool. Cooling from tricks and grinds is the same at any stoke.
import { PHYS } from '../physics/constants';
import type { Skater, SkaterEvent } from '../physics/skater';

export const HEAT = {
  slamLow: 25, // a slam at an empty stoke meter
  slamHigh: 50, // a slam at a full one, and any slam in the gnar state
  slowPerSec: 10, // below base speed (remounting after a slam), for a +35 slam: scaled with the slam
  trick: -3,
  grindPerSec: -4,
  carHop: -8,
  nearMiss: -5,
  cleanPerSec: -6,
  cleanAfter: 180, // frames without a slam before clean skating counts
  alarmPerSec: 3, // the gnar state's alarm: the cruiser drives faster while it lasts
  max: 100,
};

// the detector reading where a slam costs the old flat +35: the generator's check rides keep it, so the floors it
// builds are the same ones as before
export const FLAT_STOKE = 0.4;

// what a slam costs with the detector at `stoke` (0..1); the gnar state is a full detector
export function slamHeat(stoke: number, alarm = false): number {
  const k = alarm ? 1 : Math.max(0, Math.min(1, stoke));
  return HEAT.slamLow + (HEAT.slamHigh - HEAT.slamLow) * k;
}

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
  stoke = 0; // the detector, 0..1: the stoke meter, set by the game before each step
  alarm = false; // the gnar state: the hunt is up a tier
  slamFree = false; // the generator's own check rides only (src/gen/validate.ts): can the line be skated at gnar speed
  private slowScale = 1; // the last slam's share of a +35 slam, for the slow skating after it
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
        const cost = this.slamFree ? 0 : slamHeat(this.stoke, this.alarm);
        d += cost;
        this.slowScale = cost / 35;
        this.sinceSlam = 0;
        this.holdT = PHYS.slamFrames;
      } else if (e.type === 'trick') d += HEAT.trick;
      else if (e.type === 'hop') d += HEAT.carHop;
    }
    if (sk.mode === 'roll' && sk.hsp < PHYS.baseSpeed - 0.01) d += (HEAT.slowPerSec * this.slowScale) / 60;
    if (this.alarm) d += HEAT.alarmPerSec / 60;
    if ((sk.mode === 'grind' || sk.mode === 'rail') && !this.watched) d += HEAT.grindPerSec / 60;
    if (this.sinceSlam >= HEAT.cleanAfter && !this.watched && !this.alarm) d += HEAT.cleanPerSec / 60;
    if (d < 0 && sk.mode === 'air') d *= this.mods.airCool ?? 1;
    this.sinceSlam++;
    if (this.holdT > 0) this.holdT--;
    this.add(d);
  }

  get caught(): boolean {
    return this.value >= HEAT.max;
  }
}
