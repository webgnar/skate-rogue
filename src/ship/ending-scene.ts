// The Chapter 1 ending (GDD: Cutscenes, "Storyboard: the Chapter 1 ending"): after act 5's finale, once the skater
// reaches the Pleiadian ship's beam. About 40 s, the first time you win; tap to skip to the title card. Later wins
// get the 5 s version (the beam lifts you, the ship takes you in) and go straight on to the dice and the summary.
//
//  A  0-5 s    the beam lifts the rider over the clouds; the last Flock camera on the tallest tower tilts up, sparks
//              and goes dark: NO SIGNAL
//  B  5-10 s   looking down: the AI's drones, its cruiser and its falling rocket stall at the cloud layer and turn
//              back. "It can't follow where the ground ends."
//  C  10-16 s  up into the black: the sky darkens, the stars come out, the ship fills the frame and takes them in
//  D  16-23 s  inside (the ship hub, src/ship/hub-scene.ts): the rider drops in, the crew dancing round the spot
//  E  23-29 s  out through the glass: Earth, small. "Everyone down there is still asleep."
//  F  29-35 s  the ship turns away, the Pleiades brighten, the stars stretch into lines and it jumps.
//              "Next stop: the stars."
//  G  35-40 s  CHAPTER 1 COMPLETE, then CHAPTER 2 COMING SOON
//
// The outside shots are their own THREE.Scene; the inside ones are the hub's, its camera held on each shot.
import * as THREE from 'three';
import { BASE, type Pose } from '../render/poses';
import { SCALE } from '../render/skater-rig';
import { makeDrone } from '../render/drone-view';
import { makeParkedCruiser } from '../render/kit';
import { makeRocket } from '../render/chaser-view';
import { inkify, setInkLens, setInkResolution, toon } from '../render/toon';
import { cloudTexture, glowTexture } from '../title/city';
import { makeRng } from '../gen/rng';
import { saucer } from './saucer';
import { PLEIADES_AT, type HubScene } from './hub-scene';

export const ENDING = {
  long: 40, // seconds, the first win
  short: 5, // seconds, every win after
  shipUp: 150, // the ship's height over the clouds, tiles
  shipScale: 3,
};

// the shots' start times (seconds), and the captions over them
const AT = { B: 5, C: 10, D: 16, E: 23, F: 29, G: 35 };
const CAPTIONS: [number, number, string][] = [
  [6, 10, "It can't follow where the ground ends."],
  [24, 29, 'Everyone down there is still asleep.'],
  [31, 35, 'Next stop: the stars.'],
];

const smooth = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

// the rider in the beam: stood on the board, arms floating out, weightless
const FLOAT: Pose = { ...BASE, armLRaise: 1.1, armRRaise: 1.1, armLElbow: 0.4, armRElbow: 0.4, head: 0.25, bend: 0.1 };

export interface EndingUi {
  caption(text: string): void; // '' clears it
  card(step: 0 | 1 | 2): void; // 0 none, 1 CHAPTER 1 COMPLETE, 2 CHAPTER 2 COMING SOON
  flash(k: number): void; // a white-out over everything, 0 to 1
}

export class EndingScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.3, 4000);
  private readonly sky: THREE.ShaderMaterial;
  private readonly stars: THREE.Points;
  private readonly ship = saucer();
  private readonly beam: THREE.Mesh;
  private readonly flock: { lamp: THREE.MeshBasicMaterial; head: THREE.Group; screen: THREE.Sprite; sparks: THREE.Sprite[] };
  private readonly chasers: { o: THREE.Object3D; from: THREE.Vector3; spin: number }[] = [];
  private readonly rocket: THREE.Group;
  private readonly streaks: THREE.LineSegments;
  private t = 0;
  private len: number;
  private done = false;
  private inside = false;
  private earthTurn = 0;
  onDone: (() => void) | null = null;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly hub: HubScene,
    readonly full: boolean,
    private readonly ui: EndingUi,
  ) {
    this.len = full ? ENDING.long : ENDING.short;
    const s = this.scene;
    s.fog = new THREE.Fog(0x9ac8ff, 120, 600);
    this.sky = skyMaterial();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), this.sky);
    dome.renderOrder = -100;
    dome.frustumCulled = false;
    s.add(dome);
    this.stars = stars();
    s.add(this.stars);
    s.add(clouds());
    s.add(new THREE.HemisphereLight(0xdfe8ff, 0x6a5a8a, 1.6));
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.8);
    sun.position.set(40, 60, 30);
    s.add(sun);
    //the ship, high over the beam, and the beam down through the clouds
    this.ship.scale.setScalar(ENDING.shipScale);
    this.ship.position.set(0, ENDING.shipUp, 0);
    inkify(this.ship);
    s.add(this.ship);
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 3.4, ENDING.shipUp + 40, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    this.beam.position.y = (ENDING.shipUp - 40) / 2;
    s.add(this.beam);
    this.flock = flockTower(s);
    //the hunt, stalled at the cloud tops: three drones, the cruiser on its jets, the rocket falling away
    const drone = (x: number, z: number) => {
      const d = makeDrone();
      d.group.scale.setScalar(1.8);
      inkify(d.group);
      d.group.position.set(x, 0.5, z);
      s.add(d.group);
      this.chasers.push({ o: d.group, from: d.group.position.clone(), spin: (x > 0 ? 1 : -1) * 0.8 });
    };
    drone(-8, 3);
    drone(7, 5);
    drone(-4, -8);
    drone(9, -6);
    const car = makeParkedCruiser(-1.6, 1.6, 0, 1.3, 0);
    inkify(car);
    car.scale.setScalar(1.2);
    car.position.set(3, 0.6, -9);
    s.add(car);
    this.chasers.push({ o: car, from: car.position.clone(), spin: -0.5 });
    this.rocket = makeRocket();
    inkify(this.rocket);
    this.rocket.scale.setScalar(2);
    s.add(this.rocket);
    this.streaks = streaks();
    this.hub.scene.add(this.streaks);
    const rider = this.hub.rider;
    if (rider) {
      s.add(rider.mesh);
      rider.mesh.rotation.set(0, 0.6, 0);
    }
  }

  // a tap: the long ending skips to its title card, the card (or the short one) ends it
  tap(): void {
    if (this.full && this.t < AT.G - 0.3) this.t = AT.G - 0.3;
    else this.finish();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.ui.caption('');
    this.ui.card(0);
    this.ui.flash(0);
    this.streaks.removeFromParent();
    this.hub.hold = null;
    this.hub.riderUp = 0;
    this.hub.riderCentre = false;
    this.hub.window.rotation.set(0, 0, 0);
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }

  frame(dt: number): void {
    if (this.done) return;
    this.t += dt;
    const t = this.t;
    if (t >= this.len) return this.finish();
    if (this.full) this.long(t, dt);
    else this.short(t, dt);
  }

  // ---- the 40 s version ----
  private long(t: number, dt: number): void {
    const cap = CAPTIONS.find(([a, b]) => t >= a && t < b);
    this.ui.caption(cap ? cap[2] : '');
    this.ui.card(t >= AT.G + 2.4 ? 2 : t >= AT.G ? 1 : 0);
    if (t < AT.D) {
      //outside: up through the beam
      const y = t < AT.C ? mix(4, 14, smooth(0, AT.C, t)) : mix(14, ENDING.shipUp - 4, Math.pow(smooth(AT.C, AT.D - 0.6, t), 1.6));
      const space = smooth(AT.C, AT.D - 1.5, t);
      this.outside(y, space, t, dt);
      if (t < AT.B) this.shotA(t, y);
      else if (t < AT.C) this.shotB(t, y);
      else this.shotC(t, y);
      //into the ship's belly: a white-out that the inside comes up out of
      this.ui.flash(smooth(AT.D - 1, AT.D, t));
      this.draw(this.scene, this.camera);
      return;
    }
    this.goInside();
    this.ui.flash(1 - smooth(AT.D, AT.D + 0.8, t) + (t > AT.F + 4.8 ? smooth(AT.F + 4.8, AT.F + 5.4, t) * (1 - smooth(AT.G, AT.G + 0.8, t)) : 0));
    const h = this.hub;
    const tall = this.renderer.domElement.clientWidth < this.renderer.domElement.clientHeight;
    if (t < AT.E) {
      //the rider drops in out of the light, the crew round them
      h.riderUp = 9 * (1 - smooth(AT.D, AT.D + 3, t));
      h.hold = { at: new THREE.Vector3(mix(-3, 2, smooth(AT.D, AT.E, t)), 3.2, tall ? 13 : 10.5), look: new THREE.Vector3(0, 2.4 + h.riderUp * 0.5, 0), fov: tall ? 72 : 54 };
    } else if (t < AT.F) {
      //over the rider's shoulder, out through the glass to Earth
      h.riderUp = 0;
      const k = smooth(AT.E, AT.F, t);
      h.hold = { at: new THREE.Vector3(2.2, 3.6, 7.5 - k), look: new THREE.Vector3(-30, -4, -60), fov: tall ? 70 : 52 };
    } else {
      //the ship turns from Earth to the Pleiades, the camera lifting to them, and the stars stretch as it jumps
      const turn = smooth(AT.F, AT.F + 3, t);
      this.earthTurn = 0.35 * turn;
      h.window.rotation.y = this.earthTurn;
      const p = PLEIADES_AT.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.earthTurn);
      const look = new THREE.Vector3(-30, -4, -60).lerp(p.clone().multiplyScalar(0.1), turn);
      h.hold = { at: new THREE.Vector3(2.2, 3.6, 6.5), look, fov: tall ? 70 : 52 };
      const warp = smooth(AT.F + 3, AT.F + 5.4, t);
      this.streaks.visible = warp > 0;
      const st = this.streaks.material as THREE.LineBasicMaterial;
      st.opacity = warp;
      this.streaks.scale.set(1, 1, 0.05 + warp * 6);
      this.streaks.position.copy(h.camera.position);
      this.streaks.quaternion.copy(h.camera.quaternion);
    }
    h.frame(dt);
  }

  // ---- the 5 s version: lifted in the beam, then up into the ship ----
  private short(t: number, dt: number): void {
    const up = smooth(0, this.len - 0.4, t);
    const y = mix(4, ENDING.shipUp - 4, Math.pow(up, 2.2));
    const space = smooth(1.5, this.len - 0.8, t);
    this.outside(y, space, t, dt);
    if (t < 2.2) this.shotA(t * 1.4, y);
    else this.shotC(mix(AT.C, AT.D, (t - 2.2) / (this.len - 2.2)), y);
    this.ui.flash(smooth(this.len - 0.8, this.len, t));
    this.draw(this.scene, this.camera);
  }

  // the outside world this frame: the rider at height y, the sky gone from blue to black by `space`
  private outside(y: number, space: number, t: number, dt: number): void {
    this.sky.uniforms.uSpace.value = space;
    (this.stars.material as THREE.PointsMaterial).opacity = smooth(0.3, 0.9, space);
    this.scene.fog!.color.setRGB(mix(0.6, 0.02, space), mix(0.78, 0.02, space), mix(1, 0.06, space));
    const rider = this.hub.rider;
    if (rider) {
      rider.preview(FLOAT);
      rider.mesh.scale.setScalar(SCALE);
      rider.mesh.position.set(0, y, 0);
      rider.mesh.rotation.y = 0.6 + t * 0.25; // a slow turn as they rise, the wheels stopped
    }
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.sin(t * 6) * 0.03;
    this.ship.rotation.y += dt * 0.3;
    //the Flock camera tilts up to follow, sparks, and goes dark
    const f = this.flock;
    const look = smooth(0.5, 2.6, t);
    f.head.rotation.z = 0.25 + look * 0.7;
    const dead = t > 2.8;
    f.lamp.color.set(dead ? 0x200808 : (Math.floor(t * 4) % 2 ? 0xff2030 : 0x801010));
    f.screen.visible = dead;
    f.sparks.forEach((sp, i) => {
      const k = t - 2.8 - i * 0.05;
      sp.visible = k > 0 && k < 0.7;
      sp.position.set(-8 + Math.cos(i * 1.7) * k * 3, 5.6 + k * 2 - k * k * 6, -9 + Math.sin(i * 1.7) * k * 3);
      sp.scale.setScalar(0.6 * (1 - k));
    });
    //the hunt stalls at the cloud tops, then sinks back down into them, turning away
    const sink = smooth(AT.B + 1.5, AT.C, this.full ? t : 0);
    for (const c of this.chasers) {
      c.o.position.copy(c.from);
      c.o.position.y = c.from.y + Math.sin(t * 2 + c.from.x) * 0.3 - sink * 14;
      c.o.rotation.y = c.spin * sink * 2;
    }
    //the rocket: its engine cut, tipping over and falling back through the clouds
    const fall = Math.max(0, t - AT.B + 0.5);
    this.rocket.position.set(-10 + fall * 1.2, 10 - fall * fall * 1.4, -2);
    this.rocket.rotation.set(0, 0, Math.PI / 2 - Math.min(Math.PI * 1.2, fall * 0.9));
    this.rocket.visible = this.full && t > AT.B - 1 && t < AT.C;
    const fire = this.rocket.getObjectByName('flame');
    if (fire) fire.visible = fall < 0.3;
  }

  private aspect(): boolean {
    const css = this.renderer.domElement;
    this.camera.aspect = css.clientWidth / Math.max(1, css.clientHeight);
    return this.camera.aspect < 1;
  }

  // A: from beside the beam, the rider rising, the Flock tower poking up through the clouds behind
  private shotA(_t: number, y: number): void {
    const tall = this.aspect();
    this.camera.fov = tall ? 68 : 48;
    this.camera.position.set(tall ? 3.5 : 4.5, y + 0.6, tall ? 10 : 8);
    this.camera.lookAt(-3.5, y - 0.6, -3);
  }

  // B: from over the rider's head, looking down at the hunt stalling at the clouds
  private shotB(t: number, y: number): void {
    const tall = this.aspect();
    this.camera.fov = tall ? 75 : 58;
    const k = smooth(AT.B, AT.C, t);
    this.camera.position.set(5.5, y + 4, 6 - k);
    this.camera.lookAt(-1, 0, -3);
  }

  // C: from under the rider, looking up past them to the ship, the black coming in
  private shotC(t: number, y: number): void {
    const tall = this.aspect();
    this.camera.fov = tall ? 72 : 55;
    const k = smooth(AT.C, AT.D, t);
    this.camera.position.set(5 - k * 1.5, y - 4 + k * 2, 6 - k * 2);
    this.camera.lookAt(0, mix(y + 3, ENDING.shipUp, k * k * 0.4), 0);
  }

  // into the ship: the rider goes back to the crew
  private goInside(): void {
    if (this.inside) return;
    this.inside = true;
    const rider = this.hub.rider;
    if (rider) {
      this.hub.scene.add(rider.mesh);
      rider.mesh.rotation.set(0, 0, 0);
    }
    this.hub.riderCentre = true;
  }

  private draw(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    const r = this.renderer;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    camera.updateProjectionMatrix();
    setInkLens(0, 1, 1);
    setInkResolution(size.x, size.y, r.getPixelRatio());
    this.hub.inkWidths();
    r.setRenderTarget(null);
    r.clear();
    r.render(scene, camera);
  }

  get time(): number {
    return this.t;
  }

  // stills for checks: jump to a moment
  seek(t: number): void {
    this.t = Math.max(0, t - 1 / 60);
    if (t >= AT.D) this.goInside();
  }
}

// ---- the pieces ----

// the sky: day blue at the cloud tops, deep blue overhead, mixed to the black of space by uSpace
export function skyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uSpace: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uSpace;
      varying vec3 vDir;
      void main() {
        float h = normalize(vDir).y;
        vec3 day = mix(vec3(0.72, 0.86, 1.0), vec3(0.16, 0.38, 0.86), smoothstep(-0.1, 0.8, h));
        vec3 black = mix(vec3(0.05, 0.06, 0.16), vec3(0.01, 0.01, 0.03), smoothstep(-0.2, 0.6, h));
        gl_FragColor = vec4(mix(day, black, uSpace), 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

export function stars(): THREE.Points {
  const rng = makeRng(9);
  const n = 1200;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rng() * 1.2 - 0.2;
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - u * u));
    pos.set([Math.cos(a) * r * 1200, u * 1200, Math.sin(a) * r * 1200], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  p.frustumCulled = false;
  return p;
}

// the cloud sea under the rider, seen from above: a soft white floor, and cloud cards lying flat on it, overlapping
export function clouds(): THREE.Group {
  const g = new THREE.Group();
  const rng = makeRng(21);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(900, 40), new THREE.MeshBasicMaterial({ color: 0xdfe6fa }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -6;
  floor.userData.inked = true;
  g.add(floor);
  const mats = [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ map: cloudTexture(rng), transparent: true, depthWrite: false, color: 0xffffff, side: THREE.DoubleSide }));
  const geo = new THREE.PlaneGeometry(1, 0.44);
  for (let i = 0; i < 110; i++) {
    const c = new THREE.Mesh(geo, mats[i % 3]);
    const r = 6 + rng() * 260;
    const a = rng() * Math.PI * 2;
    c.position.set(Math.cos(a) * r, -1.5 - rng() * 4, Math.sin(a) * r);
    c.rotation.set(-Math.PI / 2, 0, rng() * Math.PI * 2);
    const w = 24 + rng() * 60;
    c.scale.set(w, w * 1.6, 1);
    c.userData.inked = true;
    g.add(c);
  }
  return g;
}

// the tallest tower's top poking up through the clouds, the last Flock camera on its pole
function flockTower(s: THREE.Scene) {
  const g = new THREE.Group();
  const wall = toon({ color: 0x5a6270 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(5, 10, 5), wall);
  top.position.y = -2;
  g.add(top);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 8), toon({ color: 0x9aa0aa }));
  spire.position.y = 5;
  g.add(spire);
  const head = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.6), toon({ color: 0x2a2a34 }));
  body.position.x = 0.4;
  head.add(body);
  const lamp = new THREE.MeshBasicMaterial({ color: 0xff2030 });
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), lamp);
  eye.position.x = 1.05;
  head.add(eye);
  head.position.y = 6.6;
  g.add(head);
  g.position.set(-9, -1, -9);
  inkify(g);
  s.add(g);
  //NO SIGNAL, over it once it's dead
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 72;
  const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(26,4,8,0.9)';
  x.fillRect(0, 0, 256, 72);
  x.strokeStyle = x.fillStyle = '#ff3a4a';
  x.lineWidth = 5;
  x.strokeRect(5, 5, 246, 62);
  x.font = "bold 40px Bangers, 'Arial Black', sans-serif";
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('NO SIGNAL', 128, 38);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, fog: false }));
  screen.scale.set(4, 1.1, 1);
  screen.position.set(-9, 7.4, -9);
  screen.renderOrder = 10;
  screen.visible = false;
  s.add(screen);
  const glow = glowTexture();
  const sparks = Array.from({ length: 6 }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffe080, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    sp.visible = false;
    s.add(sp);
    return sp;
  });
  return { lamp, head, screen, sparks };
}

// the jump: streaks of starlight along the way the ship looks, drawn in the camera's own space (lines parallel to
// its view run out from the middle of the screen)
function streaks(): THREE.LineSegments {
  const rng = makeRng(13);
  const n = 260;
  const pos = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = 2 + rng() * 60;
    const z = -40 - rng() * 260;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    pos.set([x, y, z, x, y, z + 18], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  lines.frustumCulled = false;
  lines.visible = false;
  lines.userData.inked = true;
  return lines;
}

