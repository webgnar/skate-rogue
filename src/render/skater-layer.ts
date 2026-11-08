// The skater over the HUD (zack, 2026-11-06: "player should be drawn over the trick names.. also over the hud UI").
//
// The HUD is HTML on top of the street's canvas, so nothing the canvas draws can cover it. This is a second canvas
// above the HUD that holds only the skater, and only where he crosses a HUD panel or a callout: everywhere else the
// street's own canvas shows him as before (with his dithered ghost behind walls, which this copy doesn't have).
//
// Each frame the street view draws the skater alone, on a clear background, into the box round him (one small pass
// before the frame proper, bent by the fisheye the same way), and copies that box here, cut to the HUD rectangles
// it crosses. When he crosses none (most of a run) it costs nothing.
//
// The rectangles are read at the start of a frame (measure()), before the HUD writes its numbers, while the page's
// layout is still clean, so reading them doesn't force the browser to lay the page out again mid-frame.
import * as THREE from 'three';

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
  private readonly ctx: CanvasRenderingContext2D;
  private rects: DOMRect[] = [];
  private hits: DOMRect[] = [];
  private drawn = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly hud: HTMLElement,
  ) {
    this.ctx = canvas.getContext('2d')!;
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

  // does the skater's box cross anything on the HUD (and keep the ones it does for copy())
  wants(box: Box): boolean {
    const top = this.canvas.getBoundingClientRect();
    this.hits.length = 0;
    for (const r of this.rects) {
      const x = r.left - top.left;
      const y = r.top - top.top;
      if (x < box.x + box.w && x + r.width > box.x && y < box.y + box.h && y + r.height > box.y) this.hits.push(r);
    }
    return this.hits.length > 0;
  }

  // copy the box from the street's canvas (where the skater was just drawn alone) into this one, cut to the HUD
  copy(src: HTMLCanvasElement, box: Box): void {
    const c = this.canvas;
    if (c.width !== src.width || c.height !== src.height) {
      c.width = src.width;
      c.height = src.height;
    }
    const sx = src.width / Math.max(1, src.clientWidth);
    const sy = src.height / Math.max(1, src.clientHeight);
    const top = c.getBoundingClientRect();
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.beginPath();
    for (const r of this.hits) ctx.rect((r.left - top.left) * sx, (r.top - top.top) * sy, r.width * sx, r.height * sy);
    ctx.clip();
    const x = Math.floor(box.x * sx);
    const y = Math.floor(box.y * sy);
    const w = Math.min(src.width - x, Math.ceil(box.w * sx));
    const h = Math.min(src.height - y, Math.ceil(box.h * sy));
    if (w > 0 && h > 0) ctx.drawImage(src, x, y, w, h, x, y, w, h);
    ctx.restore();
    this.drawn = true;
  }

  clear(): void {
    if (!this.drawn) return;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawn = false;
  }
}

// the canvas's alpha back to solid once the frame is drawn (the street's canvas has alpha now, for the skater's
// pass; a shader that writes alpha under 1 would otherwise show the page through)
export function solidAlpha(renderer: THREE.WebGLRenderer): void {
  const gl = renderer.getContext();
  gl.colorMask(false, false, false, true);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.colorMask(true, true, true, true);
  renderer.state.buffers.color.reset(); // three's cached mask and clear colour are stale now
}
