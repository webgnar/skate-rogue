// Bullet time (zack, 2026-10-26: "when things are super intense it goes slow mo"): a huge combo glides the game into
// slow motion, deeper the bigger the combo and the faster you're going, and never twice within a cooldown so it stays
// rare. Pure: the game feeds it the live combo and speed, and plays what it returns on its TimeWarp.
//
// Two things slow it down: huge combos (zack: "slow mo should be for huge combos"), x12 then every 6 more, and close
// calls over cars (zack: "near misses on cars is cool"). Slow-mo on a landing felt like running into something, so
// a clutch catch or a flush bank only gets its callout. The slow-mo eases in rather than hitting like a wall.

export type LandCall = 'clutch' | 'flush';

export interface Slow {
  enter: number; // s easing down into the slow-mo (real time)
  slow: number; // game speed at its slowest, x
  hold: number; // s at that speed
  ease: number; // s easing back to 1x
}

export const BULLET = {
  on: true, // ?bullet=0 turns it off (slams and the Slow-mo mod still slow things down)
  cooldown: 8, // s of real time after a bullet time before another can start
  comboFirst: 12, // the first combo milestone
  comboEvery: 6, // and every this many more
  comboFull: 24, // combo count at full intensity
  speedFull: 2, // speed (x cruise) at full intensity
  enter: 0.3, // s gliding down into it
  slow: 0.4, // game speed at its slowest, at the least intensity
  hold: 0.5,
  nearHold: 0.35, // a close call holds a little less
  ease: 0.6,
  deepen: 0.4, // full intensity takes this much off the slow (as a share of it)
  lengthen: 0.6, // and holds this much longer
  clutchFrames: 5, // a catch this many frames (or fewer) before touchdown is a clutch (a callout)
  flushRad: 0.35, // within this angle of a falling slope's line is flush (a callout)
};

export function initBullet(params: URLSearchParams): void {
  if (params.get('bullet') === '0') BULLET.on = false;
}

// how intense the combo is: 0 at the first milestone, 1 at comboFull, pushed up by speed over cruise
export function intensity(combo: number, speed: number): number {
  const c = Math.min(1, Math.max(0, (combo - BULLET.comboFirst) / (BULLET.comboFull - BULLET.comboFirst)));
  const s = Math.min(1, Math.max(0, (speed - 1) / (BULLET.speedFull - 1)));
  return Math.min(1, 0.7 * c + 0.3 * s);
}

// a landing's callout, if any. `spare`: frames between the flip's catch and touchdown, `flush`: rad off a falling
// slope's line (both undefined when they don't apply)
export function landCall(quality: string | undefined, spare: number | undefined, flush: number | undefined): LandCall | null {
  if (quality === 'slam' || quality === 'sketchy') return null;
  if (spare !== undefined && spare <= BULLET.clutchFrames) return 'clutch';
  if (flush !== undefined && flush <= BULLET.flushRad) return 'flush';
  return null;
}

export class BulletTime {
  private cool = 0;
  private lastMilestone = 0;

  // a close call over a car: bullet time, unless cooling down
  near(combo: number, speed: number): Slow | null {
    return this.fire(combo, speed, BULLET.nearHold);
  }

  // the combo grew: the slow-mo to play if it just reached a milestone (once each per combo), and isn't cooling down
  combo(n: number, speed: number): Slow | null {
    if (n < this.lastMilestone) this.lastMilestone = 0;
    if (n < BULLET.comboFirst) return null;
    const m = BULLET.comboFirst + Math.floor((n - BULLET.comboFirst) / BULLET.comboEvery) * BULLET.comboEvery;
    if (m <= this.lastMilestone) return null;
    this.lastMilestone = m;
    return this.fire(n, speed, BULLET.hold);
  }

  private fire(combo: number, speed: number, hold: number): Slow | null {
    if (!BULLET.on || this.cool > 0) return null;
    this.cool = BULLET.cooldown;
    const k = intensity(combo, speed);
    return { enter: BULLET.enter, slow: BULLET.slow * (1 - BULLET.deepen * k), hold: hold * (1 + BULLET.lengthen * k), ease: BULLET.ease };
  }

  // advance by real seconds
  update(dt: number): void {
    this.cool = Math.max(0, this.cool - dt);
  }

  reset(): void {
    this.cool = 0;
    this.lastMilestone = 0;
  }
}
