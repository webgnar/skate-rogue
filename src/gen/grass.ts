// Grass strips across the street (zack, 2026-10-30: wheels are what get you over rough ground like grass). A few a
// floor, each 2 to 4 tiles long, on flat street clear of glass, parked cars, cross streets and the gate. Good
// wheels roll right over them; worn ones bog down (src/physics/skater.ts, GEAR.grassSlow).
import { TILE } from '../physics/constants';
import { isStreetAt, type Glass, type Level } from '../physics/level';
import { makeRng } from './rng';
import { CROSS } from '../traffic/cross';

export const GRASS = {
  gap: [22, 40] as [number, number], // tiles between strips
  len: [2, 4] as [number, number], // tiles long
};

export function placeGrass(level: Level): Glass[] {
  const rng = makeRng(level.layout.seed * 71 + level.layout.floor * 13);
  const out: Glass[] = [];
  const between = ([a, b]: [number, number]) => a + rng() * (b - a);
  const clear = (x0: number, x1: number) => {
    for (let x = x0; x <= x1; x += TILE / 2) if (!isStreetAt(level, x)) return false;
    //flat street only: not under a hill's slope or a ramp
    if (level.surfaces.some((s) => s.x1 > x0 && s.x0 < x1 && s.y >= level.streetY - 2)) return false;
    if (level.cars.some((c) => c.x1 > x0 - TILE && c.x0 < x1 + TILE)) return false;
    if (level.glass.some((g) => g.x1 > x0 - 2 * TILE && g.x0 < x1 + 2 * TILE)) return false;
    return !level.crossings.some((i) => i.x + CROSS.w / 2 + CROSS.street * TILE > x0 && i.x + CROSS.w / 2 - CROSS.street * TILE < x1);
  };
  for (let x = level.startX + 10 * TILE + between(GRASS.gap) * TILE; x < level.exitX - 8 * TILE; x += between(GRASS.gap) * TILE) {
    const x0 = Math.round(x / TILE) * TILE;
    const x1 = x0 + Math.round(between(GRASS.len)) * TILE;
    if (clear(x0, x1)) out.push({ x0, x1 });
  }
  return out;
}
