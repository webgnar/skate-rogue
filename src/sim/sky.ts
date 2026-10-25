// The sky over the top route (zack, 2026-10-25: "the upper route has birds flying by and airplanes", "the upper
// route could have heat with a helicopter"). Flocks of pigeons sit on the rooftops and the power line ahead, seen from
// far off; skate into one and it's a bird strike: you lose your speed and the commotion adds Heat, so ollie over them
// (they take off under you). The police helicopter flies in over you while you're up (its Heat is in src/sim/floor.ts) and
// peels off once you're back on the street. The airplanes are only scenery (src/render/sky-view.ts). Pure, stepped
// at 60 Hz with the floor.
import { PHYS, TILE } from '../physics/constants';
import type { Level } from '../physics/level';
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
};

// a flock's place in the level: over a rooftop at y, or (rail) along a power line
export interface FlockSite {
  x: number;
  y: number;
  rail?: number; // index into level.rails: it flies along the wire's height
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

  constructor(readonly level: Level) {
    this.flocks = (level.flocks ?? []).map((s) => new Flock(s));
    this.chopper = new TopChopper(level.startX);
  }

  // one step: true when the skater just skated into a flock
  step(sk: Skater, up: boolean): boolean {
    let hit = false;
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
      if (into || dx < SKY.wake) f.state = 'scatter';
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
