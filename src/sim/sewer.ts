// The sewer route's moving pieces (src/gen/sewer.ts), stepped by the floor sim: rat packs that run at you down the
// floor, the flood surge that bursts out of the storm gate behind you, the subway's trains crossing under the tunnel,
// and the sewer alligator. Pure, so the game, the bots and tests all run the same thing.
import { PHYS, TILE } from '../physics/constants';
import { sewerAt, type Car, type Level, type Sewer } from '../physics/level';
import type { Skater } from '../physics/skater';
import { SEWER } from '../gen/sewer';

export const SEWER_SIM = {
  ratSpeed: 1.6, // px/frame: a pack runs at you this fast once it's seen you
  ratWake: 16 * TILE, // it starts running when you're this close
  ratGap: 11, // px between rats in a pack
  ratLow: 10, // px: feet this close over the floor and a rat under you trips you
  ratKeep: 0.55, // of your speed, after a rat trips you (you wobble, you don't slam)
  surgeSpeed: 4.6, // px/frame: a little faster than cruising, so it's the current (or a grind) that outruns it
  surgeFrom: 2 * TILE, // the gate bursts once you're this far past the way in
  surgeH: 1.4 * TILE, // the wall of water's height over the floor
  surgeSoak: 3, // it soaks the deck this many puddles' worth (src/sim/floor.ts)
  //(zack, 2026-10-31: "make it stay close to the player for dramatic effect": it never falls more than this far
  //behind you down there, rushing up to it when it does; it still only catches you at surgeSpeed)
  surgeLead: 3.5 * TILE,
  surgeRush: 0.25, // of the gap past surgeLead it closes each frame
  trainFrames: 72, // frames a train takes to cross under the tunnel, in every SEWER.subwayPeriod
  trainWarn: 45, // frames before one that its headlight shows down the line
  gatorWake: 5 * TILE, // the alligator opens its jaws as you come this close
  gatorLow: 14, // px: feet this close over the floor over it and it bites
};

export type SewerEvent =
  | { type: 'rats'; n: number; x: number; y: number } // cleared a rat pack, n of them under you
  | { type: 'ratBump'; x: number; y: number } // rolled into a rat: it tripped you
  | { type: 'surge'; x: number; y: number } // the storm gate behind you burst
  | { type: 'washed'; x: number; y: number } // the surge caught you
  | { type: 'gator'; x: number; y: number } // cleared the alligator: a spin token
  | { type: 'bite'; x: number; y: number } // rolled into it
  | { type: 'subway'; x: number; y: number }; // over the subway line, by ollie or by train roof

export interface Rat {
  x: number;
  alive: boolean;
}

export interface Pack {
  rats: Rat[];
  awake: boolean;
  bumped: boolean;
  cleared: number;
  done: boolean;
}

export interface Surge {
  front: number; // the wall of water's leading edge, px
  on: boolean;
  caught: boolean;
  done: boolean;
}

export interface Train {
  box: Car; // its roof across the gap, while it's under the tunnel
  t: number; // frames into the period
  on: boolean;
}

export interface Gator {
  open: number; // 0..1, its jaws
  over: boolean; // you've been in the air over it, down here
  done: boolean;
  bit: boolean;
}

// one tunnel's moving pieces
export interface SewerState {
  s: Sewer;
  pack?: Pack;
  surge?: Surge;
  train?: Train;
  gator?: Gator;
  overGap: boolean; // in the air over the subway's gap, down here
}

export class SewerSim {
  readonly tunnels: SewerState[];
  events: SewerEvent[] = [];
  private frame = 0;

  constructor(readonly level: Level) {
    this.tunnels = (level.sewers ?? []).map((s) => {
      const st: SewerState = { s, overGap: false };
      const p = s.piece;
      if (p?.kind === 'rats') st.pack = { rats: Array.from({ length: p.n }, (_, k) => ({ x: p.x + k * SEWER_SIM.ratGap, alive: true })), awake: false, bumped: false, cleared: 0, done: false };
      if (p?.kind === 'surge') st.surge = { front: s.drain[0], on: false, caught: false, done: false };
      if (p?.kind === 'subway') st.train = { box: { x0: p.x0 - 2, x1: p.x1 + 2, roof: s.y + 3, bottom: s.y + 4 * TILE }, t: p.phase, on: false };
      if (s.gator) st.gator = { open: 0, over: false, done: false, bit: false };
      return st;
    });
  }

  // the subway trains under the tunnel right now, as boxes in the skate lane (their roofs are one-way: you hop off them)
  get boxes(): Car[] {
    const out: Car[] = [];
    for (const t of this.tunnels) if (t.train?.on) out.push(t.train.box);
    return out;
  }

  // before the skater moves: the trains come and go on their timetable
  stepTrains(): void {
    this.frame++;
    for (const t of this.tunnels) {
      const tr = t.train;
      if (!tr) continue;
      tr.t = (tr.t + 1) % SEWER.subwayPeriod;
      tr.on = tr.t < SEWER_SIM.trainFrames;
    }
  }

  // after the skater moves: what it ran into, cleared or was caught by. `down`: the skater's down in the sewer
  step(sk: Skater, down: boolean): void {
    this.events = [];
    const here = down ? sewerAt(this.level, sk.x) : undefined;
    const half = PHYS.width / 2;
    for (const t of this.tunnels) {
      const s = t.s;
      const mine = here === s;
      const low = (h: number) => sk.y > s.y - h && sk.mode !== 'rail' && sk.mode !== 'grind';
      //the rat pack: it wakes as you come up on it and runs at you; under you in the air it's cleared, on the floor it trips you
      const pack = t.pack;
      if (pack && !pack.done) {
        const p = s.piece as { x: number };
        if (!pack.awake && mine && p.x - sk.x < SEWER_SIM.ratWake) pack.awake = true;
        if (pack.awake) {
          for (const r of pack.rats) {
            if (!r.alive) continue;
            r.x -= SEWER_SIM.ratSpeed;
            if (r.x < (s.stairs?.[0]?.x1 ?? s.x0)) r.alive = false;
            if (!mine) continue;
            if (Math.abs(r.x - sk.x) < half && low(SEWER_SIM.ratLow) && sk.mode !== 'bail') {
              r.alive = false;
              if (!pack.bumped) {
                pack.bumped = true;
                sk.hsp *= SEWER_SIM.ratKeep;
                sk.carry *= SEWER_SIM.ratKeep;
                sk.feel.bounce(2, 0);
                this.events.push({ type: 'ratBump', x: sk.x, y: s.y });
              }
            } else if (r.x < sk.x - half) {
              r.alive = false;
              pack.cleared++;
            }
          }
          if (pack.rats.every((r) => !r.alive)) {
            pack.done = true;
            if (pack.cleared && !pack.bumped) this.events.push({ type: 'rats', n: pack.cleared, x: sk.x, y: s.y });
          }
        }
      }
      //the flood surge: the storm gate behind you bursts, and the water comes down the tunnel after you
      const surge = t.surge;
      if (surge && !surge.done) {
        if (!surge.on && mine && sk.x > s.drain[1] + SEWER_SIM.surgeFrom) {
          surge.on = true;
          this.events.push({ type: 'surge', x: s.x0, y: s.y });
        }
        if (surge.on) {
          const behind = mine && !surge.caught ? sk.x - SEWER_SIM.surgeLead - surge.front : 0;
          surge.front += Math.max(SEWER_SIM.surgeSpeed, behind * SEWER_SIM.surgeRush);
          if (surge.front > s.x1 - (s.outlet[1] > s.outlet[0] ? SEWER.ramp * TILE : 0)) surge.done = true;
          if (!surge.caught && mine && surge.front >= sk.x - half && sk.y > s.y - SEWER_SIM.surgeH && sk.mode !== 'bail') {
            surge.caught = true;
            sk.shot();
            this.events.push({ type: 'washed', x: sk.x, y: s.y });
          }
        }
      }
      //the subway: in the air over its gap and across, or off a train's roof, it's cleared
      const p = s.piece;
      if (p?.kind === 'subway' && mine) {
        if (sk.x > p.x0 && sk.x < p.x1 && sk.mode === 'air') t.overGap = true;
        if (t.overGap && sk.x >= p.x1 && sk.grounded) {
          t.overGap = false;
          this.events.push({ type: 'subway', x: sk.x, y: s.y });
        }
      }
      //the alligator: it opens up as you come close; over it in the air and it's a spin token, into it and it bites
      const g = t.gator;
      if (g && s.gator && !g.done) {
        const [g0, g1] = s.gator;
        g.open = Math.min(1, Math.max(0, 1 - (g0 - sk.x) / SEWER_SIM.gatorWake));
        if (mine) {
          const over = sk.x + half > g0 && sk.x - half < g1;
          if (over && low(SEWER_SIM.gatorLow) && sk.mode !== 'bail') {
            g.done = g.bit = true;
            sk.shot();
            this.events.push({ type: 'bite', x: sk.x, y: s.y });
          } else if (over) g.over = true;
          else if (sk.x - half >= g1) {
            g.done = true;
            if (g.over) this.events.push({ type: 'gator', x: (g0 + g1) / 2, y: s.y - TILE });
          }
        } else if (sk.x - half >= g1) g.done = true;
      }
    }
  }
}
