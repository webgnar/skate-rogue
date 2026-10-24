// Placeholder skater: Lou Gnar's sprite sheets (66 x 75 px frames, from excaliburSkate) on a camera-facing plane,
// with the animation picked from the physics state and events. The rigged 3D skater replaces this in M3.
import * as THREE from 'three';
import type { Skater, SkaterEvent } from '../physics/skater';
import { loadImage, pixelTexture } from './textures';

interface Clip {
  sheet: string;
  frames: number;
  ms: number[]; // per frame
  loop: boolean;
}

const ms = (n: number, each: number) => new Array(n).fill(each);

// timings as in Lou Gnar's player.ts
const CLIPS: Record<string, Clip> = {
  push: { sheet: 'push', frames: 14, ms: ms(14, 70), loop: true },
  ollie: { sheet: 'ollie', frames: 10, ms: [...ms(4, 40), ...ms(6, 100)], loop: false },
  kickflip: { sheet: 'kickflip', frames: 7, ms: ms(7, 60), loop: false },
  heelflip: { sheet: 'heelflip', frames: 6, ms: ms(6, 70), loop: false },
  shuv1: { sheet: 'shuv1', frames: 7, ms: ms(7, 60), loop: false },
  shuv2: { sheet: 'shuv2', frames: 7, ms: ms(7, 60), loop: false },
  grind1: { sheet: 'grind1', frames: 3, ms: ms(3, 100), loop: true },
  grind2: { sheet: 'grind2', frames: 3, ms: ms(3, 100), loop: true },
  impact: { sheet: 'impact', frames: 7, ms: ms(7, 50), loop: false },
  freefall: { sheet: 'freefall', frames: 4, ms: ms(4, 100), loop: true },
};

export const TRICKS = ['kickflip', 'heelflip', 'shuv1', 'shuv2'] as const;
export const TRICK_NAMES: Record<string, string> = {
  kickflip: 'KICKFLIP',
  heelflip: 'HEELFLIP',
  shuv1: 'SHUVIT',
  shuv2: '360 SHUVIT',
};

const HEIGHT = 2.3; // world units (tiles)
const WIDTH = (HEIGHT * 66) / 75;

export class SkaterSprite {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;
  private textures = new Map<string, THREE.Texture>();
  private clip = CLIPS.push;
  private clipName = 'push';
  private frame = 0;
  private frameMs = 0;
  private flash = 0;
  private grindClip = 'grind1';

  private constructor() {
    const geo = new THREE.PlaneGeometry(WIDTH, HEIGHT).translate(0, HEIGHT / 2 - 0.12, 0);
    //drawn over the kit: in 2.5D the skater is always in front of what they ride
    this.mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, depthTest: false });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 10;
    this.mesh.position.z = 0.25;
  }

  static async create(base: string): Promise<SkaterSprite> {
    const s = new SkaterSprite();
    const sheets = [...new Set(Object.values(CLIPS).map((c) => c.sheet))];
    await Promise.all(
      sheets.map(async (name) => {
        const tex = pixelTexture(await loadImage(`${base}sprites/${name}.png`));
        tex.repeat.set(1 / CLIPS[name].frames, 1);
        s.textures.set(name, tex);
      }),
    );
    s.play('push');
    return s;
  }

  play(name: string): void {
    this.clipName = name;
    this.clip = CLIPS[name];
    this.frame = 0;
    this.frameMs = 0;
    this.mat.map = this.textures.get(this.clip.sheet)!;
    this.mat.needsUpdate = true;
    this.applyFrame();
  }

  onEvent(e: SkaterEvent): void {
    switch (e.type) {
      case 'ollie':
      case 'hop':
        this.play('ollie');
        break;
      case 'trick':
        this.play(TRICKS[e.index % TRICKS.length]);
        break;
      case 'land':
        this.play('impact');
        break;
      case 'grind':
      case 'rail':
        this.grindClip = this.grindClip === 'grind1' ? 'grind2' : 'grind1';
        this.play(this.grindClip);
        break;
      case 'slam':
        this.flash = 0.6;
        this.play('impact');
        break;
      case 'bail':
        this.play('freefall');
        break;
    }
  }

  update(dtMs: number, sk: Skater, angle: number): void {
    //settle into the right loop when a one-shot clip ends
    const oneShotDone = !this.clip.loop && this.frame === this.clip.frames - 1 && this.frameMs >= this.clip.ms[this.frame];
    if (sk.mode === 'roll' && (this.clip.loop ? this.clipName !== 'push' : oneShotDone)) this.play('push');
    if (sk.mode === 'air' && oneShotDone && sk.vsp > 3) this.play('freefall');
    if ((sk.mode === 'grind' || sk.mode === 'rail') && !this.clipName.startsWith('grind')) this.play(this.grindClip);

    this.frameMs += dtMs;
    while (this.frameMs >= this.clip.ms[this.frame]) {
      if (this.frame < this.clip.frames - 1) {
        this.frameMs -= this.clip.ms[this.frame];
        this.frame++;
      } else if (this.clip.loop) {
        this.frameMs -= this.clip.ms[this.frame];
        this.frame = 0;
      } else break;
    }
    this.applyFrame();

    this.mesh.rotation.z = angle;
    if (this.flash > 0) this.flash -= dtMs / 1000;
    const blink = this.flash > 0 && Math.floor(this.flash * 20) % 2 === 0;
    this.mat.color.setRGB(1, blink ? 0.35 : 1, blink ? 0.35 : 1);
  }

  private applyFrame(): void {
    const tex = this.mat.map;
    if (tex) tex.offset.x = this.frame / this.clip.frames;
  }
}
