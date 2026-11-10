// The street dice's 3D view (src/ui/dice-panel.ts): real casino dice (zack, 2026-11-04: "transparent red with opaque
// white dots like the casino") thrown with real physics (src/run/dice-physics.ts; zack, 2026-11-10: "actual physics
// ... a 3d ground") onto a patch of night street: asphalt, the curb and the sidewalk along the back, under a sodium
// street lamp that casts the dice's shadows. A perspective camera looks down the street; the patch the dice can land
// on is fitted to what it sees, so a throw never leaves the view in portrait or landscape.
// Before the throw the pair is in your hand, just above the street near you: it follows your finger while you drag,
// and a swipe throws it the way and as hard as you swiped (the panel reads the swipe through hold / drag / release).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Face } from '../run/dice';
import { DicePhysics, FACE_NORMAL, type Bounds } from '../run/dice-physics';

const PIPS: Record<Face, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export const DICE3D = {
  red: 0x8a0410, // the body
  opacity: 0.86,
  pip: 0.092, // pip radius, as a share of the die's size
  pipGap: 0.26, // pip grid spacing, as a share of the die's size
  fov: 38, // the camera's, degrees up and down
  tilt: 56, // how steeply it looks down at the street, degrees (portrait); a wide view looks down more
  tiltWide: 66,
  depth: 5.6, // die sizes of street, curb to near edge, the camera fits at least
  width: 5.4, // and across, at the near edge
  handY: 2.1, // the hand: this high over the street
  handIn: 1.4, // and this far in from the near edge
  swipe: 1.15, // a swipe's speed (die sizes a second, on the hand's plane) times this is the throw
  swipeMs: 90, // the last this-many ms of a swipe set its speed
  curbH: 0.7, // the curb's height, in die sizes
};

// every pip of a die as one mesh, flush with the faces (a hair proud, so the body never covers them)
function pipGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const z = new THREE.Vector3(0, 0, 1);
  for (const f of [1, 2, 3, 4, 5, 6] as Face[]) {
    const n = new THREE.Vector3(...FACE_NORMAL[f]);
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

// a die's body: a sharp-edged cube, like a casino die (and the physics' box)
const bodyGeometry = (): THREE.BufferGeometry => new THREE.BoxGeometry(1, 1, 1);

// noise for the asphalt and the concrete
function speckle(g: CanvasRenderingContext2D, w: number, h: number, n: number, light: string, dark: string, rng: () => number): void {
  for (let i = 0; i < n; i++) {
    g.fillStyle = rng() < 0.5 ? light : dark;
    const s = 1 + rng() * 1.2;
    g.fillRect(rng() * w, rng() * h, s, s);
  }
}

// the asphalt: dark, speckled, mottled, an oil stain and a crack, a faded white line near you
function asphaltTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#222126';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) {
    const x = rng() * 512;
    const y = rng() * 512;
    const r = 30 + rng() * 80;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, rng() < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  speckle(g, 512, 512, 14000, 'rgba(200,195,185,0.22)', 'rgba(0,0,0,0.5)', rng);
  //an oil stain
  const o = g.createRadialGradient(360, 300, 4, 360, 300, 70);
  o.addColorStop(0, 'rgba(10,6,14,0.55)');
  o.addColorStop(1, 'rgba(10,6,14,0)');
  g.fillStyle = o;
  g.beginPath();
  g.ellipse(360, 300, 80, 44, 0.3, 0, Math.PI * 2);
  g.fill();
  //a crack
  g.strokeStyle = 'rgba(0,0,0,0.7)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(60, 120);
  for (let i = 0; i < 9; i++) g.lineTo(60 + i * 22 + rng() * 10, 120 + i * 14 + (rng() - 0.5) * 16);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// concrete: the curb's face and the sidewalk's slabs (joints every so often)
function concreteTexture(joints: boolean): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  let seed = 3;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#a8a397';
  g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, 4000, 'rgba(255,255,250,0.25)', 'rgba(40,36,30,0.25)', rng);
  if (joints) {
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(0, 0, 3, 256);
    g.fillRect(0, 0, 256, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export class Dice3D {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(DICE3D.fov, 1, 0.5, 200);
  private readonly physics: DicePhysics;
  private readonly bodies: THREE.Group[] = [];
  private readonly fronts: THREE.Mesh[] = [];
  private readonly backs: THREE.Mesh[] = [];
  private readonly front: THREE.MeshPhysicalMaterial;
  private readonly back: THREE.MeshPhysicalMaterial;
  private readonly glow: THREE.MeshPhysicalMaterial; // the MATCH's dice: a hotter, brighter red
  private readonly glowBack: THREE.MeshPhysicalMaterial;
  private readonly curb: THREE.Mesh;
  private readonly sidewalk: THREE.Mesh;
  private readonly lamp: THREE.SpotLight;
  private bounds: Bounds = { halfW: 3, back: -3, front: 3 };
  private hand = new THREE.Vector3(0, DICE3D.handY, 2); // where the pair is held
  private rest = new THREE.Vector3(0, DICE3D.handY, 2); // the hand's home, before you drag it
  private dragging = false;
  private trail: { t: number; p: THREE.Vector3 }[] = [];
  private appearAt = -1e9; // when this pair popped out of a chip (they grow in)
  private shake = 0; // how hard the phone's shaking right now (0-1), rattles the dice in the hand
  private raf = 0;
  private last = 0;
  private shown = false; // a pair is on the table (in your hand or thrown)
  private w = 1;
  private h = 1;
  onLand: ((faces: [Face, Face]) => void) | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'dice3d';
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.background = new THREE.Color(0x0a0910);
    this.scene.fog = new THREE.Fog(0x0a0910, 14, 40);
    const body = (color: number, side: THREE.Side, opacity: number) =>
      new THREE.MeshPhysicalMaterial({ color, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity, side, depthWrite: false, envMapIntensity: 0.55 });
    this.front = body(DICE3D.red, THREE.FrontSide, DICE3D.opacity);
    this.back = body(0x3a0005, THREE.BackSide, 0.6);
    this.glow = body(0xc80c18, THREE.FrontSide, DICE3D.opacity);
    this.glow.emissive = new THREE.Color(0x8a1000);
    this.glowBack = body(0x8a0a10, THREE.BackSide, 0.55);

    //the street: asphalt, then the curb and the sidewalk along the back
    const asphalt = asphaltTexture();
    asphalt.repeat.set(12, 12);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.92, metalness: 0 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    const face = concreteTexture(false);
    face.repeat.set(10, 0.5);
    this.curb = new THREE.Mesh(new THREE.BoxGeometry(60, DICE3D.curbH, 0.5), new THREE.MeshStandardMaterial({ map: face, roughness: 0.85, color: 0xc9c4b6 }));
    this.curb.receiveShadow = true;
    const slabs = concreteTexture(true);
    slabs.repeat.set(60 / 3, 30 / 3);
    this.sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ map: slabs, roughness: 0.9, color: 0x9c978a }));
    this.sidewalk.rotation.x = -Math.PI / 2;
    this.sidewalk.receiveShadow = true;
    this.scene.add(ground, this.curb, this.sidewalk);

    //the sodium street lamp, up over the curb and to the left: the dice's shadows
    this.lamp = new THREE.SpotLight(0xffc98a, 300, 40, 0.75, 0.75, 1.6);
    this.lamp.position.set(-3.5, 11, -4);
    this.lamp.castShadow = true;
    this.lamp.shadow.mapSize.set(1024, 1024);
    this.lamp.shadow.bias = -0.0008;
    this.lamp.shadow.radius = 4;
    this.scene.add(this.lamp, this.lamp.target, new THREE.HemisphereLight(0x8a90c0, 0x1a1418, 0.4));

    this.physics = new DicePhysics(this.bounds);
    const bodyGeo = bodyGeometry();
    const pipGeo = pipGeometry();
    const pipMat = new THREE.MeshStandardMaterial({ color: 0xfbfbf6, roughness: 0.45 });
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      const back = new THREE.Mesh(bodyGeo, this.back);
      const front = new THREE.Mesh(bodyGeo, this.front);
      const pips = new THREE.Mesh(pipGeo, pipMat);
      //the pips first (opaque), then the inside, then the outside over both: far pips show through the red
      pips.renderOrder = 0;
      back.renderOrder = 1;
      front.renderOrder = 2;
      front.castShadow = true;
      g.add(pips, back, front);
      g.visible = false;
      this.scene.add(g);
      this.bodies.push(g);
      this.fronts.push(front);
      this.backs.push(back);
    }
  }

  // a fresh pair in your hand. pop: it grows in, out of the chip that bought it
  set(pop = false): void {
    this.physics.shuffle();
    this.hand.copy(this.rest);
    this.physics.hold(this.hand);
    this.dragging = false;
    this.glowing(false);
    this.shown = true;
    for (const b of this.bodies) b.visible = true;
    this.appearAt = pop ? performance.now() : -1e9;
    this.start();
  }

  // no dice on the table (a chip on its way)
  clear(): void {
    this.shown = false;
    for (const b of this.bodies) b.visible = false;
    this.start();
  }

  // the MATCH: the dice glow a hotter red
  glowing(on: boolean): void {
    this.fronts.forEach((m) => (m.material = on ? this.glow : this.front));
    this.backs.forEach((m) => (m.material = on ? this.glowBack : this.back));
    this.wake();
  }

  get thrown(): boolean {
    return this.physics.thrown;
  }

  // a finger (or the mouse) on the street, at x, y in the canvas's CSS pixels: the pair goes under it
  hold(x: number, y: number, now: number): void {
    if (this.physics.thrown) return;
    this.dragging = true;
    this.trail = [];
    this.drag(x, y, now);
  }

  drag(x: number, y: number, now: number): void {
    if (!this.dragging) return;
    const p = this.onHandPlane(x, y);
    if (!p) return;
    const b = this.bounds;
    p.x = Math.max(-b.halfW + 1.1, Math.min(b.halfW - 1.1, p.x));
    p.z = Math.max(b.back + 1, Math.min(b.front - 0.4, p.z));
    this.hand.copy(p);
    this.trail.push({ t: now, p });
    while (this.trail.length > 2 && now - this.trail[0].t > DICE3D.swipeMs * 2) this.trail.shift();
  }

  // the finger lifts: a swipe throws the pair the way it went (true); a finger that barely moved throws nothing (false:
  // it was a tap, the panel tosses them)
  release(now: number): boolean {
    if (!this.dragging) return false;
    this.dragging = false;
    const recent = this.trail.filter((s) => now - s.t <= DICE3D.swipeMs);
    const from = recent.length > 1 ? recent[0] : this.trail[Math.max(0, this.trail.length - 2)];
    const to = this.trail[this.trail.length - 1];
    if (!from || !to || to.t - from.t < 8) return false;
    const dt = (to.t - from.t) / 1000;
    const v = to.p.clone().sub(from.p).divideScalar(dt).multiplyScalar(DICE3D.swipe);
    if (Math.hypot(v.x, v.z) < 3) return false;
    this.physics.throw({ x: v.x, y: 0, z: v.z });
    return true;
  }

  // a toss without a swipe (a tap, the ROLL button, a key, a shake): straight up the street, a little to one side.
  // power: 1 a normal toss, more for a hard shake
  toss(power = 1): void {
    if (this.physics.thrown) return;
    this.dragging = false;
    const s = 15 * power;
    this.physics.throw({ x: (Math.random() - 0.5) * s * 0.5, y: 0, z: -s });
  }

  // run the throw to the end now (a tap while they tumble, reduce motion)
  finish(): void {
    if (!this.physics.thrown || this.physics.landed) return;
    this.landed(this.physics.finish());
  }

  // the phone's shaking (0-1): the dice rattle in the hand
  rattle(amount: number): void {
    this.shake = Math.max(this.shake, Math.min(1, amount));
    if (!this.physics.thrown) this.physics.turn(amount * 1.6);
  }

  // where your hand is, in the canvas's CSS pixels (a chip flies there to become the next pair)
  handOnScreen(): { x: number; y: number } {
    const p = this.rest.clone().project(this.camera);
    return { x: ((p.x + 1) / 2) * this.w, y: ((1 - p.y) / 2) * this.h };
  }

  layout(w: number, h: number): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    const cam = this.camera;
    cam.aspect = this.w / this.h;
    const tilt = THREE.MathUtils.degToRad(cam.aspect > 1.5 ? DICE3D.tiltWide : DICE3D.tilt);
    //back the camera off until it sees enough street, deep and wide
    let fit = this.see(tilt, 4);
    for (let d = 4; d < 60; d += 0.25) {
      fit = this.see(tilt, d);
      if (fit.near - fit.far >= DICE3D.depth + 1.4 && fit.halfW >= DICE3D.width / 2 + 0.2) break;
    }
    //the curb a little in from the top of the view, so the sidewalk shows behind it
    const back = fit.far + Math.min(2.2, (fit.near - fit.far) * 0.2);
    this.bounds = { halfW: fit.halfW - 0.15, back, front: fit.near - 0.15 };
    this.physics.fit(this.bounds);
    this.curb.position.set(0, DICE3D.curbH / 2, back - 0.25);
    this.sidewalk.position.set(0, DICE3D.curbH, back - 0.5 - 15);
    this.lamp.target.position.set(0, 0, (back + fit.near) / 2);
    this.rest.set(0, DICE3D.handY, fit.near - DICE3D.handIn);
    if (!this.physics.thrown && !this.dragging) {
      this.hand.copy(this.rest);
      this.physics.hold(this.hand);
    }
    this.start();
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  // the camera at tilt, d from the middle of the street: how much ground it sees (near and far z, and the half width at
  // the near edge, where the view's narrowest)
  private see(tilt: number, d: number): { near: number; far: number; halfW: number } {
    const cam = this.camera;
    cam.position.set(0, Math.sin(tilt) * d, Math.cos(tilt) * d);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    const hit = (nx: number, ny: number) => {
      const r = new THREE.Vector3(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize();
      const t = r.y < -1e-3 ? -cam.position.y / r.y : 1e3;
      return cam.position.clone().addScaledVector(r, t);
    };
    //a die stands 1 tall: the near edge is where a die's top still shows, not just its foot
    const nearL = hit(-1, -1);
    const far = hit(0, 1);
    return { near: nearL.z - 0.5, far: far.z + 0.2, halfW: Math.abs(nearL.x) - 0.55 };
  }

  // the point on the hand's plane under x, y on the canvas
  private onHandPlane(x: number, y: number): THREE.Vector3 | null {
    const nx = (x / this.w) * 2 - 1;
    const ny = 1 - (y / this.h) * 2;
    const cam = this.camera;
    const r = new THREE.Vector3(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize();
    if (Math.abs(r.y) < 1e-3) return null;
    const t = (DICE3D.handY - cam.position.y) / r.y;
    return t > 0 ? cam.position.clone().addScaledVector(r, t) : null;
  }

  private landed(faces: [Face, Face]): void {
    this.onLand?.(faces);
  }

  private start(): void {
    this.idleSince = 0;
    if (this.raf) return;
    this.last = performance.now();
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this.draw(performance.now());
    };
    this.raf = requestAnimationFrame(tick);
  }

  private draw(now: number): void {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const shake = this.shake;
    this.shake *= 0.86;
    const p = this.physics;
    if (!p.thrown) {
      //in the hand: a little wobble, a lot more while the phone shakes
      p.hold(this.hand, 0.06 + shake * 0.6, now);
      if (!this.dragging) p.turn(0.01 + shake * 0.5);
    } else if (!p.landed) {
      const faces = p.advance(dt);
      if (faces) this.landed(faces);
    }
    //out of the chip: a quick overshooting grow
    const g = Math.min(1, (now - this.appearAt) / 260);
    const grow = g >= 1 ? 1 : Math.max(0.01, 1 + 2.2 * (g - 1) ** 3 + 1.2 * (g - 1) ** 2);
    p.dice.forEach((d, i) => {
      const b = this.bodies[i];
      b.position.set(d.position.x, d.position.y, d.position.z);
      b.quaternion.set(d.quaternion.x, d.quaternion.y, d.quaternion.z, d.quaternion.w);
      b.scale.setScalar(grow);
    });
    this.renderer.render(this.scene, this.camera);
    //nothing moving: stop drawing until something changes
    if (!this.shown || p.landed) this.stopSoon(now);
    else this.idleSince = 0;
  }

  private idleSince = 0;
  private stopSoon(now: number): void {
    if (!this.idleSince) this.idleSince = now;
    if (now - this.idleSince > 400) {
      this.idleSince = 0;
      this.stop();
    }
  }

  // the pair on the table moved or changed: draw again
  wake(): void {
    this.idleSince = 0;
    this.start();
  }
}
