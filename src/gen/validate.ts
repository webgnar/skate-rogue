// Makes sure every floor can be cleared with no boons: a simple reference bot skates each generated layout, and
// layouts it can't clear are re-rolled from a sub-seed, then generated one tier lower. Pure and deterministic.
import { TILE } from '../physics/constants';
import { buildLevel, isStreetAt, type Level } from '../physics/level';
import { Skater } from '../physics/skater';
import { makeLayout, maxTier, type Layout } from './layout';
import { PIECES } from './pieces';

const REROLLS = 8;

function danger(level: Level, x: number): boolean {
  for (let dx = 20; dx <= 70; dx += 4) {
    if (!isStreetAt(level, x + dx)) return true;
    if (level.cars.some((c) => x + dx >= c.x0 && x + dx <= c.x1)) return true;
    if (level.glass.some((g) => x + dx >= g.x0 && x + dx <= g.x1)) return true;
  }
  return false;
}

// the reference bot: ollies at canals and cars, rides rails to their ends, flips when falling short
export function botRun(level: Level): { result: string; slams: number } {
  const sk = new Skater(level);
  let hold = 0;
  let slams = 0;
  for (let f = 0; f < 60 * 120; f++) {
    let pressed = false;
    const onSurface = sk.mode === 'grind' || (sk.mode === 'roll' && sk.surface !== null);
    if (sk.mode === 'roll' && !sk.surface && danger(level, sk.x)) pressed = true;
    if (onSurface && sk.surface && sk.x > sk.surface.x1 - 24 && danger(level, sk.x)) pressed = true;
    if (sk.mode === 'rail' && sk.rail && sk.railD > sk.rail.length - 30) pressed = true;
    // falling with no street ahead: flip for more air
    if (sk.mode === 'air' && sk.vsp > 0.5 && sk.jumps > 0 && !isStreetAt(level, sk.x + 40)) pressed = true;
    if (pressed && sk.grounded) hold = 30;
    sk.step({ pressed, held: hold > 0 || pressed });
    if (hold > 0) hold--;
    slams += sk.events.filter((e) => e.type === 'slam').length;
    sk.events.length = 0;
    if (sk.mode === 'bail') return { result: `bail at col ${Math.floor(sk.x / TILE)}`, slams };
    if (sk.mode === 'exit') return { result: 'exit', slams };
  }
  return { result: 'timeout', slams };
}

export function clearable(layout: Layout): boolean {
  return botRun(buildLevel(layout)).result === 'exit';
}

export interface Validated {
  layout: Layout;
  tries: number; // layouts generated before one passed
  tierDrops: number;
}

export function validatedLayout(seed: number, floor: number): Validated {
  let tries = 0;
  for (let top = maxTier(floor), drops = 0; top >= 1; top--, drops++) {
    const library = PIECES.filter((p) => p.tier <= top);
    for (let k = 0; k <= REROLLS; k++) {
      tries++;
      const layout = makeLayout(seed + k * 15485863 + drops * 32452843, floor, library);
      if (clearable(layout)) return { layout: { ...layout, seed }, tries, tierDrops: drops };
    }
  }
  //nothing passed (should not happen: tier 1 is designed for walking speed); hand back the original
  return { layout: makeLayout(seed, floor), tries, tierDrops: -1 };
}
