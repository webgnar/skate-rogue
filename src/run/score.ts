// Score, combo, stoke and the run's money (GDD: Scoring and stoke). Pure, stepped with the floor's events.
//
// - Tricks, grinds and car-hops build a combo while you stay off the ground; landing banks it as
//   points x combo count x speed. A slam loses the combo.
// - A long combo also pays cash when you land it (the stoke cash-out): greedy combos pay, slams pay nothing.
// - Banked points fill the stoke meter. Full stoke is the gnar state: faster cruising, and slams cost no Heat.
// - Clearing a floor pays 250 x floor (QFS). Stoken pickups add to the score too.
import { PHYS } from '../physics/constants';
import type { Mode } from '../physics/skater';
import type { FloorEvent } from '../sim/floor';

export const SCORE = {
  trick: 100,
  grindStart: 50,
  railStart: 75,
  grindPerSec: 60,
  carHop: 150,
  stoken: 100,
  cashCoin: 1,
  floorClear: 250,
  speedMultMax: 2.5,
  cashOutFrom: 4, // combo count where landing starts paying cash
  cashOutPer: 2, // cash per trick past that
  stokeFull: 2500, // banked points to fill the meter
  stokeDecayPerSec: 0.04, // the meter drains slowly when you aren't banking
  stokeIdle: 3, // seconds after a bank before it drains
  gnarSecs: 8,
  gnarBoost: 1.2, // cruising speed in the gnar state
  slamStoke: 0.25, // a slam knocks this much off the meter
};

export interface Bank {
  points: number; // added to the score
  count: number;
  cash: number; // cash-out
}

export class RunScore {
  score = 0;
  cash = 0;
  stoken = 0;
  combo = 0; // tricks in the current combo
  comboPoints = 0;
  stoke = 0; // 0..1
  gnarT = 0; // seconds of gnar state left
  private idle = 0;

  get gnar(): boolean {
    return this.gnarT > 0;
  }

  // one sim step: grinding pays as it goes, the meter drains when idle
  step(mode: Mode): void {
    const dt = 1 / 60;
    if (mode === 'grind' || mode === 'rail') this.comboPoints += SCORE.grindPerSec * dt;
    if (this.gnarT > 0) this.gnarT = Math.max(0, this.gnarT - dt);
    this.idle += dt;
    if (this.idle > SCORE.stokeIdle && this.gnarT === 0) this.stoke = Math.max(0, this.stoke - SCORE.stokeDecayPerSec * dt);
  }

  // returns the bank when an event lands a combo, so the HUD can show it
  onEvent(e: FloorEvent, hsp: number): Bank | null {
    switch (e.type) {
      case 'trick':
        this.add(SCORE.trick);
        break;
      case 'grind':
        this.add(SCORE.grindStart);
        break;
      case 'rail':
        this.add(SCORE.railStart);
        break;
      case 'hop':
        this.add(SCORE.carHop);
        break;
      case 'land':
        return this.bank(hsp);
      case 'slam':
        this.combo = 0;
        this.comboPoints = 0;
        if (!this.gnar) this.stoke = Math.max(0, this.stoke - SCORE.slamStoke);
        break;
      case 'pickup':
        if (e.kind === 'cash') this.cash += SCORE.cashCoin;
        else {
          this.stoken++;
          this.score += SCORE.stoken;
        }
        break;
    }
    return null;
  }

  // style from a board mod (Spark Trail): into the combo when there is one, straight to the score when not
  addStyle(points: number): void {
    if (this.combo > 0) this.comboPoints += points;
    else this.score += points;
  }

  clearFloor(floor: number): number {
    const pts = SCORE.floorClear * floor;
    this.score += pts;
    return pts;
  }

  private add(points: number): void {
    this.combo++;
    this.comboPoints += points;
  }

  private bank(hsp: number): Bank | null {
    if (this.combo === 0) return null;
    const mult = Math.min(SCORE.speedMultMax, Math.max(1, hsp / PHYS.baseSpeed));
    const points = Math.round(this.comboPoints * this.combo * mult);
    const cash = Math.max(0, this.combo - SCORE.cashOutFrom + 1) * SCORE.cashOutPer;
    const count = this.combo;
    this.score += points;
    this.cash += cash;
    this.combo = 0;
    this.comboPoints = 0;
    this.idle = 0;
    if (!this.gnar) {
      this.stoke = Math.min(1, this.stoke + points / SCORE.stokeFull);
      if (this.stoke >= 1) {
        this.stoke = 0;
        this.gnarT = SCORE.gnarSecs;
      }
    }
    return { points, count, cash };
  }
}
