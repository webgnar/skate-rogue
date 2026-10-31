// The flash as the board locks onto a grind or slide (zack's reference sheet, 2026-10-31): a 4-point star grows
// inside a ring, then breaks into a dashed ring and streaks that fly out and fade. Ten frames drawn by
// art/fx/grind_impact.py into public/sprites/fx/grind-impact.png, played on a camera-facing sprite. It sits in
// `view.withActor` (docs/effects-roadmap.md), in depth with the skater, so his board and shoes cut across it.
import * as THREE from 'three';
import { warmMesh } from './shader-keep';

export const GRIND_IMPACT = {
  frames: 10,
  fps: 28, // the whole flash in about a third of a second
  size: 2.2, // world units across the sheet's frame
  lift: -0.12, // below the contact point, so the star shows under the board instead of hiding behind the legs
  toward: 0.3, // toward the camera, so the rail itself doesn't slice it
};
const POOL = 3;

// the sheet, loaded once in the browser (tests build this under Node, with no images)
function sheet(): THREE.Texture {
  const tex = new THREE.Texture();
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.repeat.set(1 / GRIND_IMPACT.frames, 1);
  if (typeof Image !== 'undefined') {
    const img = new Image();
    img.onload = () => {
      tex.image = img;
      tex.needsUpdate = true;
    };
    img.src = `${import.meta.env.BASE_URL}sprites/fx/grind-impact.png`;
  }
  return tex;
}

interface Flash {
  sprite: THREE.Sprite;
  map: THREE.Texture;
  age: number; // -1: free
}

export class GrindImpacts {
  readonly group = new THREE.Group();
  private readonly flashes: Flash[] = [];
  private next = 0;

  constructor() {
    const tex = sheet();
    for (let i = 0; i < POOL; i++) {
      const map = i ? tex.clone() : tex; // each its own frame offset, all on the one image
      const mat = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.renderOrder = 2;
      this.group.add(sprite);
      this.flashes.push({ sprite, map, age: -1 });
    }
    this.group.add(warmMesh(this.flashes[0].sprite.material));
  }

  // a flash at the contact point (x, y), turned a random quarter so they don't all look the same
  spawn(x: number, y: number, z = 0): void {
    const f = this.flashes[this.next];
    this.next = (this.next + 1) % POOL;
    f.age = 0;
    f.sprite.position.set(x, y + GRIND_IMPACT.lift, z + GRIND_IMPACT.toward);
    f.sprite.scale.setScalar(GRIND_IMPACT.size);
    f.sprite.material.rotation = (Math.floor(Math.random() * 4) * Math.PI) / 2 + (Math.random() - 0.5) * 0.4;
    this.show(f);
  }

  // keep the live flashes on the contact point as the board rides on along the rail, so it doesn't hang back
  follow(x: number, y: number): void {
    for (const f of this.flashes) {
      if (f.age < 0) continue;
      f.sprite.position.x = x;
      f.sprite.position.y = y + GRIND_IMPACT.lift;
    }
  }

  update(dt: number): void {
    for (const f of this.flashes) {
      if (f.age < 0) continue;
      f.age += dt;
      this.show(f);
    }
  }

  // which frame it's on, or hidden once it's played through
  frame(age: number): number {
    return age < 0 ? -1 : Math.floor(age * GRIND_IMPACT.fps) < GRIND_IMPACT.frames ? Math.floor(age * GRIND_IMPACT.fps) : -1;
  }

  private show(f: Flash): void {
    const k = this.frame(f.age);
    if (k < 0) f.age = -1;
    f.sprite.visible = k >= 0;
    if (k >= 0) f.map.offset.x = k / GRIND_IMPACT.frames;
  }

  // the world moved under it (a floor handed over to the next)
  shift(dx: number, dy: number): void {
    for (const f of this.flashes) {
      f.sprite.position.x += dx;
      f.sprite.position.y += dy;
    }
  }
}
