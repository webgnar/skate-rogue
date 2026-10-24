// Comic sound words for slams (SLAM!, WHAM!, ...): chunky letters with a yellow-to-white fill, a red drop shadow
// and a thick ink outline, on a sprite that pops in at the skater, tilts, floats up and fades.
import * as THREE from 'three';

const LIFE = 0.95; // seconds, real time
export const SLAM_WORDS = ['SLAM!', 'WHAM!', 'CRUNCH!', 'BAM!', 'KRAK!'];

const cache = new Map<string, { tex: THREE.Texture; aspect: number }>();

function wordTexture(word: string): { tex: THREE.Texture; aspect: number } {
  const hit = cache.get(word);
  if (hit) return hit;
  const H = 128;
  const font = `italic 900 ${H * 0.72}px "Arial Black", "Helvetica Neue", Impact, sans-serif`;
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  g.font = font;
  const w = Math.ceil(g.measureText(word).width + H * 0.5);
  c.width = w;
  c.height = H;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  const x = w / 2;
  const y = H / 2 + 4;
  // red drop shadow, inked
  g.lineWidth = 16;
  g.strokeStyle = '#120814';
  g.strokeText(word, x + 7, y + 7);
  g.fillStyle = '#e8352a';
  g.fillText(word, x + 7, y + 7);
  // main letters: ink outline, then a hot fill
  g.strokeText(word, x, y);
  const fill = g.createLinearGradient(0, H * 0.2, 0, H * 0.8);
  fill.addColorStop(0, '#fffbe0');
  fill.addColorStop(0.45, '#ffe23a');
  fill.addColorStop(1, '#ff9a1f');
  g.fillStyle = fill;
  g.fillText(word, x, y);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const out = { tex, aspect: w / H };
  cache.set(word, out);
  return out;
}

interface Word {
  sprite: THREE.Sprite;
  age: number;
  aspect: number;
  x: number;
  y: number;
}

export class SoundWords {
  readonly group = new THREE.Group();
  private words: Word[] = [];

  spawn(x: number, y: number, word = SLAM_WORDS[Math.floor(Math.random() * SLAM_WORDS.length)]): void {
    const { tex, aspect } = wordTexture(word);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true });
    mat.rotation = (Math.random() < 0.5 ? -1 : 1) * (0.12 + Math.random() * 0.12);
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 11;
    this.group.add(sprite);
    this.words.push({ sprite, age: 0, aspect, x, y });
  }

  // real seconds
  update(dt: number): void {
    for (const w of this.words) {
      w.age += dt;
      const t = w.age;
      //pop: overshoot to 1.35, settle to 1, then a slow grow while it floats off
      const pop = t < 0.07 ? (t / 0.07) * 1.35 : t < 0.16 ? 1.35 - ((t - 0.07) / 0.09) * 0.35 : 1 + (t - 0.16) * 0.15;
      const h = 1.1 * pop;
      w.sprite.scale.set(h * w.aspect, h, 1);
      w.sprite.position.set(w.x + 0.3, w.y + 2.4 + Math.max(0, t - 0.16) * 0.8, 0.6);
      w.sprite.material.opacity = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / (LIFE - 0.7));
    }
    for (const w of this.words.filter((w) => w.age >= LIFE)) {
      this.group.remove(w.sprite);
      w.sprite.material.dispose();
    }
    this.words = this.words.filter((w) => w.age < LIFE);
  }
}
