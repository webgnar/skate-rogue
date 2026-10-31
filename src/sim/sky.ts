// The sky over the top route (zack, 2026-10-25: "the upper route has birds flying by and airplanes", "the upper
// route could have heat with a helicopter"). Flocks of pigeons sit on the rooftops and the power line ahead, seen from
// far off; skate into one and it's a bird strike: you lose your speed and the commotion adds Heat, so ollie over them
// (they take off under you). The police helicopter flies in over you while you're up (its Heat is in src/sim/floor.ts) and
// peels off once you're back on the street. The airplanes are only scenery (src/render/sky-view.ts). Pure, stepped
// at 60 Hz with the floor.
//
// The sky's set pieces and finds (zack, 2026-10-31, src/gen/sky-beats.ts) are stepped here too: the moving decks
// (a blimp's bobbing back, a window washer's rig that drops under you, a crane jib that swings out of the lane),
// the paper billboards you burst through, and the golden pigeon: clear it from above and it pays a spin token.
import { PHYS, TILE } from '../physics/constants';
import type { Car, Level, SkyBust, SkyMover, Surface } from '../physics/level';
import type { Skater } from '../physics/skater';
import type { Cover } from './chopper';

export const SKY = {
  wake: 10, // px: a flock takes off when you're this close (over it, ollied; into it, a strike)
  perch: 6, // px they sit over the deck or the wire
  reach: 16, // px either side of a flock that hits
  strikeSpeed: 0.75, // share of your speed a bird strike leaves you
  strikeHeat: 5,
  chopperLag: 0.05, // how hard the helicopter closes on you
  chopperOff: 2.2, // x base speed it peels away at once you're down
  goldOver: 3 * TILE, // px: clearing the golden pigeon from no higher than this over it pays out
  beamFrames: 300, // a swinging I-beam's swing there and back: slow (5 s)
  beamLift: 6, // px it rises at each end of its swing, as a weight on a long cable does
  blimpBob: 4, // px the blimp's back rides up and down
  blimpBobFrames: 240,
  rigV: 1, // px/frame the rig starts dropping at once you land on it
  rigAccel: 0.15, // and faster each frame (its rope's slipping)
  rigMax: 6,
  // a crane jib's swing, frames: in the lane, slewing out, out, slewing back
  swingHold: 130,
  swingMove: 60,
  swingAway: 50,
  swingOut: 1.3, // radians it slews out to
  swingIn: 0.3, // radians: past this it's out of the lane, and you drop off it
  bustCash: 5, // cash in a billboard you burst through
  driftFrames: 420, // a drifting cloud's wander there and back (src/gen/clouds.ts)
  balloonBob: 6, // px a hot air balloon's basket rides up and down
  balloonBobFrames: 200,
};

// NO GROUND (zack, 2026-10-31): chain sky pieces (wires, rooftops, billboards, booms, a blimp's back) without
// touching the ground below and the coins you pick up up there multiply; touch down and the line banks
export const SKY_LINE = { step: 0.5, max: 4 };

// the coin multiplier `n` pieces into a line
export function skyMult(n: number): number {
  return n < 2 ? 1 : Math.min(SKY_LINE.max, 1 + SKY_LINE.step * (n - 1));
}

// a moving sky deck: a box in the skate lane whose top (ledge) you land on, as an L train's roof
export class SkyPieceSim {
  readonly box: Car;
  readonly ledge: Surface;
  y: number;
  angle = 0; // a crane jib's slew, radians (0 = along the lane)
  x = 0; // a drifting cloud's wander from where it was built, px
  v = 0; // a rig's drop, px/frame
  dropping = false;

  constructor(readonly site: SkyMover) {
    this.y = site.y;
    const rail = site.kind === 'swing' || site.kind === 'beam';
    this.ledge = { kind: rail ? 'rail' : 'roof', x0: site.x0, x1: site.x1, y: site.y, row: -1, sky: site.kind, ...(rail ? { material: 'metal' as const } : {}) };
    this.box = { x0: site.x0, x1: site.x1, roof: site.y, bottom: site.y + 2 * TILE, ledge: this.ledge };
  }

  get inLane(): boolean {
    return Math.abs(this.angle) < SKY.swingIn;
  }

  step(frame: number, sk: Skater): void {
    const s = this.site;
    let dx = 0;
    if (s.kind === 'blimp') this.y = s.y + SKY.blimpBob * Math.sin((frame / SKY.blimpBobFrames) * Math.PI * 2);
    else if (s.kind === 'balloon') this.y = s.y + SKY.balloonBob * Math.sin(((frame + (s.phase ?? 0)) / SKY.balloonBobFrames) * Math.PI * 2);
    else if (s.kind === 'cloud') {
      dx = CLOUD_DRIFT * Math.sin(((frame + (s.phase ?? 0)) / SKY.driftFrames) * Math.PI * 2);
      this.x = dx;
    } else if (s.kind === 'rig') {
      if (!this.dropping && sk.surface === this.ledge) {
        this.dropping = true;
        this.v = SKY.rigV;
      }
      if (this.dropping && this.y < (s.floor ?? s.y)) {
        this.v = Math.min(SKY.rigMax, this.v + SKY.rigAccel);
        this.y = Math.min(s.floor ?? s.y, this.y + this.v);
      }
    } else if (s.kind === 'swing') this.angle = swingAt(frame + (s.phase ?? 0));
    else if (s.kind === 'beam') {
      //a weight on a long cable: along the lane and back, rising a little at each end
      const u = Math.sin(((frame + (s.phase ?? 0)) / SKY.beamFrames) * Math.PI * 2);
      dx = SKY_SWAY * TILE * u;
      this.y = s.y - SKY.beamLift * u * u;
      //(grinding it, it carries you with it)
      if (sk.surface === this.ledge && sk.grounded) sk.x += dx - this.x;
      this.x = dx;
    }
    this.box.roof = this.ledge.y = this.y;
    this.box.bottom = this.y + 2 * TILE;
    //a jib slewed out of the lane isn't under you: nothing to land on, and you drop off it
    const here = this.inLane;
    this.box.x0 = this.ledge.x0 = here ? s.x0 + dx : -1e6;
    this.box.x1 = this.ledge.x1 = here ? s.x1 + dx : -1e6;
    //riding it: your feet go up and down with it
    if (sk.surface === this.ledge && sk.grounded) sk.y = this.y;
  }
}

const CLOUD_DRIFT = 1.5 * TILE; // CLOUDS.driftBy (src/gen/clouds.ts), px
// tiles a swinging I-beam swings either way along the lane (src/gen/sky-beats.ts keeps that clear)
export const SKY_SWAY = 1.25;

// a crane jib's slew at frame t: held in the lane, eased out, held out, eased back
export function swingAt(t: number): number {
  const { swingHold: h, swingMove: m, swingAway: w, swingOut: out } = SKY;
  const f = ((t % (h + 2 * m + w)) + (h + 2 * m + w)) % (h + 2 * m + w);
  const ease = (u: number) => u * u * (3 - 2 * u);
  if (f < h) return 0;
  if (f < h + m) return out * ease((f - h) / m);
  if (f < h + m + w) return out;
  return out * (1 - ease((f - h - m - w) / m));
}

// a flock's place in the level: over a rooftop at y, or (rail) along a power line
export interface FlockSite {
  x: number;
  y: number;
  rail?: number; // index into level.rails: it flies along the wire's height
  gold?: boolean; // the golden pigeon (src/gen/sky-beats.ts): one bird; clear it from above for a spin token
}

export class Flock {
  x: number;
  y: number;
  state: 'perch' | 'scatter' = 'perch';
  t = 0;

  constructor(readonly site: FlockSite) {
    this.x = site.x;
    this.y = site.y;
  }
}

// the helicopter over the top route: shaped like the escape's (src/sim/chopper.ts) so its view draws it
export class TopChopper {
  x: number;
  v = 0;
  lit = false;
  readonly covers: Cover[] = [];
  gone = true;

  constructor(x: number) {
    this.x = x;
  }
}

export class Sky {
  readonly flocks: Flock[];
  readonly chopper: TopChopper;
  readonly pieces: SkyPieceSim[];
  readonly busts: SkyBust[];
  readonly busted: boolean[];
  gold = false; // this step, the golden pigeon was cleared: it pays out
  private frame = 0;

  constructor(readonly level: Level) {
    this.flocks = (level.flocks ?? []).map((s) => new Flock(s));
    this.chopper = new TopChopper(level.startX);
    this.pieces = (level.skyMovers ?? []).map((m) => new SkyPieceSim(m));
    this.busts = level.busts ?? [];
    this.busted = this.busts.map(() => false);
  }

  // the moving decks' boxes for the skater's movers
  get boxes(): Car[] {
    return this.pieces.map((p) => p.box);
  }

  // before the skater steps: move the decks
  stepPieces(sk: Skater): void {
    this.frame++;
    for (const p of this.pieces) p.step(this.frame, sk);
  }

  // after the skater steps (from px, py): the billboards you went through this step, by index
  burst(sk: Skater, px: number): number[] {
    const out: number[] = [];
    this.busts.forEach((b, i) => {
      if (this.busted[i] || px >= b.x || sk.x < b.x || sk.mode === 'bail') return;
      if (sk.y > b.y0 && sk.y - PHYS.height < b.y1) {
        this.busted[i] = true;
        out.push(i);
      }
    });
    return out;
  }

  // one step: true when the skater just skated into a flock
  step(sk: Skater, up: boolean): boolean {
    let hit = false;
    this.gold = false;
    for (const f of this.flocks) {
      f.t++;
      if (f.state === 'scatter') {
        f.x += 1.5;
        f.y -= 2.5;
        continue;
      }
      //perched on the wire, they sit on it wherever it is
      if (f.site.rail !== undefined) f.y = (this.level.rails[f.site.rail]?.yAt(f.x) ?? f.site.y) - SKY.perch;
      const dx = f.x - sk.x;
      const into = Math.abs(dx) < SKY.reach && f.y < sk.y + 4 && f.y > sk.y - PHYS.height && sk.mode !== 'bail' && sk.mode !== 'exit';
      if (into) {
        hit = true;
        sk.hsp *= SKY.strikeSpeed;
        sk.carry *= SKY.strikeSpeed;
        if (sk.mode === 'rail') sk.railV *= SKY.strikeSpeed;
      }
      //they take off as you come over them (or hit them)
      if (into || dx < SKY.wake) {
        //cleared the golden pigeon from just over it: it drops a spin token
        if (f.site.gold && f.state === 'perch' && !into && sk.y <= f.y + 4 && f.y - sk.y < SKY.goldOver && sk.mode !== 'bail') this.gold = true;
        f.state = 'scatter';
      }
    }
    //the helicopter: in over you while you're up, away ahead once you're down
    const ch = this.chopper;
    ch.lit = up;
    if (up) {
      if (ch.gone) {
        ch.gone = false;
        ch.x = sk.x - 12 * TILE;
        ch.v = sk.hsp;
      }
      const want = sk.hsp + (sk.x - ch.x) * SKY.chopperLag;
      ch.v += (want - ch.v) * 0.1;
    } else if (!ch.gone) {
      ch.v += (PHYS.baseSpeed * SKY.chopperOff - ch.v) * 0.03;
      if (ch.x - sk.x > 20 * TILE) ch.gone = true;
    }
    if (!ch.gone) ch.x += ch.v;
    return hit;
  }
}
