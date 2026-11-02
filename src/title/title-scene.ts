// The title screen's own scene (zack 2026-11-02: "it should be its own scene. should introduce the world. start kinda
// high in the sky, paint the atmosphere, birds flying, trash floating by, the ai drone bot crap and cops. eventually
// to the skater"). A city at dusk (city.ts) and what lives in it (life.ts), and Webster on the sidewalk at the bottom,
// spinning his board on one hand. The camera waits high over the towers under the logo; the first tap (which also
// starts the title music) sends it down through the clouds, past the birds, the trash on the wind, the drones and
// the cops, to Webster. A tap on the way down skips to the end.
//
// It draws with the game's renderer onto the game's canvas, in its own THREE.Scene and camera; the run's street is
// built behind it and takes over on SKATE.
import * as THREE from 'three';
import { BASE, BOARD, type Pose } from '../render/poses';
import { SCALE, type SkaterRig } from '../render/skater-rig';
import { setInkLens, setInkResolution } from '../render/toon';
import { buildStreet, DUSK, skyDome } from './city';
import { buildCity } from './grid';
import { buildLife } from './life';

// the camera's way down: where it is and what it looks at, at each stop (tiles; Webster stands at the origin)
export const PATH: { at: [number, number, number]; look: [number, number, number] }[] = [
  { at: [0, 260, 95], look: [12, 215, -420] }, // high over the towers, the sun going down behind them
  { at: [-8, 196, 72], look: [6, 150, -200] }, // into the clouds, the birds wheeling past
  { at: [6, 130, 56], look: [-4, 92, -120] }, // the trash on the wind, the chopper's light below
  { at: [22, 78, 48], look: [26, 6, -150] }, // over an avenue, looking down the canyon: the traffic, the crossings, the drones
  { at: [10, 28, 34], look: [0, 6, -20] }, // swinging round onto Webster's street, the cruiser on its jets over it
  { at: [3, 7, 24], look: [0, 6, -6] }, // dropping to the street
  { at: [3.6, 1.5, 14], look: [3.2, 4.2, 0] }, // down at Webster, looking up at him and the towers over him; he's left of
  // the middle so SKATE can sit off to his right (zack: not on top of him)
];
// the last stop on an upright phone: in closer, so Webster's big in the narrow frame
const TALL_END = { at: [1.0, 1.7, 9.5] as [number, number, number], look: [0, 2.5, 0] as [number, number, number] };
export const DESCENT = 11; // seconds from the sky to Webster

// a smooth step that eases in and out but doesn't stall in the middle
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

const HAND_ARM = 0; // the lead (left, +x) arm twirls the board
const SPIN = 8; // the board's twirl, radians a second (zack's sprite: a turn in 0.75 s)
const BOARD_AT = { x: 0.5, z: 0.08 }; // where the board stands, rig space: at his lead side

export class TitleScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.5, 4000);
  private readonly city = buildCity();
  private readonly street = buildStreet();
  private readonly life = buildLife();
  private readonly curves = [PATH, [...PATH.slice(0, -1), TALL_END]].map((path) => ({
    at: new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p.at)), false, 'centripetal'),
    look: new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p.look)), false, 'centripetal'),
  }));
  private t = 0;
  private k = 0; // how far down, 0 (the sky) to 1 (Webster)
  private going = false;
  private keys: Pose[] = []; // Webster's standing poses, his arm solved to hold the board up
  private spin = 0;
  onArrive: (() => void) | null = null;

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly rig: SkaterRig | null) {
    const s = this.scene;
    s.fog = new THREE.Fog(DUSK.fog, DUSK.fogNear, DUSK.fogFar);
    s.add(skyDome(), this.city.group, this.street.group, this.life.group);
    //the low sun from behind the camera's left, warm, and a purple sky light
    const sun = new THREE.DirectionalLight(0xffd0a0, 2.2);
    sun.position.set(-60, 80, 120);
    s.add(sun, new THREE.HemisphereLight(0xffb0d0, 0x302040, 1.4));
    if (rig) {
      rig.mesh.position.set(0, 0, 0);
      s.add(rig.mesh);
      this.keys = this.standPoses(rig);
    }
    this.place();
  }

  // Webster stood on the sidewalk off his board, from zack's boardspin sprite (2026-11-02): the board stood on its
  // tail at his side, his lead hand resting on the nose, twirling it about its long axis (bottom, edge, grip, edge).
  // A few poses breathing, each with the arm solved (SkaterRig.reach) to the top of the nose
  private standPoses(rig: SkaterRig): Pose[] {
    const stand: Pose = {
      ...BASE,
      yaw: 0.1,
      hipY: 0.84,
      bend: 0.04,
      lean: -0.04,
      head: -0.1,
      nod: 0.05,
      headTilt: -0.06,
      footFOn: 0,
      footBOn: 0,
      footFX: 0.15,
      footFY: 0,
      footFZ: 0.02,
      footBX: -0.15,
      footBY: 0,
      footBZ: -0.02,
      footFTurn: 0.25,
      footBTurn: -0.25,
      //the free (trailing) arm hangs loose, a little out from the side
      armRRaise: 0.35,
      armRFwd: 0.05,
      armRElbow: 0.3,
    };
    return [0, 1, 2, 3].map((i) => {
      const bob = Math.sin((i / 4) * Math.PI * 2);
      const p: Pose = { ...stand, hipY: stand.hipY + bob * 0.006, armRRaise: stand.armRRaise + bob * 0.03 };
      //the board on its tail beside him, nose up: it pitches a quarter turn up about the tail, the tail on the ground
      p.boardPivot = -BOARD.tail;
      p.boardPitch = Math.PI / 2;
      p.boardX = BOARD_AT.x + BOARD.tail;
      p.boardY = -BOARD.deckTop + 0.02;
      p.boardZ = BOARD_AT.z;
      const hand = new THREE.Vector3(BOARD_AT.x - 0.02, BOARD.length + 0.05 + bob * 0.004, BOARD_AT.z);
      Object.assign(p, rig.reach(p, HAND_ARM, hand));
      return p;
    });
  }

  // tap: start down (or, on the way, skip to the bottom)
  go(): void {
    if (!this.going) this.going = true;
    else if (this.k < 1) this.k = 1;
  }

  // stills for checks: hold the camera this far down
  held = false;
  hold(k: number): void {
    this.held = true;
    this.going = true;
    this.k = k;
  }

  get arrived(): boolean {
    return this.k >= 1;
  }

  private place(): void {
    const css = this.renderer.domElement;
    this.camera.aspect = css.clientWidth / Math.max(1, css.clientHeight);
    const e = ease(this.k);
    const tall = this.camera.aspect < 1;
    const path = this.curves[tall ? 1 : 0];
    this.camera.position.copy(path.at.getPoint(e));
    //waiting at the top: a slow drift so the sky isn't a still
    if (!this.going) this.camera.position.x += Math.sin(this.t * 0.25) * 6;
    this.camera.lookAt(path.look.getPoint(e));
    //the lens narrows on the way down: wide over the city, tighter on Webster (wider upright, so the street still fits)
    this.camera.fov = (tall ? 66 : 50) - (tall ? 10 : 8) * e;
  }

  frame(dt: number): void {
    this.t += dt;
    if (this.going && this.k < 1 && !this.held) this.k = Math.min(1, this.k + dt / DESCENT);
    if (this.k >= 1 && this.onArrive) {
      const arrive = this.onArrive;
      this.onArrive = null;
      arrive();
    }
    this.city.update(this.t, dt);
    this.street.update(this.t, dt);
    this.life.update(this.t, dt);
    if (this.rig && this.keys.length) {
      const n = this.keys.length;
      const u = (this.t / 0.6) % n;
      const i = Math.floor(u);
      const f = u - i;
      const a = this.keys[i];
      const b = this.keys[(i + 1) % n];
      const p = { ...a };
      for (const key of Object.keys(a) as (keyof Pose)[]) p[key] = a[key] + (b[key] - a[key]) * f;
      this.rig.preview(p);
      this.spin += dt * SPIN;
      this.rig.boardGroup.rotation.x = this.spin; // about the board's long axis, standing up
      this.rig.mesh.scale.setScalar(SCALE);
    }
    this.place();
    this.render();
  }

  render(): void {
    const r = this.renderer;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    this.camera.updateProjectionMatrix();
    setInkLens(0, 1, 1);
    setInkResolution(size.x, size.y, r.getPixelRatio());
    r.setRenderTarget(null);
    r.clear();
    r.render(this.scene, this.camera);
  }
}
