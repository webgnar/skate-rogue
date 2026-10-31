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
import { busy, groundAt } from './top-route';

export type CloudBeat = 'puff' | 'drift' | 'thin' | 'rainbow' | 'balloon' | 'gap';

export const CLOUDS = {
  from: 5, // first floor with a cloud layer
  stairAt: 0.4, // how far down each stretch of hill (0-1) the sky beats end and the staircase starts
  climb: 10, // tiles the staircase climbs over the last sky beat, up to the layer
  stair: [3, 4], // tiles: each step's deck
  stairGap: 2, // tiles between steps
  stairRise: 1.25, // tiles each step stands over the last: a plain ollie at speed makes it
  stairHeight: 4.5, // tiles over the ground where the staircase starts, with no sky beat before it (SKY.height)
  puff: [6, 9], // tiles: a cloud
  thin: [4, 5],
  drift: [5, 6],
  driftBy: 1.5, // tiles a drifting cloud wanders either way
  rainbow: [14, 18], // tiles across
  rainbowRise: 2.4, // tiles its middle stands over its feet
  balloon: 2.5, // tiles: a basket
  balloonUp: 1, // tiles higher than the layer
  between: [2, 3], // tiles of open sky between beats, to ollie
  gap: [4, 6],
  step: 0.6, // tiles each beat drops under the last, the layer falling gently with the hill
  stoken: 0.35, // chance of a Stoken over each gap
  spin: 0.25, // chance the floor's layer hides a spin token at the top of a rainbow
};

// beats by weight: mostly clouds, a rainbow or two, a balloon now and then
const BEATS: [CloudBeat, number][] = [['puff', 5], ['thin', 2], ['drift', 2], ['rainbow', 2], ['balloon', 1.5], ['gap', 1.5]];

const range = (rng: Rng, [lo, hi]: number[]) => lo + Math.floor(rng() * (hi - lo + 1));

function pick(rng: Rng): CloudBeat {
  const total = BEATS.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [b, w] of BEATS) if ((r -= w) < 0) return b;
  return 'puff';
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
  for (const [a, b] of spans) {
    //the staircase: from the last sky beat on the stretch (or the sky beats' height, where there are none), deck after
    //deck, each a step higher, the top steps wisps of cloud
    const at = a + CLOUDS.stairAt * (b - a);
    const before = level.surfaces.filter((s) => s.sky && s.x1 > a && s.x1 <= at + 4 * TILE);
    const lastBeat = before.sort((p, q) => q.x1 - p.x1)[0];
    let x = lastBeat ? Math.max(at, lastBeat.x1) + CLOUDS.stairGap * TILE : at;
    let y = lastBeat ? lastBeat.y : (groundAt(level, x) ?? level.streetY) - CLOUDS.stairHeight * TILE;
    const steps = Math.ceil(CLOUDS.climb / CLOUDS.stairRise);
    for (let k = 0; k < steps; k++) {
      y -= CLOUDS.stairRise * TILE;
      const w = range(rng, CLOUDS.stair) * TILE;
      const wisp = k >= steps / 2;
      //(clear of the power line: slide along until it is)
      for (let n = 0; n < 16 && busy(level, x, x + w, y); n++) x += TILE;
      if (busy(level, x, x + w, y)) continue;
      surfaces.push({ kind: 'ledge', x0: x, x1: x + w, y, row: -1, sky: wisp ? 'wisp' : 'step' });
      coins(x, x + w, () => y);
      x += w + CLOUDS.stairGap * TILE;
    }
    const end = b - 2 * TILE;
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
      if (beat === 'puff' || beat === 'thin') {
        const w = range(rng, beat === 'thin' ? CLOUDS.thin : CLOUDS.puff) * TILE;
        if (fits(w) && !busy(level, x, x + w, y)) {
          surfaces.push({ kind: 'ledge', x0: x, x1: x + w, y, row: -1, sky: beat === 'thin' ? 'thin' : 'cloud', ...(beat === 'thin' ? { crumble: true } : {}) });
          coins(x, x + w, () => y);
        }
        x += w;
      }
      last = beat;
      x += range(rng, CLOUDS.between) * TILE;
      y += CLOUDS.step * TILE;
    }
  }
  level.surfaces.push(...surfaces);
  level.rails.push(...rails);
  if (movers.length) level.skyMovers = [...(level.skyMovers ?? []), ...movers];
}

// where the cloud layer starts on a floor (for the ?clouds test start): the first cloud, or nothing
export function firstCloud(level: Level): Surface | undefined {
  return level.surfaces.filter((s) => s.sky === 'cloud').sort((p, q) => p.x0 - q.x0)[0];
}
