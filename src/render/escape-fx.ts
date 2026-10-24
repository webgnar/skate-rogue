// The escape set pieces, kicked up from the street: the helicopter's rotor wash blows grit and litter out from
// under it, and act 3's chaser throws its own spray as it comes (the wave's foam and mist, the chariot's hoof dust
// and wheel sparks, the guards' running dust). All from the shared particle pool.
import type { Particles } from './particles';
import type { ChaserLook } from './chaser-view';

const hex = (c: number) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
const GRIT = [hex(0xb8b0a8), hex(0x8a8580), hex(0xd8d0c8)];
const LITTER = [hex(0xf0ead8), hex(0xe04a4a), hex(0x4a8ae0)];
const FOAM = [hex(0xeaf8ff), hex(0xffffff), hex(0xbfe4ff)];
const MIST = [hex(0xc8e8ff), hex(0xa8d4f0)];
const DUST = [hex(0xd8c8a8), hex(0xb8a888)];
const SPARK = [hex(0xffffff), hex(0xffe08a)];

export const ESCAPE_FX = {
  wash: 40, // grit per second under the helicopter (twice that when its light has you)
  front: { wave: 1.2, chariot: 1.6, guards: 0.6 } as Record<ChaserLook, number>, // world units from its middle to its front
};

export class EscapeFx {
  constructor(private readonly particles: Particles) {}

  // the helicopter over (x, ground); no wash where the L tracks cover the street
  chopper(x: number, ground: number, lit: boolean, covered: boolean, dt: number): void {
    if (covered) return;
    const p = this.particles;
    const rate = ESCAPE_FX.wash * (lit ? 2 : 1);
    //grit blown flat out both ways along the street
    p.stream('washL', x, ground + 0.05, rate / 2, dt, { n: 0, colors: GRIT, life: [0.4, 0.7], size: [0.08, 0.14], speed: [3, 6], angle: [Math.PI - 0.15, Math.PI + 0.05], jitter: 0.6, drag: 2.5, alpha: 0.75 });
    p.stream('washR', x, ground + 0.05, rate / 2, dt, { n: 0, colors: GRIT, life: [0.4, 0.7], size: [0.08, 0.14], speed: [3, 6], angle: [-0.05, 0.15], jitter: 0.6, drag: 2.5, alpha: 0.75 });
    //now and then a scrap of paper tumbles up
    p.stream('litter', x, ground + 0.1, 3, dt, { n: 0, colors: LITTER, life: [0.8, 1.2], size: [0.12, 0.16], speed: [2, 4], angle: [0.3, Math.PI - 0.3], jitter: 1, grav: 3, drag: 1.5, ink: true });
  }

  // act 3's chaser at x (its middle, world units) on the street; surging: it just gained on a slam
  chaser(look: ChaserLook, x: number, ground: number, surging: boolean, dt: number): void {
    const p = this.particles;
    const fx = x + ESCAPE_FX.front[look];
    const k = surging ? 2.5 : 1;
    if (look === 'wave') {
      p.stream('foam', fx, ground + 2.6, 30 * k, dt, { n: 0, colors: FOAM, life: [0.4, 0.7], size: [0.12, 0.2], speed: [1.5, 3.5], angle: [0.2, 1.4], jitter: 0.8, grav: 9, drag: 1, floor: ground });
      p.stream('mist', fx, ground + 0.4, 12 * k, dt, { n: 0, colors: MIST, life: [0.6, 0.9], size: [0.2, 0.3], size1: 0.5, speed: [0.8, 1.6], angle: [0, 0.6], jitter: 0.5, drag: 2, grav: -0.3, alpha: 0.55, fadeFrom: 0 });
    } else if (look === 'chariot') {
      p.stream('hooves', fx, ground + 0.05, 26 * k, dt, { n: 0, colors: DUST, life: [0.4, 0.7], size: [0.14, 0.22], size1: 0.35, speed: [0.6, 1.8], angle: [Math.PI * 0.55, Math.PI * 0.95], jitter: 0.8, drag: 2.5, grav: -0.3, alpha: 0.7, fadeFrom: 0 });
      p.stream('wheel', x - 0.6, ground + 0.1, 10 * k, dt, { n: 0, colors: SPARK, life: [0.15, 0.3], size: [0.08, 0.11], speed: [2, 4], angle: [Math.PI * 0.6, Math.PI * 0.9], grav: 14 });
    } else {
      p.stream('boots', fx, ground + 0.05, 14 * k, dt, { n: 0, colors: DUST, life: [0.3, 0.5], size: [0.1, 0.16], size1: 0.25, speed: [0.5, 1.4], angle: [Math.PI * 0.55, Math.PI * 0.95], jitter: 0.6, drag: 3, alpha: 0.6, fadeFrom: 0 });
    }
  }

  // a bounty paid at the gate: a fountain of Stoken-violet and gold
  bounty(x: number, y: number): void {
    this.particles.spray(x, y + 0.8, { n: 28, colors: [hex(0xb98cff), hex(0xffd23f), hex(0xffffff)], life: [0.6, 0.9], size: [0.12, 0.18], speed: [3, 6], angle: [Math.PI * 0.25, Math.PI * 0.75], grav: 9, drag: 0.8, ink: true });
  }
}
