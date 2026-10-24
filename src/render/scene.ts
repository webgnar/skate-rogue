// The 2.5D view: renderer, Lou Gnar's camera (see camera.ts), lights, sky and skyline.
import * as THREE from 'three';
import type { Level } from '../physics/level';
import { LouZoom, viewHeight } from './camera';
import { buildKit, toX, toY } from './kit';
import { NightCity } from './night';
import { FX } from './fx-settings';
import { batchStatic } from './batch';
import { GateFx } from './gate-fx';
import { Ambience, BACKDROP_SPAN, BACKDROPS, type BiomeId } from './biomes';
import { loadSheet } from './skins';
import { loadImage, pixelTexture } from './textures';
import { inkify, setInkResolution, solid } from './toon';
import { mergeInk, splitSlabs } from './kit-merge';
import { RAIN, Rain, skyMesh, skylineMaterial, type Mood } from './atmosphere';
import { Puddles } from './puddles';

export class StreetView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  // the skater draws in its own pass over the level: always in front of what they ride, still occluding itself
  readonly front = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 400);
  private kit: THREE.Group | null = null;
  private biome: BiomeId = 'chicago';
  private sheet: HTMLImageElement | null = null; // the biome's tile sheet (skins.ts)
  private base = '';
  private seed = 0;
  private floor = 1;
  readonly night = new NightCity();
  readonly gates = new GateFx();
  readonly ambience = new Ambience();
  private wet = 0;
  private backdrop: { mesh: THREE.Mesh; parallax: number }[] = [];
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
  private camX = 0;
  private camY = 2;
  private dist = 22;
  private baseH = 16;
  private pixelRatio: number;
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
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.info.autoReset = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
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
    this.scene.add(this.sky, this.puddles.mesh, this.night.group, this.gates.group, this.ambience.points);
    this.front.add(this.rain.mesh);
    this.renderer.autoClear = false;
  }

  async loadBackdrop(base: string): Promise<void> {
    this.base = base;
    //the sky is a gradient drawn per mood (QFS's Chicago sky is a plain blue gradient, the afternoon mood);
    //behind the street, the district's far cards (Chicago's pink skyline)
    this.scene.background = null;
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
      this.backdrop.push({ mesh, parallax: l.parallax });
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
    this.wetKit();
    this.puddles.setSky(m.skyTop, m.skyBottom, m.neon);
    this.night.setNight(m.neon);
    this.lightningIn = 6 + Math.random() * 6;
    this.flash = 99;
  }

  // seed and floor place the night city's lamps, cameras and billboards
  setLevel(level: Level, seed = 0, floor = 1): void {
    this.level = level;
    this.seed = seed;
    this.floor = floor;
    if (this.kit) {
      this.scene.remove(this.kit);
      this.kit.traverse((o) => {
        //outlines share their geometry and one material with what they outline
        if (o instanceof THREE.Mesh && o.userData.inkMerged) o.geometry.dispose();
        else if (o instanceof THREE.Mesh && !o.userData.ink) {
          o.geometry.dispose();
          for (const m of [o.material].flat()) {
            (m as THREE.MeshLambertMaterial).map?.dispose();
            m.dispose();
          }
        }
      });
    }
    this.kit = buildKit(level, this.biome, this.sheet);
    const slabs = splitSlabs(this.kit);
    batchStatic(this.kit);
    inkify(this.kit, { outline: (m) => !m.userData.noInk && solid(m) });
    mergeInk(this.kit, slabs);
    this.kitInk();
    this.wetKit();
    this.scene.add(this.kit);
    this.night.build(level, this.kit, seed, floor);
    this.gates.build(this.kit);
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
  follow(px: number, py: number, dt = 0): void {
    this.camX = toX(px);
    this.gates.update(dt, toX(px));
    this.camY = toY(this.level, py);
    //a slam punches the camera in and rolls it, settling over about half a second (held through the hit-stop)
    const zoom = this.zoom.zoom * (1 + this.punchAmt * 0.35);
    this.camera.fov = (2 * Math.atan(this.baseH / (2 * zoom * this.dist)) * 180) / Math.PI;
    this.camera.updateProjectionMatrix();
    //a slam shakes the camera, dying off fast
    const sx = (Math.random() - 0.5) * this.shakeAmt;
    const sy = (Math.random() - 0.5) * this.shakeAmt;
    this.shakeAmt *= Math.pow(0.86, dt * 60);
    //a little above the skater looking down at them, so the street reads in depth; the feet stay centred
    this.camera.position.set(this.camX + sx, this.camY + this.dist * 0.18 + sy, this.dist);
    this.camera.lookAt(this.camX + sx * 0.6, this.camY + sy * 0.6, 0.25);
    this.camera.rotateZ(this.punchAmt * this.punchRoll * 0.1);
    this.punchAmt *= Math.pow(0.91, dt * 60);
    for (const b of this.backdrop) b.mesh.position.x = this.camX * b.parallax; // far away: barely moves
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
    //Lou Gnar's 800 x 600 box: full height on wide screens, full width on narrow ones; back off rather than go fish-eye
    this.baseH = viewHeight(w / h);
    this.dist = Math.max(22, this.baseH / (2 * Math.tan((32 * Math.PI) / 180)));
    this.camera.fov = (2 * Math.atan(this.baseH / (2 * this.zoom.zoom * this.dist)) * 180) / Math.PI;
    this.camera.updateProjectionMatrix();
    const buf = this.renderer.getDrawingBufferSize(this.buf);
    setInkResolution(buf.x, buf.y, this.pixelRatio);
  }

  // when frames stay slow (over 20 ms for 2 s): lower the resolution, and before it drops below 1, switch to the
  // low effects tier (unless the tier was chosen by hand)
  adapt(frameMs: number): void {
    this.slowMs = frameMs > 20 ? this.slowMs + frameMs : 0;
    if (this.slowMs > 2000 && FX.quality === 'auto' && FX.tier === 'high' && this.pixelRatio * 0.8 < 1) {
      this.setTier('low');
      this.slowMs = 0;
    } else if (this.slowMs > 2000 && this.pixelRatio > 0.6) {
      this.pixelRatio = Math.max(0.6, this.pixelRatio * 0.8);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.resize();
      this.slowMs = 0;
    }
  }

  setTier(tier: 'high' | 'low'): void {
    FX.tier = tier;
    this.kitInk();
    this.night.setNight(this.mood?.neon ?? 0);
  }

  // rain darkens the street kit, the way wet concrete and brick go darker (facades keep their windows)
  private wetKit(): void {
    const k = 1 - 0.22 * this.wet;
    this.kit?.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o.userData.ink) return;
      for (const m of [o.material].flat() as THREE.MeshToonMaterial[]) {
        if (!(m instanceof THREE.MeshToonMaterial) || m.userData.facade) continue;
        const dry = (m.userData.dry ??= m.color.getHex()) as number;
        m.color.setHex(dry).multiplyScalar(k);
      }
    });
  }

  // the low tier keeps outlines on the skater, cars and pickups but drops them from the street kit
  private kitInk(): void {
    this.kit?.traverse((o) => {
      if (o.userData.ink) o.visible = FX.tier === 'high';
    });
  }

  get resolution(): number {
    return this.pixelRatio;
  }

  render(): void {
    this.renderer.info.reset(); // count both passes
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.front, this.camera);
  }
}
