// The skater over the HUD (zack, 2026-11-06: "player should be drawn over the trick names.. also over the hud UI").
//
// The HUD is HTML on top of the street's canvas, so nothing the canvas draws can cover it. This is a second canvas
// above the HUD that holds only the skater, and only where he crosses a HUD panel or a callout: everywhere else the
// street's own canvas shows him as before (with his dithered ghost behind walls, which this copy doesn't have).
//
// Each frame this canvas's own WebGL renderer draws the skater alone, on a clear background, in the box round him
// (bent by the fisheye the same way), and the canvas is clipped to the HUD rectangles he crosses. When he crosses
// none (most of a run) it's hidden and costs nothing.
//
// (It used to draw him on the street's canvas and copy that box up with drawImage. Reading a WebGL canvas back like
// that stalls the GPU every frame: ~10 ms a frame in the cloud, most of a small iPhone's frame whenever he was over
// the held boons. Thread "Fix act 3 lag on iPhone 13 mini", 2026-11-08.)
//
// The rectangles are read at the start of a frame (measure()), before the HUD writes its numbers, while the page's
// layout is still clean, so reading them doesn't force the browser to lay the page out again mid-frame.
import * as THREE from 'three';
import { Lens } from './lens';

// what the skater goes over: the top bar's panels, the meters, the callouts, held boons, board mods, gear wear
export const LAYER = {
  over: '#logo, #center > .panel:not([data-live="0"]), #right > *, #stoke, #heat, #callout .pop, #pointfly .pop, #boons .chip, #board, #gear, #mission:not([hidden])',
  edge: 8, // css px each HUD box grows by, for the neon edges and drop shadows drawn outside it
  pad: 0.2, // the box round the skater grows by this much each way (his bounds are his rest pose's, not his pose's)
};

export interface Box {
  x: number; // css px from the left
  y: number; // css px from the top
  w: number;
  h: number;
}

export class SkaterLayer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly lens = new Lens();
  private rects: DOMRect[] = [];
  private hits: DOMRect[] = [];
  private drawn = false;
  private clip = '';
  private readonly size = new THREE.Vector2();

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly hud: HTMLElement,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, stencil: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.canvas.style.visibility = 'hidden';
  }

  // the HUD's rectangles, read before the frame writes to the page
  measure(): void {
    const rects: DOMRect[] = [];
    if (this.hud.offsetParent !== null) {
      for (const el of this.hud.querySelectorAll<HTMLElement>(LAYER.over)) {
        const r = el.getBoundingClientRect();
        const e = LAYER.edge;
        if (r.width > 0 && r.height > 0) rects.push(new DOMRect(r.left - e, r.top - e, r.width + e * 2, r.height + e * 2));
      }
    }
    this.rects = rects;
  }

  // does the skater's box cross anything on the HUD (and keep the ones it does for draw())
  wants(box: Box): boolean {
    const top = this.canvas.getBoundingClientRect();
    this.hits.length = 0;
    for (const r of this.rects) {
      const x = r.left - top.left;
      const y = r.top - top.top;
      if (x < box.x + box.w && x + r.width > box.x && y < box.y + box.h && y + r.height > box.y) this.hits.push(new DOMRect(x, y, r.width, r.height));
    }
    return this.hits.length > 0;
  }

  // draw the skater's scene (only him showing) into his box, the street's camera and lens, at the street canvas's
  // size and pixel ratio, and clip the canvas to the HUD boxes he crosses
  draw(main: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, box: Box, k: number, chunky: boolean, sharp: boolean): void {
    const r = this.renderer;
    this.match(main);
    const h = this.canvas.clientHeight;
    r.setScissor(box.x, h - box.y - box.h, box.w, box.h);
    r.setScissorTest(true);
    this.lens.render(r, camera, k, chunky, sharp, () => {
      r.clear();
      r.render(scene, camera);
    });
    r.setScissorTest(false);
    //only where a HUD box is: a polygon of its rectangles, each joined back to the corner by a seam of no width
    const clip = `polygon(${this.hits.map((c) => `0 0, ${c.x}px ${c.y}px, ${c.x + c.width}px ${c.y}px, ${c.x + c.width}px ${c.y + c.height}px, ${c.x}px ${c.y + c.height}px, ${c.x}px ${c.y}px`).join(', ')}, 0 0)`;
    if (clip !== this.clip) this.canvas.style.clipPath = this.clip = clip;
    if (!this.drawn) this.canvas.style.visibility = 'visible';
    this.drawn = true;
  }

  // the same drawing size, pixel ratio and colour handling as the street's canvas, so the copy lands on him exactly
  private match(main: THREE.WebGLRenderer): void {
    const r = this.renderer;
    r.outputColorSpace = main.outputColorSpace;
    r.toneMapping = main.toneMapping;
    r.toneMappingExposure = main.toneMappingExposure;
    if (r.getPixelRatio() !== main.getPixelRatio()) r.setPixelRatio(main.getPixelRatio());
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    r.getSize(this.size);
    if (this.size.x !== w || this.size.y !== h) r.setSize(w, h, false);
  }

  // compile the skater's shaders for this canvas too (the loading screen), so his first time over the HUD doesn't
  // stop to make them
  warm(main: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): Promise<unknown> {
    this.match(main);
    const target = new THREE.WebGLRenderTarget(4, 4);
    this.renderer.setRenderTarget(target);
    const into = this.renderer.compileAsync(scene, camera);
    this.renderer.setRenderTarget(null);
    return Promise.all([into, this.renderer.compileAsync(scene, camera), this.lens.warm(this.renderer)]).finally(() => target.dispose());
  }

  clear(): void {
    if (!this.drawn) return;
    this.canvas.style.visibility = 'hidden';
    this.drawn = false;
  }
}
