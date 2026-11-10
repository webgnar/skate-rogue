// Act 5's bail (zack, 2026-11-10: "i think falling from this level should count as like a bail... we could make a new
// scene with a spherical earth below him. camera could show him falling down to that and fades out"). Off the station
// line and out into space (src/sim/floor.ts offStation): the rider tumbles away, arms out, the board spinning off on
// its own, down toward the whole round Earth below; the camera holds above and watches them go, then it fades to black
// and the continue card comes up. A few seconds; a tap skips it.
import * as THREE from 'three';
import { BASE, type Pose } from '../render/poses';
import { SCALE, type SkaterRig } from '../render/skater-rig';
import { inkify, setInkLens, setInkResolution } from '../render/toon';
import { earth } from '../ship/hub-scene';
import { makeRng } from '../gen/rng';

export const SPACE_FALL = {
  len: 3.8, // seconds, then the card
  fadeFrom: 2.7, // seconds: the fade to black starts
  fall: 2.2, // world units a second down, at the start
  pull: 4.5, // and the pull of Earth, units a second a second
  drift: 1.4, // units a second along, the way they were skating
  tumble: 2.4, // radians a second, head over heels
  earthR: 220, // Earth's radius, world units (the ship hub's)
  earthDown: 95, // how far under the rider its top is
};

const smooth = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// flailing: arms thrown up and out, feet off the deck, the board drifting away under them
const FLAIL: Pose = {
  ...BASE,
  armLRaise: 2.5, armLFwd: 0.3, armLElbow: 0.5,
  armRRaise: 2.2, armRFwd: -0.3, armRElbow: 0.7,
  footFOn: 0, footBOn: 0, footFY: 0.25, footBY: 0.1,
  bend: -0.2, nod: 0.5, head: 0.3,
};

export class SpaceFallScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 4000);
  private readonly holder = new THREE.Group();
  private readonly fade: THREE.MeshBasicMaterial;
  private readonly planet: THREE.Group;
  private t = 0;
  private done = false;
  private held = false;
  onDone: (() => void) | null = null;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly rider: SkaterRig,
    private readonly inkWidths: () => void,
  ) {
    const s = this.scene;
    s.background = new THREE.Color(0x05040c);
    s.add(stars());
    //the whole round Earth, under them, turning slowly, its air glowing round the rim
    this.planet = earth();
    this.planet.position.set(-40, -SPACE_FALL.earthDown - SPACE_FALL.earthR, -60);
    inkify(this.planet);
    s.add(this.planet);
    const sun = new THREE.DirectionalLight(0xfff0dc, 2.2);
    sun.position.set(60, 40, 80);
    s.add(sun, new THREE.HemisphereLight(0x9fd0ff, 0x1a1830, 1.2));
    this.holder.add(rider.mesh);
    rider.mesh.position.set(0, 0, 0);
    s.add(this.holder);
    //the fade: a black sheet just in front of the lens
    this.fade = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), this.fade);
    sheet.position.z = -0.2;
    sheet.renderOrder = 1000;
    sheet.frustumCulled = false;
    this.camera.add(sheet);
    s.add(this.camera);
  }

  // a tap skips it
  tap(): void {
    this.finish();
  }

  // stills for checks: jump to a moment and hold there
  seek(t: number): void {
    this.t = Math.max(0, t);
    this.held = true;
  }

  frame(dt: number): void {
    if (this.done) return;
    if (!this.held) this.t += dt;
    const t = this.t;
    if (t >= SPACE_FALL.len) return this.finish();
    const F = SPACE_FALL;
    //falling away, faster and faster, drifting on the way they were going, tumbling head over heels
    const y = -(F.fall * t + 0.5 * F.pull * t * t);
    const x = F.drift * t;
    const pose: Pose = { ...FLAIL, boardY: 0.2 + 0.6 * t, boardRoll: -3.1 * t, boardYaw: 0.8 * t, boardX: 0.3 * t, tumble: 0 };
    this.rider.preview(pose);
    this.rider.mesh.scale.setScalar(SCALE);
    this.holder.position.set(x, y, 0);
    this.holder.rotation.set(0.4 * t, 0.6 + 0.3 * t, -F.tumble * t);
    this.planet.rotation.y += dt * 0.03;
    //the camera: close beside them as they go, then it holds up there and lets them fall away toward Earth
    const css = this.renderer.domElement;
    this.camera.aspect = css.clientWidth / Math.max(1, css.clientHeight);
    const tall = this.camera.aspect < 1;
    const back = smooth(0.2, 2.2, t);
    const near = new THREE.Vector3(x + 1.5, y + 1.6, 7);
    const far = new THREE.Vector3(5, 6, tall ? 26 : 20);
    this.camera.position.copy(near.lerp(far, back));
    const look = new THREE.Vector3(x, y + 0.8, 0).lerp(new THREE.Vector3(x * 0.6, y - 8, -10), smooth(1.2, 3.4, t));
    this.camera.lookAt(look);
    this.camera.fov = tall ? 72 : 50;
    this.camera.updateProjectionMatrix();
    this.fade.opacity = smooth(F.fadeFrom, F.len - 0.1, t);
    this.draw();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.rider.mesh.removeFromParent();
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }

  private draw(): void {
    const r = this.renderer;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    setInkLens(0, 1, 1);
    setInkResolution(size.x, size.y, r.getPixelRatio());
    this.inkWidths();
    r.setRenderTarget(null);
    r.clear();
    r.render(this.scene, this.camera);
  }
}

// the stars all round, a few of them bright
function stars(): THREE.Points {
  const rng = makeRng(17);
  const n = 1400;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rng() * 2 - 1;
    const a = rng() * Math.PI * 2;
    const r = 1500;
    const k = Math.sqrt(1 - u * u);
    pos.set([r * k * Math.cos(a), r * u, r * k * Math.sin(a)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false }));
}
