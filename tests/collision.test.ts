import { describe, expect, it } from 'vitest';
import { NO_MODS, type Mods } from '../src/boons/mods';
import { validatedFloor } from '../src/gen/validate';
import { TWISTS } from '../src/gen/twists';
import { PHYS } from '../src/physics/constants';
import { surfaceSlope, surfaceY } from '../src/physics/level';
import { Skater } from '../src/physics/skater';
import { FloorSim } from '../src/sim/floor';


function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

// where a straight path from (px, py) to (x, y) goes from on or above a line to under it, or null
function crossAt(px: number, py: number, x: number, y: number, x0: number, y0: number, m: number): number | null {
  const f0 = py - (y0 + m * (px - x0));
  const f1 = y - (y0 + m * (x - x0));
  if (f0 > 0.01 || f1 <= 0.5) return null;
  return px + Math.max(0, -f0 / (f1 - f0)) * (x - px);
}

// Random button mashing across generated floors, plain and with fast, floaty boon builds: a step that starts and
// ends in the air must never pass down through the top of a roof, ledge, bar, bank, car roof or curved rail.
describe('no falling through things', () => {
  const builds: Partial<Mods>[] = [
    {},
    { speedScale: 1.6, slingshot: 2, kickerScale: 1.6, ollieScale: 1.4, jumps: 2 },
    { ollieScale: 1.6, floatyFlip: true, lateFlip: true, jumps: 3 },
  ];
  it("fuzzes floors 1-8 on 8 seeds with three builds, with every twist", () => {
    const holes: string[] = [];
    for (let seed = 1; seed <= 8; seed++) {
      for (let floor = 1; floor <= 8; floor++) {
        //each seed with another twist (currents, ceilings, conveyors, ruins, rail-heavy pieces) or none
        const level = validatedFloor(seed * 7919, floor, { twist: TWISTS[seed % (TWISTS.length + 1)] }).level;
        builds.forEach((b, bi) => {
          const r = rng(seed * 100 + floor * 7 + bi);
          const sim = new FloorSim(level, { ...NO_MODS, ...b });
          const sk = sim.skater;
          let hold = 0;
          for (let f = 0; f < 60 * 60 && sim.state === 'skate'; f++) {
            const pressed = r() < 0.04;
            if (pressed) hold = Math.floor(r() * 30);
            const px = sk.x;
            const py = sk.boardY;
            const was = sk.mode;
            const ignore = sk.railIgnore;
            //moving things too: traffic, buses at stops, open car doors, drones (as they stood at the start of the step)
            const movers = sk.movers.map((c) => ({ ...c }));
            sim.step({ pressed, held: hold-- > 0 });
            if (was !== 'air' || sk.mode !== 'air' || sim.events.some((e) => e.type === 'hop' || e.type === 'tuck' || e.type === 'kicker')) continue;
            const at = `seed ${seed * 7919} floor ${floor} build ${bi} frame ${f}`;
            for (const s of level.surfaces) {
              if (sk.gone.has(s)) continue; // Greece's ruins fall away
              const cx = crossAt(px, py, sk.x, sk.boardY, s.x0, s.y, surfaceSlope(s));
              if (cx !== null && cx >= s.x0 && cx <= s.x1) holes.push(`${at}: through a ${s.kind} at ${Math.round(cx)}`);
            }
            for (const c of [...level.cars, ...movers]) {
              const cx = crossAt(px, py, sk.x, sk.boardY, 0, c.roof, 0);
              if (cx !== null && cx + PHYS.width / 2 >= c.x0 && cx - PHYS.width / 2 <= c.x1) holes.push(`${at}: through a car roof`);
            }
            for (const rail of level.rails) {
              if (rail === ignore || rail === sk.railIgnore) continue;
              const a = rail.yAt(px);
              const b = rail.yAt(sk.x);
              if (a !== undefined && b !== undefined && py <= a + 0.01 && sk.boardY > b + 0.5) holes.push(`${at}: through a curved rail`);
            }
          }
        });
      }
    }
    expect(holes.slice(0, 5)).toEqual([]);
  }, 120000);
});


// zack's bug (Oct 24): flying into an up bank you went through it and fell to your death. Throw the skater at every
// bank on a range of floors from all sorts of angles and speeds, at every district gravity: never through it.
describe('flying into banks', () => {
  it('lands on the bank from any approach', () => {
    const r = rng(7);
    const holes: string[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      for (const gravity of [1, 0.8, 0.6]) {
        const level = validatedFloor(seed * 7919, 1 + (seed % 8), { gravity }).level;
        for (const bank of level.surfaces.filter((s) => s.kind === 'bank')) {
          for (let k = 0; k < 60; k++) {
            const sk = new Skater(level);
            sk.step({ pressed: false, held: false });
            const x = bank.x0 - 80 + r() * (bank.x1 - bank.x0 + 60);
            const y = surfaceY(bank, x) - 2 - r() * 80;
            Object.assign(sk, { mode: 'air', surface: null, rail: null, x, y, hsp: 1 + r() * 11, vsp: -10 + r() * 20, coyote: 0 });
            for (let f = 0; f < 200; f++) {
              const px = sk.x;
              const py = sk.boardY;
              sk.step({ pressed: false, held: false });
              if (sk.mode !== 'air') break;
              const over = sk.x > bank.x0 + 1 && sk.x < bank.x1 - 1;
              if (over && sk.boardY > surfaceY(bank, sk.x) + 1 && py <= surfaceY(bank, px) + 1) {
                holes.push(`seed ${seed} gravity ${gravity}: from (${x.toFixed(1)}, ${y.toFixed(1)}) through the bank at ${Math.round(sk.x)}`);
                break;
              }
            }
          }
        }
      }
    }
    expect(holes.slice(0, 5)).toEqual([]);
  }, 60000);
});
