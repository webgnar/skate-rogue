// The biome kits: which tiles of each QFS world's tileset make the street, the water, the blocks, the ledges and the
// scenery, ported from QFS's survivor skins (QFSHIVE scripts/survivor_worlds, survivor_skins()). The kit builder
// (kit.ts) draws a floor from one of these. Every sheet is 15 tiles of 32 px across, like the Chicago one.
import type { BiomeId } from './biomes';
import { cityTiles, loadImage } from './textures';

export interface Skin {
  sheet: string; // public/tex/<sheet>_tiles.png
  // the street's front face: 'city' = QFS's 3-row road with crumbled corners; otherwise a top row and fill below
  ground: 'city' | { top: number[]; left: number; right: number; fill: number[] };
  pit: 'city' | { top: number; fill: number }; // water in a canal; 'city' = the Chicago water
  block: { fill: number[]; cap?: [number, number, number] }; // walls, buildings and the blocks under roofs
  ledge: [number, number, number];
  // the street's top, painted: the road, the strip along the back (sidewalk, grass, sand), its edge, the centre line
  top: { road: string; back: string; seam: string; edge: string; line: string | null };
  side: number; // colour of faces QFS never drew (slab sides, roofs)
  // scenery stood behind the wall (trees, temples, signs) or hung above it (paintings): rows of tiles, top first
  decor: { rows: number[][]; chance: number; hang?: boolean }[];
  props: (number | number[])[]; // small things on the sidewalk, as cards: one tile, or a column top first
  sink?: boolean; // the props' bottom tiles have their art at the top: they stand a tile lower
  landmark?: string; // the world's big 3D landmark (art/landmarks.py), stood behind the wall every few screens
}

const CITY_TOP = { road: '#2a2830', back: '#7d7a86', seam: '#5d5a66', edge: '#9a97a3', line: '#d8b84a' };

export const SKINS: Record<BiomeId, Skin> = {
  chicago: {
    sheet: 'chicago', ground: 'city', pit: { top: 129, fill: 144 }, block: { fill: [108, 109, 110, 111, 123, 124], cap: [180, 181, 182] },
    ledge: [204, 205, 206], top: CITY_TOP, side: 0x3a3640, decor: [], props: [],
  },
  clemente: {
    sheet: 'clemente', ground: { top: [91, 92, 93, 94, 95], left: 90, right: 96, fill: [101, 102, 103] }, pit: 'city',
    block: { fill: [52], cap: [90, 92, 96] }, ledge: [322, 323, 324],
    top: { road: '#6b5e4e', back: '#4f8a3a', seam: '#3f7030', edge: '#8a8478', line: null }, side: 0x4a3a30,
    decor: [
      { rows: [[240, 241, 242, 243, 244, 245, 246], [255, 256, 257, 258, 259, 260, 261], [270, 271, 272, 273, 274, 275, 276], [285, 286, 287, 288, 289, 290, 291], [300, 301, 302, 303, 304, 305, 306]], chance: 0.35 },
      { rows: [[315, 316, 317, 318, 319, 320, 321], [330, 331, 332, 333, 334, 335, 336], [345, 346, 347, 348, 349, 350, 351], [360, 361, 362, 363, 364, 365, 366], [375, 376, 377, 378, 379, 380, 381]], chance: 0.35 },
      { rows: [[165, 166, 167]], chance: 0.15 }, // ROBERTO CLEMENTE
      { rows: [[229, 230, 231, 232]], chance: 0.15 }, // SKATEHIVE
    ],
    props: [220, 221, 222, 223, 75, 185],
    landmark: 'LightTower',
  },
  greece: {
    sheet: 'greece', ground: { top: [195, 196, 197, 198, 199, 200, 201, 202], left: -1, right: -1, fill: [170] }, pit: { top: 126, fill: 135 },
    block: { fill: [100], cap: [88, 88, 88] }, ledge: [163, 163, 163],
    top: { road: '#cdb48a', back: '#e8dcc0', seam: '#c8b898', edge: '#f4ecd8', line: null }, side: 0x8a6a48,
    decor: [
      { rows: [[-1, 76, 77, 78, 79, 80, 81], [90, 91, 92, 93, 94, 95, 96]], chance: 0.3 }, // little temples
      { rows: [[150, 151, 152, 153], [165, -1, -1, 168]], chance: 0.3 }, // ruined arches
    ],
    props: [[132, 147], [133, 148], [101, 116, 131, 146]], // red palace pillars
    sink: true,
    landmark: 'Temple',
  },
  atlantis: {
    sheet: 'atlantis', ground: { top: [81, 82, 83, 84, 85], left: -1, right: -1, fill: [96, 97, 98, 99, 100] }, pit: { top: 336, fill: 337 },
    block: { fill: [288], cap: [320, 322, 323] }, ledge: [290, 291, 292],
    top: { road: '#2c5a62', back: '#c8b07a', seam: '#a8945e', edge: '#3a7a80', line: null }, side: 0x1a3a48,
    decor: [],
    props: [255, 256, 257, 227, 225, 228, 240, 241, 242, 63, 64, 66, 67, 68], // coral, seaweed, sea grass
    landmark: 'SunkenArch',
  },
  museum: {
    sheet: 'museum', ground: { top: [63], left: -1, right: -1, fill: [63] }, pit: 'city',
    block: { fill: [65], cap: [50, 50, 50] }, ledge: [195, 196, 197],
    top: { road: '#8a6a4a', back: '#d8d0c0', seam: '#b8b0a0', edge: '#efe8da', line: null }, side: 0x5a4a40,
    decor: [
      { rows: [[225, 226, 227, 228], [240, 241, 242, 243], [255, 256, 257, 258], [270, 271, 272, 273]], chance: 0.3, hang: true }, // paintings
      { rows: [[229, 230, 231, 232], [244, 245, 246, 247], [259, 260, 261, 262], [274, 275, 276, 277]], chance: 0.3, hang: true },
    ],
    props: [188, 308, 309, 323, 324, 326, 327, 328, 329, [411, 426, 441]], // ... and the statue of David
    landmark: 'GiantBust',
  },
  hightech: {
    sheet: 'hightech', ground: { top: [21], left: -1, right: -1, fill: [20] }, pit: { top: 425, fill: 440 },
    block: { fill: [248] }, ledge: [210, 211, 212],
    top: { road: '#1c2230', back: '#3a4458', seam: '#2c3446', edge: '#5ae0f0', line: '#ff4ad8' }, side: 0x222838,
    decor: [], props: [399, 400, 401, 402],
    landmark: 'DataSpire',
  },
  space: {
    sheet: 'space', ground: { top: [16], left: -1, right: -1, fill: [16] }, pit: { top: 136, fill: 151 },
    block: { fill: [71, 72] }, ledge: [16, 16, 16],
    top: { road: '#1a1830', back: '#2c2a48', seam: '#22203a', edge: '#6a68a0', line: null }, side: 0x14122a,
    decor: [], props: [5, 6, 7, 8],
    landmark: 'Rocket',
  },
  // the AI's stronghold: High-Tech City's tiles under the Hive's red-amber grade (biomes.ts)
  hive: {
    sheet: 'hightech', ground: { top: [21], left: -1, right: -1, fill: [20] }, pit: { top: 425, fill: 440 },
    block: { fill: [248] }, ledge: [210, 211, 212],
    top: { road: '#20141a', back: '#3a2228', seam: '#2c1a20', edge: '#ff8a3a', line: '#ffd23f' }, side: 0x2a1418,
    decor: [], props: [399, 400, 401, 402],
    landmark: 'HiveTower',
  },
};

const sheets = new Map<string, Promise<HTMLImageElement>>();

// a biome's tile sheet, loaded once (Chicago's is loaded at start)
export function loadSheet(base: string, id: BiomeId): Promise<HTMLImageElement> {
  const name = SKINS[id].sheet;
  const city = cityTiles();
  if (name === 'chicago' && city) return Promise.resolve(city);
  let p = sheets.get(name);
  if (!p) sheets.set(name, (p = loadImage(`${base}tex/${name}_tiles.png`)));
  return p;
}

// every world's sheet, for the one city's quarters (quarters.ts); a sheet that fails to load is left out
export async function loadWorlds(base: string, ids: BiomeId[]): Promise<Map<BiomeId, HTMLImageElement>> {
  const out = new Map<BiomeId, HTMLImageElement>();
  await Promise.all(
    ids.map((id) =>
      loadSheet(base, id)
        .then((img) => void out.set(id, img))
        .catch((err) => console.warn(`${id} tiles failed to load`, err)),
    ),
  );
  return out;
}
