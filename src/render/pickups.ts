// Cash coins and Stoken gems floating along the floor's lines. Coins spin; collected coins burst into sparkles, gems
// pop and vanish.
import * as THREE from 'three';
import { inkify } from './toon';
import type { Level } from '../physics/level';
import { toX, toY } from './kit';
import { flatGeometry } from './models';

const POP_SECS = 0.18;
const COIN_R = 0.2;
const COIN_T = 0.06;
const COIN_Z = 0.25; // pickups float this far toward the camera from the skater's lane

// The Stoken coin face from Quest For Stoken (QFSHIVE sprites/s_stoken_rotate, frame 0), on both faces of the coin.
// Loaded once in the browser (tests build PickupView under Node, with no images).
let coinFace: THREE.Texture | null = null;
function coinTexture(): THREE.Texture {
  if (coinFace) return coinFace;
  const tex = (coinFace = new THREE.Texture());
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  if (typeof Image !== 'undefined') {
    const img = new Image();
    img.onload = () => {
      tex.image = img;
      tex.needsUpdate = true;
    };
    img.src = `${import.meta.env.BASE_URL}sprites/stoken-coin.png`;
  }
  return tex;
}

// a gold edge and the Stoken face on both caps, facing the camera (the game spins coins about Y, its vertical)
let coinGeo: THREE.BufferGeometry | null = null;
function coinMesh(count: number): THREE.InstancedMesh {
  if (!coinGeo) {
    coinGeo = new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_T, 24).rotateX(Math.PI / 2);
    //the caps' UVs come out a quarter turn off once the coin is stood up: turn them so the face reads upright, front
    //and back (the edge is a flat colour, so its UVs don't matter)
    const uv = coinGeo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), 1 - uv.getX(i));
  }
  const geo = coinGeo;
  const face = new THREE.MeshLambertMaterial({ map: coinTexture(), emissive: 0x3a2800 });
  const edge = new THREE.MeshLambertMaterial({ color: 0xc08a18, emissive: 0x3a2800 });
  return new THREE.InstancedMesh(geo, [edge, face, face], count);
}

// A spin token (src/gen/spin-tokens.ts): a red casino chip with white rim stripes and a gold star, drawn once on a
// canvas (none under Node, where it's a plain red chip)
let chipFace: THREE.Texture | null = null;
function chipTexture(): THREE.Texture | null {
  if (chipFace || typeof document === 'undefined') return chipFace;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#e8203a';
  g.beginPath();
  g.arc(32, 32, 32, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#fff';
  g.lineWidth = 7;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    g.beginPath();
    g.arc(32, 32, 27, a - 0.18, a + 0.18);
    g.stroke();
  }
  g.fillStyle = '#ffd84a';
  g.strokeStyle = '#000';
  g.lineWidth = 2.5;
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rad = k % 2 ? 7 : 16;
    g.lineTo(32 + Math.cos(a) * rad, 32 + Math.sin(a) * rad);
  }
  g.closePath();
  g.fill();
  g.stroke();
  chipFace = new THREE.CanvasTexture(c);
  chipFace.colorSpace = THREE.SRGBColorSpace;
  return chipFace;
}

const CHIP_R = 0.26;
let chipGeo: THREE.BufferGeometry | null = null;
function chipMesh(count: number): THREE.InstancedMesh {
  chipGeo ??= new THREE.CylinderGeometry(CHIP_R, CHIP_R, 0.08, 28).rotateX(Math.PI / 2);
  const map = chipTexture();
  const face = new THREE.MeshLambertMaterial(map ? { map, emissive: 0x401010 } : { color: 0xe8203a, emissive: 0x401010 });
  const edge = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x303030 });
  return new THREE.InstancedMesh(chipGeo, [edge, face, face], count);
}

export class PickupView {
  readonly group = new THREE.Group();
  private coins: THREE.InstancedMesh | null = null;
  private gems: THREE.InstancedMesh | null = null;
  private chips: THREE.InstancedMesh | null = null; // spin tokens
  private slots: { mesh: THREE.InstancedMesh; i: number; x: number; y: number; popT: number; gone: boolean }[] = [];
  private t = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();

  setLevel(level: Level): void {
    for (const mesh of [this.coins, this.gems, this.chips]) {
      if (!mesh) continue;
      this.group.remove(mesh);
      mesh.dispose();
    }
    this.slots = [];
    const cash = level.pickups.filter((p) => p.kind === 'cash').length;
    const spins = level.pickups.filter((p) => p.kind === 'spin').length;
    const stoken = level.pickups.length - cash - spins;
    //art/pickups.py: a brilliant-cut gem, colours baked into the vertices
    const gem = flatGeometry('Stoken');
    this.coins = coinMesh(Math.max(1, cash));
    this.gems = new THREE.InstancedMesh(
      gem ?? new THREE.OctahedronGeometry(0.32),
      new THREE.MeshLambertMaterial(gem ? { vertexColors: true, emissive: 0x2a1460 } : { color: 0xb98cff, emissive: 0x4a2a9a }),
      Math.max(1, stoken),
    );
    this.chips = chipMesh(Math.max(1, spins));
    this.coins.count = cash;
    this.gems.count = stoken;
    this.chips.count = spins;
    let c = 0;
    let g = 0;
    let k = 0;
    for (const p of level.pickups) {
      const mesh = p.kind === 'cash' ? this.coins : p.kind === 'spin' ? this.chips : this.gems;
      const i = p.kind === 'cash' ? c++ : p.kind === 'spin' ? k++ : g++;
      this.slots.push({ mesh, i, x: toX(p.x), y: toY(level, p.y), popT: 0, gone: false });
    }
    inkify(this.coins);
    inkify(this.gems);
    inkify(this.chips);
    this.group.add(this.coins, this.gems, this.chips);
    this.update(0);
  }

  // a coin vanishes on the spot (the game bursts it into sparkles, Particles.coin) and its position comes back; a
  // gem pops
  take(index: number): THREE.Vector3 | null {
    const slot = this.slots[index];
    if (!slot) return null;
    if (slot.mesh !== this.coins) {
      slot.popT = POP_SECS;
      return null;
    }
    slot.gone = true;
    this.m.makeScale(0, 0, 0);
    slot.mesh.setMatrixAt(slot.i, this.m);
    slot.mesh.instanceMatrix.needsUpdate = true;
    return new THREE.Vector3(slot.x, slot.y + Math.sin(this.t * 3 + slot.x) * 0.05, COIN_Z);
  }

  update(dt: number): void {
    this.t += dt;
    for (const s of this.slots) {
      if (s.gone) continue;
      let scale = 1;
      let lift = 0;
      if (s.popT > 0) {
        s.popT -= dt;
        const k = 1 - Math.max(0, s.popT) / POP_SECS;
        scale = 1 + k * 0.8;
        lift = k * 0.5;
        if (s.popT <= 0) {
          s.gone = true;
          scale = 0;
        }
      }
      const spin = this.t * 4 + s.x * 0.7;
      this.e.set(0, spin, s.mesh === this.gems ? 0.3 : 0);
      this.q.setFromEuler(this.e);
      this.v.set(s.x, s.y + lift + Math.sin(this.t * 3 + s.x) * 0.05, COIN_Z);
      this.s.setScalar(scale);
      this.m.compose(this.v, this.q, this.s);
      s.mesh.setMatrixAt(s.i, this.m);
    }
    if (this.coins) this.coins.instanceMatrix.needsUpdate = true;
    if (this.gems) this.gems.instanceMatrix.needsUpdate = true;
    if (this.chips) this.chips.instanceMatrix.needsUpdate = true;
  }
}
