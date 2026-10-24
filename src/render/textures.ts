// Textures cut from Quest For Stoken's Chicago tileset (s_tile_city_textures: 480 x 480, 15 x 15 tiles of 32 px).
// Surfaces are composed into canvases per floor and drawn with nearest filtering so the pixels stay crisp.
import * as THREE from 'three';

const TILE_PX = 32;
const COLUMNS = 15;

export const CITY = {
  road: (i: number) => 19 + (i % 11), // street, 3 rows: t, t + 15, t + 30 (QFS survivor_ground_tile)
  cornerLeft: [16, 17, 18],
  cornerRight: [60, 61, 62],
  water: 144,
  waterTop: 129,
  facade: [108, 109, 110, 111, 123, 124],
  cap: [180, 181, 182],
  ledge: [204, 205, 206],
  brick: [78, 79, 81, 82, 83, 84, 85, 86, 93, 94, 96, 97, 98, 99, 100, 101],
  flag: [192, 193],
};

let tiles: HTMLImageElement | null = null;

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

export async function loadCityTiles(url: string): Promise<void> {
  tiles = await loadImage(url);
}

export function pixelTexture(source: HTMLCanvasElement | HTMLImageElement): THREE.Texture {
  const tex = source instanceof HTMLCanvasElement ? new THREE.CanvasTexture(source) : new THREE.Texture(source);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// a canvas of tiles: grid[row][col] = tile index, or several indices drawn on top of each other (-1 = transparent)
export type TileCell = number | number[];

export function tileCanvas(grid: TileCell[][]): HTMLCanvasElement {
  const rows = grid.length;
  const cols = Math.max(...grid.map((r) => r.length));
  const canvas = document.createElement('canvas');
  canvas.width = cols * TILE_PX;
  canvas.height = rows * TILE_PX;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  grid.forEach((row, r) =>
    row.forEach((cellTiles, c) => {
      for (const t of [cellTiles].flat()) {
        if (t < 0 || !tiles) continue;
        const sx = (t % COLUMNS) * TILE_PX;
        const sy = Math.floor(t / COLUMNS) * TILE_PX;
        ctx.drawImage(tiles, sx, sy, TILE_PX, TILE_PX, c * TILE_PX, r * TILE_PX, TILE_PX, TILE_PX);
      }
    }),
  );
  return canvas;
}

export function tileTexture(grid: TileCell[][]): THREE.Texture {
  return pixelTexture(tileCanvas(grid));
}

// a flat pixel-art canvas drawn by hand (street tops, sidewalks), w x h tiles
export function paintTexture(w: number, h: number, paint: (ctx: CanvasRenderingContext2D, W: number, H: number) => void): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * 8));
  canvas.height = Math.max(1, Math.round(h * 8));
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  paint(ctx, canvas.width, canvas.height);
  return pixelTexture(canvas);
}
