// Bullet time (zack, 2026-10-26: "when things are super intense it goes slow mo"): a few sick moments drop the game
// into slow motion, deeper the more intense the run is right then, and never twice within a cooldown so it stays
// rare. Pure: the game feeds it events and the live combo and speed, and plays what it returns on its TimeWarp.
//
// The moments:
// - clutch: a flip caught in the last few frames before the wheels touch down (caught any later is sketchy)
// - flush: landing lined up with a slope that falls away, a bank or a hill taken like a transition
// - near: a close call, only while a combo is going (on its own it keeps the old quick beat)
// - combo: the combo reaching x10, x20, ...
//
// Intensity (0..1) is the combo count and the speed over cruise; it makes the slow-mo deeper and longer.

export type Moment = 'clutch' | 'flush' | 'near' | 'combo';

export interface Slow {
  moment: Moment;
  slow: number; // game speed at its slowest, x
  hold: number; // s at that speed (real time)
  ease: number; // s easing back to 1x
}

export const BULLET = {
  on: true, // ?bullet=0 turns it off (slams and the Slow-mo mod still slow things down)
  cooldown: 8, // s of real time after a bullet time before another can start
  clutchFrames: 5, // a catch this many frames (or fewer) before touchdown is a clutch
  flushRad: 0.35, // within this angle of a falling slope's line is flush (an ollie's arc usually meets one 0.4+ off)
  nearCombo: 3, // a close call needs this combo for bullet time
  comboEvery: 10, // the combo milestones
  comboFull: 12, // combo count at full intensity
  speedFull: 2, // speed (x cruise) at full intensity
  deepen: 0.4, // full intensity takes this much off the slow (as a share of it)
  lengthen: 0.5, // and holds this much longer
  moments: {
    clutch: { slow: 0.3, hold: 0.35, ease: 0.45 },
    flush: { slow: 0.3, hold: 0.4, ease: 0.5 },
    near: { slow: 0.35, hold: 0.25, ease: 0.4 },
    combo: { slow: 0.4, hold: 0.25, ease: 0.4 },
  } as Record<Moment, { slow: number; hold: number; ease: number }>,
};

export function initBullet(params: URLSearchParams): void {
  if (params.get('bullet') === '0') BULLET.on = false;
}

// how intense the run is right now: the combo going and how fast you're rolling
export function intensity(combo: number, speed: number): number {
  const c = Math.min(1, combo / BULLET.comboFull);
  const s = Math.min(1, Math.max(0, (speed - 1) / (BULLET.speedFull - 1)));
  return Math.min(1, 0.7 * c + 0.3 * s + 0.3 * c * s);
}

export class BulletTime {
  private cool = 0;
  private lastMilestone = 0;

  // a landing: which moment it was, if any. `spare`: frames between the flip's catch and touchdown, `flush`: rad off
  // a falling slope's line (both undefined when they don't apply)
  land(quality: string | undefined, spare: number | undefined, flush: number | undefined): Moment | null {
    if (quality === 'slam' || quality === 'sketchy') return null;
    if (spare !== undefined && spare <= BULLET.clutchFrames) return 'clutch';
    if (flush !== undefined && flush <= BULLET.flushRad) return 'flush';
    return null;
  }

  // the combo grew: a milestone is a moment (once each per combo)
  combo(n: number): Moment | null {
    if (n < this.lastMilestone) this.lastMilestone = 0;
    const m = Math.floor(n / BULLET.comboEvery) * BULLET.comboEvery;
    if (m > 0 && m > this.lastMilestone) {
      this.lastMilestone = m;
      return 'combo';
    }
    return null;
  }

  // a close call is a moment while a combo's going
  near(combo: number): Moment | null {
    return combo >= BULLET.nearCombo ? 'near' : null;
  }

  // try to start bullet time for a moment: the slow-mo to play, or null while cooling down
  fire(moment: Moment, combo: number, speed: number): Slow | null {
    if (!BULLET.on || this.cool > 0) return null;
    this.cool = BULLET.cooldown;
    const k = intensity(combo, speed);
    const m = BULLET.moments[moment];
    return {
      moment,
      slow: m.slow * (1 - BULLET.deepen * k),
      hold: m.hold * (1 + BULLET.lengthen * k),
      ease: m.ease,
    };
  }

  get cooling(): boolean {
    return this.cool > 0;
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
