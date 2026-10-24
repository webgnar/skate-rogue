// Heat you can see: the cruiser's light bar throws real red and blue light down the street, and the whole scene
// takes on the siren wash, growing with Heat. The cruiser closes in as Heat climbs, so the light reaches the
// skater on its own. Lights are created once and only change intensity, so materials never recompile.
import * as THREE from 'three';
import { FX } from './fx-settings';

export const HEAT_LIGHT = {
  from: 25, // Heat where the light starts to show
  full: 90, // Heat where it is at full strength
  point: 30, // point light intensity at full
  range: 26, // tiles the point light reaches
  wash: 1.3, // sky-light wash intensity at full
  flare: 1.6, // flare size in tiles at full
  sweep: 0.9, // red-blue cycles per second of the light on the scene: smooth and slow, never a hard strobe
};

const RED = new THREE.Color(0xff2a2a);
const BLUE = new THREE.Color(0x2a6bff);

function flareTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  //a comic star cross through the glow
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillRect(4, 31, 56, 2);
  g.fillRect(31, 4, 2, 56);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class HeatLights {
  readonly group = new THREE.Group(); // goes in the level scene
  readonly front = new THREE.Group(); // goes in the skater's pass, so the skater is lit too
  private readonly point: THREE.PointLight;
  private readonly frontPoint: THREE.PointLight;
  private readonly wash: THREE.HemisphereLight;
  private readonly frontWash: THREE.HemisphereLight;
  private readonly flares: [THREE.Sprite, THREE.Sprite];
  private readonly mix = new THREE.Color();
  // the bar's light for reflections in puddles
  readonly glow = { pos: new THREE.Vector3(), color: new THREE.Color(), k: 0 };
  private t = 0;

  constructor() {
    this.point = new THREE.PointLight(RED, 0, HEAT_LIGHT.range, 1.2);
    this.frontPoint = this.point.clone();
    this.wash = new THREE.HemisphereLight(RED, 0x000000, 0);
    this.frontWash = this.wash.clone();
    this.group.add(this.point, this.wash);
    this.front.add(this.frontPoint, this.frontWash);
    const tex = flareTexture();
    const flare = (color: THREE.Color) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      s.renderOrder = 2;
      this.group.add(s);
      return s;
    };
    this.flares = [flare(RED), flare(BLUE)];
  }

  // bar: the light bar's world position; flash: which side of the bar is lit; heat 0..100; dt in seconds.
  // Only the small flares alternate hard; the light on the scene sweeps smoothly between red and blue, so a
  // whole screen never strobes (photosensitivity).
  update(bar: THREE.Vector3, visible: boolean, flash: boolean, heat: number, caught: boolean, dt: number): void {
    this.t += dt;
    const k = caught ? 1 : visible ? THREE.MathUtils.smoothstep(heat, HEAT_LIGHT.from, HEAT_LIGHT.full) : 0;
    const color = this.mix.copy(RED).lerp(BLUE, 0.5 + 0.5 * Math.sin(this.t * Math.PI * 2 * HEAT_LIGHT.sweep));
    for (const p of [this.point, this.frontPoint]) {
      p.position.set(bar.x, bar.y + 1.5, bar.z + 2);
      p.color.copy(color);
      p.intensity = FX.tier === 'low' ? 0 : HEAT_LIGHT.point * k; // low tier: the wash alone
    }
    this.glow.pos.copy(bar);
    this.glow.color.copy(color);
    this.glow.k = 1.4 * k;
    for (const w of [this.wash, this.frontWash]) {
      w.color.copy(color);
      w.intensity = HEAT_LIGHT.wash * k;
    }
    this.flares.forEach((f, i) => {
      const lit = FX.reduceFlashing || (i === 0) === flash; // reduce flashing: both glow steady
      f.visible = visible && k > 0.01;
      f.position.set(bar.x + (i === 0 ? -0.25 : 0.15), bar.y, bar.z + 0.3);
      const s = HEAT_LIGHT.flare * (0.35 + 0.65 * k) * (lit ? 1 : 0.35);
      f.scale.set(s, s, 1);
      f.material.opacity = FX.reduceFlashing ? 0.7 : lit ? 1 : 0.4;
    });
  }
}
