// The cloud layer (zack, 2026-10-31: "i want sky route to go really tall. we could use the clouds and the rainbow...
// if we can put as much love into the sky as we did the ground"). Way up over each stretch of hill, far above the
// rooftops and cranes, a world of its own with nothing reaching down to the city: puffy clouds to land on, drifting
// ones, thin ones that break up a moment after you land, rainbows to grind up and over, and hot air balloons whose
// baskets bob. Built beat by beat from the floor's seed, like the sky beats under it (src/gen/sky-beats.ts).
// Physics only, like the rest of the sky route: nothing lifts you. You climb (zack, 2026-10-31, "climb a staircase
// of sky pieces"): partway down each stretch the sky beats give way to a staircase, scaffold decks and then wisps
// of cloud each a little higher than the last, an ollie apart, up into the layer.
import { TILE } from '../physics/constants';
import { CurvedRail, type Level, type SkyMover, type Surface } from '../physics/level';
import { PICKUPS } from './descent';
import { makeRng, type Rng } from './rng';
import { busy, clearAt, groundAt } from './top-route';

export type CloudBeat = 'puff' | 'drift' | 'thin' | 'rainbow' | 'balloon' | 'gap' | 'fork' | 'hops' | 'climb';

export const CLOUDS = {
  from: 5, // first floor with a cloud layer
  room: 95, // tiles of hill down from its crest a stretch needs for a cloud layer
  stairAt: 0.18, // how far down each stretch of hill from its crest (0-1) the sky beats end and the staircase starts
  // (early: zack's clips, 2026-10-31, the clouds were over in about 7 s; this way about a third longer)
  climb: 9, // tiles the staircase climbs over the last sky beat, up to the layer
  stair: [4, 5], // tiles: each step's deck (room to land from a flip, take the knock and pop again)
  stairGap: 2, // tiles between steps
  stairRise: 1.5, // tiles each step stands over the last: an ollie and a flip make it, at any speed
  stairHeight: 4.5, // tiles over the ground where the staircase starts, with no sky beat before it (SKY.height)
  // (longer platforms, zack 2026-11-02: "there need to be longer platforms")
  puff: [10, 14], // tiles: a cloud
  thin: [5, 7],
  thinFrames: 40, // a thin cloud puffs away this long after you land (time to take the knock and pop off it)
  drift: [6, 8],
  driftBy: 1.5, // tiles a drifting cloud wanders either way
  rainbow: [14, 18], // tiles across
  rainbowRise: 2.4, // tiles its middle stands over its feet
  balloon: 2.5, // tiles: a basket
  balloonUp: 1, // tiles higher than the layer
  fork: [18, 24], // tiles: a fork's long low cloud (zack, 2026-11-02: "mini upper and lower paths")
  forkUp: 1.5, // tiles the wisp up to the high way stands over where you leave the last cloud (a flip makes it)
  forkLow: 1, // tiles the low way stands under it
  forkHigh: 3, // tiles the high way stands over the low way: past an ollie and a flip from it
  forkWisp: 5, // tiles: the wisp up to it
  forkPiece: [5, 7], // tiles: each cloud of the high way
  hops: 4, // wisps in a run of hops: short, evenly spaced, each a little lower, a rhythm to pop along
  hop: 5, // tiles: each (room past the landing lockout to pop again, src/sim/floor.ts)
  hopGap: 2,
  hopDrop: 0.5,
  climbs: 3, // wisps in a climb: a staircase up within the layer, each a tile over the last, an ollie apart
  climb1: 5, // tiles: each
  climbUp: 1,
  climbMax: 6, // tiles over the lowest the layer may stand, at most, to start a climb (it falls back gently after)
  between: [2, 3], // tiles of open sky between beats, to ollie
  gap: [4, 6],
  step: 0.6, // tiles each beat drops under the last, the layer falling gently with the hill
  over: 10, // tiles over the highest ground ahead the layer always stands, on to the end of the floor
  ahead: 40, // tiles ahead that counts
  exitShort: 10, // tiles before the floor's exit the layer ends: you drop to the street for the gate
  stoken: 0.35, // chance of a Stoken over each gap
  spin: 0.25, // chance the floor's layer hides a spin token at the top of a rainbow
};

// where a stretch of hill [a, b] crests: the highest ground on it (its first stretch starts on top; the later ones
// climb out of a cross street first, and the sky only starts once the hill falls away under you)
export function crestOf(level: Level, a: number, b: number): number {
  let best = a;
  let top = Infinity;
  for (let x = a; x < a + 0.6 * (b - a); x += TILE / 2) {
    const g = groundAt(level, x);
    if (g !== undefined && g < top - 0.5) {
      top = g;
      best = x;
    }
  }
  return best;
}

// which stretches of a floor climb into the clouds: only a long run down (the staircase alone takes about 40 tiles,
// and a climb to nothing is no climb), so mostly the floor's first stretch, down from the top; and never two in a
// row, so the floors that have room for two still end their stretches two ways
export function cloudy(level: Level, stretch: number): boolean {
  const span = level.hillSpans?.[stretch];
  if (!span || level.layout.floor < CLOUDS.from || stretch % 2) return false;
  const [a, b] = span;
  return b - crestOf(level, a, b) >= CLOUDS.room * TILE;
}

// the lip at the top of a stretch of hill: where the ground starts to fall away past its crest (px), and the crest's
// height. The way into the sky is a big ollie and a flip off it
export function lipOf(level: Level, a: number, b: number): [number, number] {
  const c = crestOf(level, a, b);
  const top = groundAt(level, c) ?? level.streetY;
  let x = c;
  while (x < b && (groundAt(level, x + TILE / 2) ?? top) <= top + TILE / 4) x += TILE / 2;
  return [x, top];
}

// the way into the sky on a stretch of hill: where you leave the hill for it (px), at what height, and whether off the
// end of a falling grind (a power line or a rail run down the hill off the lip: the way in is off its end) or off the
// lip itself (a big ollie and a flip)
export function skyEntry(level: Level, a: number, b: number): { x: number; y: number; grind: boolean } {
  const [lip, top] = lipOf(level, a, b);
  const ahead = lip + 3 * TILE;
  const rail = level.rails.find((r) => !r.sky && !r.top && !r.sewer && r.x0 < ahead + 4 * TILE && r.x1 > ahead - 2 * TILE && r.x1 < ahead + 30 * TILE);
  if (rail) return { x: rail.x1, y: rail.ys[rail.ys.length - 1], grind: true };
  return { x: lip, y: top, grind: false };
}

// where the sky beats give way to the staircase up into the clouds, on the stretch [a, b]
export function stairStart(level: Level, a: number, b: number): number {
  const c = crestOf(level, a, b);
  return c + CLOUDS.stairAt * (b - c);
}

// beats by weight: mostly clouds, a rainbow or two, a balloon now and then, forks into a high and a low way, runs of hops
const BEATS: [CloudBeat, number][] = [['puff', 5], ['thin', 2], ['drift', 2], ['rainbow', 2], ['balloon', 1.5], ['gap', 1.5], ['fork', 2.5], ['hops', 1.5], ['climb', 1.5]];

const range = (rng: Rng, [lo, hi]: number[]) => lo + Math.floor(rng() * (hi - lo + 1));

// (a floor's level-editor edits can narrow the mix, src/gen/descent.ts)
let mix: CloudBeat[] | null = null;
export function cloudMix<R>(only: CloudBeat[] | undefined, fn: () => R): R {
  const was = mix;
  mix = only?.length ? only : null;
  try {
    return fn();
  } finally {
    mix = was;
  }
}

function pick(rng: Rng): CloudBeat {
  const beats = mix ? BEATS.filter(([b]) => mix!.includes(b)) : BEATS;
  const total = beats.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [b, w] of beats) if ((r -= w) < 0) return b;
  return beats[0]?.[0] ?? 'puff';
}

export function addClouds(level: Level, seed: number): void {
  const spans = level.hillSpans;
  const floor = level.layout.floor;
  if (!spans?.length || floor < CLOUDS.from) return;
  const rng = makeRng(seed * 113 + floor * 7177 + 3);
  const surfaces: Surface[] = [];
  const rails: CurvedRail[] = [];
  const movers: SkyMover[] = [];
  let spin = rng() < CLOUDS.spin;
  const coins = (x0: number, x1: number, y: (x: number) => number) => {
    for (let c = x0 + TILE; c < x1 - TILE / 2; c += 2 * TILE) level.pickups.push({ kind: 'cash', x: c, y: y(c) - PICKUPS.ride });
  };
  //the layer, once you're up in it, runs on to the end of the floor (zack, 2026-11-01, drawing it across his route
  //map: "see how i kind of made the sky route go the whole way"): over the cross streets and the chases between the
  //hills too, never down within `over` of the ground ahead. A later stretch with room still gets its own staircase up
  //into it, for whoever came down
  let layer = false;
  for (const [i, [a, b]] of spans.entries()) {
    if (!cloudy(level, i)) continue;
    //the staircase: from the last sky beat on the stretch (or the sky beats' height, where there are none), deck after
    //deck, each a step higher, the top steps wisps of cloud
    const at = stairStart(level, a, b);
    //(where the line leaves off: the end of the last sky piece before here, a deck, a boom or a moving deck)
    //(off the end of a falling grind the pop's weak, so the first step's no higher than where it leaves off)
    const ends: [number, number, boolean][] = [
      ...level.surfaces.filter((s) => s.sky && s.x1 > a && s.x1 <= at + 4 * TILE).map((s): [number, number, boolean] => [s.x1, s.y, false]),
      ...level.rails.filter((r) => r.sky && r.x1 > a && r.x1 <= at + 4 * TILE).map((r): [number, number, boolean] => [r.xs[r.xs.length - 1], r.ys[r.ys.length - 1], r.ys[r.ys.length - 1] > r.ys[0] + TILE]),
      ...(level.skyMovers ?? []).filter((m) => m.x1 > a && m.x1 <= at + 4 * TILE).map((m): [number, number, boolean] => [m.x1, m.y, false]),
    ].sort((p, q) => q[0] - p[0]);
    const leave = ends[0];
    let x = leave ? Math.max(at, leave[0]) + CLOUDS.stairGap * TILE : at;
    let y = leave ? leave[1] + (leave[2] ? CLOUDS.stairRise * TILE : 0) : (groundAt(level, x) ?? level.streetY) - CLOUDS.stairHeight * TILE;
    const steps = Math.ceil(CLOUDS.climb / CLOUDS.stairRise);
    for (let k = 0; k < steps; k++) {
      const w = range(rng, CLOUDS.stair) * TILE;
      const wisp = k >= steps / 2;
      //(crowded by the power line: a little lower, or slide along until it's clear; never a step you can't make)
      let at: number | null = null;
      for (let n = 0; n < 12 && at === null; n++) {
        at = clearAt(level, x, x + w, y - CLOUDS.stairRise * TILE);
        if (at !== null && at < y - (CLOUDS.stairRise + 0.25) * TILE) at = null;
        if (at === null) x += TILE;
      }
      if (at === null) continue;
      y = at;
      surfaces.push({ kind: 'ledge', x0: x, x1: x + w, y, row: -1, sky: wisp ? 'wisp' : 'step' });
      coins(x, x + w, () => at);
      x += w + CLOUDS.stairGap * TILE;
    }
    if (layer) continue;
    layer = true;
    const end = level.exitX - CLOUDS.exitShort * TILE;
    //the lowest the layer may stand at x: `over` tiles over the highest ground in the `ahead` tiles from there
    const lowest = (x: number) => {
      let top = Infinity;
      for (let gx = x; gx < Math.min(end, x + CLOUDS.ahead * TILE); gx += TILE) top = Math.min(top, groundAt(level, gx) ?? level.streetY);
      return top === Infinity ? Infinity : top - CLOUDS.over * TILE;
    };
    let last: CloudBeat = 'gap';
    let first = true;
    while (x < end - 6 * TILE) {
      let beat = pick(rng);
      //never two gaps or two rainbows running, and open with a cloud to land on
      if (last === 'gap' && beat === 'gap') beat = 'puff';
      if (last === 'rainbow' && beat === 'rainbow') beat = 'puff';
      if (first) beat = 'puff';
      first = false;
      const fits = (w: number) => x + w <= end;
      if (beat === 'gap') {
        const w = range(rng, CLOUDS.gap) * TILE;
        if (rng() < CLOUDS.stoken) level.pickups.push({ kind: 'stoken', x: x + w / 2, y: y - PICKUPS.arc });
        x += w;
        last = beat;
        continue;
      }
      if (beat === 'rainbow') {
        const w = range(rng, CLOUDS.rainbow) * TILE;
        if (fits(w) && !busy(level, x, x + w, y)) {
          //an arch: its middle stands `curve` px off its ends (src/physics/level.ts CurvedRail), negative to arch up
          const r = new CurvedRail(x, y, x + w, y, -CLOUDS.rainbowRise * TILE, 32);
          r.sky = 'rainbow';
          rails.push(r);
          coins(x, x + w, (cx) => r.yAt(cx) ?? y);
          if (spin) {
            spin = false;
            const mid = r.at(r.length / 2);
            level.pickups.push({ kind: 'spin', x: mid.x, y: mid.y - PICKUPS.arc });
          }
          x += w;
        } else beat = 'puff';
      }
      if (beat === 'balloon') {
        const w = CLOUDS.balloon * TILE;
        const by = y - CLOUDS.balloonUp * TILE;
        if (fits(w) && !busy(level, x, x + w, by)) {
          movers.push({ kind: 'balloon', x0: x, x1: x + w, y: by, phase: Math.floor(rng() * 240) });
          coins(x, x + w, () => by);
          x += w;
        } else beat = 'puff';
      }
      if (beat === 'drift') {
        const w = range(rng, CLOUDS.drift) * TILE;
        const room = CLOUDS.driftBy * TILE;
        if (fits(w + 2 * room) && !busy(level, x, x + w + 2 * room, y)) {
          movers.push({ kind: 'cloud', x0: x + room, x1: x + room + w, y, phase: Math.floor(rng() * 360) });
          coins(x + room, x + room + w, () => y);
          x += w + 2 * room;
        } else beat = 'puff';
      }
      if (beat === 'fork') {
        //mini upper and lower paths (zack, 2026-11-02): the low way a long cloud a little under; the high way thin
        //clouds and puffs over it, reached only off a wisp a flip up from where you leave the last cloud (from the low
        //way they're past an ollie and a flip). The high way pays a Stoken; both join on what's next
        const w = range(rng, CLOUDS.fork) * TILE;
        //(only where the layer's free to dip a tile: where the ground ahead climbs, the layer climbs too)
        const low = y + CLOUDS.forkLow * TILE;
        const wy = y - CLOUDS.forkUp * TILE;
        const high = low - CLOUDS.forkHigh * TILE;
        const ww = CLOUDS.forkWisp * TILE;
        if (low <= lowest(x) && fits(w) && !busy(level, x + 2 * TILE, x + w, low) && !busy(level, x, x + w, high) && !busy(level, x, x + ww, wy)) {
          surfaces.push({ kind: 'ledge', x0: x + 2 * TILE, x1: x + w, y: low, row: -1, sky: 'cloud' });
          coins(x + 2 * TILE, x + w, () => low);
          surfaces.push({ kind: 'ledge', x0: x, x1: x + ww, y: wy, row: -1, sky: 'wisp' });
          let hx = x + ww + 2 * TILE;
          level.pickups.push({ kind: 'stoken', x: hx - TILE, y: high - PICKUPS.arc });
          //(the high way runs right to the fork's end, so what's next is a drop off it, never a long way off; its last
          //cloud solid, the one you jump from)
          for (let k = 0; hx + 5 * TILE <= x + w; k++) {
            let hw = Math.min(range(rng, CLOUDS.forkPiece) * TILE, x + w - hx);
            if (x + w - (hx + hw + 2 * TILE) < 5 * TILE) hw = x + w - hx;
            const thin = k % 2 === 1 && hx + hw < x + w;
            surfaces.push({ kind: 'ledge', x0: hx, x1: hx + hw, y: high, row: -1, sky: thin ? 'thin' : 'cloud', ...(thin ? { crumble: true, crumbleFrames: CLOUDS.thinFrames } : {}) });
            coins(hx, hx + hw, () => high);
            hx += hw + 2 * TILE;
          }
          x += w;
          y = low;
        } else beat = 'puff';
      }
      if (beat === 'hops') {
        //a run of hops: short wisps, evenly spaced, each a little lower: pop, pop, pop
        let hy = y;
        for (let k = 0; k < CLOUDS.hops && fits(CLOUDS.hop * TILE); k++) {
          if (!busy(level, x, x + CLOUDS.hop * TILE, hy)) {
            surfaces.push({ kind: 'ledge', x0: x, x1: x + CLOUDS.hop * TILE, y: hy, row: -1, sky: 'wisp' });
            const cy = hy;
            level.pickups.push({ kind: 'cash', x: x + (CLOUDS.hop * TILE) / 2, y: cy - PICKUPS.ride });
          }
          x += (CLOUDS.hop + CLOUDS.hopGap) * TILE;
          //(where the ground ahead climbs, up instead: never more than a tile, an ollie makes it)
          hy = Math.max(hy - CLOUDS.climbUp * TILE, Math.min(hy + CLOUDS.hopDrop * TILE, lowest(x)));
        }
        x -= CLOUDS.hopGap * TILE;
        y = hy;
      }
      if (beat === 'climb') {
        //a climb: a few wisps, each a tile over the last, then the layer falls gently back again: a wave to ride
        if (y > lowest(x) - CLOUDS.climbMax * TILE && fits(CLOUDS.climbs * (CLOUDS.climb1 + 2) * TILE)) {
          for (let k = 0; k < CLOUDS.climbs; k++) {
            const cy = y - CLOUDS.climbUp * TILE;
            if (busy(level, x, x + CLOUDS.climb1 * TILE, cy)) break;
            y = cy;
            surfaces.push({ kind: 'ledge', x0: x, x1: x + CLOUDS.climb1 * TILE, y, row: -1, sky: 'wisp' });
            coins(x, x + CLOUDS.climb1 * TILE, () => cy);
            x += (CLOUDS.climb1 + 2) * TILE;
          }
          x -= 2 * TILE;
        } else beat = 'puff';
      }
      if (beat === 'puff' || beat === 'thin') {
        const w = range(rng, beat === 'thin' ? CLOUDS.thin : CLOUDS.puff) * TILE;
        if (fits(w) && !busy(level, x, x + w, y)) {
          surfaces.push({ kind: 'ledge', x0: x, x1: x + w, y, row: -1, sky: beat === 'thin' ? 'thin' : 'cloud', ...(beat === 'thin' ? { crumble: true, crumbleFrames: CLOUDS.thinFrames } : {}) });
          coins(x, x + w, () => y);
        }
        x += w;
      }
      last = beat;
      x += range(rng, CLOUDS.between) * TILE;
      //(falling gently with the floor; where the ground ahead climbs, up again, a step at a time: a flip makes it)
      y = Math.max(y - CLOUDS.stairRise * TILE, Math.min(y + CLOUDS.step * TILE, lowest(x)));
    }
  }
  level.surfaces.push(...surfaces);
  level.rails.push(...rails);
  if (movers.length) level.skyMovers = [...(level.skyMovers ?? []), ...movers];
}

// where the climb into the cloud layer starts on a floor (for the ?clouds test start): the staircase's first step,
// or the first cloud, or nothing
export function firstCloud(level: Level): Surface | undefined {
  const up = (k: string) => level.surfaces.filter((s) => s.sky === k).sort((p, q) => p.x0 - q.x0)[0];
  return up('step') ?? up('cloud');
}
