// The act breaks (GDD: Cutscenes, "The act breaks"): after each act's escape, the first time you clear it, a short
// scene before the next act. Each is two beats, you rise and the AI answers with its next hunter, played by the
// skater you ride (their own model) in the game's own kit: the title's city, the cloud sky, the chasers. The skater
// talks in comic speech bubbles; the AI in red capitals. A first tap shows SKIP; a tap on it skips.
//
//  1 to 2  "Okay. Higher."    the cruisers jammed after the roadblock, the fire escape up, the chopper's spotlight
//  2 to 3  "STOKE DETECTED"    a 50-50 on a power line, the sparks hit a substation, the billboards, the drones
//  3 to 4  "No further."       up through the clouds into the stars, a blimp, the gunships' lights blink on
//  4 to 5  "...Whoa."          off the last blimp into space, a slow flip, the rocket launches from the city
import * as THREE from 'three';
import { BASE, CLIPS, sample, type Pose } from '../render/poses';
import { SCALE, type SkaterRig } from '../render/skater-rig';
import { makeDrone } from '../render/drone-view';
import { makeParkedCruiser } from '../render/kit';
import { makeRocket } from '../render/chaser-view';
import { makeGunship } from '../render/car-damage';
import { inkify, setInkLens, setInkResolution } from '../render/toon';
import { DUSK } from '../title/city';
import { clouds as cloudSea, skyMaterial, stars as starField } from '../ship/ending-scene';
import { saucer } from '../ship/saucer';
import {
  billboard, blimp, chopper, cityStage, cloudLayer, earth, ESCAPE, glowSprite, pylon, ROOF_Y, silo, sleepwalker, Sparks,
  substation, wire,
} from './props';

export type ActBreak = 1 | 2 | 3 | 4;
export const isActBreak = (n: number): n is ActBreak => n === 1 || n === 2 || n === 3 || n === 4;

// how long each runs, seconds (the storyboards' timings)
export const ACT_BREAK_LEN: Record<ActBreak, number> = { 1: 20.5, 2: 17, 3: 16, 4: 17 };
export const SKIP_SHOWN = 2.5; // seconds the SKIP button stays up after a tap

export interface CutsceneUi {
  // a speech bubble pointing at a screen point (css px); '' hides it
  say(text: string, at: { x: number; y: number } | null): void;
  // the AI's red capitals across the top; '' hides them
  ai(text: string): void;
  // the SKIP button
  skip(show: boolean): void;
  // a white flash over everything, 0 to 1
  flash(k: number): void;
}

// a line of dialogue: who says it (a key into the scene's speakers), when, and what
type Line = { from: number; to: number; who: string; text: string };
export const LINES: Record<ActBreak, Line[]> = {
  1: [
    { from: 0.5, to: 3, who: 'cop', text: 'Subject is non-compliant. Subject is... smiling?' },
    { from: 3.6, to: 5.8, who: 'skater', text: 'Yeah, no.' },
    { from: 10.8, to: 13, who: 'skater', text: "They can't drive up here. Okay. Higher." },
    { from: 13.6, to: 15.8, who: 'ai', text: 'STAY WHERE YOU ARE. YOU ARE SAFE.' },
    { from: 15.9, to: 17, who: 'skater', text: 'Nope.' },
  ],
  2: [
    { from: 4, to: 7, who: 'skater', text: "Don't look down. Don't look down." },
    { from: 9.8, to: 13, who: 'ai', text: 'STOKE DETECTED. RAISING RESPONSE.' },
    { from: 14.6, to: 17, who: 'skater', text: 'Oh, come on.' },
  ],
  3: [
    { from: 6.8, to: 9, who: 'skater', text: '...Quiet up here.' },
    { from: 10.2, to: 13, who: 'ai', text: 'CEILING HOLDING. NO FURTHER.' },
    { from: 13.6, to: 16, who: 'skater', text: "Every ceiling's got a gap." },
  ],
  4: [
    { from: 4.4, to: 7, who: 'skater', text: '...Whoa.' },
    { from: 9.8, to: 13, who: 'ai', text: 'FINAL MEASURE.' },
    { from: 15.2, to: 17, who: 'skater', text: 'Almost there.' },
  ],
};

const smooth = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const clipAt = (name: string, t: number): Pose => sample(CLIPS[name] ?? CLIPS.ride, t);

// poses the clips don't have
const SIT: Pose = { ...BASE, hipY: 0.42, bend: 0.35, nod: -0.25, head: 0.9, footFX: 0.32, footBX: -0.05, kneeFZ: 0.3, kneeBZ: 0.3, armLRaise: 0.35, armRRaise: 0.4, armLFwd: 0.9, armRFwd: 0.8, armLElbow: 1.2, armRElbow: 1.1 };
const LOOK_BACK: Pose = { ...BASE, ...CLIPS.idle.keys[0].pose, head: 1.25, nod: -0.05, yaw: 0.6 };
const LOOK_UP: Pose = { ...BASE, ...CLIPS.idle.keys[0].pose, nod: -0.7, head: 0.9 };
const FLOAT: Pose = { ...BASE, hipY: 1.0, bend: 0.05, nod: -0.2, head: 0.8, armLRaise: 1.6, armRRaise: 1.5, armLElbow: 0.5, armRElbow: 0.6, armLFwd: 0.3, armRFwd: -0.2 };

export class ActBreakScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.3, 6000);
  readonly len: number;
  private readonly holder = new THREE.Group(); // the rider rides in this (preview resets the rig's own rotation)
  private readonly speakers = new Map<string, () => THREE.Vector3>();
  private readonly play: (t: number, dt: number) => void;
  private t = 0;
  private done = false;
  private skipFor = 0;
  private said = '';
  private aiSaid = '';
  onDone: (() => void) | null = null;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly rider: SkaterRig,
    private readonly inkWidths: () => void,
    readonly act: ActBreak,
    private readonly ui: CutsceneUi,
  ) {
    this.len = ACT_BREAK_LEN[act];
    this.holder.add(rider.mesh);
    rider.mesh.position.set(0, 0, 0);
    this.scene.add(this.holder);
    this.speakers.set('skater', () => {
      this.holder.updateMatrixWorld(true);
      return rider.mesh.localToWorld(rider.headAt()).add(V(0, 0.5, 0));
    });
    const sun = new THREE.DirectionalLight(0xffd0a0, 2.2);
    sun.position.set(-60, 80, 120);
    this.scene.add(sun, new THREE.HemisphereLight(0xffb0d0, 0x302040, 1.4));
    this.play = [this.act1, this.act2, this.act3, this.act4][act - 1].call(this);
  }

  // a tap: the first shows SKIP, a tap while it's up skips
  tap(): void {
    if (this.skipFor > 0) return this.finish();
    this.skipFor = SKIP_SHOWN;
    this.ui.skip(true);
  }

  get time(): number {
    return this.t;
  }

  // stills for checks: jump to a moment and hold there
  private held = false;
  seek(t: number): void {
    this.t = Math.max(0, t);
    this.held = true;
  }

  frame(dt: number): void {
    if (this.done) return;
    if (!this.held) this.t += dt;
    if (this.skipFor > 0) {
      this.skipFor -= dt;
      if (this.skipFor <= 0) this.ui.skip(false);
    }
    if (this.t >= this.len) return this.finish();
    this.aspect();
    this.play(this.t, dt);
    this.camera.updateMatrixWorld(true);
    this.lines();
    this.draw();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.ui.say('', null);
    this.ui.ai('');
    this.ui.skip(false);
    this.ui.flash(0);
    this.rider.mesh.removeFromParent();
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }

  // the lines up now: the AI's across the top, anyone else's in a bubble at their head
  private lines(): void {
    const now = LINES[this.act].filter((l) => this.t >= l.from && this.t < l.to);
    const ai = now.find((l) => l.who === 'ai');
    if ((ai?.text ?? '') !== this.aiSaid) {
      this.aiSaid = ai?.text ?? '';
      this.ui.ai(this.aiSaid);
    }
    const line = now.find((l) => l.who !== 'ai');
    const where = line ? this.speakers.get(line.who)?.() : undefined;
    if (!line || !where) {
      if (this.said) this.ui.say('', null);
      this.said = '';
      return;
    }
    const p = where.clone().project(this.camera);
    const css = this.renderer.domElement;
    const at = p.z < 1 ? { x: ((p.x + 1) / 2) * css.clientWidth, y: ((1 - p.y) / 2) * css.clientHeight } : null;
    this.said = line.text;
    this.ui.say(line.text, at);
  }

  private tall = false;
  private aspect(): void {
    const css = this.renderer.domElement;
    this.camera.aspect = css.clientWidth / Math.max(1, css.clientHeight);
    this.tall = this.camera.aspect < 1;
  }

  // the camera: from `at` looking at `look`, the lens wider on an upright phone (and pulled back a little)
  private shot(at: THREE.Vector3, look: THREE.Vector3, fov = 50): void {
    const pull = this.tall ? 1.25 : 1;
    //pulled back level, so a low camera never sinks under the street
    const back = at.clone().sub(look).multiplyScalar(pull);
    this.camera.position.set(look.x + back.x, at.y, look.z + back.z);
    this.camera.fov = this.tall ? Math.min(85, fov * 1.35) : fov;
    this.camera.lookAt(look);
    this.camera.updateProjectionMatrix();
  }

  // the rider at `p`, turned `yaw` (0 rolls toward +x, the camera's side +z), in `pose`
  private ride(p: THREE.Vector3, yaw: number, pose: Pose, roll = 0): void {
    this.rider.preview(pose);
    this.rider.mesh.scale.setScalar(SCALE);
    this.holder.position.copy(p);
    this.holder.rotation.set(0, yaw, roll);
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

  // ---- stages ----

  private city(): ReturnType<typeof cityStage> {
    const c = cityStage();
    this.scene.add(c.group);
    return c;
  }

  // the sky above the clouds (the ending's): `space` 0 is day blue, 1 the black of space
  private sky(): { group: THREE.Group; set(space: number): void } {
    const group = new THREE.Group();
    const mat = skyMaterial();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 16), mat);
    dome.renderOrder = -100;
    dome.frustumCulled = false;
    const st = starField();
    group.add(dome, st, cloudSea());
    this.scene.add(group);
    return {
      group,
      set: (space) => {
        mat.uniforms.uSpace.value = space;
        (st.material as THREE.PointsMaterial).opacity = smooth(0.3, 0.9, space);
      },
    };
  }

  private cityFog(): void {
    this.scene.fog = new THREE.Fog(DUSK.fog, DUSK.fogNear, DUSK.fogFar);
  }

  // a cruiser with its light bar flashing (glows over it, red and blue), facing +x at scale s
  private cruiser(x: number, z: number, ry: number, s = 1.7): { car: THREE.Group; flash(t: number): void } {
    const car = makeParkedCruiser(-1.6, 1.6, 0, 1.3, Math.round(x));
    inkify(car);
    car.scale.setScalar(s);
    car.position.set(x, 0, z);
    car.rotation.y = ry;
    const red = glowSprite(0xff2a2a, 3.2);
    const blue = glowSprite(0x2a6bff, 3.2);
    red.position.set(0, 1.75, -0.3);
    blue.position.set(0, 1.75, 0.3);
    car.add(red, blue);
    this.scene.add(car);
    const k = x * 0.7;
    return {
      car,
      flash: (t) => {
        const on = Math.floor(t * 5 + k) % 2 === 0;
        red.material.opacity = on ? 1 : 0.15;
        blue.material.opacity = on ? 0.15 : 1;
      },
    };
  }

  // ---- 1 to 2: "Okay. Higher." ----
  private act1(): (t: number, dt: number) => void {
    const c = this.city();
    this.cityFog();
    //the roadblock, jammed in the far lane; a cop on foot beside it
    const jam = [
      this.cruiser(-12, 8.5, 0.35),
      this.cruiser(-6.5, 7, -0.5),
      this.cruiser(-1, 8.5, 0.25),
      this.cruiser(4.5, 7.2, 2.8),
    ];
    const cop = sleepwalker(3, true);
    cop.group.position.set(8.5, 0, 9.5);
    cop.group.rotation.y = 0.3;
    this.scene.add(cop.group);
    this.speakers.set('cop', () => cop.group.localToWorld(V(0, 2.8, 0)));
    //more on the way, down the avenue
    const coming = [0, 1, 2].map((i) => this.cruiser(-70 - i * 9, 14 + (i % 2) * 3.5, 0));
    //a dumpster under the fire escape
    const dumpster = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.4), new THREE.MeshToonMaterial({ color: 0x2e5a3a }));
    dumpster.position.set(5.6, 0.7, -2);
    inkify(dumpster);
    this.scene.add(dumpster);
    const heli = chopper();
    heli.group.scale.setScalar(2.6);
    this.scene.add(heli.group);
    const street = 15.5; // the near lane the rider rolls down
    const rail = ESCAPE.rail;
    const railZ = ESCAPE.z - 0.1;
    // the way up: a hop to the dumpster, up to the first landing's rail, along it, up to the second, back along it,
    // over the parapet onto the roof (time, place, and the clip for the leg)
    const hops: { t: number; p: THREE.Vector3; leg: 'ride' | 'ollie' | 'grind' }[] = [
      { t: 6.0, p: V(1.0, 0, 0.6), leg: 'ride' },
      { t: 6.55, p: V(4.6, 1.4, -2), leg: 'ollie' },
      { t: 7.35, p: V(ESCAPE.x0 + 0.4, rail[0], railZ), leg: 'ollie' },
      { t: 8.2, p: V(ESCAPE.x1 - 0.4, rail[0], railZ), leg: 'grind' },
      { t: 8.9, p: V(ESCAPE.x1 - 0.6, rail[1], railZ), leg: 'ollie' },
      { t: 9.6, p: V(ESCAPE.x0 + 0.6, rail[1], railZ), leg: 'grind' },
      { t: 10.0, p: V(ESCAPE.x0 - 0.5, ROOF_Y, -6.5), leg: 'ollie' },
    ];
    return (t, dt) => {
      c.update(t, dt);
      for (const j of jam) j.flash(t);
      coming.forEach((cc, i) => {
        cc.car.position.x = -70 - i * 9 + t * 7;
        cc.flash(t);
      });
      heli.aim(null, dt);
      heli.group.visible = t > 12.6;
      if (t < 3) {
        //1: wide, side on: the jam, the cop on his phone, the rider rolling past in the near lane
        cop.look(0, 0);
        const x = mix(-6, 10, t / 3);
        this.ride(V(x, 0, street), 0, clipAt('ride', t));
        this.shot(V(1, 3.2, 36), V(1, 2.6, 8), 48);
      } else if (t < 6) {
        //2: over the shoulder: they stop and look back up the avenue at the lights coming
        const k = smooth(3, 3.6, t);
        this.ride(V(mix(10, 12, k), 0, street), Math.PI * k, k < 1 ? clipAt('ride', t) : LOOK_BACK);
        //(an upright phone keeps them in frame, the avenue's lights behind)
        this.shot(V(18.5, 4.2, street + 6.5), this.tall ? V(6, 2.6, street) : V(-14, 2.4, street - 0.5), 46);
      } else if (t < 10.2) {
        //3: low, tilting up the building with them: a hop, the fire escape's rails in a zigzag, over the parapet
        let i = hops.findIndex((h) => h.t > t);
        if (i < 0) i = hops.length - 1;
        const a = i > 0 ? hops[i - 1] : { t: 6, p: V(-4, 0, 0.6), leg: 'ride' as const };
        const b = hops[i];
        const k = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
        const p = a.p.clone().lerp(b.p, k);
        const back = b.p.x < a.p.x;
        let pose: Pose;
        if (b.leg === 'ollie') {
          p.y += Math.sin(k * Math.PI) * (1.2 + Math.max(0, b.p.y - a.p.y) * 0.15);
          pose = clipAt('ollie', 0.08 + k * 0.4);
        } else if (b.leg === 'grind') pose = clipAt('grind1', t);
        else pose = clipAt('ride', t);
        this.ride(p, back ? Math.PI : 0, pose);
        const y = this.holder.position.y;
        this.shot(V(18, 1.2, 9), V(10, y + 1.5, -3), 56);
      } else if (t < 13) {
        //4: from behind them on the roof's edge, looking down at the cruisers stuck in the street
        this.ride(V(9, ROOF_Y, -4.8), -Math.PI / 2, clipAt('idle', t));
        this.shot(V(15, ROOF_Y + 2.8, -7), V(2, 12.5, 2), 52);
      } else if (t < 17) {
        //5: wide from across the street: the chopper rises over the roofline, its light finds the cruisers and
        //climbs the wall to them; "Nope." and they push off along the roof
        const rise = smooth(12.8, 15, t);
        heli.group.position.set(mix(-8, 2, rise), mix(8, 30, rise), mix(-40, -15, rise));
        heli.group.rotation.y = -0.4;
        const sweep = smooth(13.6, 15.4, t);
        const target = V(-2, 0, 8).lerp(V(11, ROOF_Y, -5.2), sweep);
        heli.aim(target, dt);
        const go = smooth(15.9, 17, t);
        const pose = go > 0 ? clipAt('push', t) : clipAt('idle', t);
        this.ride(V(11 - go * 8, ROOF_Y, -5.6), go > 0 ? Math.PI : -Math.PI / 2, pose);
        this.shot(V(18, 10, 44), V(5, 14, -6), 50);
      } else {
        //6: low from the street: they turn for the edge, ollie off the roof over the jammed cruisers, land in the
        //street and roll off down it, the chopper's light a beat behind
        const turn = smooth(17, 17.4, t);
        const air = smooth(17.6, 19.1, t);
        const away = smooth(19.25, 20.5, t);
        let p: THREE.Vector3;
        let pose: Pose;
        let yaw = -Math.PI / 2;
        if (t < 17.6) {
          p = V(3, ROOF_Y, mix(-5.6, -4.4, smooth(17.2, 17.6, t)));
          yaw = mix(Math.PI, -Math.PI / 2, turn);
          pose = clipAt('ride', t);
        } else if (t < 19.1) {
          //off the parapet in a long arc, a little rise first, then the drop to the near lane
          p = V(mix(3, 4, air), 0, mix(-4.4, 13.5, air));
          p.y = mix(ROOF_Y, 0, air * air) + Math.sin(air * Math.PI) * 2.2;
          pose = air < 0.35 ? clipAt('ollie', 0.08 + air * 1.1) : clipAt('air', t);
        } else {
          //down hard, the knees take it, and off along the street
          p = V(mix(4, 16, away * away), 0, 13.5);
          yaw = mix(-Math.PI / 2, 0, smooth(19.2, 19.7, t));
          pose = t < 19.45 ? clipAt('land', (t - 19.1) * 0.9) : clipAt('push', t);
        }
        this.ride(p, yaw, pose);
        heli.group.position.set(-14, 33, -16);
        heli.aim(this.holder.position.clone().add(V(-2, 0, -2)), dt);
        const look = this.holder.position.clone().add(V(0, 1, 0));
        this.shot(V(mix(-1, 6, away), 1.5, 22), look, 52);
      }
    };
  }

  // ---- 2 to 3: "STOKE DETECTED" ----
  private act2(): (t: number, dt: number) => void {
    const c = this.city();
    this.cityFog();
    //the cloud ceiling, low over the towers
    const ceiling = cloudLayer(90, { under: true, n: 160 });
    this.scene.add(ceiling);
    //a little pylon on the corner roof, the wires from it up to a tall one in the distance, and one down to a
    //substation on the roof's far end
    const a = pylon(7);
    a.group.position.set(17, ROOF_Y, -9);
    a.group.rotation.y = Math.PI / 2;
    const b = pylon(70);
    b.group.position.set(150, 0, -120);
    b.group.rotation.y = Math.PI / 2;
    this.scene.add(a.group, b.group);
    a.group.updateMatrixWorld(true);
    b.group.updateMatrixWorld(true);
    const up = wire(a.group.localToWorld(a.arms[0].clone()), b.group.localToWorld(b.arms[0].clone()), 8);
    const up2 = wire(a.group.localToWorld(a.arms[1].clone()), b.group.localToWorld(b.arms[1].clone()), 8);
    const station = substation();
    station.group.position.set(-12, ROOF_Y, -10);
    this.scene.add(station.group);
    const down = wire(a.group.localToWorld(a.arms[2].clone()), V(-10, ROOF_Y + 3.2, -10.8), 0.8);
    this.scene.add(up.mesh, up2.mesh, down.mesh);
    const sparks = new Sparks(80, 0.4);
    this.scene.add(sparks.group);
    const ball = glowSprite(0xfff4a0, 2.2);
    this.scene.add(ball);
    const heli = chopper();
    heli.group.scale.setScalar(2.6);
    heli.group.position.set(-26, 30, -4);
    this.scene.add(heli.group);
    //the billboards: three on the roofs over the street, showing the rider's face live (a camera on them, drawn into
    //a texture each frame they're up)
    const face = new THREE.WebGLRenderTarget(256, 256);
    face.texture.colorSpace = THREE.SRGBColorSpace;
    const faceCam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const boards = [
      { x: -12, y: ROOF_Y + 5.5, z: -8, w: 10 },
      { x: 3, y: ROOF_Y + 7, z: -10, w: 12 },
      { x: 26, y: ROOF_Y + 9, z: -16, w: 10 },
    ].map((o) => {
      const bb = billboard(o.w, o.w * 0.5, 'STAY PREDICTABLE', 'STOKE DETECTED', face.texture);
      bb.group.position.set(o.x, o.y, o.z);
      this.scene.add(bb.group);
      return bb;
    });
    //sleepwalkers along the street, on their phones; they all look up at once
    const walkers = Array.from({ length: 12 }, (_, i) => {
      const w = sleepwalker(20 + i);
      w.group.position.set(-16 + i * 3 + (i % 3) * 0.6, 0, 13 + (i % 4) * 1.7);
      w.group.rotation.y = (i % 2 ? 0.3 : -0.3) + Math.PI * (i % 5 === 0 ? 1 : 0);
      this.scene.add(w.group);
      return w;
    });
    //the drones, waiting inside two towers' roof hatches
    const hatches = [V(-40, 70, -95), V(55, 82, -130)];
    for (const h of hatches) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(18, h.y, 18), new THREE.MeshToonMaterial({ color: 0x2e2a3c }));
      tower.position.set(h.x, h.y / 2, h.z);
      const hatch = new THREE.Mesh(new THREE.BoxGeometry(5, 0.6, 5), new THREE.MeshBasicMaterial({ color: 0x080608 }));
      hatch.position.set(h.x, h.y + 0.3, h.z);
      const red = glowSprite(0xff2a2a, 10, 0.8);
      red.position.set(h.x, h.y + 1, h.z);
      inkify(tower);
      this.scene.add(tower, hatch, red);
    }
    const drones = Array.from({ length: 22 }, (_, i) => {
      const d = makeDrone();
      d.group.scale.setScalar(3);
      inkify(d.group);
      const eye = glowSprite(0xff2a2a, 2.4);
      d.group.add(eye);
      this.scene.add(d.group);
      return { d, from: hatches[i % 2], k: i / 22, side: ((i * 37) % 11) / 11 - 0.5 };
    });
    const along = (u: number) => up.curve.getPointAt(Math.min(1, Math.max(0, u)));
    const riderOn = (u: number) => along(u).add(V(0, 0.15, 0));
    return (t, dt) => {
      c.update(t, dt);
      sparks.update(dt);
      heli.group.position.x = -26 + Math.sin(t * 0.6) * 6;
      heli.aim(V(-4 + Math.sin(t * 1.3) * 10, ROOF_Y, -8), dt);
      //the wire: rolled onto at 3.2 s, ridden up from there on
      const u = t < 3.2 ? 0 : 0.015 + (t - 3.2) * 0.012;
      const grind = t >= 3.4;
      if (t < 3.4) {
        const k = smooth(0, 3.2, t);
        const p = V(mix(6, 16, k), ROOF_Y, -9.6);
        if (t > 2.8) {
          const j = smooth(2.8, 3.4, t);
          p.lerp(riderOn(0.015), j);
          p.y += Math.sin(j * Math.PI) * 1.4;
        }
        this.ride(p, 0, t > 2.8 ? clipAt('ollie', 0.08 + smooth(2.8, 3.4, t) * 0.4) : clipAt('ride', t));
      } else {
        const p = riderOn(u);
        const ahead = along(u + 0.01).sub(along(u));
        const yaw = -Math.atan2(ahead.z, ahead.x);
        const pitch = Math.atan2(ahead.y, Math.hypot(ahead.x, ahead.z));
        this.ride(p, yaw, clipAt('grind1', t), pitch);
      }
      if (grind && t < 7 && Math.random() < 0.8) sparks.emit(riderOn(u), 3, 5);
      //the spark runs down the other line into the substation, which flashes
      const run = smooth(7, 8.4, t);
      ball.visible = t > 7 && t < 8.5;
      ball.position.copy(down.curve.getPointAt(run));
      if (ball.visible && Math.random() < 0.7) sparks.emit(ball.position, 2, 3);
      const zap = t > 8.4 && t < 9.4 ? (Math.floor(t * 20) % 2 ? 1 : 0.4) * (1 - smooth(8.4, 9.4, t)) : 0;
      station.flash(zap);
      this.ui.flash(t > 8.4 && t < 8.6 ? 0.5 : 0);
      //the billboards flip to the face, one after another
      for (let i = 0; i < boards.length; i++) boards[i].set(smooth(9.2 + i * 0.35, 9.9 + i * 0.35, t), t);
      for (const w of walkers) w.look(smooth(10.2, 10.6, t), 0xff3a3a);
      //the face: a camera on the rider's head, into the billboards' texture
      if (t > 9 && t < 13.2) {
        const head = this.speakers.get('skater')!().add(V(0, -0.5, 0));
        faceCam.position.copy(head).add(V(0, 0.1, 2.6));
        faceCam.lookAt(head);
        const r = this.renderer;
        r.setRenderTarget(face);
        r.clear();
        r.render(this.scene, faceCam);
        r.setRenderTarget(null);
      }
      //the drones: up out of the hatches and on toward the wire
      for (const d of drones) {
        const k = smooth(13 + d.k * 1.2, 16.2 + d.k * 1.2, t);
        const goal = riderOn(u).add(V(-8 + d.side * 16, 6 + d.side * 6, 10 * d.side));
        const p = d.from.clone().add(V(d.side * 6, 2 + k * 30, d.side * 4)).lerp(goal, k * k);
        d.d.group.position.copy(p);
        d.d.group.visible = t > 13 + d.k * 1.2;
        d.d.rotors.forEach((r) => (r.rotation.y += dt * 40));
      }
      if (t < 3.4) {
        //1: wide: the last roof, the chopper's light behind, the pylon and its wires up to the clouds
        this.shot(V(-4, ROOF_Y + 8, 22), V(18, ROOF_Y + 5, -14), 52);
      } else if (t < 7) {
        //2: close, side on: the 50-50 on the power line, the sparks
        const p = riderOn(u);
        this.shot(p.clone().add(V(4.5, 1.2, 6)), p.clone().add(V(-0.6, 1.2, 0)), 46);
      } else if (t < 9.2) {
        //3: following the spark down the other line into the substation
        const p = ball.position.clone();
        this.shot(V(mix(10, -2, run), ROOF_Y + 9, 8), p.lerp(V(-12, ROOF_Y + 1, -10), smooth(8.2, 9, t)), 50);
      } else if (t < 13) {
        //4: from the street: the billboards flip to the face, the sleepwalkers all look up, lit red
        this.shot(V(2, 1.4, 26), V(4, ROOF_Y + 2, -6), 56);
      } else {
        //5: wide, from behind the rider on the wire: the drones pouring out of the towers at them
        const p = riderOn(u);
        this.shot(p.clone().add(V(4, -2, 12)), p.clone().add(V(-6, 9, -16)), 58);
      }
    };
  }

  // ---- 3 to 4: "No further." ----
  private act3(): (t: number, dt: number) => void {
    const sky = this.sky();
    this.scene.fog = new THREE.Fog(0xdfe4f0, 1, 40);
    const fog = this.scene.fog as THREE.Fog;
    //inside the cloud: the drones' red eyes in the mist
    const eyes = [V(-6, -10, -6), V(-3, -14, -9), V(-9, -12, -2), V(5, -11, -8), V(7, -15, -4), V(3, -9, -11)].map((p) => {
      const e = glowSprite(0xff2a2a, 2.6, 0.9);
      e.material.fog = true;
      e.position.copy(p);
      this.scene.add(e);
      return e;
    });
    const moon = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.MeshBasicMaterial({ color: 0xf6f2dc, fog: false }));
    moon.position.set(500, 380, -900);
    moon.lookAt(0, 0, 0);
    const moonGlow = glowSprite(0xf6f2dc, 180, 0.4);
    moonGlow.position.copy(moon.position);
    this.scene.add(moon, moonGlow);
    //the ship, far up: a light that isn't a star
    const ship = saucer();
    ship.scale.setScalar(2);
    ship.position.set(-80, 520, -700);
    const shipGlow = glowSprite(0xbfe8ff, 90, 0.8);
    shipGlow.position.copy(ship.position);
    this.scene.add(ship, shipGlow);
    //the blimp they land on, nose +x, its back at y 4
    const air = blimp(16);
    air.position.set(2, 4, 0);
    this.scene.add(air);
    //the gunships, a line across the sky, their eyes coming on one at a time
    const ships = Array.from({ length: 7 }, (_, i) => {
      const g = makeGunship(-3, 3, 0, 2.2, 0);
      inkify(g);
      g.scale.setScalar(3);
      g.position.set(-48 + i * 16, 42 + (i % 2) * 3, -45);
      const light = glowSprite(0xff2a2a, 9, 0);
      light.position.set(0, 1.2, 1);
      g.add(light);
      this.scene.add(g);
      return { g, light };
    });
    return (t) => {
      const above = t >= 3;
      sky.set(above ? 0.72 : 0.3);
      if (above) {
        fog.color.setHex(0x1a2448);
        fog.near = 300;
        fog.far = 2400;
      } else {
        fog.color.setHex(0xdfe4f0);
        fog.near = 1;
        fog.far = 30;
      }
      for (const e of eyes) e.visible = !above;
      ships.forEach((s, i) => {
        const on = t > 9.4 + i * 0.35;
        s.light.material.opacity = on ? 0.7 + 0.3 * Math.sin(t * 6 + i) : 0;
        s.g.visible = t > 9;
      });
      if (t < 3) {
        //1: inside the cloud: white all round, the drones' eyes behind
        this.ride(V(0, -12 + t * 0.6, 0), 0, clipAt('ride', t));
        this.shot(V(4, -9.5 + t * 0.6, 8), V(-1, -10.5 + t * 0.6, -2), 55);
        return;
      }
      if (t < 6) {
        //2: up through the cloud tops into the stars, in slow motion
        const k = smooth(3, 6, t);
        const y = mix(-6, 9, Math.sqrt(k));
        this.ride(V(-6 + k * 6, y, 0), 0, clipAt('ollie', 0.12 + k * 0.25));
        this.shot(V(3, 13, 11), V(-3, y + 0.5, 0), 55);
        return;
      }
      if (t < 13.4) {
        //3 and 4: down on the blimp's back to breathe; then looking up as the gunships' lights come on
        const land = smooth(6, 6.8, t);
        const pose = land < 1 ? clipAt('land', land * 0.3) : t < 9.2 ? SIT : LOOK_UP;
        this.ride(V(mix(0, 2, land), mix(9, 4.05, land), 0), 0, pose);
        if (t < 9.2) this.shot(V(7, 6.8, 9), V(1.5, 5.6, 0), 50);
        else this.shot(V(4.5, 4.6, 6), V(-2, 30, -40), 58);
        return;
      }
      //5: close and low: they stand, kick the board up, and grin
      const pop = t - 14.2;
      const pose = pop > 0 && pop < 0.6 ? clipAt('ollie', pop) : clipAt('idle', t);
      const hop = pop > 0 && pop < 0.6 ? Math.sin((pop / 0.6) * Math.PI) * 0.8 : 0;
      this.ride(V(2, 4.05 + hop, 0), -0.5, pose);
      this.shot(V(4.2, 4.6, 4.4), V(2, 6, 0), 46);
    };
  }

  // ---- 4 to 5: "...Whoa." ----
  private act4(): (t: number, dt: number) => void {
    const sky = this.sky();
    this.scene.fog = new THREE.Fog(0x0a0e22, 300, 2600);
    const skyAll = sky.group;
    //above the clouds: the last blimp, a gunship spinning out of the line
    const air = blimp(18);
    air.position.set(0, 4, 0);
    const spin = makeGunship(-3, 3, 0, 2.2, 3);
    inkify(spin);
    spin.scale.setScalar(2.2);
    const smoke = Array.from({ length: 14 }, (_, i) => {
      const s = glowSprite(0x777788, 4 + i * 0.4, 0.5);
      s.material.blending = THREE.NormalBlending;
      this.scene.add(s);
      return s;
    });
    const line = [1, 2].map((i) => {
      const g = makeGunship(-3, 3, 0, 2.2, 0);
      inkify(g);
      g.scale.setScalar(2.2);
      g.position.set(30 + i * 22, 40, -50);
      this.scene.add(g);
      return g;
    });
    skyAll.add(air, spin);
    //space: Earth below
    const world = earth(900);
    world.position.set(0, -960, -200);
    this.scene.add(world);
    //the ship, closer now
    const ship = saucer();
    ship.scale.setScalar(3);
    const shipGlow = glowSprite(0xbfe8ff, 60, 0.7);
    this.scene.add(ship, shipGlow);
    //the city: the silo opening in the hero street, the rocket, the billboards, the sleepwalkers
    const c = cityStage();
    const cityGroup = new THREE.Group();
    cityGroup.add(c.group);
    this.scene.add(cityGroup);
    const pit = silo();
    pit.group.position.set(0, 0, 12);
    cityGroup.add(pit.group);
    const rocket = makeRocket();
    inkify(rocket);
    rocket.scale.setScalar(5);
    rocket.rotation.z = Math.PI / 2;
    const eye = glowSprite(0xff2a2a, 2.4);
    eye.position.set(1.6, 0, 0);
    rocket.add(eye);
    this.scene.add(rocket);
    const plume = Array.from({ length: 24 }, (_, i) => {
      const s = glowSprite(i % 3 ? 0xddddee : 0xffb347, 5, 0.6);
      s.material.blending = i % 3 ? THREE.NormalBlending : THREE.AdditiveBlending;
      this.scene.add(s);
      return s;
    });
    const boards = [
      { x: -12, y: ROOF_Y + 5.5, z: -8, w: 10 },
      { x: 26, y: ROOF_Y + 9, z: -16, w: 10 },
    ].map((o) => {
      const bb = billboard(o.w, o.w * 0.5, 'THE AI LOVES YOU', 'FINAL MEASURE', null);
      bb.group.position.set(o.x, o.y, o.z);
      cityGroup.add(bb.group);
      return bb;
    });
    const walkers = Array.from({ length: 10 }, (_, i) => {
      const w = sleepwalker(40 + i);
      w.group.position.set(-15 + i * 3.4, 0, i % 2 ? 4.5 : 19.5);
      w.group.rotation.y = i % 2 ? 0 : Math.PI;
      cityGroup.add(w.group);
      return w;
    });
    const cloudsAt = cloudLayer(0, { n: 90, r: 260 });
    this.scene.add(cloudsAt);
    return (t, dt) => {
      const inCity = t >= 9 && t < 13;
      cityGroup.visible = inCity;
      skyAll.visible = !inCity;
      cloudsAt.visible = t >= 13 && t < 15;
      world.visible = t >= 3 && t < 9 || t >= 15;
      air.visible = t < 4.5;
      line.forEach((g) => (g.visible = t < 3));
      if (inCity) {
        c.update(t, dt);
        this.cityFog();
      } else {
        this.scene.fog = new THREE.Fog(0x0a0e22, 300, 2600);
      }
      //space comes in once they're off the blimp
      sky.set(t < 3 ? 0.8 : 1);
      ship.visible = shipGlow.visible = t >= 15;
      ship.position.set(30, 70, -60);
      shipGlow.position.copy(ship.position);
      ship.rotation.y += dt * 0.3;
      //the rocket: in the silo, up out of it (9-13), up through the clouds (13-15), its trail far below (15-17)
      const lift = smooth(10.2, 13, t);
      rocket.visible = (t >= 9 && t < 15) || t >= 15;
      eye.visible = t >= 13;
      pit.open(smooth(9.2, 10.2, t));
      if (t < 13) rocket.position.set(0, -6 + lift * 40, 12);
      else if (t < 15) rocket.position.set(0, mix(-30, 18, smooth(13, 15, t)), 0);
      else rocket.position.set(-30, mix(-40, -10, smooth(15, 17, t)), -20);
      const trail = t >= 10.2;
      plume.forEach((s, i) => {
        s.visible = trail && rocket.visible;
        const back = V(0, -(i * 1.6 + ((t * 20) % 1.6)), 0);
        s.position.copy(rocket.position).add(back);
        s.scale.setScalar(4 + i * 0.5);
        s.material.opacity = 0.7 * (1 - i / plume.length);
      });
      for (const b of boards) b.set(smooth(9.6, 10.2, t), t);
      for (const w of walkers) w.look(smooth(10.6, 11.2, t), 0xff6a3a);
      if (t < 3) {
        //1: tracking: they race along the last blimp while a gunship spins out of the broken line
        air.position.x = -t * 2;
        this.ride(V(4, 4.05, 0), 0, clipAt('ride', t));
        spin.position.set(-14 + t * 3, 24 - t * t * 2.4, -20);
        spin.rotation.set(t * 1.1, 0, -0.6 - t * 1.4);
        smoke.forEach((s, i) => {
          s.position.copy(spin.position).add(V(-i * 1.4, i * 1.6, 0));
          s.visible = true;
        });
        this.shot(V(10, 8, 18), V(0, 8, -6), 52);
        return;
      }
      for (const s of smoke) s.visible = false;
      if (t < 7) {
        //2: off the blimp's nose, and floating: the board drifts off their feet, a toe catches it
        const k = smooth(3, 3.8, t);
        const drift = smooth(4.2, 5.4, t) * (1 - smooth(5.8, 6.6, t));
        const pose: Pose = k < 1 ? clipAt('ollie', 0.08 + k * 0.3) : { ...FLOAT, boardY: -drift * 0.6, boardX: drift * 0.4, boardPitch: drift * 0.5, footFOn: 1 - drift, footBOn: 1 - drift };
        this.ride(V(mix(4, 10, k), 4.05 + k * 6 + (t - 3) * 0.6, 0), 0, pose);
        this.shot(V(15, 9.5 + (t - 3) * 0.6, 9), V(10, 10 + (t - 3) * 0.6, 0), 48);
        return;
      }
      if (t < 9) {
        //3: wide: one slow giant flip, the arc dotted with stars
        const k = smooth(7, 9, t);
        this.ride(V(mix(10, 26, k), 13 + Math.sin(k * Math.PI) * 6, 0), 0, clipAt('air', t), -k * Math.PI * 2);
        this.shot(V(18, 13, 21), V(18, 15, 0), 56);
        return;
      }
      if (t < 13) {
        //4: down in the city: the plaza splits, the rocket lights and lifts; every screen says the same thing
        this.ride(V(0, -500, 0), 0, BASE);
        this.shot(V(-4, 1.6, 34), V(0, mix(6, 24, lift), 6), 56);
        return;
      }
      if (t < 15) {
        //5: the rocket's eye: it punches up through the clouds, and finds them
        this.ride(V(0, -500, 0), 0, BASE);
        this.shot(V(26, 9, 38), rocket.position.clone().setY(Math.max(4, rocket.position.y)), 48);
        return;
      }
      //6: they see the trail coming, then look up at the ship
      const look = smooth(15.4, 16.2, t);
      this.ride(V(0, 10, 0), 0, look > 0.5 ? LOOK_UP : { ...FLOAT, head: 1.1, nod: 0.6 });
      this.shot(V(4, 6.5, 9), V(mix(-10, 9, look), mix(4, 22, look), mix(-12, -14, look)), 54);
    };
  }
}
