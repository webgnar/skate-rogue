// Act 5's station line (src/gen/clouds.ts STATION; zack, 2026-11-10: "a lot more little handrails like the sewer has
// with its little stairset"): stair sets with a handrail over the steps, double sets with a kinked rail, ledges and flat
// rails along the decks, rails across open space, strung along every act 5 floor, and the sky bot gets through them
import { describe, expect, it } from 'vitest';
import { validatedFloor } from '../src/gen/validate';
import { rollFork } from '../src/gen/roads';
import { actOf } from '../src/gen/escape';
import { actGravity } from '../src/physics/feel';
import { FloorSim } from '../src/sim/floor';
import { Pilot } from '../src/bot/pilot';
import { TILE } from '../src/physics/constants';
import type { Level } from '../src/physics/level';

const floorOf = (seed: number, floor: number): Level => validatedFloor(seed, floor, { hills: true, fork: rollFork(seed, floor), gravity: actGravity(actOf(floor)) }).level;
const SETS = ['handrail', 'deckrail', 'ledge', 'gaprail', 'hubba'];

describe("act 5's station line", () => {
  it('strings stair sets and rails along every floor, each flight under its handrail', () => {
    let flights = 0;
    for (let seed = 1; seed <= 4; seed++) for (const f of [13, 14, 15]) {
      const l = floorOf(seed * 61, f);
      const sets = l.rails.filter((r) => r.sky && SETS.includes(r.sky));
      expect(sets.length).toBeGreaterThanOrEqual(3);
      for (const s of l.surfaces.filter((s) => s.sky === 'stairs')) {
        flights++;
        //steps only go down, and a handrail runs over them, a handrail's height over their noses
        expect(s.kind).toBe('stairs');
        expect(s.y1!).toBeGreaterThan(s.y);
        const rail = l.rails.find((r) => r.sky === 'handrail' && r.x0 <= s.x0 && r.x1 >= s.x1);
        expect(rail).toBeDefined();
        const mid = (s.x0 + s.x1) / 2;
        const over = s.y + ((s.y1! - s.y) * (mid - s.x0)) / (s.x1 - s.x0) - rail!.yAt(mid)!;
        expect(over).toBeGreaterThan(0.5 * TILE);
        expect(over).toBeLessThan(1.5 * TILE);
      }
    }
    expect(flights).toBeGreaterThan(20);
  }, 120000);

  it('is act 5 only', () => {
    for (const f of [7, 10, 12]) {
      const l = floorOf(61, f);
      expect(l.surfaces.filter((s) => s.sky === 'stairs')).toHaveLength(0);
      expect(l.rails.filter((r) => r.sky && ['handrail', 'deckrail', 'ledge', 'gaprail'].includes(r.sky))).toHaveLength(0);
    }
  }, 120000);

  it('the sky bot skates it, up on the line, grinding the rails', () => {
    let up = 0;
    let n = 0;
    let grinds = 0;
    let slams = 0;
    let made = 0;
    for (let seed = 1; seed <= 3; seed++) for (const f of [13, 14, 15]) {
      const sim = new FloorSim(floorOf(seed * 61, f));
      const pilot = new Pilot('sky');
      let on: unknown = null;
      for (let k = 0; k < 60 * 400 && sim.state === 'skate'; k++) {
        sim.step(pilot.input(sim));
        const sk = sim.skater;
        for (const e of sim.events) if (e.type === 'slam') slams++;
        if (sk.mode === 'rail' && sk.rail?.sky && SETS.includes(sk.rail.sky) && sk.rail !== on) grinds++;
        on = sk.mode === 'rail' ? sk.rail : null;
        if (!sk.grounded) continue;
        n++;
        if (sk.surface?.sky || sk.rail?.sky) up++;
      }
      if (sim.state === 'exit') made++;
    }
    expect(made).toBeGreaterThanOrEqual(8);
    expect(up / n).toBeGreaterThan(0.8);
    expect(grinds).toBeGreaterThan(15);
    expect(slams).toBeLessThan(3);
  }, 300000);

  it('falling off it is a bail: lost in space (not act 4, not the beam-up)', () => {
    const fall = (l: Level, x: number, up = true) => {
      const sim = new FloorSim(l);
      (sim as unknown as { aboard: boolean }).aboard = up; // been up on the line
      //off the end of a deck, out into the open: dropped well under the line, still falling
      const deck = l.surfaces.filter((s) => s.sky === 'cloud' && s.x0 > x).sort((p, q) => p.x0 - q.x0)[0];
      const sk = sim.skater;
      sk.x = (deck.x0 + deck.x1) / 2;
      sk.y = deck.y + 12 * TILE;
      sk.mode = 'air';
      sk.surface = null;
      sk.vsp = 2;
      for (let k = 0; k < 5 && sim.state === 'skate'; k++) sim.step({ pressed: false, held: false });
      return sim;
    };
    for (const f of [13, 14, 15]) {
      const l = floorOf(61, f);
      const sim = fall(l, l.width * 0.4);
      expect(sim.lost).toBe(true);
      expect(sim.state).toBe('bail');
    }
    //never been up (skating the street under the line, as a floor starts): not lost
    expect(fall(floorOf(61, 13), floorOf(61, 13).width * 0.4, false).lost).toBe(false);
    //act 4's girders still bring you back up: nothing's lost there
    const four = fall(floorOf(61, 11), floorOf(61, 11).width * 0.4);
    expect(four.lost).toBe(false);
    //and act 5 has no girder staircases or capsule any more
    for (const f of [13, 14, 15]) {
      const l = floorOf(122, f);
      expect(l.surfaces.filter((s) => s.sky === 'step')).toHaveLength(0);
      expect((l.skyMovers ?? []).filter((m) => m.kind === 'rig')).toHaveLength(0);
    }
  }, 120000);
});
