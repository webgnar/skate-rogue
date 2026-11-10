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
import { BASE, CLIPS, mix as mixPose, sample, type Pose } from '../render/poses';
import type { SampleId } from '../audio/cues';
import { SCALE, type SkaterRig } from '../render/skater-rig';
import { makeDrone } from '../render/drone-view';
import { makeParkedCruiser } from '../render/kit';
import { makeRocket } from '../render/chaser-view';
import { makeGunship } from '../render/car-damage';
import { Particles } from '../render/particles';
import { Impacts } from '../render/impact';
import { inkify, setInkLens, setInkResolution } from '../render/toon';
import { DUSK } from '../title/city';
import { clouds as cloudSea, skyMaterial, stars as starField } from '../ship/ending-scene';
import { saucer } from '../ship/saucer';
import {
  billboard, blimp, chopper, cityStage, cloudLayer, earth, ESCAPE, glowSprite, pylon, quarterpipe, ROOF_Y, silo, sleepwalker, Sparks,
  substation, wire,
} from './props';

export type ActBreak = 1 | 2 | 3 | 4;
export const isActBreak = (n: number): n is ActBreak => n === 1 || n === 2 || n === 3 || n === 4;

// how long each runs, seconds (the storyboards' timings)
// act 3's opens on the street now (the quarterpipe, up through the cloud): its old cutscene runs on this much later
const ACT3_UP = 3.8;
export const ACT_BREAK_LEN: Record<ActBreak, number> = { 1: 20.5, 2: 22.5, 3: 16 + ACT3_UP, 4: 17 };
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
  // one of the game's sounds (src/audio/cues.ts), at its own level times `scale`, at a playback rate
  sfx?(sample: SampleId, scale: number, rate: number): void;
}

// the cutscenes' sounds (zack 2026-11-10: "add sounds to the cutscenes using the existing sounds we have"): the
// game's own one-shots on the action's beats, and its loops (wheels, grind, siren) while they ride. Slow motion plays
// a sound an octave down (half rate), so it stays in key (cues.ts KEY)
type Sfx = { at: number; s: SampleId; k: number; r: number };
type LoopSpan = { from: number; to: number; mode: 'roll' | 'grind' | 'air'; speed: number; heat: number };
const SLOW = 0.5;
// the game's bursts are sized to its own world (a tile a unit); the cutscenes are in metres, the skater bigger
const BURST_SCALE = 2.6;

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
    { from: 10.6, to: 12.8, who: 'skater', text: '...Quiet up here.' },
    { from: 14, to: 16.8, who: 'ai', text: 'CEILING HOLDING. NO FURTHER.' },
    { from: 17.4, to: 19.8, who: 'skater', text: "Every ceiling's got a gap." },
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
  private sounds: Sfx[] = [];
  private spans: LoopSpan[] = [];
  private heard = -1; // the sounds are played up to here
  private beats: { at: number; fn: () => void }[] = []; // effects on the clock (the landings' impact bursts)
  private bursts: Impacts | null = null;

  // the game's landing burst (src/render/impact.ts, the inked cylinder) at `at` s, round `where`, size as in the game
  private boom(at: number, where: THREE.Vector3, size: number): void {
    this.bursts ??= new Impacts(() => this.renderer.getPixelRatio());
    if (!this.bursts.group.parent) this.scene.add(this.bursts.group);
    const b = this.bursts;
    const p = where.clone();
    this.beats.push({
      at,
      fn: () => {
        b.spawn(p.x, p.y, size * BURST_SCALE);
        const m = b.group.children.at(-1)!;
        m.position.copy(p);
        //(the game draws it in a pass over the street; here it's one scene, and it writes no depth, so it draws after
        //the solid things or whatever's behind it paints over it)
        m.renderOrder = 10;
      },
    });
  }

  // a sound at `at` s (scale on its level, rate on its pitch)
  private sfx(at: number, s: SampleId, k = 1, r = 1): void {
    this.sounds.push({ at, s, k, r });
  }

  // the wheels (speed in the game's px a frame, 6 is full) or the grind from `from` to `to`; heat brings the siren in
  private loop(from: number, to: number, mode: LoopSpan['mode'], speed = 5, heat = 0): void {
    this.spans.push({ from, to, mode, speed, heat });
  }

  // what the street's loops should be doing now (the game sets its sound from this while the cutscene plays)
  loops(): { mode: string; speed: number; heat: number } | null {
    if (this.done) return null;
    const on = this.spans.filter((s) => this.t >= s.from && this.t < s.to);
    if (!on.length) return { mode: 'air', speed: 0, heat: 0 };
    const heat = Math.max(...on.map((s) => s.heat));
    const ride = on.find((s) => s.mode !== 'air') ?? on[0];
    return { mode: ride.mode, speed: ride.speed, heat };
  }

  // the one-shots the clock's just passed (none while held on a still)
  private hear(): void {
    if (this.held) {
      this.heard = this.t;
      return;
    }
    for (const c of this.sounds) if (c.at > this.heard && c.at <= this.t) this.ui.sfx?.(c.s, c.k, c.r);
    for (const b of this.beats) if (b.at > this.heard && b.at <= this.t) b.fn();
    this.heard = this.t;
  }
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
    this.hear();
    this.bursts?.update(this.held ? 0 : dt);
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
    c.group.visible = true; // (act 3's hides it once they're up off the street)
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
    //the landing off the roof: the game's own landing dust and slam debris (src/render/particles.ts), in the street
    const dust = new Particles();
    const land = new THREE.Group();
    land.position.z = 13.5;
    land.add(dust.points);
    this.scene.add(land);
    let landed = false;
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
    //the sounds: the sirens all the way, wheels in the near lane, up the fire escape (hops, grinds), the big ollie
    //off the roof and its landing
    this.loop(0, ACT_BREAK_LEN[1], 'air', 0, 80);
    this.loop(0, 3.4, 'roll', 5);
    for (const [i, h] of hops.entries()) {
      if (h.leg === 'ollie' && i > 0) this.sfx(hops[i - 1].t, 'ollie', 0.9);
      const next = hops[i + 1];
      if (next?.leg === 'grind') this.loop(h.t, next.t, 'grind');
      else if (h.leg !== 'grind' && i > 0) {
        this.sfx(h.t, h.p.y > 5 ? 'impact' : 'clack', 0.6);
        this.boom(h.t, h.p, h.p.y > 5 ? 0.7 : 0.5);
      }
    }
    this.loop(15.9, 17.6, 'roll', 4);
    this.sfx(17.6, 'ollie');
    this.sfx(19.1, 'impact');
    this.boom(19.1, V(4, 0, 13.5), 1.3);
    //the sparks off the trucks up the fire escape's rails
    const sparks = new Sparks(120, 0.7);
    this.scene.add(sparks.group);
    const grinds = this.spans.filter((s) => s.mode === 'grind');
    this.sfx(19.1, 'slam', 0.6);
    this.loop(19.1, 20.5, 'roll', 5);
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
        const away = smooth(19.65, 20.5, t);
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
          //the big-drop landing: a deep squat, arms flung out, held, then up and pushing
          pose = t < 19.7 ? clipAt('landBig', t - 19.1) : clipAt('push', t);
        }
        //the impact: debris and a dust burst where the board hits, a quick flash and a hard shake
        if (t >= 19.1 && !landed) {
          landed = true;
          dust.debris(4, 0, 1);
          dust.dust(4, 0, 3.4);
          dust.dust(4, 0, 3, true);
        }
        const hit = t >= 19.1 ? 1 - smooth(19.1, 19.55, t) : 0;
        this.ui.flash(hit > 0.85 ? 0.35 : 0);
        this.ride(p, yaw, pose);
        heli.group.position.set(-14, 33, -16);
        heli.aim(this.holder.position.clone().add(V(-2, 0, -2)), dt);
        const look = this.holder.position.clone().add(V(0, 1, 0));
        this.shot(V(mix(-1, 6, away), 1.5, 22), look, 52);
        if (hit > 0) this.camera.position.add(V((Math.random() - 0.5) * hit * 0.5, (Math.random() - 0.5) * hit * 0.4, 0));
      }
      if (t < 19.1) {
        landed = false;
        dust.clear();
      }
      dust.update(dt, this.renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)));
      sparks.update(dt);
      if (grinds.some((g) => t >= g.from && t < g.to) && Math.random() < 0.9) sparks.emit(this.holder.position.clone().add(V(0, 0.1, 0.3)), 5, 6);
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
      { x: 14.5, y: ROOF_Y + 10, z: -3, w: 10 }, // clear of the wire's line out to the tall pylon
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
    //the way down: a steep street under the wire (the cross street at z -40), from 10 up down to the ground
    const HILL = { x0: 36, x1: 110, top: 10, z: -40, w: 18 };
    const hillY = (x: number) => HILL.top * Math.min(1, Math.max(0, 1 - (x - HILL.x0) / (HILL.x1 - HILL.x0)));
    const slope = Math.atan2(HILL.top, HILL.x1 - HILL.x0);
    {
      //a wedge of road with its sidewalks, solid underneath, so it reads as a hill and not a ramp
      const len = Math.hypot(HILL.x1 - HILL.x0, HILL.top);
      const road = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 12), new THREE.MeshToonMaterial({ color: 0x34303e }));
      const walkGeo = new THREE.BoxGeometry(len, 0.5, 3);
      const walkMat = new THREE.MeshToonMaterial({ color: 0x6a6478 });
      const deck = new THREE.Group();
      deck.add(road);
      for (const side of [-1, 1]) {
        const w = new THREE.Mesh(walkGeo, walkMat);
        w.position.set(0, 0.1, side * 7.5);
        deck.add(w);
      }
      for (let i = 0; i < 6; i++) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 0.25), new THREE.MeshBasicMaterial({ color: 0xe8c860 }));
        dash.position.set(-len / 2 + 8 + i * (len - 16) / 5, 0.17, 0);
        deck.add(dash);
      }
      deck.position.set((HILL.x0 + HILL.x1) / 2, HILL.top / 2 - 0.15, HILL.z);
      deck.rotation.z = -slope;
      const fill = new THREE.BufferGeometry();
      const { x0, x1, top, z, w } = HILL;
      const v = [
        [x0, 0, z - w / 2], [x1, 0, z - w / 2], [x0, top, z - w / 2],
        [x0, 0, z + w / 2], [x0, top, z + w / 2], [x1, 0, z + w / 2],
        [x0, 0, z - w / 2], [x0, top, z - w / 2], [x0, top, z + w / 2],
        [x0, 0, z - w / 2], [x0, top, z + w / 2], [x0, 0, z + w / 2],
      ].flat();
      fill.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      fill.computeVertexNormals();
      const under = new THREE.Mesh(fill, new THREE.MeshToonMaterial({ color: 0x4a3e48, side: THREE.DoubleSide }));
      inkify(deck);
      this.scene.add(deck, under);
    }
    //off the wire: where they kick off (where the drones' shot leaves them) and where the board comes down
    const takeoff = riderOn(0.015 + (17 - 3.2) * 0.012);
    const landAt = V(takeoff.x + 16, 0, HILL.z);
    landAt.y = hillY(landAt.x);
    const offDir = landAt.clone().sub(takeoff).setY(0).normalize();
    const offYaw = -Math.atan2(offDir.z, offDir.x);
    const hillDust = new Particles();
    const hillLand = new THREE.Group();
    hillLand.position.z = HILL.z;
    hillLand.add(hillDust.points);
    this.scene.add(hillLand);
    let hillHit = false;
    //where they are from 17 s: the slow kickflip off the wire (2.8 s of air), the big landing, then bombing the hill
    const offWire = (t: number): { p: THREE.Vector3; yaw: number; roll: number; pose: Pose } => {
      if (t < 19.8) {
        const k = (t - 17) / 2.8;
        const p = takeoff.clone().lerp(landAt, k);
        p.y = mix(takeoff.y, landAt.y, k * k) + Math.sin(k * Math.PI) * 3;
        return { p, yaw: offYaw, roll: 0, pose: clipAt('kickflip', Math.min(0.42, k * 0.6)) };
      }
      if (t < 20.4) return { p: landAt.clone(), yaw: mix(offYaw, 0, smooth(19.8, 20.3, t)), roll: -slope * smooth(19.8, 20.1, t), pose: clipAt('landBig', t - 19.8) };
      const s = t - 20.4;
      const x = landAt.x + s * 5 + s * s * 4;
      return { p: V(x, hillY(x), HILL.z), yaw: 0, roll: -slope, pose: clipAt('ride', t) };
    };
    //the sounds: onto the wire, the grind, the spark's bang in the substation, the billboards flipping, the slow
    //kickflip off and the big landing, then bombing the hill
    this.loop(0, 2.8, 'roll', 5);
    this.sfx(2.8, 'ollie');
    this.sfx(3.4, 'clack', 0.6);
    this.loop(3.4, 17, 'grind');
    this.sfx(8.4, 'smash', 0.9, SLOW);
    for (let i = 0; i < 3; i++) this.sfx(9.2 + i * 0.35, 'mod', 0.6);
    this.sfx(17, 'ollie', 1, SLOW);
    this.sfx(17.1, 'trick', 1, SLOW);
    this.sfx(19.8, 'impact');
    this.boom(19.8, landAt, 1.3);
    this.sfx(19.8, 'slam', 0.5);
    this.loop(19.8, 22.5, 'roll', 6);
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
        const goal = (t < 17 ? riderOn(u) : offWire(t).p).add(V(-8 + d.side * 16, 6 + d.side * 6, 10 * d.side));
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
      } else if (t < 17) {
        //5: wide, from behind the rider on the wire: the drones pouring out of the towers at them
        const p = riderOn(u);
        this.shot(p.clone().add(V(4, -2, 12)), p.clone().add(V(-6, 9, -16)), 58);
      } else {
        //6: slow motion, side on: a kickflip off the wire, the board turning under them all the way down to a steep
        //street; the big landing, then they bomb the hill toward the camera with the drones behind
        const o = offWire(t);
        this.ride(o.p, o.yaw, o.pose, o.roll);
        if (t >= 19.8 && !hillHit) {
          hillHit = true;
          hillDust.debris(landAt.x, landAt.y, 1);
          hillDust.dust(landAt.x, landAt.y, 3.4);
          hillDust.dust(landAt.x, landAt.y, 3, true);
        }
        const hit = t >= 19.8 ? 1 - smooth(19.8, 20.25, t) : 0;
        this.ui.flash(hit > 0.85 ? 0.35 : 0);
        if (t < 19.8) {
          const k = (t - 17) / 2.8;
          const side = V(-offDir.z, 0, offDir.x);
          if (side.z < 0) side.negate();
          const at = o.p.clone().add(side.multiplyScalar(6.5)).add(offDir.clone().multiplyScalar(mix(-2.5, 2.5, k))).add(V(0, 0.6, 0));
          this.shot(at, o.p.clone().add(V(0, 0.9, 0)), 44);
        } else {
          //down the hill, backing away ahead of them
          const cx = Math.max(landAt.x + 17, o.p.x + 11);
          this.shot(V(cx, hillY(cx) + 1.6, HILL.z + 3), o.p.clone().add(V(0, 1, 0)), 48);
          if (hit > 0) this.camera.position.add(V((Math.random() - 0.5) * hit * 0.5, (Math.random() - 0.5) * hit * 0.4, 0));
        }
      }
      if (t < 19.8) {
        hillHit = false;
        hillDust.clear();
      }
      hillDust.update(dt, this.renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)));
    };
  }

  // ---- 3 to 4: "No further." ----
  // (zack 2026-11-10: it opens on the street now: a quarterpipe, straight up into the clouds, up through them clear of
  // the blimp, a slow tre flip close up over the cloud tops, then down onto the blimp's back)
  private act3(): (t: number, dt: number) => void {
    const D = ACT3_UP; // the old cutscene runs on from the blimp landing, this much later
    //the street: the city's own, a quarterpipe in the near lane
    const c = this.city();
    const street = 15.5;
    const qx = 14; // the transition's foot
    const R = 3; // its radius (and height)
    const qp = quarterpipe(R, 4.4);
    qp.position.set(qx, 0, street - 2.2);
    this.scene.add(qp);
    //one world, so the flight is one path through every cut (zack 2026-11-10: "players position need to be fluid
    //with camera changes"): the cloud tops H over the street, and the sky above them (the blimp, the gunships, the
    //ship) laid out in their own frame L, which sits right over the quarterpipe
    const H = 60;
    const X0 = qx + R; // the coping's line: straight up from here
    const UPX = -16.2; // that line, in the sky's frame
    const L = V(X0 - UPX, H, street);
    const W = (x: number, y: number, z: number) => V(x, y, z).add(L);
    const sky = this.sky();
    sky.group.position.copy(L);
    const [dome, stars] = sky.group.children;
    const high = new THREE.Group();
    high.position.copy(L);
    this.scene.add(high);
    //in the cloud's underside: the drones' red eyes in the mist, round the way up
    const eyes = [V(-6, -1, -6), V(-3, -5, -9), V(-9, -3, -2), V(5, -2, -8), V(7, -6, -4), V(3, 0, -11)].map((p) => {
      const e = glowSprite(0xff2a2a, 2.6, 0.9);
      e.material.fog = true;
      e.position.copy(p).add(V(UPX, -1, 0)).add(L);
      this.scene.add(e);
      return e;
    });
    const moon = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.MeshBasicMaterial({ color: 0xf6f2dc, fog: false }));
    moon.position.set(500, 380, -900);
    moon.lookAt(0, 0, 0);
    const moonGlow = glowSprite(0xf6f2dc, 180, 0.4);
    moonGlow.position.copy(moon.position);
    //the ship, far up: a light that isn't a star
    const ship = saucer();
    ship.scale.setScalar(2);
    ship.position.set(-80, 520, -700);
    const shipGlow = glowSprite(0xbfe8ff, 90, 0.8);
    shipGlow.position.copy(ship.position);
    //the blimp they land on, nose +x, its back at y 4 (in the sky's frame), well off the line up
    const air = blimp(16);
    air.position.set(2, 4, 0);
    high.add(moon, moonGlow, ship, shipGlow, air);
    //the gunships, a line across the sky, their eyes coming on one at a time
    const ships = Array.from({ length: 7 }, (_, i) => {
      const g = makeGunship(-3, 3, 0, 2.2, 0);
      inkify(g);
      g.scale.setScalar(3);
      g.position.set(-48 + i * 16, 42 + (i % 2) * 3, -45);
      const light = glowSprite(0xff2a2a, 9, 0);
      light.position.set(0, 1.2, 1);
      g.add(light);
      high.add(g);
      return { g, light };
    });
    //the landing on the blimp: the game's landing dust
    const dust = new Particles();
    const pad = new THREE.Group();
    pad.position.copy(L);
    pad.add(dust.points);
    this.scene.add(pad);
    let landed = false;

    // ---- the ride, as one path ----
    //the run-in: rolling up to the ramp, speeding up to 9 m/s as they get there
    const TQ = 2.2; // the transition's foot
    const vIn = 9;
    const accIn = 1.136;
    const runX = (t: number) => qx - vIn * (TQ - t) + accIn * (TQ - t) ** 2;
    //round the transition, pumping it from 9 up to 12 m/s
    const vOut = 12;
    const arc = (Math.PI / 2) * R;
    const TUP = TQ + (2 * arc) / (vIn + vOut); // off the coping
    const pump = (vOut - vIn) / (TUP - TQ);
    //then the flight: up to the apex 10.5 over the cloud tops, eased from the coping's speed (a smooth cubic, so the
    //launch and the slow top have no kinks), then a plain fall onto the blimp's back
    const APEX = H + 10.5;
    const TA = 3.4; // flight time to the apex
    const G = 11.7;
    const BACK = H + 4.05; // the blimp's back, where the board lands
    const TL = TA + Math.sqrt((2 * (APEX - BACK)) / G);
    const up = (tau: number): number => {
      if (tau >= TA) return APEX - (G / 2) * (tau - TA) ** 2;
      const u = tau / TA;
      return (2 * u ** 3 - 3 * u ** 2 + 1) * R + (u ** 3 - 2 * u ** 2 + u) * TA * vOut + (-2 * u ** 3 + 3 * u ** 2) * APEX;
    };
    //out of the cloud tops they steer over for the blimp: an easing drift along x that lands them on its back,
    //moving, and they slide to a stop over its middle
    let tauTop = 0;
    while (up(tauTop) < H && tauTop < TA) tauTop += 0.005;
    const LANDX = W(-1.5, 0, 0).x;
    const across = (tau: number) => {
      const u = Math.min(1, Math.max(0, (tau - tauTop) / (TL - tauTop)));
      return X0 + (LANDX - X0) * u * u;
    };
    const vLand = (2 * (LANDX - X0)) / (TL - tauTop);
    const STOP = W(2, 0, 0).x;
    const slide = (2 * (STOP - LANDX)) / vLand;
    //the clock runs slow over the top for the tre flip: the flight's own time against the cutscene's
    const rate = (t: number) => 1 - 0.8 * (smooth(5.4, 5.9, t) - smooth(8.4, 8.9, t));
    const STEP = 1 / 240;
    const flight: number[] = [];
    for (let t = TUP, tau = 0; t < 14; t += STEP) {
      flight.push(tau);
      tau += rate(t) * STEP;
    }
    const tauAt = (t: number) => {
      const i = Math.min(flight.length - 1, Math.max(0, Math.floor((t - TUP) / STEP)));
      return t < TUP ? 0 : flight[i];
    };
    const timeAt = (tau: number) => TUP + flight.findIndex((f) => f >= tau) * STEP;
    const LAND = timeAt(TL);
    //the cuts, where the path gets to them
    const yAt = (t: number) => up(tauAt(t));
    let cut = TUP;
    const when = (y: number) => {
      while (yAt(cut) < y && cut < 14) cut += STEP;
      return cut;
    };
    const C1 = when(13); // the street: they leave the top of frame
    const C2 = when(H - 3.5); // looking up: on into the cloud, then from over it as they burst out of the tops
    const C3 = C2;
    const C4 = 5.8; // over the clouds, wide: the slow motion takes hold; close in for the tre
    const C5 = 8.5; // and back out wide as it lets go, for the drop onto the blimp
    const C6 = D + 6.8; // the old cutscene: sitting on the blimp's back
    const TRE = [TA - 0.32, TA + 0.22]; // the tre flip, on the flight's clock (its clip is 0.42 s)
    // where they are at t (world), the pose and the board's roll
    const at = (t: number): { p: THREE.Vector3; pose: Pose; roll: number } => {
      if (t < TQ) return { p: V(runX(t), 0, street), pose: clipAt(t < 1.1 ? 'push' : 'ride', t), roll: 0 };
      if (t < TUP) {
        const k = t - TQ;
        const a = (vIn * k + (pump / 2) * k * k) / R;
        return { p: V(qx + R * Math.sin(a), R * (1 - Math.cos(a)), street), pose: clipAt('ride', t), roll: a };
      }
      const tau = tauAt(t);
      if (tau < TL) {
        const roll = (Math.PI / 2) * (1 - smooth(0, 0.45, tau));
        const air = clipAt('air', tau);
        const k = (tau - TRE[0]) / (TRE[1] - TRE[0]);
        const into = smooth(TRE[0] - 0.12, TRE[0], tau) * (1 - smooth(TRE[1], TRE[1] + 0.12, tau));
        const pose = into > 0 ? mixPose(air, clipAt('tre', Math.min(1, Math.max(0, k)) * 0.42), into) : air;
        return { p: V(across(tau), up(tau), street), pose, roll };
      }
      //down on the blimp's back: the knees take it, a slide to a stop, then they sit down
      const s = Math.min(1, (t - LAND) / slide);
      const x = LANDX + (STOP - LANDX) * (1 - (1 - s) ** 2);
      const sat = smooth(LAND + 0.7, C6 - 0.1, t);
      const pose = mixPose(clipAt('landBig', Math.min(0.6, t - LAND)), SIT, sat);
      return { p: V(x, BACK, street), pose, roll: 0 };
    };

    //the sounds: the run-in and the ramp, the pop off the coping, the slow tre, the landing on the blimp, the
    //gunships' eyes coming on, and the kick-up at the end
    this.loop(0, TQ, 'roll', 4.5);
    this.loop(TQ, TUP, 'roll', 6);
    this.sfx(TQ, 'kicker', 0.7);
    this.sfx(TUP, 'ollie');
    this.sfx(timeAt(TRE[0]), 'trick', 1, SLOW);
    this.sfx(LAND, 'impact');
    this.boom(LAND, V(LANDX, BACK, street), 1);
    this.sfx(LAND, 'land_sketchy', 0.5);
    this.loop(LAND, LAND + slide, 'roll', 4);
    for (let i = 0; i < ships.length; i++) this.sfx(D + 9.4 + i * 0.35, 'gun_aim', 0.4);
    this.sfx(D + 14.2, 'ollie', 0.7);
    this.sfx(D + 14.8, 'impact', 0.4);
    this.boom(D + 14.8, W(2, 4.05, 0), 0.4);
    return (t, dt) => {
      const shotNo = t < C1 ? 1 : t < C2 ? 2 : t < C3 ? 3 : t < C4 ? 4 : t < C5 ? 5 : t < C6 ? 6 : 7;
      const below = shotNo <= 2;
      const inCloud = shotNo === 3;
      c.group.visible = below;
      qp.visible = below;
      dome.visible = !below;
      stars.visible = !below;
      high.visible = !below;
      for (const e of eyes) e.visible = shotNo <= 4;
      sky.set(0.72);
      if (below) {
        c.update(t, dt);
        this.scene.fog = new THREE.Fog(DUSK.fog, DUSK.fogNear, DUSK.fogFar);
      } else this.scene.fog = inCloud ? new THREE.Fog(0xdfe4f0, 1, 30) : new THREE.Fog(0x1a2448, 300, 2400);
      const tt = t - D; // the old cutscene's clock, from the landing on
      ships.forEach((s, i) => {
        const on = tt > 9.4 + i * 0.35;
        s.light.material.opacity = on ? 0.7 + 0.3 * Math.sin(tt * 6 + i) : 0;
        s.g.visible = tt > 9;
      });
      if (t < LAND) {
        landed = false;
        dust.clear();
      } else if (!landed) {
        landed = true;
        dust.dust(-1.5, 4.05, 2.6);
        dust.dust(-1.5, 4.05, 2.2, true);
      }
      dust.update(dt, this.renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)));
      if (shotNo < 7) {
        const { p, pose, roll } = at(t);
        this.ride(p, 0, pose, roll);
        const rider = p.clone().add(V(0, 0.9, 0));
        if (shotNo === 1) {
          //1: wide, side on: they roll down the near lane, carve up the quarterpipe and launch straight up off the
          //coping; the camera tilts up after them as they go (an upright phone pans with them along the lane)
          const lx = this.tall ? Math.min(qx + 1, Math.max(p.x, qx - 10) + 1) : qx - 2;
          const ly = mix(3.2, 8, smooth(TUP, C1, t));
          this.shot(V(lx - 1, 3.4, street + 17), V(lx, ly, street), 48);
        } else if (shotNo === 2) {
          //2: from the foot of the ramp, looking up after them as they shrink into the dusk and into the cloud
          //(it follows them off the coping, then settles on the cloud they're heading into, so they shrink up into it)
          const look = rider.clone().lerp(V(X0 - 2, H - 4, street - 4), 0.85 * smooth(C1, C2 - 0.4, t));
          this.shot(V(X0 + 4, 0.8, street + 6), look, 62);
        } else if (shotNo === 3) {
          //3: inside the cloud: white all round, the drones' eyes behind; the camera rises slower than they do, so
          //they pass up through the frame
          const cy = H - 8 + (p.y - (H - 9)) * 0.45;
          this.shot(V(X0 + 6, cy, street + 8), V(X0, cy + 2, street), 58);
        } else if (shotNo === 4) {
          //4: out of the cloud tops into the stars, the blimp off to the side; the camera tilts up after them
          const look = rider.clone().lerp(W(-5, 6, 0), 0.35);
          this.shot(W(-4, 3, 15), look, 52);
        } else if (shotNo === 5) {
          //5: close, in slow motion, the camera drifting round them: the tre flip over the top
          const a = mix(0.55, -0.25, (t - C4) / (C5 - C4));
          this.shot(rider.clone().add(V(Math.sin(a) * 5.4, 0.6, Math.cos(a) * 5.4)), rider, 42);
        } else {
          //6: back out wide as the clock picks up: the drop onto the blimp's back, the slide, and they sit
          const look = rider.clone().lerp(W(0, 5, 0), 0.4);
          this.shot(W(8, 9, 16), look, 50);
          const hit = t >= LAND ? 1 - smooth(LAND, LAND + 0.4, t) : 0;
          if (hit > 0) this.camera.position.add(V((Math.random() - 0.5) * hit * 0.3, (Math.random() - 0.5) * hit * 0.25, 0));
        }
        return;
      }
      if (tt < 13.4) {
        //7 and 8: on the blimp's back to breathe; then looking up as the gunships' lights come on
        this.ride(W(2, 4.05, 0), 0, tt < 9.2 ? SIT : LOOK_UP);
        if (tt < 9.2) this.shot(W(7, 6.8, 9), W(1.5, 5.6, 0), 50);
        else this.shot(W(4.5, 4.6, 6), W(-2, 30, -40), 58);
        return;
      }
      //9: close and low: they stand, kick the board up, and grin
      const pop = tt - 14.2;
      const pose = pop > 0 && pop < 0.6 ? clipAt('ollie', pop) : clipAt('idle', tt);
      const hop = pop > 0 && pop < 0.6 ? Math.sin((pop / 0.6) * Math.PI) * 0.8 : 0;
      this.ride(W(2, 4.05 + hop, 0), -0.5, pose);
      this.shot(W(4.2, 4.6, 4.4), W(2, 6, 0), 46);
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
    //the sounds: wheels on the blimp, off its nose, the toe catching the board, the slow flip, the silo, the rocket
    this.loop(0, 3, 'roll', 6);
    this.sfx(0.4, 'drone_down', 0.8);
    this.sfx(3, 'ollie');
    this.sfx(6.6, 'clack', 0.7);
    this.sfx(7, 'trick', 1, SLOW);
    this.sfx(9.2, 'door_slam', 0.8, SLOW);
    this.sfx(10.2, 'car_wreck', 0.9, SLOW);
    this.sfx(13, 'gun_shot', 0.6, SLOW);
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
