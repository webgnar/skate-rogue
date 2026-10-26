// Light on the skater when it's dark or raining (lighting thread, zack Oct 26 2026: "we need some kind of light on
// the player when it's dark and raining"). Three things, all in the skater's own pass so they light nobody else:
// a cool key light from the camera's side that comes up with night and rain, a light from above in the colour of
// whatever street lamp's pool the skater rolls through (street-lights.ts lightAt), and a thin pale rim outside the
// ink so the black outline doesn't vanish into a dark street. The lights are made once and only change intensity,
// so materials never recompile.
import * as THREE from 'three';
import { Aura } from './toon';

export const SKATER_LIGHT = {
  key: 0.8, // key light at full night
  rainKey: 0.55, // extra key light in a downpour-ish rain (rain 1)
  lamp: 2.2, // the lamp light from above, in the middle of a cobra head's pool
  rim: 1.3, // rim width in CSS px at full dark
  ease: 6, // how fast the lamp light follows the skater in and out of pools, per second
};

export class SkaterLight {
  readonly group = new THREE.Group(); // goes in the skater's pass
  private readonly key = new THREE.DirectionalLight(0xdfe8ff, 0);
  private readonly lamp = new THREE.DirectionalLight(0xffc87a, 0);
  private readonly rim: Aura;
  private readonly lampColor = new THREE.Color();
  private readonly rimColor = new THREE.Color();
  private dark = 0;
  private lampK = 0;

  constructor(skater: THREE.Object3D) {
    //from the camera's side and a little above and left, so the face and front read
    this.key.position.set(-3, 5, 10);
    //nearly straight down, as from a lamp head over the street
    this.lamp.position.set(0.6, 10, 2);
    this.group.add(this.key, this.lamp);
    this.rim = new Aura(skater, 0);
  }

  // night 0..1 (the mood's neon value), rain 0..1.6
  setNight(night: number, rain: number): void {
    this.dark = Math.min(1, Math.max(night, Math.min(1, rain) * 0.7));
    this.key.intensity = SKATER_LIGHT.key * night + SKATER_LIGHT.rainKey * Math.min(1, rain);
  }

  // follow the skater: `at` is the skater's position, `lightAt` the lamplight there (strength, its colour in out);
  // gnar: the gnar glow is showing, which takes the rim's place
  update(dt: number, at: THREE.Vector3, lightAt: (x: number, y: number, out: THREE.Color) => number, gnar: boolean, pixelRatio: number): void {
    const want = Math.min(1.3, lightAt(at.x, at.y, this.lampColor));
    this.lampK += (want - this.lampK) * Math.min(1, dt * SKATER_LIGHT.ease);
    if (want > 0) this.lamp.color.lerp(this.lampColor, Math.min(1, dt * SKATER_LIGHT.ease));
    this.lamp.intensity = SKATER_LIGHT.lamp * this.lampK;
    this.key.target.position.copy(at);
    this.lamp.target.position.copy(at);
    this.key.position.set(at.x - 3, at.y + 5, at.z + 10);
    this.lamp.position.set(at.x + 0.6, at.y + 10, at.z + 2);
    this.key.target.updateMatrixWorld();
    this.lamp.target.updateMatrixWorld();
    //the rim: cool moonlight at night, picking up the lamp's colour under one
    const k = gnar ? 0 : this.dark;
    this.rim.steady(k, SKATER_LIGHT.rim, this.rimColor.copy(this.lampColor).lerp(RIM, 1 - Math.min(1, this.lampK)), pixelRatio);
  }
}

const RIM = new THREE.Color(0x9cc4ff);
