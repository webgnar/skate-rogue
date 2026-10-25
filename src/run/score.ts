// Score, combo, stoke and the run's money (GDD: Scoring and stoke). Pure, stepped with the floor's events.
//
// - Tricks, grinds, car-hops and manuals build a combo while you stay off the ground (a manual pad counts as off
//   it: landing into a manual adds to the combo instead of banking it); landing banks it as
//   points x combo count x speed. A slam loses the combo. How you land counts: a sketchy landing (the flip caught
//   late, or a drop too big to soak up) banks half; a heavy one (a big drop landed) adds a big-drop bonus.
//   Popping right at the lip of the ground is a little style of its own.
// - A long combo also pays cash when you land it (the stoke cash-out): greedy combos pay, slams pay nothing.
// - Banked points fill the stoke meter. Full stoke is the gnar state: faster cruising, and slams cost no Heat.
// - Clearing a floor pays 250 x floor (QFS). Stoken pickups add to the score too.
import { PHYS } from '../physics/constants';
import type { Mode } from '../physics/skater';
import type { FloorEvent } from '../sim/floor';

export const SCORE = {
  trick: 100,
  fakieMult: 1.5,
  spin: 25,
  grindStart: 50,
  railStart: 75,
  grindPerSec: 60,
  carHop: 150,
  wreck: 300, // car-hopping a car to scrap, on top of the hop
  kicker: 150, // off a box truck's tailgate
  nearMiss: 200, // a close call: over a vehicle with a few px to spare, or one passing right under you
  drone: 250, // stomping a drone out of the sky, on top of the hop
  smash: 25, // a prop smashed: a little style, never worth more than skating well
  smashCash: 3, // a prop hiding coins
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
  sketchy: 0.5, // share of the combo a sketchy landing banks
  bigDrop: 100, // a heavy landing: a big drop, landed
  lip: 30, // an ollie popped right at the edge
  manual: 120, // landing into a manual on a manual pad: a trick, and the combo carries on
};

export interface Bank {
  points: number; // added to the score
  count: number;
  cash: number; // cash-out
  how?: 'sketchy' | 'big'; // how it was landed, for the callout
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
  scoreScale = 1; // New Wheels: banked points
  slamStoke = false; // Slam Stoke: a slam keeps the combo and adds stoke
  stokenScale = 1; // Double Stoken
  nearScale = 1; // Jaywalker: close calls score double
  cashScale = 1; // Goldie: more cash from every source
  private cashPart = 0; // the share of a dollar Goldie's cut has banked so far

  // cash from any source, scaled; returns the whole dollars it added
  addCash(n: number): number {
    const v = n * this.cashScale + this.cashPart;
    const whole = Math.floor(v + 1e-9);
    this.cashPart = v - whole;
    this.cash += whole;
    return whole;
  }

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
        //fakie tricks are harder: half again; a 180 adds a little for the spin
        this.add(SCORE.trick * (e.fakie ? SCORE.fakieMult : 1) + (e.spin ? SCORE.spin : 0));
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
      case 'dent':
        if (e.stage === 3) this.add(SCORE.wreck);
        break;
      case 'kicker':
        this.add(SCORE.kicker);
        break;
      case 'near':
        this.add(SCORE.nearMiss * this.nearScale);
        break;
      case 'ollie':
        if (e.lip) this.add(SCORE.lip);
        break;
      case 'land':
        if (e.manual) {
          this.add(SCORE.manual);
          return null;
        }
        if (e.quality === 'heavy') this.add(SCORE.bigDrop);
        return this.bank(hsp, e.quality === 'sketchy' ? 'sketchy' : e.quality === 'heavy' ? 'big' : undefined);
      case 'slam':
      case 'tuck':
        if (this.slamStoke) {
          this.fill(SCORE.slamStoke);
          break;
        }
        this.combo = 0;
        this.comboPoints = 0;
        if (!this.gnar) this.stoke = Math.max(0, this.stoke - SCORE.slamStoke);
        break;
      case 'pickup':
        if (e.kind === 'cash') this.addCash(SCORE.cashCoin);
        else {
          this.stoken += this.stokenScale;
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

  private bank(hsp: number, how?: Bank['how']): Bank | null {
    if (this.combo === 0) return null;
    const mult = Math.min(SCORE.speedMultMax, Math.max(1, hsp / PHYS.baseSpeed));
    const points = Math.round(this.comboPoints * this.combo * mult * this.scoreScale * (how === 'sketchy' ? SCORE.sketchy : 1));
    const cash = this.addCash(Math.max(0, this.combo - SCORE.cashOutFrom + 1) * SCORE.cashOutPer);
    const count = this.combo;
    this.score += points;
    this.combo = 0;
    this.comboPoints = 0;
    this.idle = 0;
    this.fill(points / SCORE.stokeFull);
    return { points, count, cash, ...(how ? { how } : {}) };
  }

  // fill the stoke meter; full is the gnar state (not while already in it)
  private fill(share: number): void {
    if (this.gnar) return;
    this.stoke = Math.min(1, this.stoke + share);
    if (this.stoke >= 1) {
      this.stoke = 0;
      this.gnarT = SCORE.gnarSecs;
    }
  }
}
