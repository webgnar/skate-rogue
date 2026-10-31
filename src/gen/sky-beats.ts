// Sky beats (zack, 2026-10-25: "in later floors you have so much speed you fly above the power lines. i want to
// introduce a new kind of layer to the levels- where even up high like that, its using interestingly designed
// levels, like we have on the ground"). Over each stretch of hill, higher than the top route's power line, a run of
// things to land on, built beat by beat from a per-floor recipe the way the hill is (src/gen/hills.ts), and editable
// in the level editor (?levels) the same way:
// - roofs: two rooftop decks with a gap to ollie between
// - billboard: the catwalk rail along the top of a billboard
// - tower: a water tower's lid, a little higher than the rest
// - crane: a crane's boom, a long grind falling with the hill
// - scaffold: three scaffold decks stepping down
// - gap: open sky, with a Stoken in it now and then
// Set pieces (zack, 2026-10-31, "build out the sky route"), at most one a floor:
// - blimp: an ad blimp moored over the hill, its long back bobbing on the air, a calm cruise
// - rig: a window washer's rig on a tower's face that drops under you once you land: pop off it quick onto the roof
// - swing: a tower crane's jib that slews out of the lane and back: time your landing, or it swings away under you
// - bust: a paper billboard across the gap between two decks: jump the gap and burst through it
// And the finds: a stash crate on a water tower's lid (a spin token or a fresh gear part), now and then a golden
// pigeon on a deck (clear it for a spin token), and on Chinatown's stretch, clotheslines strung between the
// tenements, short sagging wires to chain (lines).
// Physics only: nothing up here lifts you (zack rejected the launch ramps), you get here on your own air and land
// on it from above. Each piece stands `height` tiles over the highest ground behind it (as the power line does),
// so it falls with the hill, and keeps clear of the power line.
import { TILE } from '../physics/constants';
import { CurvedRail, polyRail, type Level, type SkyBust, type SkyMover, type Surface } from '../physics/level';
import { SKY as FLOCK } from '../sim/sky';
import { PICKUPS } from './descent';
import { editFloor } from './hills';
import { floorEdit } from './level-edits';
import { makeRng, randInt, type Rng } from './rng';
import { busy, clearAt, groundAt } from './top-route';
import { cloudy, crestOf, lipOf, stairStart } from './clouds';

export type SkyBeat = 'roofs' | 'billboard' | 'tower' | 'crane' | 'scaffold' | 'gap' | SkyPiece | 'lines';
export type SkyPiece = 'blimp' | 'rig' | 'swing' | 'bust';
export const SKY_PIECES: SkyPiece[] = ['blimp', 'rig', 'swing', 'bust'];
export const SKY_BEATS: SkyBeat[] = ['roofs', 'billboard', 'tower', 'crane', 'scaffold', 'gap', ...SKY_PIECES, 'lines'];

export const SKY = {
  height: 4.5, // tiles over the highest ground behind: where a big ollie and a flip off a lip carries you at speed
  start: 0.1, // how far down each stretch of hill (0-1) the first beat stands
  behind: 8, // tiles of ground behind that counts, as for the power line
  between: [2, 3], // tiles of open sky between beats, to ollie
  roof: [6, 8], // a rooftop deck's tiles
  roofGap: [2, 3],
  billboard: [6, 8],
  tower: 4, // the water tower's lid (room to land, take the impact and pop again)
  towerUp: 1.5, // tiles higher than the rest
  crane: [12, 16],
  craneFall: 7, // a crane boom falls at least a tile every this many along
  scaffold: 3, // each deck
  scaffoldGap: 1, // tiles between decks: a run of steps down, an ollie anywhere lands on one
  scaffoldDrop: 0.75, // tiles each deck stands under the last
  scaffolds: 4, // decks in a run
  gap: [2, 3], // tiles of open sky past the usual: with the usual, a big flip gap, about as far as a flip carries you
  gapDrop: 1.5, // tiles the piece after a gap stands lower, so the flip carries you over
  stoken: 0.5, // a Stoken in a gap beat
  entryUp: 2.5, // tiles over the hill's lip the first piece stands, at most: a big ollie and a flip off the lip makes it
  rise: 1.5, // tiles higher than where you left the last piece the next may stand (a flip makes it)
  fall: 3, // and lower: the line steps down with the hill, but never further than you'd want to land from
  pieces: 1, // set pieces a floor, at most: the rest of a recipe's set-piece slots turn into roofs
  blimp: 16, // tiles: its back
  blimpUp: 0.5, // tiles higher than the rest
  rig: 4, // tiles: the rig's deck
  rigGap: 2, // tiles of open air between it and the roof you pop up onto
  rigRoof: [6, 8],
  swing: 12, // tiles: the jib
  bustRoof: [5, 6], // tiles: each deck either side of the billboard
  bustGap: 3, // tiles between them, the billboard in the middle
  bustUp: 3, // tiles the billboard stands over the decks
  bustDown: 1.5, // and under them
  stash: 0.7, // chance a floor's first water tower has a stash crate on its lid
  stashGear: 0.5, // chance the stash is a fresh gear part, not a spin token
  gold: 0.3, // chance a floor has a golden pigeon on one of its decks
  lines: [4, 6], // Chinatown's clotheslines: tiles each
  lineGap: [1, 2],
  lineCount: 4,
  lineSag: 6, // px each sags in the middle
  lineDrop: 0.3, // tiles each hangs under the last
};

// the code's recipes: none on act 1 (you don't fly that high yet); then simple, then mixed, then everything.
// Floors 1-15, as RECIPES; Endless reuses 10-15.
const R = (s: string) => s.split(' ').map((slot) => slot.split('/') as SkyBeat[]);
const SKY_RECIPES: SkyBeat[][][] = [
  [],
  [],
  [],
  R('roofs gap billboard gap roofs'),
  R('roofs/billboard gap tower bust/rig gap billboard roofs'),
  R('billboard scaffold gap swing roofs gap tower crane'),
  R('roofs tower gap blimp gap tower/billboard scaffold gap roofs'),
  R('crane gap billboard bust/rig scaffold gap tower roofs'),
  R('tower gap crane roofs swing/blimp gap billboard/scaffold crane'),
  R('roofs billboard gap crane rig/bust scaffold tower gap roofs crane'),
  R('crane tower gap blimp/swing scaffold billboard gap roofs crane'),
  R('scaffold crane gap tower bust/rig roofs/billboard gap crane scaffold'),
  R('crane/roofs tower scaffold gap swing/blimp billboard crane gap tower roofs'),
  R('tower crane gap scaffold rig/bust/swing roofs billboard gap crane tower'),
  R('crane scaffold tower gap blimp/swing/rig/bust roofs crane billboard gap scaffold crane'),
];

export function skyRecipe(floor: number): SkyBeat[][] {
  const i = editFloor(floor) - 1;
  return floorEdit(editFloor(floor)).sky ?? SKY_RECIPES[i] ?? [];
}

export function skyDials(floor: number) {
  const e = floorEdit(editFloor(floor));
  return { skyHeight: e.skyHeight ?? SKY.height, skyStart: e.skyStart ?? SKY.start };
}

// the beats a stretch of hill gets: the recipe, each slot picked from the seed (each stretch its own pick)
export function skyPick(seed: number, floor: number, stretch: number): SkyBeat[] {
  const rng = makeRng(seed * 17 + floor * 3313 + stretch * 101);
  const recipe = skyRecipe(floor);
  //each stretch starts the floor's recipe at its own place, so a floor keeps its pieces but no two stretches run the
  //same order (the first stretch reads it from the top)
  const k = stretch === 0 || !recipe.length ? 0 : (stretch * 3 + randInt(rng, 2)) % recipe.length;
  return [...recipe.slice(k), ...recipe.slice(0, k)].map((slot) => slot[randInt(rng, slot.length)]);
}

const range = (rng: Rng, [lo, hi]: number[]) => lo + Math.floor(rng() * (hi - lo + 1));

// over a stretch of hill [a, b]: the height a piece stands at over x, `height` tiles over the highest ground behind
function heightLine(level: Level, a: number, b: number, height: number): (x: number) => number {
  const xs: number[] = [];
  const gs: number[] = [];
  for (let x = a; x <= b; x += TILE / 2) {
    const g = groundAt(level, x);
    if (g === undefined) continue;
    xs.push(x);
    gs.push(g);
  }
  return (x: number) => {
    let g = Infinity;
    for (let i = 0; i < xs.length && xs[i] <= x; i++) if (xs[i] > x - SKY.behind * TILE) g = Math.min(g, gs[i]);
    if (g === Infinity) g = gs.find((_, i) => xs[i] >= x) ?? level.streetY;
    return g - height * TILE;
  };
}

// lay the sky beats over a built floor (after its top route, so they keep clear of its power line)
export function addSkyBeats(level: Level, seed: number): void {
  const spans = level.hillSpans;
  const floor = level.layout.floor;
  if (!spans?.length || !skyRecipe(floor).length) return;
  const d = skyDials(floor);
  const rng = makeRng(seed * 71 + floor * 6151);
  //the finds roll from their own seed, so they never move the beats
  const finds = makeRng(seed * 89 + floor * 4421 + 5);
  const surfaces: Surface[] = [];
  const rails: CurvedRail[] = [];
  const movers: SkyMover[] = [];
  const busts: SkyBust[] = [];
  const decks: Surface[] = []; // rooftop decks a golden pigeon could sit on
  let pieces = 0;
  let ceiling = -Infinity; // the highest the next piece may stand: a flip over where the line leaves off
  const coins = (x0: number, x1: number, y: (x: number) => number) => {
    for (let c = x0 + TILE; c < x1 - TILE / 2; c += 2 * TILE) level.pickups.push({ kind: 'cash', x: c, y: y(c) - PICKUPS.ride });
  };
  //the highest the base line stands over [x0, x1]
  const top = (base: (x: number) => number, x0: number, x1: number, up = 0) => {
    let y = Infinity;
    for (let x = x0; x <= x1; x += TILE / 2) y = Math.min(y, base(x));
    //(a piece that stands up over the rest, a water tower, still no more than a flip over where you leave the last)
    return Math.max(y - up * TILE, ceiling);
  };
  //a flat piece over [x0, x1], as high as its highest point needs (the hill falls away under the rest)
  const flat = (base: (x: number) => number, x0: number, x1: number, sky: SkyBeat, up = 0): Surface | null => {
    //(crowded where it stands, by the power line or the hill: up a little, up to two tiles)
    const y = clearAt(level, x0, x1, top(base, x0, x1, up), ceiling);
    if (y === null) return null;
    const s: Surface = { kind: sky === 'billboard' ? 'rail' : 'ledge', x0, x1, y, row: -1, sky, ...(sky === 'billboard' ? { material: 'metal' as const } : {}) };
    surfaces.push(s);
    coins(x0, x1, () => y);
    return s;
  };
  spans.forEach(([a, b], i) => {
    //the height the hill would put each piece at, kept in reach of where you left the last one: never more than a
    //flip higher, never a long drop lower (the hill's bumps and dips don't make the line jump about)
    const hill = heightLine(level, a, b, d.skyHeight);
    let leave: number | null = null;
    let after = 0; // tiles the next piece drops by, after a gap
    let grind = false; // the line leaves off the end of a falling grind: the pop's weak off it, so nothing higher next
    ceiling = -Infinity;
    const base = (x: number) => {
      const y = hill(x);
      if (leave === null) return y;
      ceiling = leave - (grind ? 0 : SKY.rise) * TILE + after * TILE;
      return Math.min(leave + (SKY.fall + after) * TILE, Math.max(ceiling, y));
    };
    const marks = (): [Surface | undefined, CurvedRail | undefined, SkyMover | undefined] => [surfaces.at(-1), rails.at(-1), movers.at(-1)];
    let seen = marks();
    //after each beat: where the line now leaves off, the end of what it just laid
    const settle = () => {
      const now = marks();
      const ends: [number, number, boolean][] = [];
      if (now[0] && now[0] !== seen[0]) ends.push([now[0].x1, now[0].y, false]);
      if (now[1] && now[1] !== seen[1]) ends.push([now[1].xs[now[1].xs.length - 1], now[1].ys[now[1].ys.length - 1], now[1].ys[now[1].ys.length - 1] > now[1].ys[0] + TILE]);
      if (now[2] && now[2] !== seen[2]) ends.push([now[2].x1, now[2].y, false]);
      seen = now;
      if (ends.length) {
        const last = ends.sort((p, q) => q[0] - p[0])[0];
        leave = last[1];
        grind = last[2];
        after = 0;
      }
    };
    //(with a cloud layer, the beats give way partway down to the staircase up into it, src/gen/clouds.ts)
    const end = cloudy(level, i) ? stairStart(level, a, b) : b - 4 * TILE;
    //(from where the hill crests: a stretch that climbs out of a cross street first has nothing to reach up there
    //until the ground falls away)
    const c = crestOf(level, a, b);
    let x = c + d.skyStart * (b - c);
    //the way in (zack's clips, 2026-10-31: the bot ollied off the crest and never reached the sky): the first piece
    //stands low enough over the hill's lip that a big ollie and a flip off it lands on it; the line climbs from there
    const [, lipTop] = lipOf(level, a, b);
    leave = lipTop - (SKY.entryUp - SKY.rise) * TILE;
    const picks = skyPick(seed, floor, i);
    //Chinatown's stretch opens on its clotheslines
    if (level.chinatown?.some(([c0, c1]) => c1 > a && c0 < b)) picks.unshift('lines');
    for (let beat of picks) {
      if (x >= end) break;
      const t = (n: number) => Math.min(n * TILE, end - x);
      //(no stubs: a beat that wouldn't have room for a deck you can land on stops the stretch's beats here)
      if (end - x < 3 * TILE) break;
      if ((SKY_PIECES as string[]).includes(beat)) {
        //one set piece a floor, and only where it fits whole
        const need = beat === 'blimp' ? SKY.blimp : beat === 'rig' ? SKY.rig + SKY.rigGap + SKY.rigRoof[1] : beat === 'swing' ? SKY.swing : 2 * SKY.bustRoof[1] + SKY.bustGap;
        if (pieces >= SKY.pieces || x + need * TILE > end) beat = 'roofs';
        else pieces++;
      }
      if (beat === 'gap') {
        const w = t(range(rng, SKY.gap));
        if (rng() < SKY.stoken) level.pickups.push({ kind: 'stoken', x: x + w / 2, y: (leave ?? base(x + w / 2)) - PICKUPS.arc });
        x += w;
        after = SKY.gapDrop;
        continue;
      }
      if (beat === 'roofs') {
        const w1 = t(range(rng, SKY.roof));
        const r1 = flat(base, x, x + w1, 'roofs');
        if (r1) decks.push(r1);
        x += w1 + range(rng, SKY.roofGap) * TILE;
        if (x < end) {
          const w2 = t(range(rng, SKY.roof));
          const r2 = flat(base, x, x + w2, 'roofs');
          if (r2) decks.push(r2);
          x += w2;
        }
      } else if (beat === 'billboard') {
        const w = t(range(rng, SKY.billboard));
        flat(base, x, x + w, 'billboard');
        x += w;
      } else if (beat === 'tower') {
        const w = t(SKY.tower);
        flat(base, x, x + w, 'tower', SKY.towerUp);
        x += w;
      } else if (beat === 'scaffold') {
        //(each deck under the last, from the first's height: the hill falls away faster than the steps do)
        const y0 = top(base, x, x + SKY.scaffold * TILE);
        for (let k = 0; k < SKY.scaffolds && x < end; k++) {
          const w = t(SKY.scaffold);
          //(a crowded deck is left out, not moved: the run reads as one flight of steps down)
          const y = y0 + k * SKY.scaffoldDrop * TILE;
          if (!busy(level, x, x + w, y)) {
            surfaces.push({ kind: 'ledge', x0: x, x1: x + w, y, row: -1, sky: 'scaffold' });
            coins(x, x + w, () => y);
          }
          x += w + SKY.scaffoldGap * TILE;
        }
      } else if (beat === 'crane') {
        //the boom: falling with the hill, never rising (a grind doesn't climb), smoothed
        const w = t(range(rng, SKY.crane));
        const pts: [number, number][] = [];
        for (let px = x; px <= x + w; px += TILE / 2) pts.push([px, Math.max(base(px) - TILE, ceiling)]);
        for (let k = 1; k < pts.length; k++) pts[k][1] = Math.max(pts[k][1], pts[k - 1][1]);
        //(never under the ground ahead, a bank or a crest: the boom stands clear of it, raised a little if it has to)
        for (const p of pts) p[1] = Math.min(p[1], (groundAt(level, p[0]) ?? level.streetY) - 2 * TILE);
        for (let k = pts.length - 2; k >= 0; k--) pts[k][1] = Math.min(pts[k][1], pts[k + 1][1]);
        //(and always falling some, a tile every `craneFall` along: a flat grind bleeds your speed, a falling one feeds it)
        for (const p of pts) p[1] = Math.max(p[1], pts[0][1] + (p[0] - x) / SKY.craneFall);
        const clash = () => pts.some(([px, py]) => busy(level, px, px + TILE / 2, py));
        for (let k = 1; k <= 8 && clash(); k++) for (const p of pts) p[1] += (k % 2 ? -1 : 1) * k * (TILE / 2);
        const ok = pts.length >= 4 && !clash() && pts[0][1] >= ceiling - 0.5;
        if (ok) {
          const r = polyRail(pts);
          r.sky = 'crane';
          rails.push(r);
          coins(x, x + w, (cx) => pts[Math.min(pts.length - 1, Math.round((cx - x) / (TILE / 2)))][1]);
        }
        x += w;
      } else if (beat === 'lines') {
        //clotheslines between the tenements: short sagging wires, each a little under the last, to chain
        let y = top(base, x, Math.min(end, x + 24 * TILE));
        for (let k = 0; k < SKY.lineCount && x < end - 2 * TILE; k++) {
          const w = t(range(rng, SKY.lines));
          if (!busy(level, x, x + w, y)) {
            const r = new CurvedRail(x, y, x + w, y, SKY.lineSag, 16);
            r.sky = 'lines';
            rails.push(r);
            coins(x, x + w, (cx) => r.yAt(cx) ?? y);
          }
          x += w + range(rng, SKY.lineGap) * TILE;
          y += SKY.lineDrop * TILE;
        }
        settle();
        continue;
      } else if (beat === 'blimp') {
        //an ad blimp moored over the hill: a long back to cruise along, a touch higher than the rest
        const w = SKY.blimp * TILE;
        const y = clearAt(level, x, x + w, top(base, x, x + w, SKY.blimpUp), ceiling);
        if (y !== null) {
          movers.push({ kind: 'blimp', x0: x, x1: x + w, y });
          coins(x, x + w, () => y);
        }
        x += w;
      } else if (beat === 'rig') {
        //a window washer's rig hung off a tower's face: it drops under you, so pop off it onto the roof ahead
        const w = SKY.rig * TILE;
        const rw = range(rng, SKY.rigRoof) * TILE;
        const rx = x + w + SKY.rigGap * TILE;
        const y = clearAt(level, x, rx + rw, top(base, x, rx + rw), ceiling);
        if (y !== null) {
          const ground = groundAt(level, x + w / 2) ?? level.streetY;
          movers.push({ kind: 'rig', x0: x, x1: x + w, y, floor: ground - TILE });
          surfaces.push({ kind: 'ledge', x0: rx, x1: rx + rw, y, row: -1, sky: 'roofs' });
          coins(rx, rx + rw, () => y);
          level.pickups.push({ kind: 'cash', x: x + w + (SKY.rigGap * TILE) / 2, y: y - PICKUPS.arc });
        }
        x = rx + rw;
      } else if (beat === 'swing') {
        //a tower crane's flat jib, slewing out of the lane and back
        const w = SKY.swing * TILE;
        const y = clearAt(level, x, x + w, top(base, x, x + w, 1), ceiling);
        if (y !== null) {
          movers.push({ kind: 'swing', x0: x, x1: x + w, y, mast: x + w * 0.25, phase: Math.floor(rng() * 300) });
          coins(x, x + w, () => y);
        }
        x += w;
      } else if (beat === 'bust') {
        //two decks, a paper billboard standing across the gap between them: jump the gap and burst through it
        const w1 = range(rng, SKY.bustRoof) * TILE;
        const w2 = range(rng, SKY.bustRoof) * TILE;
        const gap = SKY.bustGap * TILE;
        const y = clearAt(level, x, x + w1 + gap + w2, top(base, x, x + w1 + gap + w2), ceiling);
        if (y !== null) {
          surfaces.push({ kind: 'ledge', x0: x, x1: x + w1, y, row: -1, sky: 'roofs' });
          surfaces.push({ kind: 'ledge', x0: x + w1 + gap, x1: x + w1 + gap + w2, y, row: -1, sky: 'roofs' });
          busts.push({ x: x + w1 + gap / 2, y0: y - SKY.bustUp * TILE, y1: y + SKY.bustDown * TILE });
          coins(x, x + w1, () => y);
          coins(x + w1 + gap, x + w1 + gap + w2, () => y);
        }
        x += w1 + gap + w2;
      }
      settle();
      x += range(rng, SKY.between) * TILE;
    }
  });
  level.surfaces.push(...surfaces);
  level.rails.push(...rails);
  if (movers.length) level.skyMovers = movers;
  if (busts.length) level.busts = busts;
  //now and then a golden pigeon on a deck, past where you land on it
  const roomy = decks.filter((s) => s.x1 - s.x0 >= 6 * TILE);
  if (roomy.length && finds() < SKY.gold) {
    const s = roomy[Math.floor(finds() * roomy.length)];
    (level.flocks ??= []).push({ x: s.x1 - 2 * TILE, y: s.y - FLOCK.perch, gold: true });
  }
}

// the floor's first water tower can have a stash on its lid: a tagged crate to skate through, a spin token or a
// fresh gear part inside. After the props are placed (they'd be rebuilt over it), from its own seed
export function addSkyStash(level: Level, seed: number): void {
  const rng = makeRng(seed * 97 + level.layout.floor * 3001 + 11);
  const lid = level.surfaces.find((s) => s.sky === 'tower');
  if (!lid || rng() >= SKY.stash) return;
  const loot = rng() < SKY.stashGear ? 'gear' : 'spin';
  level.props.push({ name: 'Crate', x: (lid.x0 + lid.x1) / 2 + TILE / 2, y: lid.y, z: 0, yaw: 0.2, breaks: true, loot, stash: true });
}
