// Electrocuted on the sewer subway's third rail (src/sim/sewer.ts 'zap'): jagged arcs of electric blue and white
// crawl over the skater from the rail up through his body, redrawn every few frames so they crackle, and fade out.
// Thin ribbons (a line is one pixel wide on most GPUs), all in one mesh; drawn in the effects' pass over him.
import * as THREE from 'three';

const ARCS = 5; // arcs at once
const POINTS = 9; // kinks along each
const RESHAPE = 0.045; // seconds between new shapes
const LIFE = 1.6; // seconds it crackles (game.ts ZAP.secs)
const HEIGHT = 1.9; // world units: from the rail up over his head
const WIDTH = 0.07; // the ribbons' width

export class ShockFx {
  readonly group = new THREE.Group();
  private readonly geo = new THREE.BufferGeometry();
  private readonly pos = new Float32Array(ARCS * (POINTS - 1) * 6 * 3);
  private readonly mat = new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 1, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  private readonly core: THREE.Mesh;
  private t = LIFE;
  private next = 0;
  private x = 0;
  private y = 0;

  constructor() {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.core = new THREE.Mesh(this.geo, this.mat);
    this.core.frustumCulled = false;
    this.group.add(this.core);
    this.group.visible = false;
  }

  // it gets him at (x, y), world units: his feet on the rail
  burst(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.t = 0;
    this.next = 0;
    this.group.visible = true;
  }

  // (x, y): where he's drawn now, so the arcs stay on him
  update(dt: number, x?: number, y?: number): void {
    if (this.t >= LIFE) return;
    this.t += dt;
    if (x !== undefined && y !== undefined) {
      this.x = x;
      this.y = y;
    }
    if (this.t >= LIFE) {
      this.group.visible = false;
      return;
    }
    //bright at first, flickering, then dying away
    const fade = 1 - this.t / LIFE;
    this.mat.opacity = fade * (0.55 + 0.45 * Math.random());
    this.mat.color.setHSL(0.53, 1, 0.75 + 0.25 * Math.random());
    this.next -= dt;
    if (this.next > 0) return;
    this.next = RESHAPE;
    let k = 0;
    for (let a = 0; a < ARCS; a++) {
      //each from somewhere on the rail by his wheels up to somewhere on him, kinking side to side
      const x0 = this.x + (Math.random() - 0.5) * 0.6;
      const x1 = this.x + (Math.random() - 0.5) * 0.9;
      const top = HEIGHT * (0.45 + 0.55 * Math.random());
      const z = 0.2 + Math.random() * 0.3;
      let px = x0;
      let py = this.y;
      for (let i = 1; i < POINTS; i++) {
        const f = i / (POINTS - 1);
        const nx = x0 + (x1 - x0) * f + (i < POINTS - 1 ? (Math.random() - 0.5) * 0.45 : 0);
        const ny = this.y + top * f;
        //a ribbon from (px, py) to (nx, ny), WIDTH across it
        const dx = nx - px;
        const dy = ny - py;
        const l = Math.hypot(dx, dy) || 1;
        const ox = (-dy / l) * WIDTH * (1 - 0.5 * f);
        const oy = (dx / l) * WIDTH * (1 - 0.5 * f);
        const quad = [px - ox, py - oy, px + ox, py + oy, nx + ox, ny + oy, px - ox, py - oy, nx + ox, ny + oy, nx - ox, ny - oy];
        for (let q = 0; q < 6; q++) {
          this.pos[k++] = quad[q * 2];
          this.pos[k++] = quad[q * 2 + 1];
          this.pos[k++] = z;
        }
        px = nx;
        py = ny;
      }
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  // off (a new floor)
  clear(): void {
    this.t = LIFE;
    this.group.visible = false;
  }
}
