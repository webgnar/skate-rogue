// The guards shoot (zack, 2026-10-27: "when the cops are on foot, chasing you, they should shoot at you. you should
// have to dodge the bullets"). On a chase floor (src/sim/chaser.ts) the guard in front aims for a beat, with a red
// sight line on you the whole time, then fires a bullet flat along the street at your waist. Be in the air when it
// gets to you (an ollie clears it), or up off the street where they can't draw a line on you. A hit is a slam: the
// chaser closes in. Pure, 60 Hz, deterministic from the floor seed.
import { PHYS, TILE } from '../physics/constants';
import type { Skater } from '../physics/skater';
import { makeRng } from '../gen/rng';
import type { Chaser } from './chaser';

export const SHOTS = {
  first: 180, // frames into the chase before the first shot
  every: [150, 270], // frames between shots (2.5 to 4.5 s)
  aim: 42, // frames of aiming (the tell) before the shot, the sight line blinking faster at the end
  speed: 5, // px/frame faster than you're going: it closes the gap in about 0.75 s
  waist: 22, // px over the ground you're riding: a plain ollie gets your feet over it
  reach: 2.5 * TILE, // they only shoot while you're this close to street level (a roof or a high line is safe)
  gun: 0.9 * TILE, // the muzzle, ahead of the chaser's position: the front guard's arm aimed out from the shoulder
  gunY: 44, // and above the street (src/render/chaser-view.ts AIM: shoulder height less the aim's dip, plus the bob)
  life: 150, // frames before a bullet that never reached you is gone
  afterHit: 120, // frames of grace after a hit before they aim again
};

export interface Bullet {
  x: number;
  y: number; // px, the line it flies along
  vx: number;
  life: number;
}

export type ShotEvent =
  | { type: 'aim'; x: number; y: number } // the guard raises the gun (x, y: the gun, px)
  | { type: 'shot'; x: number; y: number } // bang: a bullet leaves the gun at height y
  | { type: 'shotHit'; x: number; y: number } // it got you
  | { type: 'dodge'; x: number; y: number }; // it went under you

export class Shooter {
  aimT = 0; // frames left of the aim, 0 when not aiming
  aimY = 0; // the height the sight line is on (px)
  wait: number = SHOTS.first; // frames to the next aim
  readonly bullets: Bullet[] = [];
  events: ShotEvent[] = [];
  private groundY: number;
  private readonly rng: () => number;

  constructor(
    seed: number,
    private readonly streetY: number,
  ) {
    this.rng = makeRng(seed * 31 + 7);
    this.groundY = streetY;
  }

  // where the gun is
  gunX(chaser: Chaser): number {
    return chaser.x + SHOTS.gun;
  }

  get gunY(): number {
    return this.streetY - SHOTS.gunY;
  }

  // within reach of their aim: close enough to street level
  inReach(): boolean {
    return Math.abs(this.groundY - this.streetY) <= SHOTS.reach;
  }

  // before the skater moves, so a hit's slam lands in this step's events
  step(chaser: Chaser, sk: Skater): void {
    this.events = [];
    if (sk.grounded) this.groundY = sk.y;
    const live = sk.x >= chaser.from && !chaser.caught && sk.mode !== 'bail' && sk.mode !== 'exit';
    this.flyBullets(sk);
    if (!live) {
      this.aimT = 0;
      return;
    }
    if (this.aimT > 0) {
      this.aimY = this.groundY - SHOTS.waist;
      //lost the line on you (you got up high): they lower the gun and try again
      if (!this.inReach()) {
        this.aimT = 0;
        this.wait = SHOTS.every[0] / 2;
      } else if (--this.aimT === 0) this.fire(chaser, sk);
      return;
    }
    if (--this.wait > 0) return;
    if (!this.inReach()) {
      this.wait = 30;
      return;
    }
    this.aimT = SHOTS.aim;
    this.aimY = this.groundY - SHOTS.waist;
    this.events.push({ type: 'aim', x: this.gunX(chaser), y: this.gunY });
  }

  private fire(chaser: Chaser, sk: Skater): void {
    const x = this.gunX(chaser);
    this.bullets.push({ x, y: this.aimY, vx: Math.max(Math.abs(sk.hsp), PHYS.baseSpeed) + SHOTS.speed, life: SHOTS.life });
    this.events.push({ type: 'shot', x, y: this.aimY });
    const [lo, hi] = SHOTS.every;
    this.wait = lo + Math.floor(this.rng() * (hi - lo + 1));
  }

  private flyBullets(sk: Skater): void {
    const half = PHYS.width / 2;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const x0 = b.x;
      b.x += b.vx;
      b.life--;
      //this step it swept from x0 to b.x: did that cross your body?
      const across = b.x >= sk.x - half && x0 <= sk.x + half;
      const body = sk.mode !== 'bail' && b.y > sk.y - PHYS.height && b.y < sk.y;
      if (across && body) {
        this.bullets.splice(i, 1);
        this.events.push({ type: 'shotHit', x: sk.x, y: b.y });
        sk.shot();
        this.wait = Math.max(this.wait, SHOTS.afterHit);
      } else if (x0 <= sk.x + half && b.x > sk.x + half) {
        //past you without a hit
        this.events.push({ type: 'dodge', x: sk.x, y: b.y });
        this.bullets.splice(i, 1);
      } else if (b.life <= 0) this.bullets.splice(i, 1);
    }
  }
}
