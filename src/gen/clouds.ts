// The cloud layer (zack, 2026-10-31: "i want sky route to go really tall. we could use the clouds and the rainbow...
// if we can put as much love into the sky as we did the ground"). Way up over each stretch of hill, far above the
// rooftops and cranes, a world of its own with nothing reaching down to the city: puffy clouds to land on, drifting
// ones, thin ones that break up a moment after you land, rainbows to grind up and over, and hot air balloons whose
// baskets bob. Built beat by beat from the floor's seed, like the sky beats under it (src/gen/sky-beats.ts).
// Physics only, like the rest of the sky route: nothing lifts you. You climb (zack, 2026-10-31, "climb a staircase
// of sky pieces"): partway down each stretch the sky beats give way to a staircase, scaffold decks and then wisps
// of cloud each a little higher than the last, an ollie apart, up into the layer.
import { TILE } from '../physics/constants';
import { CurvedRail, polyRail, type Level, type SkyBust, type SkyMover, type Surface } from '../physics/level';
import { SKY_SWAY } from '../sim/sky';
import { PICKUPS } from './descent';
import { editFloor } from './hills';
import { makeRng, type Rng } from './rng';
import { busy, clearAt, groundAt, TOP } from './top-route';
import { CLOUDY, maxGap, openAt, piecesOf, REACH } from './sky-line';
import { actGravity } from '../physics/feel';
import { DRONE } from '../sim/drones';

// spire, blimp: acts 4 and 5's own beats (HIGH): a skyscraper's crown up through the clouds, and a blimp of the fleet
// hubba, srail, sbeam, bridge, launch: act 3's own sets (CLOUD_LINE), the cloud line as a line of its own
export type CloudBeat = 'puff' | 'drift' | 'thin' | 'rainbow' | 'balloon' | 'gap' | 'fork' | 'hops' | 'climb' | 'spire' | 'blimp' | 'beam' | 'hubba' | 'srail' | 'sbeam' | 'bridge' | 'launch' | 'stairset' | 'double' | 'ledge' | 'gaprail';
// act 3's set pieces, one a floor up in the layer (CLOUD_ACT): the sky route's blimp, crane jib and window washer's rig
export type CloudPiece = 'blimp' | 'swing' | 'rig' | 'bust';

export const CLOUDS = {
  from: 7, // first floor with a cloud layer: act 3's (CLOUD_ACT), so act 2's floors are all rooftops
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
  thinFrames: 60, // a thin cloud blinks, faster and faster, and puffs away this long after you land (zack, 2026-11-10)
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

// Act 3, the cloud act (GDD: How a run ends, and the Roadmap's climb, step b; zack, 2026-11-06). Floors 7-9 are the
// next step up: the cloud layer is the floor, not the top lane. The floor starts on a cloud over the hill's run-up and
// the layer climbs from there, on over the whole floor to just before the gate; the city's sky beats under it are
// gone (the girders and the wires are what's left between the clouds and the street). Fall off and every later
// stretch has a girder staircase up off its lip, an ollie onto its first step, climbing back into the layer. Level
// design only: the same clouds and physics, nothing that lifts you
export const CLOUD_ACT = {
  floors: [7, 8, 9], // the act's floors (Endless reuses acts 4 and 5, so never these)
  startUp: 2.5, // tiles the starting cloud stands over the hill's run-up
  startCloud: 4, // tiles of the starting cloud past the hill's lip
  entryUp: 1.5, // tiles a later stretch's first girder stands over its lip: a big ollie and a flip off the lip
  entryIn: 2, // tiles past the lip it starts (rolling off without an ollie, you drop to the hill road under it)
  pieceAt: 0.3, // how far along the layer (0-1) its set piece comes, at the first place it fits
  blimp: 16, // tiles: the blimp's back, to cruise along
  blimpUp: 0.5, // tiles over the layer
  swing: 12, // tiles: the crane's jib, slewing out of the lane and back (land early, or it swings away under you)
  swingUp: 1, // tiles over the layer
  swingLow: 1.5, // tiles under the layer: the cloud under it (act 3), for when it's swung away
  rig: 4, // tiles: the window washer's rig, that drops under you (all the way to the street, if you ride it)
  rigGap: 2, // tiles of open sky to the cloud you pop up onto off it
  rigCloud: [8, 11], // tiles: that cloud
  steps: 14, // the most steps a staircase climbs before it meets the layer
  meetUp: 1.5, // tiles: the layer's in reach of a step up to this far over it (an ollie and a flip from its end)
  meetRoom: 4, // tiles of it past the step's end, to land on (and it starts ahead: nothing to catch overhead)
  runOn: 4, // tiles a step may run on toward a layer piece just out of its reach
};

// Act 3's cloud line (zack, 2026-11-10: "in order to pass act 3, you gotta take the cloud route ... it has to be more
// fun not just an accent on the existing level. so rainbow Hubbas, S shaped rails. S shaped I Beam... stomping the
// drones is great ... quarterpipes ... ramps that shoot you straight up, through a cloud, land on a big ass rail going
// down to a little flat then up again via quarterpipe"). The layer's cloud beats stay as the filler between sets of
// its own: the clouds are the only way through act 3 (fall to the street and the act starts over, src/game/game.ts),
// so every set is in reach of the one before, and the sky bot clears them (tests/cloud-line.test.ts)
export const CLOUD_LINE = {
  // the act's beats by weight: the sets come round often, the layer's clouds between them
  beats: [['puff', 3], ['thin', 1], ['drift', 1], ['rainbow', 1], ['fork', 1.2], ['hops', 0.8], ['climb', 0.8], ['gap', 0.5], ['hubba', 2.5], ['srail', 2], ['sbeam', 1.5], ['bridge', 2], ['launch', 1.6]] as [CloudBeat, number][],
  // a rainbow hubba: a cloud a flip up over the layer, then a rainbow ledge off its end, grinding down onto a cloud
  hubbaUp: 2, // tiles that cloud stands over the layer
  hubbaTop: [5, 6], // tiles: that cloud
  hubba: [9, 12], // tiles the hubba runs along
  hubbaDrop: 4, // tiles it falls, from that cloud (less where the layer can't go that low)
  hubbaLand: [7, 9], // tiles: the cloud at its foot
  // an S-rail: a chrome rail that dips and kicks back up at its end, throwing you on to a cloud ahead
  srail: [14, 18], // tiles along
  srailDip: 3.5, // tiles down to its lowest, about two thirds of the way along
  srailKick: 1.5, // tiles its end stands back up over its lowest
  srailGap: 3, // tiles of open sky to the cloud after it
  srailLand: [7, 9],
  // an S I-beam: a red steel beam hung off crane cables, flat, then down, then flat again, onto a cloud
  sbeam: [14, 18],
  sbeamDrop: 3,
  sbeamLand: [7, 9],
  // a drone bridge: a gap too wide to jump with no cloud under it, the drones hovering across it at the layer's height:
  // stomp from one to the next (each stomp gives you your jumps back)
  bridge: [2, 3], // drones
  bridgePitch: 3.25, // tiles from one drone to the next (a stomp's bounce, tapped, carries about 2.6 at cruising speed, 4 fast)
  bridgeEdge: 3, // tiles of open sky from the cloud's edge to the first drone (an ollie off the edge comes down about there)
  bridgeFar: 2, // and from the last drone to the cloud on the far side
  bridgeFrom: [6, 8], // tiles: the cloud you leave from
  bridgeLand: [8, 10], // tiles: the one on the far side
  bridgeDrop: 0.75, // tiles it stands under the one you left (a long jump over the drones still comes down on it)
  most: { launch: 2, bridge: 3, hubba: 3, srail: 3, sbeam: 3 } as Partial<Record<CloudBeat, number>>, // a floor's most of each set
  // the clouds that blink out under you (zack, 2026-11-10: "use them sparingly in the harder parts of cloud act"):
  // none on the act's first floor, then at most this many a floor, and only past this share of the layer
  thinMost: 2,
  thinFrom: 0.5,
};

// act 3's launch quarterpipes: roll up one and off its lip and it throws you straight up (at the same arc whatever
// your speed, launchHsp), up through a cloud bank and down onto a big rail running down to a little flat, then a
// second quarterpipe and a second rail down onto the layer. Ollie on the ramp instead and you've thrown it away
export const LAUNCH = {
  run: [11, 13], // tiles: the cloud you roll up to it on (long: come in fast off a rail and you still land before it)
  qp: 2, // tiles: the quarterpipe
  qpUp: 2, // tiles its lip stands over its foot
  vsp: -13, // px/frame up off the lip (about 10.5 tiles of air over it)
  hsp: 4.5, // px/frame along, every time (the arc tops out about 7.3 tiles past the lip)
  bank: 6, // tiles: the cloud bank you shoot up through
  bankUp: 5, // tiles over the lip
  railAt: 7.5, // tiles past the lip the big rail starts, just past the top of the arc
  railUp: 10, // tiles over the lip it starts
  rail: 20, // tiles it runs down
  flat: [5, 6], // tiles: the little flat at its foot
  land: [9, 11], // tiles: the cloud the second rail runs down onto
};

// Act 5's station line (zack, 2026-11-10: "act 5 is space: THAT level needs to be built out... to the degree that
// the sewer was. we are going to add a lot more little handrails like the sewer has with its little stairset"). The
// station's own sets, strung along the floor between its decks, satellites and debris, the way act 3's cloud line
// strings its sets: stair sets with a handrail over the steps (the sewer's, src/gen/sewer.ts: ollie the set or grind
// the rail, roll onto the steps and you slam), double sets with a kinked rail, ledges and flat rails along the decks,
// rails over open space between two modules, and act 3's hubba as a ledge down off a module's roof. In act 3's tiles
// (1x gravity): highDials grows them for act 5's, so a set is about 3x the sewer's, the handrails' height kept a
// handrail's
export const STATION = {
  // a stair set: a deck, the steps down off its end with a handrail over them, a deck at their foot
  top: [5, 7], // tiles: the deck before the steps
  run: [3, 4], // tiles of steps along
  drop: 1.2, // tiles they fall
  land: [7, 9], // tiles: the deck at their foot
  railH: 0.9 * TILE, // px: the handrail over the steps' noses (a handrail's height, never grown)
  // a double set: steps, a landing, steps, its rail kinked down, flat, down
  run2: [2, 3], // tiles: each flight
  drop2: 0.9, // tiles each falls
  landing: [2, 3], // tiles: the landing between them
  // a deck with ledges along it: ollie up onto one, grind it, drop back to the deck
  deck: [14, 18], // tiles: the deck
  ledge: [3, 4], // tiles: each ledge
  ledges: 2, // the most on a deck
  ledgeH: 0.5 * TILE, // px: a ledge's top over the deck (a flat rail stands railH)
  // a gap rail: a rail across open space from one module's deck to the next, too far to jump
  from: [5, 7], // tiles: the deck you leave from
  gap: [5, 6], // tiles of open space under the rail
  far: [7, 9], // tiles: the deck on the far side
  most: { stairset: 6, double: 3, ledge: 3, gaprail: 3, hubba: 2 } as Partial<Record<CloudBeat, number>>, // a floor's most of each set
};

// Acts 4 and 5 (GDD: How a run ends, and the Roadmap's climb, step d; zack, 2026-11-06): the same floor as act 3's,
// the layer the whole way from a start up over the run-up, built higher and spread out for the act's gravity. Every
// gap and rise is scaled by 1 / gravity (an ollie and a flip carry you that much further and higher), so the line asks
// the same of you as act 3's does, only in jumps 1.4x (act 4) and 3.3x (act 5) as big.
// - Act 4, above the clouds: puffs of cloud with a fleet of blimps cruising among them and the crowns of the tallest
//   skyscrapers poking up through them (spires), the stars coming out. Its set piece is the crane jib or the rig.
// - Act 5, space: the same beats drawn as space (src/render/sky-pieces-view.ts): a cloud is a station's deck, a thin
//   one a panel of junk that breaks off, a wisp a solar panel, a rainbow a ring of station hull to grind, a balloon a
//   satellite, a drifting cloud a tumbling piece of debris, the blimp a shuttle's back, the jib a station's robot arm
//   and the rig a capsule that drops away under you
export const HIGH = {
  4: {
    floors: [10, 11, 12],
    over: 16, // tiles the line stands over the ground ahead (act 3's: CLOUDS.over)
    //its set piece, one a floor, out of the sky route's (the blimps are beats of their own up here, a fleet of them,
    //and so are the swinging I-beams, hung off cranes on the towers' tops)
    pieces: ['swing', 'rig', 'bust'] as CloudPiece[],
    beats: [['puff', 3], ['thin', 1.5], ['drift', 1.5], ['rainbow', 1], ['balloon', 1], ['blimp', 3], ['spire', 3], ['beam', 1.5], ['gap', 1.5], ['fork', 2], ['hops', 1], ['climb', 1.5]] as [CloudBeat, number][],
  },
  5: {
    floors: [13, 14, 15],
    over: 26,
    pieces: ['blimp', 'swing', 'rig'] as CloudPiece[],
    //(the station line's sets come round often, the decks, satellites and debris between them: STATION)
    beats: [['puff', 1.5], ['thin', 0.8], ['drift', 1], ['rainbow', 0.8], ['balloon', 1], ['gap', 0.5], ['fork', 0.6], ['hops', 0.6], ['climb', 0.6], ['stairset', 5], ['double', 3], ['ledge', 2.5], ['gaprail', 2], ['hubba', 2]] as [CloudBeat, number][],
  },
  spire: [5, 7], // tiles: a skyscraper's crown, a deck to land on
  beam: [5, 7], // tiles: a swinging I-beam (src/gen/sky-beats.ts SKY.beam), its sway either side kept clear
  bustDeck: [7, 9], // tiles: the crown either side of a paper billboard (SKY.bustRoof)
  bustGap: 3, // tiles between them, the billboard in the middle (times the act's scale)
  bustUp: 3, // tiles it stands over the decks, and under them (times the act's scale)
  bustDown: 1.5,
  spireUp: 1, // tiles over the layer (times the act's scale)
  spread: 1, // share of 1 / gravity the gaps and rises grow by (1: exactly as far as the jumps carry)
  long: 1, // and the share of it the pieces grow by
};

// which act's layer floor this is (3 the cloud act, 4 above the clouds, 5 space), or 0 (Endless never)
export function layerAct(floor: number): 0 | 3 | 4 | 5 {
  if (floor > 15) return 0;
  const f = editFloor(floor);
  if (CLOUD_ACT.floors.includes(f)) return 3;
  if (HIGH[4].floors.includes(f)) return 4;
  if (HIGH[5].floors.includes(f)) return 5;
  return 0;
}

// how much bigger than act 3's a layer floor's gaps and rises are: 1 / its act's gravity
export function layerScale(floor: number): number {
  const act = layerAct(floor);
  return act >= 4 ? 1 + HIGH.spread * (1 / actGravity(act) - 1) : 1;
}

// run fn with the cloud layer's and the sky line's dials grown for a high act's floor (HIGH): every gap and rise
// times its scale, the line `over` higher. Nothing changes on other floors
export function highDials<R>(floor: number, fn: () => R): R {
  const act = layerAct(floor);
  if (act < 4) return fn();
  const k = layerScale(floor);
  const saved: [Record<string, unknown>, string, unknown][] = [];
  const set = (d: Record<string, unknown>, key: string, v: unknown) => {
    saved.push([d, key, d[key]]);
    d[key] = v;
  };
  const grow = (d: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      const v = d[key];
      set(d, key, Array.isArray(v) ? v.map((n: number) => Math.round(n * k)) : (v as number) * k);
    }
  };
  grow(CLOUDS as unknown as Record<string, unknown>, ['between', 'gap', 'stairRise', 'stairGap', 'stairHeight', 'step', 'forkUp', 'forkLow', 'forkHigh', 'hopGap', 'hopDrop', 'climbUp', 'climbMax', 'ahead']);
  //(and the pieces longer, by `long` of that: a jump's longer up here, so is the run between two)
  const w = 1 + HIGH.long * (k - 1);
  const widen = (d: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      const v = d[key];
      set(d, key, Array.isArray(v) ? v.map((n: number) => Math.round(n * w)) : (v as number) * w);
    }
  };
  //(a thin cloud's time to break up with it: it's that much longer to ride across)
  widen(CLOUDS as unknown as Record<string, unknown>, ['stair', 'puff', 'thin', 'thinFrames', 'drift', 'rainbow', 'balloon', 'fork', 'forkWisp', 'forkPiece', 'hop', 'climb1']);
  widen(CLOUD_ACT as unknown as Record<string, unknown>, ['blimp', 'swing', 'rigCloud', 'meetRoom']); // (not the rig: it drops under you, so it stays short)
  widen(REACH as unknown as Record<string, unknown>, ['deck']);
  widen(HIGH as unknown as Record<string, unknown>, ['spire', 'beam', 'bustDeck']);
  set(CLOUDS as unknown as Record<string, unknown>, 'over', HIGH[act as 4 | 5].over);
  grow(CLOUD_ACT as unknown as Record<string, unknown>, ['startUp', 'entryUp', 'entryIn', 'meetUp', 'runOn', 'rigGap', 'blimpUp', 'swingUp']);
  grow(REACH as unknown as Record<string, unknown>, ['gap', 'min', 'max', 'rise']);
  //(the station line's and the hubba's, act 5's: drops and gaps grown, lengths widened, the rails' heights kept)
  grow(STATION as unknown as Record<string, unknown>, ['drop', 'drop2', 'gap']);
  widen(STATION as unknown as Record<string, unknown>, ['top', 'run', 'land', 'run2', 'landing', 'deck', 'ledge', 'from', 'far']);
  grow(CLOUD_LINE as unknown as Record<string, unknown>, ['hubbaUp', 'hubbaDrop']);
  widen(CLOUD_LINE as unknown as Record<string, unknown>, ['hubbaTop', 'hubba', 'hubbaLand']);
  try {
    return fn();
  } finally {
    for (const [d, key, v] of saved.reverse()) d[key] = v;
  }
}

// filter an array in place (other parts of the level may hold it)
function keep<T>(xs: T[], ok: (x: T) => boolean): void {
  const kept = xs.filter(ok);
  xs.splice(0, xs.length, ...kept);
}

// clearAt, but a rail only counts where it runs right there (openAt): act 3's staircase climbs off a hill's lip over
// the rail that runs down the hill from it, clear of it where it's fallen away
function clearOver(level: Level, x0: number, x1: number, y: number): number | null {
  for (let k = 0; k <= 8; k++) {
    const dy = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * (TILE / 2);
    const el = (level.el ?? []).some((e) => e.x1 > x0 - 2 * TILE && e.x0 < x1 + 2 * TILE && y + dy > e.y - 6 * TILE);
    if (!el && openAt(level, x0, x1, y + dy)) return y + dy;
  }
  return null;
}

// is this floor one of act 3's cloud floors?
export function cloudFloor(floor: number): boolean {
  return layerAct(floor) === 3;
}

// is this floor one the layer runs the whole of (acts 3, 4 and 5: no city sky under it)?
export function layerFloor(floor: number): boolean {
  return layerAct(floor) > 0;
}

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
  if (!span || level.layout.floor < CLOUDS.from) return false;
  //(act 3: every stretch, the first under the layer it starts in, the later ones with a staircase up off the lip)
  if (layerFloor(level.layout.floor)) return true;
  if (stretch % 2) return false;
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

function pick(rng: Rng, weights = BEATS): CloudBeat {
  const beats = mix ? weights.filter(([b]) => mix!.includes(b)) : weights;
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
  const act = layerAct(floor);
  const weights = act >= 4 ? HIGH[act as 4 | 5].beats : act === 3 ? CLOUD_LINE.beats : BEATS;
  const k = layerScale(floor);
  const surfaces: Surface[] = [];
  const rails: CurvedRail[] = [];
  const movers: SkyMover[] = [];
  const busts: SkyBust[] = [];
  const bridges: { x: number; h: number; base: number }[] = [];
  let spin = rng() < CLOUDS.spin;
  const coins = (x0: number, x1: number, y: (x: number) => number) => {
    for (let c = x0 + TILE; c < x1 - TILE / 2; c += 2 * TILE) level.pickups.push({ kind: 'cash', x: c, y: y(c) - PICKUPS.ride });
  };
  //the layer, once you're up in it, runs on to the end of the floor (zack, 2026-11-01, drawing it across his route
  //map: "see how i kind of made the sky route go the whole way"): over the cross streets and the chases between the
  //hills too, never down within `over` of the ground ahead. A later stretch with room still gets its own staircase up
  //into it, for whoever came down
  const end = level.exitX - CLOUDS.exitShort * TILE;
  //the lowest the layer may stand at x: `over` tiles over the highest ground in the `ahead` tiles from there
  const lowest = (x: number) => {
    let top = Infinity;
    for (let gx = x; gx < Math.min(end, x + CLOUDS.ahead * TILE); gx += TILE) top = Math.min(top, groundAt(level, gx) ?? level.streetY);
    return top === Infinity ? Infinity : top - CLOUDS.over * TILE;
  };
  //the layer itself, from (x, y) on to the end of the floor
  const lay = (x: number, y: number, first: boolean, piece: CloudPiece | null = null) => {
    let last: CloudBeat | CloudPiece = 'gap';
    const sets: Record<string, number> = {};
    const pieceX = x + CLOUD_ACT.pieceAt * (end - x);
    //(act 3: a cloud that blinks out only so often, and only in the floor's harder back half; none on floor 7)
    const hardX = x + CLOUD_LINE.thinFrom * (end - x);
    let thins = act === 3 ? (floor === CLOUDS.from ? 0 : CLOUD_LINE.thinMost) : Infinity;
    const thinOk = (at: number) => act !== 3 || (thins > 0 && at >= hardX);
    while (x < end - 6 * TILE) {
      let beat: CloudBeat | CloudPiece = pick(rng, weights);
      //never two gaps or two rainbows running, and open with a cloud to land on
      if (last === 'gap' && beat === 'gap') beat = 'puff';
      if (last === 'rainbow' && beat === 'rainbow') beat = 'puff';
      if (first) beat = 'puff';
      first = false;
      //(act 3's set piece, once the layer's that far along; tried again on each beat until it fits)
      if (piece && x >= pieceX && last !== 'gap') beat = piece;
      const fits = (w: number) => x + w <= end;
      if (beat === 'blimp' || beat === 'swing') {
        const w = (beat === 'blimp' ? CLOUD_ACT.blimp : CLOUD_ACT.swing) * TILE;
        const by = y - (beat === 'blimp' ? CLOUD_ACT.blimpUp : CLOUD_ACT.swingUp) * TILE;
        if (fits(w) && !busy(level, x, x + w, by)) {
          movers.push({ kind: beat, x0: x, x1: x + w, y: by, cloud: true, ...(beat === 'swing' ? { mast: x + w * 0.25, phase: Math.floor(rng() * 300) } : {}) });
          //(act 3: a low cloud under the jib, for when it's swung away: the clouds are the only way through there)
          if (act === 3 && beat === 'swing' && y + CLOUD_ACT.swingLow * TILE <= lowest(x)) {
            surfaces.push({ kind: 'ledge', x0: x + 2 * TILE, x1: x + w, y: y + CLOUD_ACT.swingLow * TILE, row: -1, sky: 'cloud' });
          }
          coins(x, x + w, () => by);
          x += w;
          if (beat === piece) piece = null;
        } else beat = 'puff';
      }
      if (beat === 'spire') {
        //a skyscraper's crown up through the clouds (act 4): a deck on top of it a little over the layer
        const w = range(rng, HIGH.spire) * TILE;
        const sy = y - HIGH.spireUp * k * TILE;
        if (fits(w) && !busy(level, x, x + w, sy)) {
          surfaces.push({ kind: 'ledge', x0: x, x1: x + w, y: sy, row: -1, sky: 'spire' });
          coins(x, x + w, () => sy);
          x += w;
        } else beat = 'puff';
      }
      if (beat === 'beam') {
        //a steel I-beam on a crane's cable, swinging slowly along the lane (the sky route's, src/sim/sky.ts), with room
        //either side for its swing
        const w = range(rng, HIGH.beam) * TILE;
        const sway = SKY_SWAY * TILE;
        if (fits(w + 2 * sway) && !busy(level, x, x + w + 2 * sway, y)) {
          movers.push({ kind: 'beam', x0: x + sway, x1: x + sway + w, y, cloud: true, phase: Math.floor(rng() * 600) });
          coins(x + sway, x + sway + w, () => y);
          x += w + 2 * sway;
        } else beat = 'puff';
      }
      if (beat === 'bust') {
        //two crowns, a paper billboard across the gap between them: jump the gap and burst through it
        const w1 = range(rng, HIGH.bustDeck) * TILE;
        const w2 = range(rng, HIGH.bustDeck) * TILE;
        const gap = HIGH.bustGap * k * TILE;
        if (fits(w1 + gap + w2) && !busy(level, x, x + w1 + gap + w2, y)) {
          surfaces.push({ kind: 'ledge', x0: x, x1: x + w1, y, row: -1, sky: 'spire' });
          surfaces.push({ kind: 'ledge', x0: x + w1 + gap, x1: x + w1 + gap + w2, y, row: -1, sky: 'spire' });
          busts.push({ x: x + w1 + gap / 2, y0: y - HIGH.bustUp * k * TILE, y1: y + HIGH.bustDown * k * TILE });
          coins(x, x + w1, () => y);
          coins(x + w1 + gap, x + w1 + gap + w2, () => y);
          x += w1 + gap + w2;
          piece = null;
        } else beat = 'puff';
      }
      if (beat === 'rig') {
        //the rig, then open sky, then the cloud you pop up onto (it drops under you: ride it and it takes you down)
        const w = CLOUD_ACT.rig * TILE;
        const cw = range(rng, CLOUD_ACT.rigCloud) * TILE;
        const cx = x + w + CLOUD_ACT.rigGap * TILE;
        if (fits(cx + cw - x) && !busy(level, x, cx + cw, y)) {
          movers.push({ kind: 'rig', x0: x, x1: x + w, y, floor: (groundAt(level, x + w / 2) ?? level.streetY) - TILE, cloud: true });
          level.pickups.push({ kind: 'cash', x: x + w + (CLOUD_ACT.rigGap * TILE) / 2, y: y - PICKUPS.arc });
          surfaces.push({ kind: 'ledge', x0: cx, x1: cx + cw, y, row: -1, sky: 'cloud' });
          coins(cx, cx + cw, () => y);
          x = cx + cw;
          piece = null;
        } else beat = 'puff';
      }
      //(act 3's sets: never the same one twice running)
      if (beat === last && ['hubba', 'srail', 'sbeam', 'bridge', 'launch', 'double', 'ledge', 'gaprail'].includes(beat)) beat = 'puff';
      //(and only so many of each a floor)
      const most = act === 3 ? CLOUD_LINE.most[beat as CloudBeat] : act === 5 ? STATION.most[beat as CloudBeat] : undefined;
      if (most !== undefined && (sets[beat] ?? 0) >= most) beat = 'puff';
      if (beat === 'thin' && !thinOk(x)) beat = 'puff';
      if (beat === 'hubba') {
        //a cloud a flip up, a rainbow ledge off its end grinding down, and a cloud at its foot
        const tw = range(rng, CLOUD_LINE.hubbaTop) * TILE;
        const hw = range(rng, CLOUD_LINE.hubba) * TILE;
        const lw = range(rng, CLOUD_LINE.hubbaLand) * TILE;
        const ty = y - CLOUD_LINE.hubbaUp * TILE;
        const hx = x + tw;
        const ly = Math.min(ty + CLOUD_LINE.hubbaDrop * TILE, lowest(hx + hw));
        if (ly - ty >= 1.5 * TILE && fits(tw + hw + lw) && !busy(level, x, x + tw, ty) && !busy(level, hx, hx + hw + lw, ly)) {
          surfaces.push({ kind: 'ledge', x0: x, x1: hx, y: ty, row: -1, sky: 'cloud' });
          coins(x, hx, () => ty);
          const r = polyRail([[hx, ty], [hx + hw, ly]]);
          r.sky = 'hubba';
          r.material = 'concrete';
          rails.push(r);
          coins(hx, hx + hw, (cx) => r.yAt(cx) ?? ly);
          surfaces.push({ kind: 'ledge', x0: hx + hw, x1: hx + hw + lw, y: ly, row: -1, sky: 'cloud' });
          coins(hx + hw, hx + hw + lw, () => ly);
          x = hx + hw + lw;
          y = ly;
        } else beat = 'puff';
      }
      if (beat === 'stairset' || beat === 'double') {
        //a deck, the steps down off its end (one flight, or two with a landing between) under a handrail, and the
        //deck at their foot
        const one = beat === 'stairset';
        const S = STATION;
        const tw = range(rng, S.top) * TILE;
        const flights = one ? [[range(rng, S.run) * TILE, S.drop * TILE]] : [[range(rng, S.run2) * TILE, S.drop2 * TILE], [range(rng, S.run2) * TILE, S.drop2 * TILE]];
        const mid = one ? 0 : range(rng, S.landing) * TILE;
        const lw = range(rng, S.land) * TILE;
        const run = flights.reduce((a, [w]) => a + w, 0) + mid;
        const fall = flights.reduce((a, [, d]) => a + d, 0);
        //(where the layer's already as low as it may stand, the deck before the steps stands that much over it: a
        //flip up onto it, never more than a staircase's step)
        const up = Math.max(0, y + fall - lowest(x + tw + run));
        if (up <= CLOUDS.stairRise * TILE) y -= up;
        const foot = y + fall;
        if (up <= CLOUDS.stairRise * TILE && fits(tw + run + lw) && !busy(level, x, x + tw + run + lw, y + fall / 2)) {
          surfaces.push({ kind: 'ledge', x0: x, x1: x + tw, y, row: -1, sky: 'cloud' });
          coins(x, x + tw, () => y);
          //the flights, and the rail's line over their noses: a handrail's height over the top step's edge and the
          //bottom one's, flat over the landing
          let sx = x + tw;
          let sy = y;
          const pts: [number, number][] = [[sx - TILE / 2, sy - S.railH]];
          flights.forEach(([w, d], i) => {
            surfaces.push({ kind: 'stairs', x0: sx, x1: sx + w, y: sy, y1: sy + d, row: -1, sky: 'stairs' });
            pts.push([sx + w, sy + d - S.railH]);
            sx += w;
            sy += d;
            if (i === 0 && mid) {
              surfaces.push({ kind: 'ledge', x0: sx, x1: sx + mid, y: sy, row: -1, sky: 'landing' });
              sx += mid;
              pts.push([sx, sy - S.railH]);
            }
          });
          //(it runs half a tile on past the last step, over the deck at the foot, to come off onto)
          pts[pts.length - 1] = [sx + TILE / 2, sy - S.railH];
          const r = polyRail(pts);
          r.sky = 'handrail';
          rails.push(r);
          coins(x + tw, sx, (cx) => (r.yAt(cx) ?? sy));
          surfaces.push({ kind: 'ledge', x0: sx, x1: sx + lw, y: foot, row: -1, sky: 'cloud' });
          coins(sx, sx + lw, () => foot);
          x = sx + lw;
          y = foot;
        } else beat = 'puff';
      }
      if (beat === 'ledge') {
        //a long deck with ledges and flat rails along it, an ollie up onto each, room between to come down and pop again
        const S = STATION;
        const w = range(rng, S.deck) * TILE;
        if (fits(w) && !busy(level, x, x + w, y)) {
          surfaces.push({ kind: 'ledge', x0: x, x1: x + w, y, row: -1, sky: 'cloud' });
          const n = 1 + Math.floor(rng() * S.ledges);
          const slot = w / n;
          for (let i = 0; i < n; i++) {
            const lw = Math.min(range(rng, S.ledge) * TILE, slot * 0.55);
            const lx = x + slot * i + slot * 0.35;
            const rail = rng() < 0.5;
            const ly = y - (rail ? S.railH : S.ledgeH);
            const r = polyRail([[lx, ly], [lx + lw, ly]]);
            r.sky = rail ? 'deckrail' : 'ledge';
            if (!rail) r.material = 'concrete';
            rails.push(r);
            coins(lx, lx + lw, () => ly);
          }
          coins(x, x + slot * 0.3, () => y);
          x += w;
        } else beat = 'puff';
      }
      if (beat === 'gaprail') {
        //a module's deck, a rail out across open space from its end to the next one's, too far to jump
        const S = STATION;
        const fw = range(rng, S.from) * TILE;
        const gw = range(rng, S.gap) * TILE;
        const lw = range(rng, S.far) * TILE;
        const ry = y - S.railH;
        if (fits(fw + gw + lw) && !busy(level, x, x + fw + gw + lw, y) && !busy(level, x + fw, x + fw + gw, ry)) {
          surfaces.push({ kind: 'ledge', x0: x, x1: x + fw, y, row: -1, sky: 'cloud' });
          coins(x, x + fw, () => y);
          const r = polyRail([[x + fw - 2 * TILE, ry], [x + fw + gw + TILE, ry]]);
          r.sky = 'gaprail';
          rails.push(r);
          coins(x + fw, x + fw + gw, () => ry);
          if (rng() < CLOUDS.stoken) level.pickups.push({ kind: 'stoken', x: x + fw + gw / 2, y: ry - PICKUPS.arc });
          (level.airways ??= []).push([x + fw, x + fw + gw]);
          surfaces.push({ kind: 'ledge', x0: x + fw + gw, x1: x + fw + gw + lw, y, row: -1, sky: 'cloud' });
          coins(x + fw + gw, x + fw + gw + lw, () => y);
          x += fw + gw + lw;
        } else beat = 'puff';
      }
      if (beat === 'srail' || beat === 'sbeam') {
        //an S: the chrome rail dips and kicks back up at its end (off it into open sky, onto the cloud ahead); the red
        //I-beam steps down flat to flat, straight onto the cloud at its foot
        const s3 = beat === 'srail';
        const w = range(rng, s3 ? CLOUD_LINE.srail : CLOUD_LINE.sbeam) * TILE;
        const want = (s3 ? CLOUD_LINE.srailDip : CLOUD_LINE.sbeamDrop) * TILE;
        const dip = Math.min(want, lowest(x + w * 0.6) - y);
        const gap = s3 ? CLOUD_LINE.srailGap * TILE : 0;
        const lw = range(rng, s3 ? CLOUD_LINE.srailLand : CLOUD_LINE.sbeamLand) * TILE;
        const kick = s3 ? CLOUD_LINE.srailKick * TILE : 0;
        const ey = y + dip - kick;
        if (dip >= 2 * TILE && fits(w + gap + lw) && !busy(level, x, x + w + gap + lw, y + dip / 2)) {
          const pts: [number, number][] = [];
          const n = 40;
          for (let i = 0; i <= n; i++) {
            const t = i / n;
            let f: number;
            if (!s3) f = (dip * (1 - Math.cos(Math.PI * t))) / 2;
            else if (t < 0.65) f = (dip * (1 - Math.cos((Math.PI * t) / 0.65))) / 2;
            else f = dip - kick * (1 - Math.cos((Math.PI / 2) * ((t - 0.65) / 0.35)));
            pts.push([x + w * t, y + f]);
          }
          const r = polyRail(pts);
          r.sky = beat;
          rails.push(r);
          coins(x, x + w, (cx) => r.yAt(cx) ?? y);
          //(off the S-rail's kick you're thrown up and on: the cloud a little over where it leaves you)
          const ly = s3 ? ey - TILE / 2 : y + dip;
          surfaces.push({ kind: 'ledge', x0: x + w + gap, x1: x + w + gap + lw, y: ly, row: -1, sky: 'cloud' });
          coins(x + w + gap, x + w + gap + lw, () => ly);
          if (s3) level.pickups.push({ kind: 'cash', x: x + w + gap / 2, y: ly - PICKUPS.arc });
          x += w + gap + lw;
          y = ly;
        } else beat = 'puff';
      }
      if (beat === 'bridge') {
        //a cloud to leave from, the drones across the gap at its height, and a cloud on the far side
        const fw = range(rng, CLOUD_LINE.bridgeFrom) * TILE;
        const n = range(rng, CLOUD_LINE.bridge);
        const edge = CLOUD_LINE.bridgeEdge * TILE;
        const span = edge + CLOUD_LINE.bridgeFar * TILE + (n - 1) * CLOUD_LINE.bridgePitch * TILE + DRONE.w;
        const lw = range(rng, CLOUD_LINE.bridgeLand) * TILE;
        if (fits(fw + span + lw) && !busy(level, x, x + fw + span + lw, y)) {
          surfaces.push({ kind: 'ledge', x0: x, x1: x + fw, y, row: -1, sky: 'cloud' });
          coins(x, x + fw, () => y);
          const gx = x + fw;
          for (let i = 0; i < n; i++) {
            const dx = gx + edge + i * CLOUD_LINE.bridgePitch * TILE;
            bridges.push({ x: dx, h: 0, base: y });
            level.pickups.push({ kind: 'cash', x: dx + DRONE.w / 2, y: y - PICKUPS.arc });
          }
          if (rng() < CLOUDS.stoken) level.pickups.push({ kind: 'stoken', x: gx + span / 2, y: y - PICKUPS.high });
          (level.airways ??= []).push([gx, gx + span]);
          const ly = Math.max(y, Math.min(y + CLOUD_LINE.bridgeDrop * TILE, lowest(gx + span)));
          surfaces.push({ kind: 'ledge', x0: gx + span, x1: gx + span + lw, y: ly, row: -1, sky: 'cloud' });
          coins(gx + span, gx + span + lw, () => ly);
          x = gx + span + lw;
          y = ly;
        } else beat = 'puff';
      }
      if (beat === 'launch') {
        //roll up the quarterpipe, up through the cloud bank, down the big rail to the little flat, up the second
        //quarterpipe and down the second rail onto the layer
        const L = LAUNCH;
        const rw = range(rng, L.run) * TILE;
        const fw = range(rng, L.flat) * TILE;
        const lw = range(rng, L.land) * TILE;
        const leg = (L.qp + L.railAt + L.rail) * TILE;
        const w = rw + leg + fw + leg + lw;
        const fx = x + rw + leg;
        const fy = Math.min(y, lowest(fx));
        const ex = fx + fw + leg;
        const ey = Math.min(fy, lowest(ex));
        const clear = (x0: number, x1: number, yy: number) => !busy(level, x0, x1, yy);
        if (fits(w) && clear(x, ex + lw, y) && clear(x, ex + lw, y - L.railUp * TILE) && clear(x, ex + lw, y - (L.railUp / 2) * TILE)) {
          surfaces.push({ kind: 'ledge', x0: x, x1: x + rw, y, row: -1, sky: 'cloud' });
          coins(x, x + rw, () => y);
          //one leg: the quarterpipe from (qx, qy) and the rail down from over its lip to (tx, ty)
          const legOf = (qx: number, qy: number, tx: number, ty: number) => {
            const lip = qy - L.qpUp * TILE;
            const lx = qx + L.qp * TILE;
            surfaces.push({ kind: 'bank', x0: qx, x1: lx, y: qy, y1: lip, row: -1, sky: 'qp', launch: L.vsp, launchHsp: L.hsp });
            surfaces.push({ kind: 'ledge', x0: lx - 1.5 * TILE, x1: lx - 1.5 * TILE + L.bank * TILE, y: lip - L.bankUp * TILE, row: -1, sky: 'cloud' });
            const r = polyRail([[lx + L.railAt * TILE, lip - L.railUp * TILE], [tx, ty]]);
            r.sky = 'downrail';
            rails.push(r);
            coins(lx + L.railAt * TILE + TILE, tx, (cx) => r.yAt(cx) ?? ty);
            //(a line of coins up the launch, the way it throws you)
            for (let k = 1; k <= 4; k++) level.pickups.push({ kind: 'cash', x: lx + k * 1.2 * TILE, y: lip - k * 2.2 * TILE });
          };
          legOf(x + rw, y, fx, fy);
          surfaces.push({ kind: 'ledge', x0: fx, x1: fx + fw, y: fy, row: -1, sky: 'cloud' });
          coins(fx, fx + fw, () => fy);
          legOf(fx + fw, fy, ex, ey);
          surfaces.push({ kind: 'ledge', x0: ex, x1: ex + lw, y: ey, row: -1, sky: 'cloud' });
          coins(ex, ex + lw, () => ey);
          (level.airways ??= []).push([x + rw, ex]);
          x = ex + lw;
          y = ey;
        } else beat = 'puff';
      }
      sets[beat] = (sets[beat] ?? 0) + 1;
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
            const thin = k % 2 === 1 && hx + hw < x + w && thinOk(hx);
            if (thin) thins--;
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
        //(act 3, where the clouds are the only way: crowded right there, up a little out of the way instead of a hole)
        if (act === 3 && fits(w) && busy(level, x, x + w, y)) {
          const up = clearAt(level, x, x + w, y, y - 2 * TILE);
          if (up !== null && up <= y) y = up;
        }
        if (fits(w) && !busy(level, x, x + w, y)) {
          surfaces.push({ kind: 'ledge', x0: x, x1: x + w, y, row: -1, sky: beat === 'thin' ? 'thin' : 'cloud', ...(beat === 'thin' ? { crumble: true, crumbleFrames: CLOUDS.thinFrames } : {}) });
          if (beat === 'thin') thins--;
          coins(x, x + w, () => y);
        }
        x += w;
      }
      last = beat;
      x += range(rng, CLOUDS.between) * TILE;
      //(falling gently with the floor; where the ground ahead climbs, up again, a step at a time: a flip makes it)
      y = Math.max(y - CLOUDS.stairRise * TILE, Math.min(y + CLOUDS.step * TILE, lowest(x)));
    }
  };
  //a staircase from (x, y): deck after deck, each a step higher, the top half wisps of cloud (or, `until` it's in
  //reach of the layer, girders all the way)
  const stairs = (x: number, y: number, steps: number, until?: (step: Surface) => boolean, clear = clearAt, room?: (x0: number, x1: number, y: number) => void): [number, number] => {
    for (let k = 0; k < steps; k++) {
      const w = range(rng, CLOUDS.stair) * TILE;
      const wisp = !until && k >= steps / 2;
      //(crowded by the power line: a little lower, or slide along until it's clear; never a step you can't make)
      let at: number | null = null;
      const from = x;
      room?.(x, x + w, y - CLOUDS.stairRise * TILE);
      for (let n = 0; n < 12 && at === null; n++) {
        at = clear(level, x, x + w, y - CLOUDS.stairRise * TILE);
        if (at !== null && at < y - (CLOUDS.stairRise + 0.25) * TILE) at = null;
        if (at === null) x += TILE;
      }
      if (at === null) continue;
      //(act 3's, slid along: the step before runs on after it, so the gap's still a step's, where that's clear)
      const prev = surfaces.at(-1);
      if (until && x > from && prev?.sky === 'step' && openAt(level, prev.x1 + 1, x - CLOUDS.stairGap * TILE, prev.y)) {
        coins(prev.x1 - TILE, x - CLOUDS.stairGap * TILE, () => prev.y);
        prev.x1 = x - CLOUDS.stairGap * TILE;
      }
      y = at;
      const step: Surface = { kind: 'ledge', x0: x, x1: x + w, y, row: -1, sky: wisp ? 'wisp' : 'step' };
      surfaces.push(step);
      coins(x, x + w, () => at);
      x += w + CLOUDS.stairGap * TILE;
      if (until?.(step)) break;
    }
    return [x, y];
  };
  if (act) {
    //act 3 (CLOUD_ACT): the floor starts on a cloud over the hill's run-up, and the layer runs on from there
    const [a, b] = spans[0];
    const [lip] = lipOf(level, a, b);
    const y0 = (groundAt(level, a) ?? level.streetY) - CLOUD_ACT.startUp * TILE;
    const x1 = lip + CLOUD_ACT.startCloud * TILE;
    surfaces.push({ kind: 'ledge', x0: a - 2 * TILE, x1, y: y0, row: -1, sky: 'cloud' });
    coins(Math.max(a, level.startX + TILE), x1, () => y0);
    level.startY = y0;
    //(act 3: not the rig, that drops you to the street, and the street ends the act's floor)
    const pieces: CloudPiece[] = act >= 4 ? HIGH[act as 4 | 5].pieces : ['blimp', 'swing'];
    lay(x1 + range(rng, CLOUDS.between) * TILE, y0, false, pieces[Math.floor(rng() * pieces.length)]);
    //(laid, so the staircases keep clear of it)
    level.surfaces.push(...surfaces.splice(0));
    level.rails.push(...rails.splice(0));
    if (movers.length) level.skyMovers = [...(level.skyMovers ?? []), ...movers.splice(0)];
    if (busts.length) level.busts = [...(level.busts ?? []), ...busts.splice(0)];
    if (bridges.length) level.bridges = [...(level.bridges ?? []), ...bridges.splice(0)];
    let layer = piecesOf(level, a, level.width).filter((p) => p.cloud);
    //where a staircase climbs up into the layer, the clouds in its way go (and their coins), so it rises on through
    //the layer to its height instead of flattening out under it with nowhere to go
    const room = (x0: number, x1: number, y: number) => {
      const near = (sy: number) => Math.abs(sy - y) < TOP.clear;
      const over = (p0: number, p1: number) => p1 > x0 - TILE && p0 < x1 + TILE;
      const gone: [number, number, number][] = [];
      keep(level.surfaces, (s) => {
        const hit = !!s.sky && CLOUDY.has(s.sky) && over(s.x0, s.x1) && near(s.y);
        if (hit) gone.push([s.x0, s.x1, s.y]);
        return !hit;
      });
      keep(level.rails, (r) => {
        const hit = r.sky === 'rainbow' && over(r.x0, r.x1) && r.ys.some(near);
        if (hit) gone.push([r.x0, r.x1, Math.max(...r.ys)]);
        return !hit;
      });
      if (level.skyMovers) keep(level.skyMovers, (m) => {
        const hit = (m.kind === 'cloud' || m.kind === 'balloon') && over(m.x0 - REACH.drift, m.x1 + REACH.drift) && near(m.y);
        if (hit) gone.push([m.x0 - REACH.drift, m.x1 + REACH.drift, m.y]);
        return !hit;
      });
      if (!gone.length) return;
      //(a rainbow's coins and chip ride its arch, up to its rise over its feet)
      keep(level.pickups, (k) => !gone.some(([p0, p1, py]) => k.x >= p0 && k.x <= p1 && k.y < py && k.y > py - (CLOUDS.rainbowRise + 1) * TILE - PICKUPS.arc));
      layer = piecesOf(level, a, level.width).filter((p) => p.cloud);
    };
    //in reach of the layer from the end of a step: a piece starting ahead (nothing to catch overhead), no more than a
    //flip up, with room to land on it. Just out of reach, the step runs on toward it, where that's clear
    const reach = (step: Surface, p: (typeof layer)[number]) => p.x0 - step.x1 - maxGap((p.y0 - step.y) / TILE) * TILE;
    const meets = (step: Surface) => {
      const ahead = layer.filter((p) => p.x1 > step.x1 + CLOUD_ACT.meetRoom * TILE && p.y0 >= step.y - CLOUD_ACT.meetUp * TILE && p.x0 >= step.x1 - TILE / 2);
      if (ahead.some((p) => reach(step, p) <= 0)) return true;
      for (const p of ahead.filter((p) => reach(step, p) <= CLOUD_ACT.runOn * TILE)) {
        const x1 = step.x1 + reach(step, p) + TILE / 2;
        if (!openAt(level, step.x1 + 1, x1, step.y)) continue;
        coins(step.x1 - TILE, x1, () => step.y);
        step.x1 = x1;
        return true;
      }
      return false;
    };
    //every later stretch: girders up off the lip (an ollie onto the first), a flip a step, until the layer's in reach
    //(not act 3's: the clouds are its only way through, so falling to the street loses the floor anyway)
    for (const [c, d] of act === 3 ? [] : spans.slice(1)) {
      //(the first step's an ollie and a flip up off the lip, like the sky's way in, so it clears a rail run down the
      //hill off the lip: the first rise is that, from the lip's height)
      const [l, top] = lipOf(level, c, d);
      stairs(l + CLOUD_ACT.entryIn * TILE, top - (CLOUD_ACT.entryUp - CLOUDS.stairRise) * TILE, CLOUD_ACT.steps, meets, clearOver, room);
    }
  } else {
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
      [x, y] = stairs(x, y, Math.ceil(CLOUDS.climb / CLOUDS.stairRise));
      if (layer) continue;
      layer = true;
      lay(x, y, true);
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
