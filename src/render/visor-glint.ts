// The streak of light across Lou's visor (the models thread's 'VisorGlint' mesh): faint by day, bright and tinted
// with the city's neon at night, and a quick gleam when he lands or kicks a trick. Only the visor brightens;
// nothing else on screen does.
import * as THREE from 'three';
import { FX } from './fx-settings';

export const VISOR = {
  day: 0.3, // opacity in daylight
  night: 0.75, // ...and at full neon
  tint: 0.45, // how far toward the neon colour at night
  ping: 0.35, // extra opacity on a gleam
  pingSecs: 0.25,
  neon: 0xff4fd8, // street neon, unless the district has its own
};

// districts whose light isn't the street's pink
export const VISOR_TINT: Record<string, number> = { atlantis: 0x80e0ff, hightech: 0x4ad8ff, space: 0xb8c0ff, hive: 0xff8a30 };

export class VisorGlint {
  private readonly mat: THREE.MeshBasicMaterial | null;
  private base = VISOR.day;
  private gleam = 0;

  constructor(root: THREE.Object3D) {
    const mesh = root.getObjectByName('VisorGlint') as THREE.Mesh | undefined;
    this.mat = (mesh?.material as THREE.MeshBasicMaterial | undefined) ?? null;
  }

  // night 0..1 from the mood; tint is the district's neon colour
  setNight(night: number, tint = VISOR.neon): void {
    this.base = VISOR.day + (VISOR.night - VISOR.day) * night;
    this.mat?.color.setHex(0xffffff).lerp(new THREE.Color(tint), VISOR.tint * night);
  }

  ping(): void {
    if (!FX.reduceFlashing) this.gleam = 1;
  }

  update(dt: number): void {
    if (!this.mat) return;
    this.gleam = Math.max(0, this.gleam - dt / VISOR.pingSecs);
    this.mat.opacity = Math.min(1, this.base + VISOR.ping * this.gleam);
  }

  get opacity(): number {
    return this.mat?.opacity ?? 0;
  }
}
