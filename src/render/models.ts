// Models built in Blender (art/*.py, exported to public/models): the cars, the drone, the helicopter, the props, the
// other worlds' landmarks and act 3's chasers. Loaded once at startup; anything that fails to load falls back to the
// code-built version (or, for a landmark, isn't drawn).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const parts = new Map<string, THREE.Mesh>();
// parts asked for that no model had: drawn as the code-built fallback (or not at all); the playtest bot reports them
const missing = new Set<string>();
const loaded: string[] = [];

export function missingModels(): { files: string[]; parts: string[] } {
  return { files: FILES.filter((f) => !loaded.includes(f)), parts: [...missing] };
}

const FILES = ['cars.glb', 'drone.glb', 'chopper.glb', 'props.glb', 'landmarks.glb', 'chasers.glb', 'peds.glb', 'street.glb', 'pickups.glb'];
// materials that glow instead of taking light
const LIT = new Set(['lamp', 'tail', 'accent', 'badge', 'eye', 'navRed', 'navBlue', 'sign', 'holo', 'neon', 'amber', 'sigRed', 'sigGreen']); // the sheriff gold is reflective livery

export async function loadModels(base: string): Promise<void> {
  const loader = new GLTFLoader();
  await Promise.all(
    FILES.map(async (file) => {
      try {
        const gltf = await loader.loadAsync(`${base}models/${file}`);
        gltf.scene.children.forEach((o) => parts.set(o.name, asMesh(o)));
        loaded.push(file);
      } catch (err) {
        console.warn(`${file} failed to load, using the built-in version`, err);
      }
    }),
  );
}

// glTF splits a multi-material object into a group of meshes: make it one mesh with a material group per primitive
function asMesh(o: THREE.Object3D): THREE.Mesh {
  if ((o as THREE.Mesh).isMesh) return o as THREE.Mesh;
  const mesh = new THREE.Mesh();
  mesh.position.copy(o.position); // where the part sits in its model (the drone's and chopper's rotors)
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  o.children.forEach((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    geos.push(m.geometry);
    mats.push(m.material as THREE.Material);
  });
  mesh.geometry = merge(geos);
  mesh.material = mats;
  return mesh;
}

function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  const pos: number[] = [];
  const nor: number[] = [];
  let start = 0;
  geos.forEach((g, i) => {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...(ng.getAttribute('position').array as Float32Array));
    nor.push(...(ng.getAttribute('normal').array as Float32Array));
    const count = ng.getAttribute('position').count;
    out.addGroup(start, count, i);
    start += count;
  });
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

const shared = new Map<string, THREE.Material>();

// a copy of a model with the game's materials: Lambert (inkify turns it toon), glowing lamps, and `paint` recoloured
export function model(name: string, paint?: number): THREE.Mesh | null {
  const src = parts.get(name);
  if (!src) {
    missing.add(name);
    return null;
  }
  const mats = [src.material].flat().map((m) => {
    const std = m as THREE.MeshStandardMaterial;
    if (std.name === 'paint' && paint !== undefined) return new THREE.MeshLambertMaterial({ color: paint });
    let mat = shared.get(std.name);
    if (!mat) {
      mat = LIT.has(std.name)
        ? new THREE.MeshBasicMaterial({ color: std.color })
        : new THREE.MeshLambertMaterial({ color: std.color });
      mat.name = std.name;
      shared.set(std.name, mat);
    }
    return mat;
  });
  const mesh = new THREE.Mesh(src.geometry, mats.length === 1 ? mats[0] : mats);
  mesh.position.copy(src.position);
  return mesh;
}

// a model's geometry with each material's colour baked into a vertex colour, for merging many into one mesh
const flat = new Map<string, THREE.BufferGeometry>();
export function flatGeometry(name: string): THREE.BufferGeometry | null {
  const cached = flat.get(name);
  if (cached) return cached;
  const src = parts.get(name);
  if (!src) {
    missing.add(name);
    return null;
  }
  //never indexed: props merge these into one mesh (mergeGeometries needs all or none indexed) and hide a prop by its
  //vertex range
  const geo = src.geometry.index ? src.geometry.toNonIndexed() : src.geometry.clone();
  const mats = [src.material].flat() as THREE.MeshStandardMaterial[];
  const n = geo.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  const groups = geo.groups.length ? geo.groups : [{ start: 0, count: n, materialIndex: 0 }];
  for (const g of groups) {
    const c = mats[g.materialIndex ?? 0].color;
    for (let i = g.start; i < g.start + g.count; i++) col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.clearGroups();
  flat.set(name, geo);
  return geo;
}

// a prop's break pieces ('<name>_piece0'..N in props.glb): vertex-coloured geometry centred on the piece, and where
// that centre sits in the whole prop
export function propPieces(name: string): { geometry: THREE.BufferGeometry; offset: THREE.Vector3 }[] {
  const out: { geometry: THREE.BufferGeometry; offset: THREE.Vector3 }[] = [];
  for (let i = 0; parts.has(`${name}_piece${i}`); i++) {
    const piece = `${name}_piece${i}`;
    out.push({ geometry: flatGeometry(piece)!, offset: parts.get(piece)!.position.clone() });
  }
  return out;
}
