// Polished steel for everything you can grind: flat rails, curved handrails and the L's running rails. One shared
// material, so every rail on a floor still batches into one draw (batch.ts):
//   - a matcap: a painted chrome ball, sky over a dark street with a hard horizon line and a hot spot, stepped into
//     a few bands like the toon shading. It reflects by view-space normal, so the shine slides along a rail as the
//     camera moves, with no environment map and no lights to pay for
//   - a tiling normal map: brushed grooves along the rail, a few nicks and dents, and a worn flat where boards grind
// The mood tints it (scene.ts wetKit): bright steel by day, and at night a dimmer steel that picks up the neon.
import * as THREE from 'three';

export const RAIL_METAL = {
  repeat: 2, // tiles one repeat of the normal map covers along a rail
  bump: 0.5, // normal map strength: rails are thin on screen, so the dents stay a hint
  radius: 0.075, // a straight rail's pipe, tiles
  night: 0x9a86c8, // the tint at full neon (white by day)
  neon: 0xff5fc8, // the neon's colour in the matcap's rim
};

const MATCAP = 128;

// the chrome ball: a pure function of the view-space normal (nx, ny up, nz toward the camera) to linear RGB 0..1
export function chrome(nx: number, ny: number, nz: number): [number, number, number] {
  //the reflected ray in view space for a camera looking down -z: r = d - 2(d.n)n with d = (0, 0, -1)
  const ry = 2 * nz * ny;
  const rx = 2 * nz * nx;
  let r: number, g: number, b: number;
  if (ry > 0.08) {
    //sky: pale cool lavender, brighter toward the top
    const t = Math.min(1, ry);
    r = 0.62 + 0.3 * t;
    g = 0.64 + 0.3 * t;
    b = 0.78 + 0.2 * t;
  } else if (ry > -0.02) {
    //the horizon: a hard bright line, the chrome's tell
    r = g = b = 1;
  } else {
    //the street: a dark warm purple, darker straight down
    const t = Math.min(1, -ry);
    r = 0.24 - 0.12 * t;
    g = 0.2 - 0.1 * t;
    b = 0.3 - 0.12 * t;
  }
  //a hot spot up and to the left, and a neon kiss on the right rim
  const hot = Math.max(0, 1 - Math.hypot(nx + 0.38, ny - 0.5) / 0.22);
  const rim = Math.max(0, (rx - 0.55) / 0.45) * (1 - nz);
  const neon = new THREE.Color(RAIL_METAL.neon);
  r += hot + rim * neon.r;
  g += hot + rim * neon.g;
  b += hot + rim * neon.b;
  //stepped into bands, like the toon shading
  const band = (v: number) => Math.min(1, Math.round(v * 6) / 6);
  return [band(r), band(g), band(b)];
}

function matcapTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = MATCAP;
  const g = c.getContext('2d')!;
  const img = g.createImageData(MATCAP, MATCAP);
  for (let y = 0; y < MATCAP; y++) {
    for (let x = 0; x < MATCAP; x++) {
      const nx = ((x + 0.5) / MATCAP) * 2 - 1;
      const ny = 1 - ((y + 0.5) / MATCAP) * 2;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const [r, gr, b] = chrome(nx, ny, nz);
      const i = (y * MATCAP + x) * 4;
      img.data.set([r * 255, gr * 255, b * 255, 255], i);
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// the height field one repeat of the normal map is made from: u along the rail (W), v round it (H)
export function railHeights(W: number, H: number, seed = 7): Float32Array {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const h = new Float32Array(W * H);
  //brushed grooves along the rail: a value per row, a little ripple along it
  const rows = Array.from({ length: H }, () => rnd());
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) h[y * W + x] = 0.25 * rows[y] + 0.04 * Math.sin((x / W) * Math.PI * 2 * 3 + y);
  //nicks and dents from boards and trucks
  for (let k = 0; k < 6; k++) {
    const cx = rnd() * W;
    const cy = rnd() * H;
    const rad = 1.2 + rnd() * 2;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = Math.min(Math.abs(x - cx), W - Math.abs(x - cx)); // wraps along the rail
        const d = Math.hypot(dx, y - cy) / rad;
        if (d < 1) h[y * W + x] -= 0.3 * (1 - d * d);
      }
    }
  }
  //the worn flat on top (the middle of v), polished smooth by grinding
  for (let y = Math.floor(H * 0.4); y < Math.ceil(H * 0.6); y++) for (let x = 0; x < W; x++) h[y * W + x] = 0.2;
  return h;
}

function normalTexture(): THREE.Texture {
  const W = 128;
  const H = 16;
  const h = railHeights(W, H);
  const at = (x: number, y: number) => h[((y + H) % H) * W + ((x + W) % W)];
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = at(x + 1, y) - at(x - 1, y);
      const dy = at(x, y + 1) - at(x, y - 1);
      const n = new THREE.Vector3(-dx * 2, dy * 2, 1).normalize(); // canvas y runs down, texture v up
      img.data.set([(n.x * 0.5 + 0.5) * 255, (n.y * 0.5 + 0.5) * 255, (n.z * 0.5 + 0.5) * 255, 255], (y * W + x) * 4);
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.NearestFilter; // pixel art, like the kit's other textures
  tex.generateMipmaps = false;
  return tex;
}

const shared = new Map<boolean, THREE.MeshMatcapMaterial>();

// the rail material, made on first use. `bumpy` false is for Blender models, which carry no UVs to lay the normal
// map along (the L's running rails in ElSpan): the same chrome, smooth
export function railMetal(bumpy = true): THREE.MeshMatcapMaterial {
  let m = shared.get(bumpy);
  if (m) return m;
  const matcap = shared.get(!bumpy)?.matcap ?? matcapTexture();
  m = new THREE.MeshMatcapMaterial({ matcap });
  if (bumpy) {
    m.normalMap = normalTexture();
    m.normalScale.set(RAIL_METAL.bump, RAIL_METAL.bump);
  }
  m.name = 'railMetal'; // scene.ts tints every kit's copy of it by name, and leaves the shared ones undisposed
  shared.set(bumpy, m);
  return m;
}

// the tint for the mood's neon 0..1: white steel by day, the night tint after dark
export function railTint(neon: number, out = new THREE.Color()): THREE.Color {
  return out.set(0xffffff).lerp(new THREE.Color(RAIL_METAL.night), THREE.MathUtils.clamp(neon, 0, 1));
}

// stretch a rail geometry's u so the normal map repeats every RAIL_METAL.repeat tiles along `length` tiles,
// instead of stretching once over the whole rail. axis 'u' for tubes (u runs along the curve); boxes are mapped
// per face, so their along-the-rail faces get u scaled and the end caps are left alone
export function railUv(geo: THREE.BufferGeometry, length: number): THREE.BufferGeometry {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!uv) return geo;
  const k = length / RAIL_METAL.repeat;
  const isBox = geo instanceof THREE.BoxGeometry;
  //BoxGeometry's faces go +x, -x, +y, -y, +z, -z, 4 vertices each (no segments): the x faces are the end caps
  for (let i = 0; i < uv.count; i++) {
    if (isBox && i < 8) continue;
    uv.setX(i, uv.getX(i) * k);
  }
  uv.needsUpdate = true;
  return geo;
}

// a straight rail as a round pipe along x, centred on the origin: round so the chrome's sky, horizon line and
// street run along it (a flat-faced bar would show one flat colour)
export function railBar(length: number, radius = RAIL_METAL.radius): THREE.BufferGeometry {
  const line = new THREE.LineCurve3(new THREE.Vector3(-length / 2, 0, 0), new THREE.Vector3(length / 2, 0, 0));
  return railUv(new THREE.TubeGeometry(line, 1, radius, 8), length);
}
