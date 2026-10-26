// A look for each boon and board mod, so you can see what you bought working: POP boons in the POP yellow, GRIND
// boons in the GRIND orange, board mods each in their own colour. All of it goes through the one particle pool.
// Visual only: the sim does the actual work.
import type { BoonId, Held } from '../boons/defs';
import type { EffectId } from '../board/mods';
import type { Mode, SkaterEvent } from '../physics/skater';
import type { Particles, Spray } from './particles';
import { PHYS } from '../physics/constants';

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
const FLOW = [hex(0x3ee0f0), hex(0xc8f8ff)];
const COOL = [hex(0x5a8cff), hex(0xc0d4ff)];
const STREET = [hex(0xff4a5a), hex(0xffc0c4)];
const BUBBLE = [hex(0xffffff), hex(0xc8f0ff), hex(0xffc8f0)];
const STOKE = [hex(0xff4fa8), hex(0xffd23f)];
// curses wear the card's purple, duos its pink (defs.ts CURSE_COLOR, DUO_COLOR)
const CURSE = [hex(0xb98cff), hex(0x6a3cc0)];
const DUO = [hex(0xff7ad9), hex(0xffffff)];
const MOON = [hex(0xd8d0f0), hex(0xb98cff)];

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
    //Boostin: pale feathers drift off the board while gravity is halved
    if (this.held.has('floatyFlip') && air && sk.floatT > 0) p.stream('floaty', x, y, 30, dt, { n: 0, colors: POP, life: [0.5, 0.8], size: [0.1, 0.14], speed: [0.3, 0.8], angle: [DOWN - 0.8, DOWN + 0.8], jitter: 0.25, grav: 0.6, drag: 2, fadeFrom: 0.3 });
    //Mad Pop: an updraft pushing under the board while it floats (after 0.25 s held)
    if (this.held.has('pressureFlip') && air && sk.holdT > 15) p.stream('pressure', x, y - 0.1, 40, dt, { n: 0, colors: POP, life: [0.2, 0.35], size: [0.08, 0.12], speed: [1.5, 3], angle: [DOWN - 0.3, DOWN + 0.3], jitter: 0.3, drag: 2 });
    //Grease: dark glossy drips off the trucks
    if (this.held.has('grease') && grinding) p.stream('grease', x, y, 22, dt, { n: 0, colors: GREASE, life: [0.4, 0.6], size: [0.07, 0.1], speed: [0.2, 0.6], angle: [DOWN - 0.4, DOWN + 0.4], jitter: 0.12, grav: 12, ink: true, floor: y - 2 });
    //Feeble Frenzy: the sparks run hotter the longer you stay on one rail
    if (this.held.has('feebleFrenzy') && grinding && sk.onRailT > 30) p.stream('frenzy', x, y, 15 * Math.min(4, sk.onRailT / 30), dt, { n: 0, colors: FRENZY, life: [0.2, 0.4], size: [0.1, 0.16], speed: [1.5, 3.5], angle: [UP - 1.2, UP + 0.4], grav: 10 });
    //Exit Wax: a wax streak off the wheels while rail speed lasts
    if (this.held.has('exitWax') && sk.mode === 'roll' && sk.carry > 0.3) p.stream('wax', x, y + 0.03, 25 * Math.min(1, sk.carry / 2), dt, { n: 0, colors: WAX, life: [0.3, 0.45], size: [0.08, 0.12], speed: [0.5, 1.5], angle: [Math.PI - 0.2, Math.PI + 0.2], drag: 3, alpha: 0.7 });
    //Bomb Hill / Perpetual Motion: extra speed that won't bleed off streams cyan (pink when fused) off the wheels
    if (sk.mode === 'roll' && sk.carry > 0.3) {
      if (this.held.has('perpetualMotion')) p.stream('perpetual', x, y + 0.03, 30 * Math.min(1, sk.carry / 2), dt, { n: 0, colors: DUO, life: [0.3, 0.5], size: [0.08, 0.12], speed: [0.5, 1.5], angle: [Math.PI - 0.2, Math.PI + 0.2], drag: 3, alpha: 0.8 });
      else if (this.held.has('bombHill')) p.stream('bomb', x, y + 0.03, 18 * Math.min(1, sk.carry / 2), dt, { n: 0, colors: FLOW, life: [0.25, 0.4], size: [0.07, 0.1], speed: [0.5, 1.2], angle: [Math.PI - 0.2, Math.PI + 0.2], drag: 3, alpha: 0.7 });
    }
    //Speed Wobbles (curse): purple wisps shake off the trucks when you're going too fast to land clean
    if (this.held.has('speedWobbles') && air && Math.abs(sk.hsp) > PHYS.baseSpeed * 1.5) p.stream('wobbles', x, y, 14, dt, { n: 0, colors: CURSE, life: [0.2, 0.35], size: [0.07, 0.1], speed: [0.6, 1.4], jitter: 0.15, drag: 2, alpha: 0.8 });
    //Wanted (curse): now and then a purple pixel rises off Lou, like a bounty marker
    if (this.held.has('wanted')) p.stream('wanted', x, y + 1.6, 3, dt, { n: 0, colors: CURSE, life: [0.6, 0.9], size: [0.1, 0.13], speed: [0.4, 0.7], angle: [UP - 0.2, UP + 0.2], jitter: 0.3, drag: 1, fadeFrom: 0.3 });
    if (sk.mode !== 'air') this.airJumps = 0;
    this.lastMode = sk.mode;
  }

  event(e: SkaterEvent, x: number, y: number, speed: number): void {
    const p = this.particles;
    switch (e.type) {
      case 'ollie': {
        const offRail = this.lastMode === 'grind' || this.lastMode === 'rail';
        //Rocket Grind (duo): off a fast grind, a pink-white column blasts straight down under the launch
        if (this.held.has('rocketGrind') && offRail && speed > 5) {
          p.spray(x, y, { n: 24, colors: [...DUO, ...GRIND], life: [0.35, 0.55], size: [0.12, 0.2], speed: [4, 8], angle: [DOWN - 0.15, DOWN + 0.15], jitter: 0.15, drag: 2.5 });
          p.spray(x, y, ring(DUO, 16, 4));
          break;
        }
        //Big Pop: a POP-yellow ring kicks out flat under the board
        if (this.held.has('bigPop')) p.spray(x, y, ring(POP, 14, 3.5));
        //Moon Shoes (curse): a slow puff of pale moon dust hangs where you popped
        if (this.held.has('moonShoes')) p.spray(x, y, { ...ring(MOON, 12, 1.6), life: [0.6, 0.9], size: [0.14, 0.2], size1: 0.3, drag: 1.5, alpha: 0.8 });
        //Rail Launch: off a rail, an orange plume that grows with grind speed
        if (this.held.has('railLaunch') && offRail) {
          const k = Math.min(2, speed / 5);
          p.spray(x, y, { n: Math.round(10 + 10 * k), colors: GRIND, life: [0.3, 0.5], size: [0.12, 0.18], speed: [2 + k, 4 + 2 * k], angle: [DOWN - 0.5, DOWN + 0.5], grav: -2, drag: 2 });
        }
        break;
      }
      case 'trick':
        this.airJumps++;
        //Late Flip: streaks shoot down from the board as it goes full height
        if (this.held.has('lateFlip')) p.spray(x, y, { n: 8, colors: POP, life: [0.18, 0.26], size: [0.1, 0.14], speed: [5, 7], angle: [DOWN - 0.25, DOWN + 0.25], drag: 4 });
        //Triple Threat: the extra jump shows as three stacked rings
        if (this.held.has('tripleThreat') && this.airJumps >= 2) for (let k = 0; k < 3; k++) p.spray(x, y - k * 0.18, ring(POP, 10, 2 + k * 0.6));
        //Sky Line (duo): a line of pink pixels draws out under you where the ghost rail lands
        if (this.held.has('skyLine')) p.spray(x, y - 0.25, { n: 14, colors: DUO, life: [0.4, 0.6], size: [0.1, 0.12], speed: [2.5, 4], angle: [-0.05, 0.05], jitter: 0.05, drag: 3 });
        break;
      case 'hop':
        //Hood Pop: the bounce kicks a red STREET ring off the roof
        if (this.held.has('hoodPop')) p.spray(x, y, ring(STREET, 14, 3.5));
        //Siren Song: cool blue notes float up as the hop takes Heat off
        if (this.held.has('sirenSong')) p.spray(x, y + 0.6, { n: 6, colors: COOL, life: [0.6, 0.8], size: [0.12, 0.16], speed: [1, 1.6], angle: [UP - 0.6, UP + 0.6], jitter: 0.2, drag: 1.2, fadeFrom: 0.4 });
        break;
      case 'kicker':
        //Kicker Boost: cyan streaks thrown back off the tailgate
        if (this.held.has('kickerBoost')) p.spray(x, y + 0.2, { n: 14, colors: FLOW, life: [0.2, 0.3], size: [0.1, 0.14], speed: [5, 8], angle: [Math.PI - 0.4, Math.PI + 0.1], jitter: 0.2, drag: 3 });
        break;
      case 'exit':
        //Slingshot: riding off a rail's end, streaks stretch out ahead
        if (this.held.has('slingshot')) p.spray(x, y, { n: 12, colors: FLOW, life: [0.2, 0.3], size: [0.1, 0.13], speed: [6, 9], angle: [-0.25, 0.25], drag: 3 });
        break;
      case 'land':
        //Butter: a smooth yellow smear along the ground as the air speed carries on
        if (this.held.has('butter') && speed > PHYS.baseSpeed * 1.2) p.spray(x, y + 0.03, { n: 12, colors: POP, life: [0.3, 0.45], size: [0.1, 0.14], speed: [1, 3], angle: [-0.1, 0.1], drag: 3, alpha: 0.85 });
        break;
      case 'pad':
        //Bubble Pads: the slam pops into soap bubbles instead
        p.spray(x, y + 0.5, { n: 14, colors: BUBBLE, life: [0.6, 1], size: [0.14, 0.24], speed: [0.6, 1.6], angle: [UP - 1.2, UP + 1.2], grav: -1, drag: 1.2, alpha: 0.75, fadeFrom: 0.4 });
        break;
      case 'tuck':
        //Tuck and Roll: a COOL-blue ring as you bounce back out of the gap
        p.spray(x, y, ring(COOL, 16, 4));
        break;
      case 'slam':
        //Slam Stoke: the slam fills stoke, so stoke-pink sparks fly up off it
        if (this.held.has('slamStoke')) p.spray(x, y + 0.4, { n: 14, colors: STOKE, life: [0.4, 0.6], size: [0.1, 0.14], speed: [2, 4], angle: [UP - 0.8, UP + 0.8], grav: 6, drag: 1 });
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
