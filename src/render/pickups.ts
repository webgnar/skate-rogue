// Cash coins and Stoken particles floating along the floor's lines. Coins spin; collected coins burst into sparkles,
// Stoken particles (stoken-particle.ts) pop and vanish.
import * as THREE from 'three';
import { inkify } from './toon';
import type { Level } from '../physics/level';
import { toX, toY } from './kit';
import { StokenParticles } from './stoken-particle';

const POP_SECS = 0.18;
const COIN_R = 0.2;
const COIN_T = 0.06;
const COIN_Z = 0.25; // pickups float this far toward the camera from the skater's lane

// The Stoken coin from Quest For Stoken's title screen (QFSHIVE sprites/s_stokencoin_mainmenu, frame 0), its emblem
// lines darkened so it reads at coin size, on both faces of the coin.
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

// The coin's reeded edge: gold ridges across its thickness, each a highlight down to a groove, with a darker lip
// where it meets each face. One ridge, tiled round the edge; a DataTexture, so it builds under Node too.
const REEDS = 40;
let coinEdge: THREE.Texture | null = null;
function edgeTexture(): THREE.Texture {
  if (coinEdge) return coinEdge;
  const ridge = [0xffe25a, 0xe6aa14, 0xbe820a, 0x784800];
  const rows = [0.62, 0.9, 1, 1, 0.9, 0.62]; // the lips, then the ridge's face
  const data = new Uint8Array(ridge.length * rows.length * 4);
  rows.forEach((k, y) =>
    ridge.forEach((c, x) => {
      const i = (y * ridge.length + x) * 4;
      data.set([((c >> 16) & 255) * k, ((c >> 8) & 255) * k, (c & 255) * k, 255], i);
    }),
  );
  const tex = (coinEdge = new THREE.DataTexture(data, ridge.length, rows.length));
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(REEDS, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// a reeded gold edge and the Stoken face on both caps, facing the camera (the game spins coins about Y, its vertical)
let coinGeo: THREE.BufferGeometry | null = null;
function coinMesh(count: number): THREE.InstancedMesh {
  if (!coinGeo) {
    coinGeo = new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_T, 40).rotateX(Math.PI / 2);
    //the caps' UVs come out a quarter turn off once the coin is stood up: turn them so the face reads upright, front
    //and back (the edge keeps its own: round the coin, then across it)
    const uv = coinGeo.getAttribute('uv');
    const normal = coinGeo.getAttribute('normal');
    for (let i = 0; i < uv.count; i++) if (Math.abs(normal.getZ(i)) > 0.5) uv.setXY(i, uv.getY(i), 1 - uv.getX(i));
  }
  const geo = coinGeo;
  const face = new THREE.MeshLambertMaterial({ map: coinTexture(), emissive: 0x181000 });
  const edge = new THREE.MeshLambertMaterial({ map: edgeTexture(), emissive: 0x181000 });
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
  private gems: StokenParticles | null = null;
  private chips: THREE.InstancedMesh | null = null; // spin tokens
  private slots: { mesh: THREE.InstancedMesh | null; x: number; y: number; popT: number; gone: boolean }[] = [];
  private t = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly pv = new THREE.Matrix4();
  private readonly frustum = new THREE.Frustum();
  private readonly ball = new THREE.Sphere(new THREE.Vector3(), 1); // a coin, popping and bobbing, with room

  setLevel(level: Level): void {
    for (const mesh of [this.coins, this.chips]) {
      if (!mesh) continue;
      this.group.remove(mesh);
      mesh.dispose();
    }
    if (this.gems) {
      this.group.remove(this.gems.group);
      this.gems.dispose();
    }
    this.slots = [];
    const cash = level.pickups.filter((p) => p.kind === 'cash').length;
    const spins = level.pickups.filter((p) => p.kind === 'spin').length;
    const stoken = level.pickups.length - cash - spins;
    this.coins = coinMesh(Math.max(1, cash));
    this.gems = new StokenParticles(stoken);
    this.chips = chipMesh(Math.max(1, spins));
    this.coins.count = cash;
    this.chips.count = spins;
    for (const p of level.pickups) {
      const mesh = p.kind === 'cash' ? this.coins : p.kind === 'spin' ? this.chips : null; // null: a Stoken particle
      this.slots.push({ mesh, x: toX(p.x), y: toY(level, p.y), popT: 0, gone: false });
    }
    //update culls them along the floor itself: an instanced mesh's bounds are worked out once, from wherever its
    //first instances stood, and would cull coins packed in later
    this.coins.frustumCulled = this.chips.frustumCulled = false;
    inkify(this.coins);
    inkify(this.chips);
    this.group.add(this.coins, this.gems.group, this.chips);
    this.update(0);
  }

  // a coin vanishes on the spot (the game bursts it into sparkles, Particles.coin) and its position comes back; a
  // Stoken particle pops and its position comes back too (for Particles.stoken); a spin chip just pops
  take(index: number): THREE.Vector3 | null {
    const slot = this.slots[index];
    if (!slot) return null;
    if (!slot.mesh) {
      //a Stoken particle pops (swells away) and the game bursts it into blue sparkles (Particles.stoken)
      slot.popT = POP_SECS;
      return new THREE.Vector3(slot.x, slot.y + Math.sin(this.t * 3 + slot.x) * 0.05, COIN_Z);
    }
    if (slot.mesh !== this.coins) {
      slot.popT = POP_SECS;
      return null;
    }
    slot.gone = true; // (update packs the coins still showing; this one's left out from now)
    return new THREE.Vector3(slot.x, slot.y + Math.sin(this.t * 3 + slot.x) * 0.05, COIN_Z);
  }

  // Only the pickups in view are posed and drawn: a floor holds hundreds (act 3's cloud floors 800+ coins), and
  // posing and drawing every one of them, ink hull and all, each frame cost a small phone more than the floor itself
  // (thread "Fix act 3 lag on iPhone 13 mini", 2026-11-08). Each frame the ones in the camera's view are packed into the
  // front of their InstancedMesh and its count (and its ink hull's) cut to them. No camera (tests): all of them.
  update(dt: number, camera?: THREE.PerspectiveCamera): void {
    this.t += dt;
    let frustum: THREE.Frustum | null = null;
    if (camera) {
      camera.updateMatrixWorld();
      this.pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum = this.frustum.setFromProjectionMatrix(this.pv);
    }
    let coins = 0;
    let chips = 0;
    let gems = 0;
    for (const s of this.slots) {
      if (s.gone) continue;
      if (frustum) {
        this.ball.center.set(s.x, s.y, COIN_Z);
        if (!frustum.intersectsSphere(this.ball)) continue;
      }
      let scale = 1;
      let lift = 0;
      if (s.popT > 0) {
        s.popT -= dt;
        const k = 1 - Math.max(0, s.popT) / POP_SECS;
        scale = 1 + k * 0.8;
        lift = k * 0.5;
        if (s.popT <= 0) {
          s.gone = true;
          continue;
        }
      }
      this.v.set(s.x, s.y + lift + Math.sin(this.t * 3 + s.x) * 0.05, COIN_Z);
      if (!s.mesh) {
        this.gems?.place(gems++, this.v, scale, this.t, s.x * 0.7);
        continue;
      }
      const spin = this.t * 4 + s.x * 0.7;
      this.e.set(0, spin, 0);
      this.q.setFromEuler(this.e);
      this.s.setScalar(scale);
      this.m.compose(this.v, this.q, this.s);
      s.mesh.setMatrixAt(s.mesh === this.coins ? coins++ : chips++, this.m);
    }
    this.show(this.coins, coins);
    this.show(this.chips, chips);
    if (this.gems) {
      this.gems.count = gems;
      this.gems.flush();
    }
  }

  // draw the first n instances, and the ink hull with them (it shares the instance matrices: src/render/toon.ts)
  private show(mesh: THREE.InstancedMesh | null, n: number): void {
    if (!mesh) return;
    mesh.count = n;
    mesh.visible = n > 0;
    for (const c of mesh.children) if (c instanceof THREE.InstancedMesh) c.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceMatrix.clearUpdateRanges();
    mesh.instanceMatrix.addUpdateRange(0, n * 16);
  }
}
