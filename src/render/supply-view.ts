// The supply pickup (src/sim/supply.ts): the fresh part itself, spinning in the air ahead of you so you can tell from
// afar what it is and go for it. The truck, wheel and shoe are the shop's card models (art/gear.py, cut down for the
// game into public/models/gear.glb), the deck is the game's board (board.glb), and the bearing is built here. A gold
// ring turns behind it so it stands out from the street.
import * as THREE from 'three';
import { gltfLoader } from './gltf';
import type { GearPart } from '../run/gear';
import { inkify } from './toon';

const SIZE = 1.0; // world units across the part's longest side (a coin is 0.4)
const Z = 0.3; // toward the camera from the skater's lane, like the pickups
const SPIN = 2.4; // radians a second
const POP_SECS = 0.25;

// a skate bearing: a steel outer race, a black shield with a red ring, and the inner race (zack's Swiss-style refs)
function bearing(): THREE.Object3D {
  const g = new THREE.Group();
  const steel = new THREE.MeshLambertMaterial({ color: 0xc8ccd4 });
  const shield = new THREE.MeshLambertMaterial({ color: 0x1c1c20 });
  const red = new THREE.MeshLambertMaterial({ color: 0xd8262e });
  const ring = (r0: number, r1: number, depth: number, mat: THREE.Material) => {
    const shape = new THREE.Shape().absarc(0, 0, r1, 0, Math.PI * 2, false);
    shape.holes.push(new THREE.Path().absarc(0, 0, r0, 0, Math.PI * 2, true));
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 28 }).translate(0, 0, -depth / 2);
    return new THREE.Mesh(geo, mat);
  };
  g.add(ring(0.82, 1, 0.56, steel), ring(0.36, 0.82, 0.46, shield), ring(0.2, 0.36, 0.56, steel));
  const stripe = ring(0.55, 0.64, 0.5, red);
  g.add(stripe);
  return g;
}

// stand a model up at SIZE across its longest side, centred on its middle
function fit(o: THREE.Object3D): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(o);
  const size = box.getSize(new THREE.Vector3());
  const k = SIZE / Math.max(size.x, size.y, size.z, 1e-6);
  const mid = box.getCenter(new THREE.Vector3());
  o.position.sub(mid);
  const holder = new THREE.Group();
  holder.add(o);
  holder.scale.setScalar(k);
  return holder;
}

export class SupplyView {
  readonly group = new THREE.Group();
  private readonly parts = new Map<GearPart, THREE.Object3D>();
  private readonly spinner = new THREE.Group();
  private readonly halo: THREE.Mesh;
  private readonly glow: THREE.Mesh;
  private shown: GearPart | null = null;
  private t = 0;
  private popT = 0;

  constructor() {
    this.halo = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.72, 40), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    this.halo.position.z = -0.4;
    //a pale disc behind the part, so a dark shoe or truck reads against a dark wall
    this.glow = new THREE.Mesh(new THREE.CircleGeometry(0.62, 40), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.55, depthWrite: false }));
    this.glow.position.z = -0.42;
    this.group.add(this.glow, this.halo, this.spinner);
    this.group.visible = false;
    this.add('bearings', fit(bearing()));
    //until the models load (and under Node, where there are none), each part is a plain box
    for (const p of ['deck', 'shoes', 'trucks', 'wheels'] as GearPart[]) this.add(p, fit(new THREE.Mesh(new THREE.BoxGeometry(p === 'deck' ? 2.4 : 1, 0.5, 0.8), new THREE.MeshLambertMaterial({ color: 0xffd23f }))));
  }

  // the models, from the game's public folder
  async load(base: string): Promise<void> {
    const loader = gltfLoader();
    const [gear, board] = await Promise.all([loader.loadAsync(`${base}models/gear.glb`).catch(() => null), loader.loadAsync(`${base}models/board.glb`).catch(() => null)]);
    const pick = (root: THREE.Object3D | undefined, name: string) => root?.getObjectByName(name)?.clone();
    const shoe = pick(gear?.scene, 'Shoe');
    const truck = pick(gear?.scene, 'Truck');
    const wheel = pick(gear?.scene, 'Wheel');
    const deck = board?.scene.clone();
    if (shoe) this.add('shoes', fit(shoe));
    if (truck) this.add('trucks', fit(truck));
    if (wheel) this.add('wheels', fit(wheel));
    if (deck) this.add('deck', fit(deck));
  }

  private add(part: GearPart, o: THREE.Object3D): void {
    const old = this.parts.get(part);
    if (old) this.spinner.remove(old);
    inkify(o);
    o.visible = part === this.shown;
    this.parts.set(part, o);
    this.spinner.add(o);
  }

  // the sim's supply this frame (world units), or none
  set(s: { part: GearPart; x: number; y: number } | null): void {
    if (this.popT > 0) return; // the grab's pop plays out first
    this.group.visible = !!s;
    if (!s) {
      this.shown = null;
      return;
    }
    if (s.part !== this.shown) {
      this.shown = s.part;
      for (const [p, o] of this.parts) o.visible = p === s.part;
    }
    this.group.position.set(s.x, s.y, Z);
  }

  // grabbed: it swells and is gone
  take(x: number, y: number): void {
    this.group.position.set(x, y, Z);
    this.popT = POP_SECS;
  }

  update(dt: number): void {
    this.t += dt;
    this.spinner.rotation.y = this.t * SPIN;
    this.spinner.rotation.x = 0.35;
    this.spinner.position.y = Math.sin(this.t * 3) * 0.06;
    this.halo.rotation.z = -this.t;
    (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(this.t * 5) * 0.12;
    if (this.popT > 0) {
      this.popT -= dt;
      const k = 1 - Math.max(0, this.popT) / POP_SECS;
      this.group.scale.setScalar(1 + k);
      if (this.popT <= 0) {
        this.group.visible = false;
        this.shown = null;
        this.group.scale.setScalar(1);
      }
    }
  }
}
