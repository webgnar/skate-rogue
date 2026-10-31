// The sky line's reach (zack, 2026-10-31: "make sure sky layer is payed as much attention to with level design as
// the ground"). Up on the sky route there's no ground to fall back to, so every piece has to be in reach of the one
// before it: at cruising speed (the decks are flat, so you're soon down to base speed up there), with an ollie and a
// flip, by a player who's good but not perfect. Measured in the sim (tests/sky-line.test.ts): at base speed an ollie
// alone carries about 4 tiles to the same height, an ollie and a flip about 6.5, two tiles up about 5.5, and a tile
// further for every two you drop.
//
// After the sky beats and the cloud layer are laid (src/gen/sky-beats.ts, src/gen/clouds.ts), this walks each
// stretch's line piece by piece and bridges any gap past that reach with a small deck (a rooftop under the clouds, a
// puff of cloud up in them), so a piece that didn't fit where it was meant to never leaves a hole you can't cross.
import { TILE } from '../physics/constants';
import { surfaceY, type Level } from '../physics/level';
import { PICKUPS } from './descent';
import { clearAt } from './top-route';

export const REACH = {
  gap: 4.5, // tiles of open sky the line may ask you to cross at the same height
  perDrop: 0.5, // more for every tile the next piece stands lower (less for every tile higher)
  min: 3,
  max: 6.5,
  rise: 2.5, // tiles higher than the last piece the next may stand
  deck: 4, // tiles: a bridging deck
  drift: 1.5 * TILE, // a drifting cloud's wander either way (CLOUDS.driftBy)
};

// the most open sky you're asked to cross to a piece `drop` tiles lower (negative: higher)
export function maxGap(drop: number): number {
  return Math.min(REACH.max, Math.max(REACH.min, REACH.gap + REACH.perDrop * drop));
}

interface Piece {
  x0: number;
  x1: number;
  y0: number; // feet height where you land on it
  y1: number; // and where you leave it
  cloud: boolean; // up in the cloud layer
}

const CLOUDY = new Set(['cloud', 'thin', 'wisp', 'rainbow', 'balloon']);

// every piece of the sky line in [a, b], in order along it
export function piecesOf(level: Level, a: number, b: number): Piece[] {
  const out: Piece[] = [];
  for (const s of level.surfaces) {
    if (!s.sky || s.x1 < a || s.x0 > b) continue;
    out.push({ x0: s.x0, x1: s.x1, y0: surfaceY(s, s.x0), y1: surfaceY(s, s.x1), cloud: CLOUDY.has(s.sky) });
  }
  for (const r of level.rails) {
    if (!r.sky || r.x1 < a || r.x0 > b) continue;
    out.push({ x0: r.xs[0], x1: r.xs[r.xs.length - 1], y0: r.ys[0], y1: r.ys[r.ys.length - 1], cloud: CLOUDY.has(r.sky) });
  }
  for (const m of level.skyMovers ?? []) {
    if (m.x1 < a || m.x0 > b) continue;
    //a drifting cloud: at the far end of its wander when you come to it, at the near end when you leave it
    const d = m.kind === 'cloud' ? REACH.drift : 0;
    out.push({ x0: m.x0 + d, x1: m.x1 - d, y0: m.y, y1: m.y, cloud: m.kind === 'cloud' || m.kind === 'balloon' });
  }
  return out.sort((p, q) => p.x0 - q.x0);
}

// bridge every gap on each stretch's sky line that's past reach: deck after deck from where you leave the last piece,
// each a comfortable jump on and stepping toward the next piece's height, until the next piece is in reach
export function bridgeSky(level: Level): void {
  const spans = level.hillSpans;
  if (!spans?.length) return;
  const inReach = (from: Piece, to: Piece) => (to.x0 - from.x1) / TILE <= maxGap((to.y0 - from.y1) / TILE) && to.y0 - from.y1 >= -REACH.rise * TILE;
  for (const [a, b] of spans) {
    const line = piecesOf(level, a, b);
    for (let i = 1; i < line.length; i++) {
      //the furthest along you could be leaving from: the piece that ends last before this one starts
      let from = line.slice(0, i).filter((p) => p.x1 <= line[i].x0 + 1).sort((p, q) => q.x1 - p.x1)[0];
      if (!from) continue;
      const to = line[i];
      for (let n = 0; n < 8 && !inReach(from, to); n++) {
        //the next deck: a gap of a few tiles on, a step toward the height you're heading for
        //(a short deck where there's only room for one: a tile of air either side of it)
        const room = to.x0 - from.x1;
        const w = Math.min(REACH.deck * TILE, room - 2 * TILE);
        if (w < 2.5 * TILE) break; // one sits right over the other: nothing to bridge
        const open = Math.min(3 * TILE, (room - w) / 2);
        const x0 = from.x1 + open;
        const want = from.y1 + Math.max(-1.25 * TILE, Math.min(2 * TILE, to.y0 - from.y1));
        let y: number | null = null;
        let x = x0;
        for (; x < to.x0 - w && y === null; x += TILE / 2) {
          y = clearAt(level, x, x + w, want);
          if (y !== null && (y < from.y1 - REACH.rise * TILE || (x - from.x1) / TILE > maxGap((y - from.y1) / TILE))) y = null;
        }
        if (y === null) break;
        x -= TILE / 2;
        const sky = to.cloud && from.cloud ? 'cloud' : 'roofs';
        level.surfaces.push({ kind: 'ledge', x0: x, x1: x + w, y, row: -1, sky });
        for (let c = x + TILE; c < x + w - TILE / 2; c += 2 * TILE) level.pickups.push({ kind: 'cash', x: c, y: y - PICKUPS.ride });
        from = { x0: x, x1: x + w, y0: y, y1: y, cloud: from.cloud };
      }
    }
  }
}
