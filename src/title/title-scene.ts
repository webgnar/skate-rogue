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
import type { Pose } from '../render/poses';
import { danceAt, dancePoses } from './dance';
import { SCALE, type SkaterRig } from '../render/skater-rig';
import { SKATER_HALO, SKATER_INK, PAPER } from '../game/game';
import { glowMaterial, INK, inkify, outlineMaterial, setInkLens, setInkResolution, silhouetteInk } from '../render/toon';
import { buildStreet, DUSK, skyDome } from './city';
import { buildCity } from './grid';
import { BEAT, buildLife, GROOVE } from './life';

// the camera's way down (zack 2026-11-06: "just one smooth motion no weaving through drones"): one glide from high
// over the towers to Webster, on a gentle curve with no swings left or right, the view turning steadily from the
// skyline to Webster while it tips down over the city on the way (tiles; Webster stands at the origin)
type Shot = { at: [number, number, number]; look: [number, number, number] };
const TOP: Shot = { at: [0, 260, 95], look: [12, 215, -420] }; // high over the towers, the sun going down behind them
// down at Webster from across the street, looking up at him, the store and the sky over the roofs; he's left of the
// middle so SKATE can sit off to his right (zack: not on top of him)
const WIDE_END: Shot = { at: [3.6, 1.5, 17], look: [3.2, 5.5, 0] };
// the last stop on an upright phone: in closer, so Webster's big in the narrow frame, looking up past the cat on the
// shop signs and the flag to the sky over the roofs
const TALL_END: Shot = { at: [1.4, 1.2, 12], look: [0.5, 5.2, 0] };
// the curve's pull: it leaves the top falling mostly straight down, and comes in to the street from above and behind
const LEAVE = new THREE.Vector3(0, -110, -12);
const ARRIVE = new THREE.Vector3(0.4, 16, 14);
export const DESCENT = 12; // seconds from the sky to Webster

// a smooth step that eases in and out but doesn't stall in the middle
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const smooth = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
// the camera tips down over the city on the way, then levels back out onto Webster, radians, by how far along it is
const TILT = 0.3;
const tilt = (e: number) => TILT * smooth(0.05, 0.4, e) * (1 - smooth(0.6, 0.97, e));

function glide(end: Shot) {
  const v = (p: [number, number, number]) => new THREE.Vector3(...p);
  const at0 = v(TOP.at);
  const at3 = v(end.at);
  const curve = new THREE.CubicBezierCurve3(at0, at0.clone().add(LEAVE), at3.clone().add(ARRIVE), at3);
  const facing = (s: Shot) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(v(s.at), v(s.look), new THREE.Vector3(0, 1, 0)));
  return { curve, from: facing(TOP), to: facing(end) };
}

export const SPIN = 8; // the board's twirl, radians a second (zack's sprite: a turn in 0.75 s)

export class TitleScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.5, 4000);
  private readonly city = buildCity();
  private readonly street = buildStreet();
  private readonly life = buildLife();
  private readonly glides = [glide(WIDE_END), glide(TALL_END)];
  private t = 0;
  private k = 0; // how far down, 0 (the sky) to 1 (Webster)
  private going = false;
  private keys: Pose[] = []; // Webster's standing poses, his arm solved to hold the board up
  private spin = 0;
  private musicAt = 0;
  onArrive: (() => void) | null = null;
  //his ink as in the game (game.ts): black round the outside of him and of his board, a paper-white halo outside it
  private readonly ink = [glowMaterial(SKATER_INK, INK.color, 0), glowMaterial(SKATER_INK, INK.color, 0)];
  private readonly halo = [glowMaterial(SKATER_INK, PAPER, 0), glowMaterial(SKATER_INK, PAPER, 0)] as [THREE.ShaderMaterial, THREE.ShaderMaterial];

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
      inkify(rig.mesh, { toon: false });
      silhouetteInk(rig.mesh, rig.boardGroup, outlineMaterial(), this.ink[0], this.ink[1], this.halo);
      this.keys = dancePoses(rig);
    }
    this.place();
  }

  // tap: start down (or, on the way, skip to the bottom)
  go(): void {
    if (!this.going) {
      this.going = true;
      this.musicAt = this.t; // the title music starts on this tap: the dancers count their beats from here
    }
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
    const g = this.glides[tall ? 1 : 0];
    this.camera.position.copy(g.curve.getPoint(e));
    //waiting at the top: a slow drift so the sky isn't a still
    if (!this.going) this.camera.position.x += Math.sin(this.t * 0.25) * 6;
    this.camera.quaternion.slerpQuaternions(g.from, g.to, e);
    this.camera.rotateX(-tilt(e));
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
    GROOVE.t = this.t - this.musicAt;
    this.city.update(this.t, dt);
    this.street.update(this.t, dt);
    this.life.update(this.t, dt);
    if (this.rig && this.keys.length) {
      const p = danceAt(this.keys, GROOVE.t / BEAT);
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
    const px = r.getPixelRatio();
    for (const m of this.ink) m.uniforms.uWidth.value = Math.max(1, SKATER_INK * px);
    for (const m of this.halo) m.uniforms.uWidth.value = Math.max(1.5, SKATER_INK * (1 + SKATER_HALO) * px);
    r.setRenderTarget(null);
    r.clear();
    r.render(this.scene, this.camera);
  }
}
