// A look for each boon and board mod, so you can see what you bought working: POP boons in the POP yellow, GRIND
// boons in the GRIND orange, board mods each in their own colour. All of it goes through the one particle pool.
// Visual only: the sim does the actual work.
import type { BoonId, Held } from '../boons/defs';
import type { EffectId } from '../board/mods';
import type { Mode, SkaterEvent } from '../physics/skater';
import type { Particles, Spray } from './particles';

const hex = (c: number) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
const POP = [hex(0xffd23f), hex(0xfff0a8)];
const GRIND = [hex(0xff8c2b), hex(0xffc07a)];
const MAGNET = [hex(0x8a7dff), hex(0x5ad0ff)];
const GREASE = [hex(0x1a1c2a), hex(0x3a4060)];
const WAX = [hex(0xf4f4ec), hex(0xd8e4f0)];
const FRENZY = [hex(0xff4fa8), hex(0xff8c2b), hex(0xffffff)];
const GOLD = [hex(0xffd23f), hex(0xffffff)];
const CASH = [hex(0x3ddc84), hex(0x9cf5c0)];
const TIME = [hex(0x9ad8ff), hex(0xe0f4ff)];
const GRAV = [hex(0xb06cff), hex(0xe0c0ff)];
const KICK = [hex(0x4ad8ff), hex(0xffffff)];
const DUSTY = [hex(0xc8c0b8), hex(0xa8a098)];

const UP = Math.PI / 2;
const DOWN = -Math.PI / 2;

// how the skater looks this frame, for the effects that run while a boon is working
export interface SkaterLook {
  mode: Mode;
  floatT: number;
  holdT: number;
  onRailT: number;
  carry: number;
  hsp: number;
}

export class BoonFx {
  private held = new Set<BoonId>();
  private airJumps = 0;
  private lastMode: Mode = 'roll';

  constructor(private readonly particles: Particles) {}

  setBoons(boons: Held[]): void {
    this.held = new Set(boons.map((b) => b.id));
    this.airJumps = 0;
  }

  // the boons that show while they work; (x, y) is under the board in world units
  update(dt: number, sk: SkaterLook, x: number, y: number): void {
    const p = this.particles;
    const air = sk.mode === 'air';
    const grinding = sk.mode === 'grind' || sk.mode === 'rail';
    //Floaty Flip: pale feathers drift off the board while gravity is halved
    if (this.held.has('floatyFlip') && air && sk.floatT > 0) p.stream('floaty', x, y, 30, dt, { n: 0, colors: POP, life: [0.5, 0.8], size: [0.1, 0.14], speed: [0.3, 0.8], angle: [DOWN - 0.8, DOWN + 0.8], jitter: 0.25, grav: 0.6, drag: 2, fadeFrom: 0.3 });
    //Pressure Flip: an updraft pushing under the board while it floats (after 0.25 s held)
    if (this.held.has('pressureFlip') && air && sk.holdT > 15) p.stream('pressure', x, y - 0.1, 40, dt, { n: 0, colors: POP, life: [0.2, 0.35], size: [0.08, 0.12], speed: [1.5, 3], angle: [DOWN - 0.3, DOWN + 0.3], jitter: 0.3, drag: 2 });
    //Grease: dark glossy drips off the trucks
    if (this.held.has('grease') && grinding) p.stream('grease', x, y, 22, dt, { n: 0, colors: GREASE, life: [0.4, 0.6], size: [0.07, 0.1], speed: [0.2, 0.6], angle: [DOWN - 0.4, DOWN + 0.4], jitter: 0.12, grav: 12, ink: true, floor: y - 2 });
    //Feeble Frenzy: the sparks run hotter the longer you stay on one rail
    if (this.held.has('feebleFrenzy') && grinding && sk.onRailT > 30) p.stream('frenzy', x, y, 15 * Math.min(4, sk.onRailT / 30), dt, { n: 0, colors: FRENZY, life: [0.2, 0.4], size: [0.1, 0.16], speed: [1.5, 3.5], angle: [UP - 1.2, UP + 0.4], grav: 10 });
    //Exit Wax: a wax streak off the wheels while rail speed lasts
    if (this.held.has('exitWax') && sk.mode === 'roll' && sk.carry > 0.3) p.stream('wax', x, y + 0.03, 25 * Math.min(1, sk.carry / 2), dt, { n: 0, colors: WAX, life: [0.3, 0.45], size: [0.08, 0.12], speed: [0.5, 1.5], angle: [Math.PI - 0.2, Math.PI + 0.2], drag: 3, alpha: 0.7 });
    if (sk.mode !== 'air') this.airJumps = 0;
    this.lastMode = sk.mode;
  }

  event(e: SkaterEvent, x: number, y: number, speed: number): void {
    const p = this.particles;
    switch (e.type) {
      case 'ollie':
        //Big Pop: a POP-yellow ring kicks out flat under the board
        if (this.held.has('bigPop')) p.spray(x, y, ring(POP, 14, 3.5));
        //Rail Launch: off a rail, an orange plume that grows with grind speed
        if (this.held.has('railLaunch') && (this.lastMode === 'grind' || this.lastMode === 'rail')) {
          const k = Math.min(2, speed / 5);
          p.spray(x, y, { n: Math.round(10 + 10 * k), colors: GRIND, life: [0.3, 0.5], size: [0.12, 0.18], speed: [2 + k, 4 + 2 * k], angle: [DOWN - 0.5, DOWN + 0.5], grav: -2, drag: 2 });
        }
        break;
      case 'trick':
        this.airJumps++;
        //Late Flip: streaks shoot down from the board as it goes full height
        if (this.held.has('lateFlip')) p.spray(x, y, { n: 8, colors: POP, life: [0.18, 0.26], size: [0.1, 0.14], speed: [5, 7], angle: [DOWN - 0.25, DOWN + 0.25], drag: 4 });
        //Triple Threat: the extra jump shows as three stacked rings
        if (this.held.has('tripleThreat') && this.airJumps >= 2) for (let k = 0; k < 3; k++) p.spray(x, y - k * 0.18, ring(POP, 10, 2 + k * 0.6));
        break;
      case 'grind':
      case 'rail':
        //Rail Magnet: violet pixels pulled in to where the board caught
        if (this.held.has('railMagnet')) p.spray(x, y, { n: 14, colors: MAGNET, life: [0.18, 0.25], size: [0.1, 0.14], speed: [-6, -4], ring: true, radius: 1.1, drag: 0 });
        //Spare Change: a gold pip rises for the quarter jump banked
        if (this.held.has('spareChange')) p.spray(x, y + 0.5, { n: 4, colors: GOLD, life: [0.5, 0.6], size: [0.14, 0.16], speed: [1.2, 1.6], angle: [UP - 0.1, UP + 0.1], jitter: 0.06, drag: 1 });
        break;
    }
  }

  // a board mod fired
  mod(effect: EffectId, x: number, y: number): void {
    const p = this.particles;
    switch (effect) {
      case 'doublePop':
        p.spray(x, y, ring([[1, 1, 1], ...POP], 12, 3));
        break;
      case 'speedKick':
        p.spray(x, y + 0.3, { n: 16, colors: KICK, life: [0.2, 0.3], size: [0.1, 0.15], speed: [6, 9], angle: [Math.PI - 0.15, Math.PI + 0.15], jitter: 0.3, drag: 3 });
        break;
      case 'jumpRefill':
        p.spray(x, y + 0.6, { n: 6, colors: POP, life: [0.45, 0.55], size: [0.14, 0.16], speed: [1.6, 2], angle: [UP - 0.5, UP + 0.5], ring: true, drag: 1.5 });
        break;
      case 'cashBurst':
        p.spray(x, y + 0.6, { n: 16, colors: CASH, life: [0.6, 0.9], size: [0.12, 0.16], speed: [2, 4], angle: [UP - 0.9, UP + 0.9], grav: 9, drag: 0.8, ink: true });
        break;
      case 'slowMo':
        p.spray(x, y + 0.6, { n: 18, colors: TIME, life: [0.6, 0.7], size: [0.1, 0.12], speed: [1.2, 1.2], ring: true, radius: 0.4, drag: 0.5, alpha: 0.85 });
        break;
      case 'gravFlip':
        p.spray(x, y + 0.4, { n: 16, colors: GRAV, life: [0.5, 0.7], size: [0.1, 0.14], speed: [0.2, 0.8], jitter: 0.6, grav: -8, drag: 1 });
        break;
      case 'shockwave':
        p.spray(x, y + 0.05, { ...ring(DUSTY, 20, 7), size: [0.16, 0.22], size1: 0.3, life: [0.4, 0.5], drag: 2.5, alpha: 0.8 });
        break;
    }
  }
}

// a flat ring kicked out round the board
function ring(colors: number[][], n: number, speed: number): Spray {
  return { n, colors, life: [0.3, 0.4], size: [0.14, 0.18], speed: [speed, speed * 1.1], ring: true, flat: true, drag: 4 };
}
