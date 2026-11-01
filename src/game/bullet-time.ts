// Bullet time (zack, 2026-10-26: "when things are super intense it goes slow mo"): a huge combo glides the game into
// slow motion, deeper the bigger the combo and the faster you're going, and never twice within a cooldown so it stays
// rare. Pure: the game feeds it the live combo and speed, and plays what it returns on its TimeWarp.
//
// Two things slow it down: huge combos (zack: "slow mo should be for huge combos"), x12 then every 6 more, and close
// calls over cars (zack: "near misses on cars is cool"). Slow-mo on a landing felt like running into something, so
// a clutch catch or a flush bank only gets its callout. The slow-mo eases in rather than hitting like a wall.
//
// A third (zack, 2026-11-01: "quick things that happen right next to each other like grind flip manual ... where the
// player actually NEEDS the game to be going in slow motion"): a quick chain, beats (a flip, a grind, a manual, a car
// hop...) landing hard on each other's heels, at least two kinds of them. The faster you're going and the further out
// the camera is (Lou small on screen), the more room between beats still counts as quick. Dead flips (thrown with no
// jumps left) never count, so spinning the board on a long fall can't farm it, and a manual landing counts but
// never starts it itself (no slow-mo on a landing).

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
  chainBeats: 3, // beats in a quick chain
  chainKinds: 2, // of at least this many kinds
  chainGap: 0.55, // s of game time between beats, at most, at cruise speed with the camera at rest
  chainSpeed: 0.6, // at speedFull the gap stretches by this share
  chainCam: 0.8, // per unit of camera pulled out past rest (viewH / resting viewH - 1), the gap stretches by this
  chainCamMin: 0.85, // the camera's say, clamped: a close-up shrinks the gap no less than this
  chainCamMax: 1.35, // and pulled right out stretches it no more than this
  chainCooldown: 5, // s of real time a chain needs since the last bullet time (combos and close calls keep `cooldown`)
  chainHold: 0.35,
  chainSlow: 0.5, // a quick chain is a lighter slow-mo than a huge combo
  clutchFrames: 5, // a catch this many frames (or fewer) before touchdown is a clutch (a callout)
  flushRad: 0.35, // within this angle of a falling slope's line is flush (a callout)
};

// a beat of a quick chain: what kind of move it was
export type Beat = 'flip' | 'grind' | 'manual' | 'hop' | 'near' | 'dodge';

// the beat a sim event is, if any. Dead flips aren't beats (no farming them on a long fall), nor are a firecracker's
// clacks (one per step)
export function beatOf(e: { type: string; dead?: boolean; manual?: boolean }): Beat | null {
  switch (e.type) {
    case 'trick':
      return e.dead ? null : 'flip';
    case 'grind':
    case 'rail':
      return 'grind';
    case 'land':
      return e.manual ? 'manual' : null;
    case 'firecracker':
      return 'manual';
    case 'hop':
    case 'kicker':
      return 'hop';
    case 'near':
      return 'near';
    case 'dodge':
      return 'dodge';
  }
  return null;
}

// how long a gap between beats still counts as quick: longer at speed and with the camera pulled out
// (cam: the view's height over its resting height, >1 pulled out)
export function chainGap(speed: number, cam: number): number {
  const s = Math.min(1, Math.max(0, (speed - 1) / (BULLET.speedFull - 1)));
  const c = Math.min(BULLET.chainCamMax, Math.max(BULLET.chainCamMin, 1 + BULLET.chainCam * (cam - 1)));
  return BULLET.chainGap * (1 + BULLET.chainSpeed * s) * c;
}

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
  private since = 1e9; // real s since the last bullet time
  private lastMilestone = 0;
  private chain: { beat: Beat; t: number }[] = [];

  // a beat at game time t (s): the slow-mo to play if it makes a quick chain. Slams break the chain (chainBreak).
  beat(b: Beat, t: number, speed: number, cam: number, combo: number): Slow | null {
    const last = this.chain[this.chain.length - 1];
    if (last && t - last.t > chainGap(speed, cam)) this.chain.length = 0;
    this.chain.push({ beat: b, t });
    if (this.chain.length < BULLET.chainBeats || b === 'manual') return null;
    if (new Set(this.chain.map((c) => c.beat)).size < BULLET.chainKinds) return null;
    if (!BULLET.on || this.since < BULLET.chainCooldown) return null;
    const n = this.chain.length;
    this.chain.length = 0;
    this.cool = BULLET.cooldown;
    this.since = 0;
    //longer chains and more speed go deeper, like a combo
    const k = Math.min(1, 0.6 * Math.min(1, (n - BULLET.chainBeats) / 3) + 0.4 * Math.min(1, Math.max(0, (speed - 1) / (BULLET.speedFull - 1))) + Math.min(0.3, combo / 40));
    return { enter: BULLET.enter, slow: BULLET.chainSlow * (1 - BULLET.deepen * k), hold: BULLET.chainHold * (1 + BULLET.lengthen * k), ease: BULLET.ease };
  }

  chainBreak(): void {
    this.chain.length = 0;
  }

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
    this.since = 0;
    const k = intensity(combo, speed);
    return { enter: BULLET.enter, slow: BULLET.slow * (1 - BULLET.deepen * k), hold: hold * (1 + BULLET.lengthen * k), ease: BULLET.ease };
  }

  // advance by real seconds
  update(dt: number): void {
    this.cool = Math.max(0, this.cool - dt);
    this.since += dt;
  }

  reset(): void {
    this.cool = 0;
    this.since = 1e9;
    this.lastMilestone = 0;
    this.chain.length = 0;
  }
}
