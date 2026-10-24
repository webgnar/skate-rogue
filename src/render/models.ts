// Models built in Blender (art/*.py, exported to public/models). Loaded once at startup; anything that fails to load
// falls back to the code-built version.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const parts = new Map<string, THREE.Mesh>();
// materials that glow instead of taking light
const LIT = new Set(['lamp', 'tail', 'accent', 'badge']); // the sheriff gold is reflective livery

export async function loadModels(base: string): Promise<void> {
  try {
    const gltf = await new GLTFLoader().loadAsync(`${base}models/cars.glb`);
    gltf.scene.children.forEach((o) => parts.set(o.name, asMesh(o)));
  } catch (err) {
    console.warn('cars.glb failed to load, using the built-in cars', err);
  }
}

// glTF splits a multi-material object into a group of meshes: make it one mesh with a material group per primitive
function asMesh(o: THREE.Object3D): THREE.Mesh {
  if ((o as THREE.Mesh).isMesh) return o as THREE.Mesh;
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  o.children.forEach((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    geos.push(m.geometry);
    mats.push(m.material as THREE.Material);
  });
  return new THREE.Mesh(merge(geos), mats);
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
  if (!src) return null;
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
  return new THREE.Mesh(src.geometry, mats.length === 1 ? mats[0] : mats);
}
