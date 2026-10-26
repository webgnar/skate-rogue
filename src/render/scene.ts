// The 2.5D view: renderer, Lou Gnar's camera (see camera.ts), lights, sky and skyline.
import * as THREE from 'three';
import type { Level } from '../physics/level';
import { CAM, CamDrift, DYN_CAM, LouZoom, Rhythm, SMOOTH, Spring, framing, type Framing } from './camera';
import { LENS, Lens, lensSource, lensWiden } from './lens';
import { tilt } from './tilt';
import { buildKit, toX, toY } from './kit';
import { NightCity } from './night';
import { FX } from './fx-settings';
import { railTint } from './rail-metal';
import { batchStatic } from './batch';
import { GateFx } from './gate-fx';
import { SirenFx } from './siren-fx';
import { Ambience, BACKDROP_SPAN, BACKDROPS, type BiomeId } from './biomes';
import { loadSheet, loadWorlds } from './skins';
import { WORLDS } from './quarters';
import { loadImage, pixelTexture } from './textures';
import { inkify, setInkResolution, solid } from './toon';
import { mergeInk, splitSlabs } from './kit-merge';
import { RAIN, Rain, skyMesh, skylineMaterial, type Mood } from './atmosphere';
import { Puddles } from './puddles';

// keep everything: a clipping plane this far out cuts nothing
const NO_CUT = 1e6;
// the floor just left stays drawn behind the skater until the camera is this many tiles into the next one
const BEHIND_TILES = 40;

// the next floor, built ahead of time past the end of this one (src/game/game.ts runs a whole run as one street):
// its kit is built a step a frame so it never stalls the game, then waits, hidden, until the skater nears the join
interface Ahead {
  root: THREE.Group; // at the next floor's origin, in this floor's world
  level: Level;
  seed: number;
  floor: number;
  kit: THREE.Group | null; // null until its build is done
  job: Generator<void, THREE.Group> | null;
  night: NightCity;
  gates: GateFx;
  sirens: SirenFx;
  cut: THREE.Plane[]; // its kit's clipping planes: [start, end]
  at: THREE.Vector2; // where its origin is, in world units
}

// a floor's kit is cut at its ends where another floor joins, so their margins (the city past each end) never
// overlap. Every kit always has both planes, set out of the way when nothing joins, so programs never recompile.
function cutPlanes(): THREE.Plane[] {
  return [new THREE.Plane(new THREE.Vector3(1, 0, 0), NO_CUT), new THREE.Plane(new THREE.Vector3(-1, 0, 0), NO_CUT)];
}

// give a fresh kit its own copies of its materials, clipped by its planes (the outline material is shared by every
// model: its copy keeps the shared uniforms, so resizes still reach it)
function clipKit(kit: THREE.Object3D, planes: THREE.Plane[]): void {
  const copies = new Map<THREE.Material, THREE.Material>();
  const clip = (m: THREE.Material) => {
    let c = copies.get(m);
    if (!c) {
      c = m.clone();
      if (m instanceof THREE.ShaderMaterial) (c as THREE.ShaderMaterial).uniforms = m.uniforms;
      c.clippingPlanes = planes;
      c.userData.clipCopy = true;
      copies.set(m, c);
    }
    return c;
  };
  kit.traverse((o) => {
    if (o instanceof THREE.Mesh) o.material = Array.isArray(o.material) ? o.material.map(clip) : clip(o.material);
  });
}

// free a kit's geometry, materials and their textures
function disposeKit(kit: THREE.Object3D): void {
  kit.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    //outlines share their geometry with what they outline (bar the merged one), and the outline material
    if (o.userData.inkMerged) o.geometry.dispose();
    else if (!o.userData.ink) o.geometry.dispose();
    for (const m of [o.material].flat()) {
      if (o.userData.ink && !m.userData.clipCopy) continue;
      if (m.name === 'railMetal' && !m.userData.clipCopy) continue; // shared by every floor (rail-metal.ts)
      if (!o.userData.ink) (m as THREE.MeshLambertMaterial).map?.dispose();
      m.dispose();
    }
  });
}

// run a generator to its end
function run<T>(job: Generator<void, T>): T {
  for (;;) {
    const step = job.next();
    if (step.done) return step.value;
  }
}

export class StreetView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  // the skater draws in its own pass over the level: always in front of what they ride, still occluding itself
  readonly front = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 400);
  private kit: THREE.Group | null = null;
  private cut = cutPlanes(); // the kit's clipping planes: [start, end]
  private aheads = new Map<string, Ahead>();
  private behind: { root: THREE.Group; kit: THREE.Group } | null = null;
  private skyDrop = 0; // world units the backdrop still sits above its place after a floor joined on (eases to 0)
  private biome: BiomeId = 'chicago';
  private sheet: HTMLImageElement | null = null; // the biome's tile sheet (skins.ts)
  private worlds = new Map<BiomeId, HTMLImageElement>(); // every world's sheet, for the one city's quarters
  private base = '';
  private seed = 0;
  private floor = 1;
  night = new NightCity(); // these three are the floor being skated's: the next floor's take over at the join
  gates = new GateFx();
  sirens = new SirenFx();
  readonly ambience = new Ambience();
  private wet = 0;
  private backdrop: { mesh: THREE.Mesh; parallax: number; w: number; y: number; off: number }[] = [];
  private readonly backdropTexs = new Map<string, THREE.Texture>();
  private readonly hemis: THREE.HemisphereLight[] = [];
  private readonly suns: THREE.DirectionalLight[] = [];
  private readonly sky = skyMesh();
  readonly rain = new Rain();
  readonly puddles = new Puddles();
  private lightningIn = 0; // seconds to the next lightning glow in a downpour
  private flash = 0; // seconds into the current glow
  private mood: Mood | null = null;
  readonly zoom = new LouZoom();
  readonly drift = new CamDrift();
  readonly rhythm = new Rhythm();
  private readonly lens = new Lens();
  private lensK = 0; // the fisheye's strength this frame (lens.ts)
  private readonly smooth = { zoom: new Spring(1), fov: new Spring(0), lens: new Spring(CAM.lens), yaw: new Spring(0), roll: new Spring(0), tilt: new Spring(0) };
  private camX = 0;
  private camY = 2;
  private lagY = 0; // world units the camera trails the feet in y, easing to 0 (a soft follow on jumps and drops)
  private lastY = 2;
  private dist = 22;
  private frame: Framing = framing(16, 9); // the framing on screen now, gliding to frameTo after a rotation
  private frameTo: Framing = this.frame;
  private readonly frameS = { viewH: new Spring(16), fov: new Spring(40), lead: new Spring(0), low: new Spring(0), punch: new Spring(1) };
  private viewPx = 0; // the canvas's css height at the last resize (0: never sized)
  private pixelRatio: number; // what the renderer draws at: autoRatio, or coarser for the chunky look (FX.pixel)
  private autoRatio: number; // the device's ratio, lowered when frames stay slow
  private slowMs = 0;
  private shakeAmt = 0;
  private punchAmt = 0;
  private punchRoll = 1;
  private readonly buf = new THREE.Vector2();

  constructor(
    readonly canvas: HTMLCanvasElement,
    private level: Level,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.autoRatio = this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.applyPixel();
    this.renderer.info.autoReset = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.localClippingEnabled = true; // floors' kits are cut where they join (clipKit)
    this.scene.background = new THREE.Color(0x2a1d4a);
    this.scene.fog = new THREE.Fog(0x3a2a5c, 40, 140);

    //toon shading bands the sun; the sky light fills the shadow side flat. Colours come from the mood (atmosphere.ts)
    for (const pass of [this.scene, this.front]) {
      const hemi = new THREE.HemisphereLight(0xffe8f0, 0x403050, 1.1);
      const sun = new THREE.DirectionalLight(0xfff0e0, 2.1);
      sun.position.set(-6, 12, 10);
      pass.add(hemi, sun);
      this.hemis.push(hemi);
      this.suns.push(sun);
    }
    this.scene.add(this.sky, this.puddles.mesh, this.night.group, this.gates.group, this.sirens.group, this.ambience.points);
    this.front.add(this.rain.mesh);
    this.renderer.autoClear = false;
  }

  async loadBackdrop(base: string): Promise<void> {
    this.base = base;
    //the sky is a gradient drawn per mood (QFS's Chicago sky is a plain blue gradient, the afternoon mood);
    //behind the street, the district's far cards (Chicago's pink skyline)
    this.scene.background = null;
    //the other worlds' tiles for the city's quarters: the floor is rebuilt in them once they're in
    void loadWorlds(base, WORLDS).then((w) => {
      this.worlds = w;
      if (this.kit) this.setLevel(this.level, this.seed, this.floor);
    });
    await this.buildBackdrop(this.biome);
  }

  // the district's far cards (biomes.ts BACKDROPS); a layer that fails to load is left out
  private async buildBackdrop(id: BiomeId): Promise<void> {
    const layers = await Promise.all(
      BACKDROPS[id].map(async (l) => {
        try {
          return { l, tex: await this.backdropTex(l.file) };
        } catch (err) {
          console.warn(`backdrop ${l.file} failed to load`, err);
          return null;
        }
      }),
    );
    for (const b of this.backdrop) {
      this.scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material).dispose();
    }
    this.backdrop = [];
    for (const one of layers) {
      if (!one) continue;
      const { l } = one;
      const w = l.px[0] * l.scale;
      const h = l.px[1] * l.scale;
      const repeat = Math.max(1, Math.round(BACKDROP_SPAN / w));
      const tex = one.tex.clone();
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.set(repeat, 1);
      tex.needsUpdate = true;
      tex.updateMatrix();
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w * repeat, h), skylineMaterial(tex));
      mesh.position.set(0, h / 2 - 10 + l.lift, l.z);
      this.scene.add(mesh);
      this.backdrop.push({ mesh, parallax: l.parallax, w, y: mesh.position.y, off: 0 });
    }
    if (this.mood) this.setMood(this.mood, this.rain.amount);
  }

  private async backdropTex(file: string): Promise<THREE.Texture> {
    let t = this.backdropTexs.get(file);
    if (!t) {
      t = pixelTexture(await loadImage(`${this.base}tex/${file}`));
      this.backdropTexs.set(file, t);
    }
    return t;
  }

  // light, fog, sky and skyline for a time of day and weather
  setMood(m: Mood, rain = 0): void {
    this.mood = m;
    for (const h of this.hemis) {
      h.color.setHex(m.hemiSky);
      h.groundColor.setHex(m.hemiGround);
      h.intensity = m.hemi;
    }
    for (const s of this.suns) {
      s.color.setHex(m.sun);
      s.intensity = m.sunI;
      s.position.set(...m.sunDir);
    }
    const fog = this.scene.fog as THREE.Fog;
    fog.color.setHex(m.fog);
    fog.near = m.fogNear;
    fog.far = m.fogFar;
    const sky = (this.sky.material as THREE.ShaderMaterial).uniforms;
    sky.uTop.value.setHex(m.skyTop);
    sky.uBottom.value.setHex(m.skyBottom);
    sky.uStars.value = m.stars;
    for (const b of this.backdrop) {
      const u = (b.mesh.material as THREE.ShaderMaterial).uniforms;
      u.uTint.value.setHex(m.skyline);
      u.uNeon.value = m.neon;
    }
    this.rain.amount = rain;
    this.wet = Math.min(1, rain);
    for (const kit of this.kits()) this.wetKit(kit);
    this.puddles.setSky(m.skyTop, m.skyBottom, m.neon);
    for (const n of [this.night, ...[...this.aheads.values()].map((a) => a.night)]) n.setNight(m.neon, rain);
    for (const s of [this.sirens, ...[...this.aheads.values()].map((a) => a.sirens)]) s.setNight(m.neon);
    this.lightningIn = 6 + Math.random() * 6;
    this.flash = 99;
  }

  // this floor's street kit (its parked cars show car-hop damage, car-damage.ts); null while it builds
  get currentKit(): THREE.Group | null {
    return this.kit;
  }

  // seed and floor place the night city's lamps, cameras and billboards. A fresh start: the floors ahead and behind
  // are dropped (the game asks for the next one again)
  setLevel(level: Level, seed = 0, floor = 1): void {
    this.level = level;
    this.seed = seed;
    this.floor = floor;
    if (this.kit) {
      this.scene.remove(this.kit);
      disposeKit(this.kit);
    }
    this.dropAheads([]);
    this.dropBehind();
    this.cut = cutPlanes();
    this.kit = run(this.kitSteps(level, this.cut));
    this.scene.add(this.kit);
    this.night.build(level, this.kit, seed, floor);
    this.gates.build(this.kit);
    this.sirens.build(this.kit);
  }

  // a floor's kit, a step at a time: the generator yields between the slow parts
  private *kitSteps(level: Level, cut: THREE.Plane[]): Generator<void, THREE.Group> {
    const kit = buildKit(level, this.biome, this.sheet, this.worlds);
    yield;
    const slabs = splitSlabs(kit);
    batchStatic(kit);
    yield;
    inkify(kit, { outline: (m) => !m.userData.noInk && solid(m) });
    yield;
    mergeInk(kit, slabs);
    clipKit(kit, cut);
    this.kitInk(kit);
    this.wetKit(kit);
    return kit;
  }

  // build the next floor past the end of this one, its origin at (x, y) world units: a step a frame (see tick).
  // Asking again for one already built or building does nothing.
  buildAhead(key: string, level: Level, seed: number, floor: number, x: number, y: number): void {
    if (this.aheads.has(key)) return;
    const root = new THREE.Group();
    root.position.set(x, y, 0);
    root.visible = false;
    const cut = cutPlanes();
    cut[0].constant = -x; // its kit keeps x >= the join
    const a: Ahead = { root, level, seed, floor, kit: null, job: null, night: new NightCity(), gates: new GateFx(), sirens: new SirenFx(), cut, at: new THREE.Vector2(x, y) };
    a.job = this.kitSteps(level, cut);
    this.aheads.set(key, a);
    this.scene.add(root);
  }

  hasAhead(key: string): boolean {
    return this.aheads.has(key);
  }

  // drop the floors ahead that aren't in `keep` (the road was decided, or a new run began)
  dropAheads(keep: string[]): void {
    for (const [key, a] of this.aheads) {
      if (keep.includes(key)) continue;
      this.scene.remove(a.root);
      if (a.kit) disposeKit(a.kit);
      this.aheads.delete(key);
    }
  }

  // show one floor ahead (the road the skater is on), or none: hidden, its whole outline mesh isn't drawn
  showAhead(key: string | null): void {
    let shown = false;
    for (const [k, a] of this.aheads) {
      a.root.visible = k === key && a.kit !== null;
      shown ||= a.root.visible;
    }
    //this floor's kit stops where the shown one starts
    const a = key ? this.aheads.get(key) : undefined;
    this.cut[1].constant = shown && a ? a.at.x : NO_CUT;
  }

  // one step of the next floor's build, once a frame
  tick(): void {
    for (const a of this.aheads.values()) {
      if (!a.job) continue;
      const step = a.job.next();
      if (step.done) this.finishAhead(a, step.value);
      return;
    }
  }

  private finishAhead(a: Ahead, kit: THREE.Group): void {
    a.job = null;
    a.kit = kit;
    a.root.add(kit, a.night.group, a.gates.group, a.sirens.group);
    a.night.build(a.level, kit, a.seed, a.floor);
    a.night.setNight(this.mood?.neon ?? 0, this.rain.amount);
    a.sirens.setNight(this.mood?.neon ?? 0);
    a.gates.build(kit);
    a.sirens.build(kit);
    //upload its textures now, not on the frame it first comes into view
    kit.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      for (const m of [o.material].flat() as THREE.MeshToonMaterial[]) for (const t of [m.map, m.emissiveMap]) if (t) this.renderer.initTexture(t);
    });
  }

  // the skater crossed into the floor ahead: it becomes this floor, at the world's origin, and everything moves
  // back by its origin (the game moves the skater, and the effects, the same way). The floor left stays drawn
  // behind until it's off screen. Finishes the floor's build first if it isn't done.
  promote(key: string, level: Level, seed: number, floor: number, x: number, y: number): void {
    this.buildAhead(key, level, seed, floor, x, y);
    const a = this.aheads.get(key)!;
    while (a.job) {
      const step = a.job.next();
      if (step.done) this.finishAhead(a, step.value);
    }
    this.aheads.delete(key);
    this.dropAheads([]);
    this.dropBehind();
    //this floor goes behind, cut where the next starts
    if (this.kit) {
      const root = new THREE.Group();
      root.position.set(-a.at.x, -a.at.y, 0);
      root.add(this.kit, this.night.group, this.gates.group, this.sirens.group);
      this.scene.add(root);
      this.cut[1].constant = 0;
      this.behind = { root, kit: this.kit };
    }
    //and the next comes to the origin, cut where the last one ended
    this.scene.remove(a.root);
    this.scene.add(a.kit!, a.night.group, a.gates.group, a.sirens.group);
    a.cut[0].constant = 0;
    this.kit = a.kit;
    this.cut = a.cut;
    this.night = a.night;
    this.gates = a.gates;
    this.sirens = a.sirens;
    this.level = level;
    this.seed = seed;
    this.floor = floor;
    //the far cards stay where they were on screen: the skyline drifts back down to its place over a few seconds
    for (const b of this.backdrop) b.off = THREE.MathUtils.euclideanModulo(b.off + a.at.x * (b.parallax - 1) + b.w / 2, b.w) - b.w / 2;
    this.skyDrop -= a.at.y;
    this.lastY -= a.at.y; //the feet jump by the join's offset; the camera's soft follow mustn't see it as a drop
  }

  private dropBehind(): void {
    if (!this.behind) return;
    this.scene.remove(this.behind.root);
    disposeKit(this.behind.kit);
    this.behind = null;
    this.cut[0].constant = NO_CUT;
  }

  // the district's kit (skins.ts): loads its tiles, then rebuilds the floor's kit in them. Chicago if they fail.
  async setBiome(id: BiomeId): Promise<void> {
    const sheet = await loadSheet(this.base, id).catch((err) => {
      console.warn(`${id} tiles failed to load, staying in Chicago`, err);
      return null;
    });
    this.biome = sheet ? id : 'chicago';
    this.sheet = sheet;
    await this.buildBackdrop(id);
    if (this.kit) this.setLevel(this.level, this.seed, this.floor);
  }

  // lock the camera on the skater's feet at (px, py), zoomed for what they're doing; dt in seconds
  // camDt: real seconds since the last frame (not slowed by a hit-stop or slow motion, so the camera keeps gliding
  // through them); left out, the camera snaps straight to where it should be (a new run or floor)
  follow(px: number, py: number, dt = 0, camDt = -1): void {
    const snap = camDt < 0;
    const cdt = Math.max(0, camDt);
    this.camX = toX(px);
    this.gates.update(dt, toX(px));
    this.sirens.update(dt);
    this.camY = toY(this.level, py);
    //soft in y: the camera trails a jump or a drop a little and catches up fast, never letting the feet off screen
    const f = this.glideFrame(snap, cdt);
    this.lagY = snap ? 0 : this.lagY + (this.camY - this.lastY);
    this.lastY = this.camY;
    this.lagY *= Math.exp(-9 * cdt);
    this.lagY = THREE.MathUtils.clamp(this.lagY, -f.viewH * 0.18, f.viewH * 0.18);
    //zoom is a dolly: the trick/grind zoom (scaled down on phones), the drift's air and speed pull-out and landing
    //kick, and a slam's punch. The lens widens as the camera rushes in and narrows as it backs off
    const trick = 1 + (this.zoom.zoom - 1) * f.punch;
    const rhythm = CAM.rhythm && !FX.reduceMotion;
    const ease = (s: Spring, target: number, omega: number) => (snap ? s.snap(target) : s.step(target, omega, cdt));
    const zoom = ease(this.smooth.zoom, trick * this.drift.pull * (1 + this.drift.kick * 0.18) * (1 + this.punchAmt * 0.5) * (rhythm ? this.rhythm.zoom : 1), SMOOTH.zoom);
    //the fisheye: its resting strength plus the rhythm's. A stronger lens also dollies in with a wider field of
    //view (Lou keeps their size), so there's more round the edges for it to bend
    this.lensK = THREE.MathUtils.clamp(ease(this.smooth.lens, FX.tier === 'low' ? 0 : Math.min(1, CAM.lens + (rhythm ? this.rhythm.lens : 0)), SMOOTH.lens), 0, 1);
    const fov = f.fov + (zoom - 1) * DYN_CAM.zoomFov + ease(this.smooth.fov, this.drift.fovAdd + this.punchAmt * 16, SMOOTH.fov) + this.lensK * LENS.fov;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    const viewH = f.viewH / zoom;
    this.dist = Math.max(DYN_CAM.minDist, viewH / (2 * tanHalf));
    //and the lens drawn wider still by its swell, so Lou keeps their size
    const tanY = lensWiden(this.lensK, viewH / (2 * this.dist), this.camera.aspect);
    this.camera.fov = (2 * Math.atan(tanY) * 180) / Math.PI;
    this.camera.updateProjectionMatrix();
    //a slam shakes the camera, dying off fast
    const sx = (Math.random() - 0.5) * this.shakeAmt;
    const sy = (Math.random() - 0.5) * this.shakeAmt;
    this.shakeAmt *= Math.pow(0.86, cdt * 60);
    //a little above the skater looking down at them, so the street reads in depth. The whole view pans ahead and up
    //so Lou sits left of and below centre (framing): more street ahead, the wires and roofs above
    //(through the lens: pan so Lou lands on that spot of the bent picture)
    const [lx, ly] = lensSource(this.lensK, tanY * this.camera.aspect, tanY, f.lead, f.low);
    const panX = lx * this.dist;
    const panY = ly * this.dist - this.lagY;
    const cx = this.camX + panX + sx;
    const cy = this.camY + panY + sy;
    //at speed the camera swings round behind Lou to look down the street ahead (the drift's yaw)
    const yaw = ease(this.smooth.yaw, this.drift.yaw, SMOOTH.yaw);
    this.camera.position.set(cx - this.dist * Math.sin(yaw), cy + this.dist * 0.18, 0.25 + (this.dist - 0.25) * Math.cos(yaw));
    this.camera.lookAt(cx - sx * 0.4, cy - sy * 0.4, 0.25);
    this.camera.rotateZ(ease(this.smooth.roll, this.punchAmt * this.punchRoll * 0.1, SMOOTH.roll));
    //gyro tilt: the world stays level with the real ground while the phone turns (tilt.ts)
    this.camera.rotateZ(ease(this.smooth.tilt, tilt.roll, SMOOTH.tilt));
    this.punchAmt *= Math.pow(0.91, cdt * 60);
    //far away: barely moves. After a floor joins on, the skyline eases back down to where it sits
    this.skyDrop *= Math.exp(-dt / 5);
    for (const b of this.backdrop) {
      b.mesh.position.x = this.camX * b.parallax + b.off;
      b.mesh.position.y = b.y + this.skyDrop;
    }
    if (this.behind && this.camX > BEHIND_TILES) this.dropBehind();
    this.rain.update(dt, this.camera);
    this.ambience.update(dt, this.camera, this.pointScale);
    this.lightning(dt);
  }

  // a downpour now and then lights the sky: one soft glow that rises fast and fades over a second, never a strobe
  private lightning(dt: number): void {
    const sky = (this.sky.material as THREE.ShaderMaterial).uniforms;
    if (this.rain.amount < RAIN.downpour || FX.reduceFlashing) {
      sky.uFlash.value = 0;
      return;
    }
    this.lightningIn -= dt;
    if (this.lightningIn <= 0) {
      this.lightningIn = 9 + Math.random() * 8;
      this.flash = 0;
    }
    this.flash += dt;
    const f = this.flash;
    sky.uFlash.value = f < 0.12 ? f / 0.12 : Math.max(0, 1 - (f - 0.12) / 1.1);
  }

  shake(amount: number): void {
    if (FX.reduceMotion) return;
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  punch(amount: number): void {
    if (FX.reduceMotion) return;
    this.punchAmt = Math.max(this.punchAmt, amount);
    this.punchRoll = Math.random() < 0.5 ? -1 : 1;
  }

  // pixels per world unit at distance 1, for sizing particles
  get pointScale(): number {
    const h = this.renderer.getDrawingBufferSize(this.buf).y;
    return h / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
  }

  resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    //desktop: Lou Gnar's 800 x 600 box. Phones: in close with a wide lens, upright or sideways (camera.ts framing).
    //Turning the phone flips the page's shape in one go, so the camera keeps Lou the size they were on screen and
    //glides from there to the new framing (glideFrame) instead of jumping to it
    this.frameTo = framing(w, h);
    if (this.viewPx > 0 && h > 0) this.frameS.viewH.x *= h / this.viewPx;
    else this.snapFrame();
    this.viewPx = h;
    this.camera.updateProjectionMatrix();
    const buf = this.renderer.getDrawingBufferSize(this.buf);
    setInkResolution(buf.x, buf.y, this.pixelRatio);
  }

  private snapFrame(): void {
    const t = this.frameTo;
    for (const k of ['viewH', 'fov', 'lead', 'low', 'punch'] as const) this.frameS[k].snap(t[k]);
    this.frame = { ...t };
  }

  // the framing eased toward the screen's (a rotation's glide takes about a second and a half)
  private glideFrame(snap: boolean, dt: number): Framing {
    if (snap) {
      this.snapFrame();
      return this.frame;
    }
    const t = this.frameTo;
    const f = this.frame;
    for (const k of ['viewH', 'fov', 'lead', 'low', 'punch'] as const) f[k] = this.frameS[k].step(t[k], SMOOTH.frame, dt);
    return f;
  }

  // when frames stay slow (over 20 ms for 2 s): lower the resolution, and before it drops below 1, switch to the
  // low effects tier (unless the tier was chosen by hand)
  adapt(frameMs: number): void {
    this.slowMs = frameMs > 20 ? this.slowMs + frameMs : 0;
    if (this.slowMs > 2000 && FX.quality === 'auto' && FX.tier === 'high' && this.pixelRatio * 0.8 < 1) {
      this.setTier('low');
      this.slowMs = 0;
    } else if (this.slowMs > 2000 && this.autoRatio > 0.6) {
      this.autoRatio = Math.max(0.6, this.autoRatio * 0.8);
      this.setPixel();
      this.slowMs = 0;
    }
  }

  // the chunky low-res look (FX.pixel): draw fewer pixels and scale them up hard-edged. Applies at once
  setPixel(): void {
    this.applyPixel();
    this.resize();
  }

  private applyPixel(): void {
    const chunky = FX.pixel > 1;
    this.pixelRatio = chunky ? Math.min(this.autoRatio, 1 / FX.pixel) : this.autoRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.canvas.style.imageRendering = chunky ? 'pixelated' : '';
  }

  setTier(tier: 'high' | 'low'): void {
    FX.tier = tier;
    for (const kit of this.kits()) this.kitInk(kit);
    for (const n of [this.night, ...[...this.aheads.values()].map((a) => a.night)]) n.setNight(this.mood?.neon ?? 0, this.rain.amount);
  }

  // every floor kit there is: this floor's, the one behind, and the ones built ahead
  private kits(): THREE.Group[] {
    const out = [this.kit, this.behind?.kit ?? null, ...[...this.aheads.values()].map((a) => a.kit)];
    return out.filter((k): k is THREE.Group => k !== null);
  }

  // rain darkens the street kit, the way wet concrete and brick go darker (facades keep their windows); the rail
  // steel takes the mood's tint here too, since each kit's clipped copy of it has its own colour (clipKit)
  private wetKit(kit: THREE.Group): void {
    const k = 1 - 0.22 * this.wet;
    kit.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o.userData.ink) return;
      for (const m of [o.material].flat() as THREE.MeshToonMaterial[]) {
        if (m.name === 'railMetal') railTint(this.mood?.neon ?? 0, (m as THREE.Material as THREE.MeshMatcapMaterial).color);
        if (!(m instanceof THREE.MeshToonMaterial) || m.userData.facade) continue;
        const dry = (m.userData.dry ??= m.color.getHex()) as number;
        m.color.setHex(dry).multiplyScalar(k);
      }
    });
  }

  // the low tier keeps outlines on the skater, cars and pickups but drops them from the street kit
  private kitInk(kit: THREE.Group): void {
    kit.traverse((o) => {
      if (o.userData.ink) o.visible = FX.tier === 'high';
    });
  }

  get resolution(): number {
    return this.pixelRatio;
  }

  render(): void {
    this.renderer.info.reset(); // count both passes
    this.lens.render(this.renderer, this.camera, this.lensK, FX.pixel > 1, () => {
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      this.renderer.clearDepth();
      this.renderer.render(this.front, this.camera);
    });
  }
}
