// The 2.5D view: renderer, camera rig that leads the skater (further at speed), lights, sky and skyline.
import * as THREE from 'three';
import type { Level } from '../physics/level';
import { buildKit, toX, toY } from './kit';
import { loadImage, pixelTexture } from './textures';

export class StreetView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  // the skater draws in its own pass over the level: always in front of what they ride, still occluding itself
  readonly front = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 400);
  private kit: THREE.Group | null = null;
  private skyline: THREE.Mesh | null = null;
  private camX = 0;
  private camY = 2;
  private lead = 4;
  private pixelRatio: number;
  private slowMs = 0;
  private shakeAmt = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private level: Level,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0x2a1d4a);
    this.scene.fog = new THREE.Fog(0x3a2a5c, 40, 140);

    this.scene.add(new THREE.HemisphereLight(0xffe8f0, 0x403050, 1.6));
    const sun = new THREE.DirectionalLight(0xffd8b0, 1.4);
    sun.position.set(-6, 12, 10);
    this.scene.add(sun);
    this.front.add(new THREE.HemisphereLight(0xffe8f0, 0x403050, 1.6), sun.clone());
    this.renderer.autoClear = false;
  }

  async loadBackdrop(base: string): Promise<void> {
    //QFS's Chicago sky behind everything, and its pink skyline as a far card
    const sky = pixelTexture(await loadImage(`${base}tex/chicago_sky.png`));
    this.scene.background = sky;
    const skylineTex = pixelTexture(await loadImage(`${base}tex/chicago_skyline.png`));
    skylineTex.wrapS = THREE.RepeatWrapping;
    skylineTex.repeat.set(8, 1);
    const w = 726 / 6;
    this.skyline = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 8, 400 / 6),
      new THREE.MeshBasicMaterial({ map: skylineTex, transparent: true, alphaTest: 0.3, fog: false }),
    );
    this.skyline.position.set(0, 400 / 12 - 10, -70);
    this.scene.add(this.skyline);
  }

  setLevel(level: Level): void {
    this.level = level;
    if (this.kit) {
      this.scene.remove(this.kit);
      this.kit.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          for (const m of [o.material].flat()) {
            (m as THREE.MeshLambertMaterial).map?.dispose();
            m.dispose();
          }
        }
      });
    }
    this.kit = buildKit(level);
    this.scene.add(this.kit);
  }

  // place the camera for the skater at (px, py) moving at hsp px/frame
  follow(px: number, py: number, hsp: number, snap = false): void {
    const x = toX(px);
    const y = toY(this.level, py);
    const targetLead = 3 + Math.max(0, hsp) * 0.9;
    this.lead += (targetLead - this.lead) * (snap ? 1 : 0.05);
    const tx = x + this.lead;
    //on the street small hops barely move the camera; up on the roofs it follows the skater's height
    const ty = y > 4 ? y - 0.5 : Math.max(1.6, y * 0.6 + 1.6);
    //catch up faster on big drops
    const k = ty < this.camY - 2 ? 0.2 : 0.08;
    this.camX = snap ? tx : this.camX + (tx - this.camX) * 0.2;
    this.camY = snap ? ty : this.camY + (ty - this.camY) * k;
    //pull back a little at speed
    const dist = 19 + Math.max(0, hsp - 3.5) * 0.8;
    //a slam shakes the camera, dying off fast
    const sx = (Math.random() - 0.5) * this.shakeAmt;
    const sy = (Math.random() - 0.5) * this.shakeAmt;
    this.shakeAmt *= 0.86;
    this.camera.position.set(this.camX + sx, this.camY + 4 + sy, dist);
    this.camera.lookAt(this.camX + sx * 0.6, this.camY + sy * 0.6, 0);
    if (this.skyline) this.skyline.position.x = this.camX * 0.85; // far away: barely moves
  }

  shake(amount: number): void {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    //keep about 18 tiles of street visible across on narrow screens
    this.camera.fov = w / h < 1.4 ? 50 : 34;
    this.camera.updateProjectionMatrix();
  }

  // lower the resolution when frames stay slow (over 20 ms for 2 s)
  adapt(frameMs: number): void {
    this.slowMs = frameMs > 20 ? this.slowMs + frameMs : 0;
    if (this.slowMs > 2000 && this.pixelRatio > 0.6) {
      this.pixelRatio = Math.max(0.6, this.pixelRatio * 0.8);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.resize();
      this.slowMs = 0;
    }
  }

  get resolution(): number {
    return this.pixelRatio;
  }

  render(): void {
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.front, this.camera);
  }
}
