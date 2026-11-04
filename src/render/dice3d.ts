// Real 3D casino dice for the end-of-run street dice (src/ui/dice-panel.ts; zack, 2026-11-04: "3d dice ...
// transparent red with opaque white dots like the casino"). Sharp-edged see-through red bodies with flush white
// pips (the far side's pips show through the body, like real casino dice), lit by a room environment for the gloss.
// One small WebGL canvas over the dice screen, made the first time it's needed and kept; it only draws while the
// screen is up. The camera is orthographic in CSS pixels, so a die is placed on its HTML slot's centre and sized to it.
// Height is faked for the throw: a die in the air rides up the screen, grows a little, and its shadow fades.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Face } from '../run/dice';

// which face of the cube shows which number (opposite faces add up to 7)
const NORMAL: Record<Face, THREE.Vector3> = {
  1: new THREE.Vector3(0, 1, 0),
  6: new THREE.Vector3(0, -1, 0),
  2: new THREE.Vector3(1, 0, 0),
  5: new THREE.Vector3(-1, 0, 0),
  3: new THREE.Vector3(0, 0, 1),
  4: new THREE.Vector3(0, 0, -1),
};
// which of a 3x3 grid's spots hold a pip, per face
const PIPS: Record<Face, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export const DICE3D = {
  red: 0x8a0410, // the body
  opacity: 0.86,
  pip: 0.092, // pip radius, as a share of the die's size
  pipGap: 0.26, // pip grid spacing, as a share of the die's size
  view: new THREE.Vector3(0.14, -0.22, 1).normalize(), // where the result face points when it lands: at you, tipped so the top and a side show
  spins: 3.5, // whole turns a die tumbles through on the way in
  hop: 0.9, // the throw's first arc, in die sizes
};

export interface DieSlot {
  x: number; // centre, in CSS pixels from the canvas's top left
  y: number;
  size: number;
}

interface Die {
  body: THREE.Group;
  shadow: THREE.Mesh;
  slot: DieSlot;
  from: { x: number; y: number }; // the hand: where it's thrown from
  start: THREE.Quaternion; // how it sits in the hand
  end: THREE.Quaternion; // how it lands: the result facing you
  axis: THREE.Vector3; // what it tumbles around
  turns: number;
  land: number; // ms after the throw it lands
  seed: number;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

// every pip of a die as one mesh, flush with the faces (a hair proud, so the body never covers them)
function pipGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const z = new THREE.Vector3(0, 0, 1);
  for (const f of [1, 2, 3, 4, 5, 6] as Face[]) {
    const n = NORMAL[f];
    const t = Math.abs(n.y) > 0.5 ? new THREE.Vector3(1, 0, 0) : Math.abs(n.x) > 0.5 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const b = new THREE.Vector3().crossVectors(n, t);
    const q = new THREE.Quaternion().setFromUnitVectors(z, n);
    for (const i of PIPS[f]) {
      const u = (i % 3) - 1;
      const v = 1 - Math.floor(i / 3);
      const g = new THREE.CircleGeometry(DICE3D.pip, 20);
      g.applyQuaternion(q);
      const at = n.clone().multiplyScalar(0.5015).addScaledVector(t, u * DICE3D.pipGap).addScaledVector(b, v * DICE3D.pipGap);
      g.translate(at.x, at.y, at.z);
      parts.push(g);
    }
  }
  return mergeGeometries(parts)!;
}

// a soft round shadow for the ground under a die
function shadowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// the rotation that lands face f pointing along the view, turned a little about it
export function restingQuat(f: Face, twist: number): THREE.Quaternion {
  const q = new THREE.Quaternion().setFromUnitVectors(NORMAL[f], DICE3D.view);
  return new THREE.Quaternion().setFromAxisAngle(DICE3D.view, twist).multiply(q);
}

export class Dice3D {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(0, 1, 0, -1, -2000, 2000);
  private readonly bodyGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.045);
  private readonly pipGeo = pipGeometry();
  private readonly shadowGeo = new THREE.PlaneGeometry(1, 1);
  private readonly front: THREE.MeshPhysicalMaterial;
  private readonly back: THREE.MeshPhysicalMaterial;
  private readonly glow: THREE.MeshPhysicalMaterial; // the MATCH's dice: a hotter, brighter red
  private readonly glowBack: THREE.MeshPhysicalMaterial;
  private readonly pipMat = new THREE.MeshStandardMaterial({ color: 0xfbfbf6, roughness: 0.45 });
  private readonly shadowMat: THREE.MeshBasicMaterial;
  private dice: Die[] = [];
  private thrownAt = -1; // performance.now() of the throw; -1 still in the hand
  private shake = 0; // how hard the phone's shaking right now (0-1), rattles the dice in the hand
  private raf = 0;
  private w = 1;
  private h = 1;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'dice3d';
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const body = (color: number, side: THREE.Side, opacity: number) =>
      new THREE.MeshPhysicalMaterial({ color, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity, side, depthWrite: false, envMapIntensity: 0.55 });
    this.front = body(DICE3D.red, THREE.FrontSide, DICE3D.opacity);
    this.back = body(0x3a0005, THREE.BackSide, 0.6);
    this.glow = body(0xc80c18, THREE.FrontSide, DICE3D.opacity);
    this.glow.emissive = new THREE.Color(0x8a1000);
    this.glowBack = body(0x8a0a10, THREE.BackSide, 0.55);
    this.shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false });
    const key = new THREE.DirectionalLight(0xfff0d8, 1.2); // the street lamp, up and to the left
    key.position.set(-0.5, 1, 0.8);
    this.scene.add(key, new THREE.AmbientLight(0xffffff, 0.15));
  }

  // the dice for these results (two per roll); they sit in the hand until thrown. hand: where the hand is
  set(results: Face[], slots: DieSlot[], hand: { x: number; y: number }, lands: number[], match: boolean[]): void {
    for (const d of this.dice) this.scene.remove(d.body, d.shadow);
    this.dice = results.map((f, i) => {
      const seed = Math.random();
      const big = match[i];
      const body = new THREE.Group();
      const back = new THREE.Mesh(this.bodyGeo, big ? this.glowBack : this.back);
      const front = new THREE.Mesh(this.bodyGeo, big ? this.glow : this.front);
      const pips = new THREE.Mesh(this.pipGeo, this.pipMat);
      //the pips first (opaque), then the inside, then the outside over both: far pips show through the red
      pips.renderOrder = 0;
      back.renderOrder = 1;
      front.renderOrder = 2;
      body.add(pips, back, front);
      const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
      shadow.renderOrder = -1;
      this.scene.add(shadow, body);
      const n = results.length;
      const spread = Math.min(1, n / 2) * slots[i].size * 0.7;
      const twist = (seed - 0.5) * 0.5;
      return {
        body,
        shadow,
        slot: slots[i],
        from: { x: hand.x + (i % 2 ? spread : -spread) * 0.6 + (Math.floor(i / 2) - (n / 2 - 1) / 2) * 8, y: hand.y + (i % 2) * 6 },
        start: new THREE.Quaternion().setFromEuler(new THREE.Euler(seed * 6, seed * 11, seed * 3)),
        end: restingQuat(f, twist),
        axis: new THREE.Vector3(0.4 + seed, 1, 0.3 - seed).normalize(),
        turns: DICE3D.spins + seed,
        land: lands[i],
        seed,
      };
    });
    this.thrownAt = -1;
    this.start();
  }

  // the dice leave the hand
  throwNow(): void {
    this.thrownAt = performance.now();
  }

  // every die on its result now
  finish(): void {
    this.thrownAt = performance.now() - 1e6;
  }

  // the phone's shaking (0-1): the dice rattle in the hand
  rattle(amount: number): void {
    this.shake = Math.max(this.shake, Math.min(1, amount));
  }

  layout(w: number, h: number, slots: DieSlot[], hand: { x: number; y: number }): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.left = 0;
    this.camera.right = this.w;
    this.camera.top = 0;
    this.camera.bottom = -this.h;
    this.camera.updateProjectionMatrix();
    this.dice.forEach((d, i) => {
      if (slots[i]) d.slot = slots[i];
      const n = this.dice.length;
      d.from = { x: hand.x + (i % 2 ? 1 : -1) * d.slot.size * 0.45 + (Math.floor(i / 2) - (n / 2 - 1) / 2) * 10, y: hand.y + (i % 2) * 6 };
    });
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private start(): void {
    if (this.raf) return;
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this.draw(performance.now());
    };
    this.raf = requestAnimationFrame(tick);
  }

  // where every die is at this moment
  private draw(now: number): void {
    const t0 = this.thrownAt;
    const shake = this.shake;
    this.shake *= 0.86;
    const spin = new THREE.Quaternion();
    for (const d of this.dice) {
      const s = d.slot.size;
      let x: number;
      let y: number;
      let lift = 0; // height above the ground, in die sizes
      const q = new THREE.Quaternion();
      if (t0 < 0) {
        //in the hand: a little wobble, a lot more while the phone shakes
        const k = 0.06 + shake * 0.5;
        const a = now / 90 + d.seed * 10;
        x = d.from.x + Math.sin(a * 1.3) * s * k * 0.5;
        y = d.from.y + Math.cos(a * 1.7) * s * k * 0.4;
        lift = 0.15 + shake * 0.3;
        q.copy(d.start).multiply(spin.setFromAxisAngle(d.axis, Math.sin(a) * (0.08 + shake * 1.4)));
      } else {
        const t = Math.min(1, (now - t0) / d.land);
        const e = easeOut(t);
        x = d.from.x + (d.slot.x - d.from.x) * e;
        y = d.from.y + (d.slot.y - d.from.y) * e;
        //a big arc, then two small bounces
        if (t < 0.6) lift = Math.sin((t / 0.6) * Math.PI) * DICE3D.hop * (1 + d.seed * 0.3);
        else if (t < 0.85) lift = Math.sin(((t - 0.6) / 0.25) * Math.PI) * 0.22;
        else lift = Math.sin(((t - 0.85) / 0.15) * Math.PI) * 0.05;
        //tumbling, slowing to a stop on its result
        q.copy(d.end).multiply(spin.setFromAxisAngle(d.axis, d.turns * Math.PI * 2 * (1 - easeOut(Math.min(1, t * 1.08)))));
      }
      const scale = s * (0.8 + lift * 0.18);
      d.body.position.set(x, -(y - lift * s * 0.9), 0);
      d.body.quaternion.copy(q);
      d.body.scale.setScalar(scale);
      d.shadow.position.set(x + s * 0.08, -(y + s * 0.42), -s * 2);
      d.shadow.scale.set(s * (1.25 - lift * 0.2), s * 0.42, 1);
      (d.shadow.material as THREE.MeshBasicMaterial).opacity = 1;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
