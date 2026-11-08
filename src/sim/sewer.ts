// The sewer route's moving pieces (src/gen/sewer.ts), stepped by the floor sim: rat packs that run at you down the
// floor, the flood surge that bursts out of the storm gate behind you, the subway's train crossing the tunnel on its
// live tracks, and the sewer alligator. Pure, so the game, the bots and tests all run the same thing.
import { PHYS, TILE } from '../physics/constants';
import { sewerAt, type Car, type Level, type Sewer } from '../physics/level';
import type { Skater } from '../physics/skater';
import { SEWER } from '../gen/sewer';
import { EL } from '../traffic/el';

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
  // the subway (zack, 2026-11-08: "top of train car should be one jumps height so the player can car hop it. it should
  // move slowly with about 5 train cars long", "the tracks ... should be electrical hazard"): a long, slow train
  // crosses the tunnel on tracks raised to just under its floor, its roof an ollie over it (SEWER.subwayRoof) to hop
  // like a car's; between trains the tracks are bare and live, and down on them you're zapped
  trainCars: 5,
  trainSpeed: 0.1, // tiles/frame along the line (6 a second): a slow crawl across
  trainHurry: [0.04, 0.3] as const, // tiles/frame: how slow or fast the first comes in, out of the city, timed to you
  trainFrom: -40, // z, tiles: where the line comes out of the city (its nose sets off from here)
  trainTo: 14, // and where it goes back into it, past the camera (the train's gone once its tail's past here)
  lane: [0.3, 1.9] as const, // z: the skate lane, which the train's in while any of it is across
  bed: 14, // px under the floor: the rail heads, the train's wheels (its roof + the L car's height, EL.carH)
  zapFrom: 4, // px under the floor (the board's middle over the tracks) and the third rail has you
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
  | { type: 'subway'; x: number; y: number } // over the subway line, by ollie or by train roof
  | { type: 'zap'; x: number; y: number }; // down on the live tracks: electrocuted

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
  box: Car; // its roof (and side) across the gap, while it's in the lane
  lead: number; // frames: the first sets off this long before you'd reach the trench at the speed you're going
  phase: number; // frames its nose crosses into the lane before you reach the trench (SEWER.subwayLead)
  z: number; // tiles: its nose along the line
  wait: number; // frames until the next one sets off (-1: the first, waiting for you)
  timed: boolean; // the first has come into the lane (or you're past): no more timing it to you
  run: boolean; // on the line (in sight)
  on: boolean; // across the skate lane
}

// tiles of train, nose to tail: five of the L's cars
export const TRAIN_LEN = (SEWER_SIM.trainCars * EL.carLen + (SEWER_SIM.trainCars - 1) * EL.coupling) / TILE;
// frames from setting off to its nose reaching the lane, and to its tail leaving the line
export const TRAIN_ARRIVE = (SEWER_SIM.lane[0] - SEWER_SIM.trainFrom) / SEWER_SIM.trainSpeed;
export const TRAIN_TRAVEL = (SEWER_SIM.trainTo - SEWER_SIM.trainFrom + TRAIN_LEN) / SEWER_SIM.trainSpeed;

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
      //(its nose reaches the lane p.phase frames before you reach the gap at cruising speed: the train's mostly across
      //the tunnel as you come up on it, sometimes still coming, sometimes its tail going)
      if (p?.kind === 'subway')
        st.train = {
          box: { x0: p.x0, x1: p.x1, roof: s.y - SEWER.subwayRoof, bottom: s.y + SEWER_SIM.bed },
          lead: TRAIN_ARRIVE + p.phase,
          phase: p.phase,
          z: SEWER_SIM.trainFrom,
          wait: -1,
          timed: false,
          run: false,
          on: false,
        };
      if (s.gator) st.gator = { open: 0, over: false, done: false, bit: false };
      return st;
    });
  }

  // the subway trains across the tunnel right now, as boxes in the skate lane: hop their roofs as a car's
  get boxes(): Car[] {
    const out: Car[] = [];
    for (const t of this.tunnels) if (t.train?.on) out.push(t.train.box);
    return out;
  }

  // before the skater moves: a train sets off as you come up on its line (timed from how fast you're going), then
  // one every SEWER.subwayPeriod
  stepTrains(sk: { x: number; hsp: number }): void {
    this.frame++;
    for (const t of this.tunnels) {
      const tr = t.train;
      if (!tr) continue;
      const x0 = (t.s.piece as { x0: number }).x0;
      const speed = Math.max(PHYS.baseSpeed, Math.abs(sk.hsp));
      if (!tr.run) {
        if (tr.wait < 0 ? sk.x < x0 - tr.lead * speed : tr.wait-- > 0) continue;
        tr.run = true;
        tr.z = SEWER_SIM.trainFrom;
      }
      //the first is timed to you: on its way in it hurries or holds back, so its nose crosses into the lane `phase`
      //frames before you reach the tracks (you speed up and slow down down here); then it crawls across
      let v = SEWER_SIM.trainSpeed;
      const lane = SEWER_SIM.lane[0];
      if (!tr.timed && tr.z < lane && sk.x < x0) {
        const left = (x0 - sk.x) / speed - tr.phase;
        v = Math.min(SEWER_SIM.trainHurry[1], Math.max(SEWER_SIM.trainHurry[0], (lane - tr.z) / Math.max(1, left)));
      } else tr.timed = true;
      tr.z += v;
      if (tr.z - TRAIN_LEN > SEWER_SIM.trainTo) {
        tr.run = false;
        tr.timed = true;
        tr.wait = Math.max(60, SEWER.subwayPeriod - Math.ceil(TRAIN_TRAVEL));
      }
      tr.on = tr.run && tr.z >= lane && tr.z - TRAIN_LEN <= SEWER_SIM.lane[1];
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
        //down on the tracks (off the lip, or a slam into the train's side): the third rail
        if (sk.x > p.x0 && sk.x < p.x1 && sk.y > s.y + SEWER_SIM.zapFrom && sk.mode !== 'bail' && sk.mode !== 'exit') {
          t.overGap = false;
          sk.zap(s.y + SEWER_SIM.bed);
          this.events.push({ type: 'zap', x: sk.x, y: s.y + SEWER_SIM.bed });
          continue;
        }
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
