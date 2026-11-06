// Painting a deck graphic (src/board/deck-art.ts): on a canvas, for the board's underside and the shop's cards.
// Flat colours and bold shapes, like the decks on GNAR SUPPLY's rack (art/skateshop.py).
//
// The picture is the deck seen from below, nose at the top. Shapes are drawn in deck widths: x across from -0.5 to
// 0.5, y along from -LEN (tail) to +LEN (nose), y up.
import * as THREE from 'three';
import type { DeckArt } from '../board/deck-art';

export const LEN = 1.94; // half the deck's length in deck widths (art/board.py: 0.95 long, 8.25" wide)

type G = CanvasRenderingContext2D;
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

function poly(g: G, color: number, pts: number[][]): void {
  g.fillStyle = hex(color);
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
}

function circle(g: G, color: number, x: number, y: number, r: number): void {
  g.fillStyle = hex(color);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

function rect(g: G, color: number, x0: number, y0: number, x1: number, y1: number): void {
  g.fillStyle = hex(color);
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
}

function star(g: G, color: number, x: number, y: number, r: number, inner = 0.45, n = 5): void {
  const pts: number[][] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / n;
    const rr = i % 2 ? r * inner : r;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  poly(g, color, pts);
}

// each shape on a deck already painted its base colour
const SHAPES: Record<DeckArt['shape'], (g: G, ink: number[], base: number) => void> = {
  plain: () => {},
  band: (g, [a]) => rect(g, a, -0.5, -0.4, 0.5, 0.4),
  stripe: (g, [a]) => rect(g, a, -0.17, -LEN + 0.47, 0.17, LEN - 0.47),
  dot: (g, [a]) => circle(g, a, 0, 0.4, 0.37),
  bolt: (g, [a]) => poly(g, a, [[-0.27, 1], [0.2, 1], [0, 0.17], [0.3, 0.17], [-0.2, -1], [-0.03, -0.07], [-0.33, -0.07]]),
  chevrons: (g, [a, b]) => {
    for (let i = 0; i < 3; i++) {
      const y = 0.75 - i * 0.55;
      poly(g, i % 2 ? b : a, [[-0.5, y - 0.3], [0, y + 0.08], [0.5, y - 0.3], [0.5, y - 0.02], [0, y + 0.36], [-0.5, y - 0.02]]);
    }
  },
  checker: (g, [a, b]) => {
    const s = 0.25;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) if ((r + c) % 2) rect(g, a, -0.5 + c * s, -0.625 + r * s, -0.5 + (c + 1) * s, -0.625 + (r + 1) * s);
    rect(g, b, -0.5, 0.68, 0.5, 0.76);
    rect(g, b, -0.5, -0.76, 0.5, -0.68);
  },
  racing: (g, [a, b]) => {
    rect(g, a, -0.3, -LEN, -0.14, LEN);
    rect(g, a, 0.14, -LEN, 0.3, LEN);
    rect(g, b, -0.04, -LEN, 0.04, LEN);
  },
  star: (g, [a, b]) => {
    star(g, b, 0, 0.1, 0.5);
    star(g, a, 0, 0.1, 0.4);
    star(g, a, 0, 1.25, 0.14);
    star(g, a, 0, -1.05, 0.14);
  },
  flames: (g, [a, b, c]) => {
    //tongues licking up from the tail, each leaning and curling at its tip: the outer colour, then each inside it
    //shorter
    const tongues = (color: number, reach: number, hw: number) => {
      const base = -LEN + reach * 0.3;
      g.fillStyle = hex(color);
      g.fillRect(-1, -LEN - 1, 2, base + LEN + 1);
      for (let i = 0; i < 4; i++) {
        const x = -0.375 + i * 0.25;
        const tip = -LEN + reach * (0.7 + 0.3 * Math.abs(Math.sin(i * 2.3 + 1)));
        const lean = (i % 2 ? 1 : -1) * 0.08;
        g.beginPath();
        g.moveTo(x - hw, base);
        g.quadraticCurveTo(x - hw * 1.1, (base + tip) / 2, x + lean, tip);
        g.quadraticCurveTo(x + hw * 0.4, (base + tip) / 2 + 0.1, x + hw, base);
        g.closePath();
        g.fill();
      }
    };
    tongues(c, 2.4, 0.17);
    tongues(a, 1.85, 0.15);
    tongues(b, 1.15, 0.12);
  },
  diamond: (g, [a, b]) => {
    poly(g, a, [[0, 0.75], [0.36, 0], [0, -0.75], [-0.36, 0]]);
    for (const y of [1.3, -1.3]) poly(g, b, [[0, y + 0.18], [0.12, y], [0, y - 0.18], [-0.12, y]]);
  },
  cross: (g, [a]) => {
    for (const s of [1, -1]) {
      g.save();
      g.rotate(s * 0.62);
      rect(g, a, -0.1, -0.85, 0.1, 0.85);
      g.restore();
    }
  },
  target: (g, [a, b], base) => {
    [0.48, 0.38, 0.28, 0.18, 0.08].forEach((r, i) => circle(g, [a, base, b, base, a][i], 0, 0, r));
  },
  split: (g, [a]) => poly(g, a, [[-0.5, 0.45], [0.5, -0.45], [0.5, -LEN], [-0.5, -LEN]]),
  polka: (g, [a]) => {
    for (let r = -5; r <= 5; r++) for (let c = -1; c <= 1; c++) {
      const x = c * 0.33 + (r % 2 ? 0.165 : 0);
      if (Math.abs(x) < 0.5) circle(g, a, x, r * 0.33, 0.09);
    }
  },
  wave: (g, [a, b]) => {
    for (let k = 0; k < 4; k++) {
      const y0 = 0.9 - k * 0.5;
      const pts: number[][] = [];
      for (let i = 0; i <= 20; i++) pts.push([-0.5 + i / 20, y0 + 0.1 * Math.sin(i * 0.63)]);
      for (let i = 20; i >= 0; i--) pts.push([-0.5 + i / 20, y0 - 0.14 + 0.1 * Math.sin(i * 0.63)]);
      poly(g, k % 2 ? b : a, pts);
    }
  },
  zigzag: (g, [a]) => {
    const pts: number[][] = [];
    const n = 9;
    const t = 0.13;
    for (let i = 0; i <= n; i++) pts.push([(i % 2 ? 0.3 : -0.3) + t, LEN - 0.4 - i * ((2 * LEN - 0.8) / n)]);
    for (let i = n; i >= 0; i--) pts.push([(i % 2 ? 0.3 : -0.3) - t, LEN - 0.4 - i * ((2 * LEN - 0.8) / n)]);
    poly(g, a, pts);
  },
  eye: (g, [a, b, c]) => {
    //an almond: two arcs meeting in points top and bottom
    g.fillStyle = hex(a);
    g.beginPath();
    g.moveTo(0, 0.7);
    g.quadraticCurveTo(0.62, 0, 0, -0.7);
    g.quadraticCurveTo(-0.62, 0, 0, 0.7);
    g.fill();
    circle(g, b, 0, 0, 0.2);
    circle(g, c, 0, 0, 0.09);
    circle(g, a, 0.06, 0.07, 0.04);
  },
  moon: (g, [a, b], base) => {
    circle(g, a, 0, 0.45, 0.38);
    circle(g, base, 0.16, 0.55, 0.32);
    star(g, b, -0.18, -0.4, 0.1);
    star(g, b, 0.2, -0.85, 0.07);
    star(g, b, -0.12, -1.25, 0.08);
    star(g, b, 0.22, 1.25, 0.06);
  },
  heart: (g, [a, b]) => {
    g.fillStyle = hex(a);
    g.beginPath();
    g.moveTo(0, -0.5);
    g.bezierCurveTo(-0.7, 0.05, -0.35, 0.65, 0, 0.3);
    g.bezierCurveTo(0.35, 0.65, 0.7, 0.05, 0, -0.5);
    g.fill();
    circle(g, b, -0.18, 0.28, 0.06);
  },
  triangles: (g, [a, b]) => {
    poly(g, a, [[-0.5, -0.6], [-0.15, 0.25], [0.2, -0.6]]);
    poly(g, a, [[-0.1, -0.6], [0.25, 0.5], [0.5, -0.1], [0.5, -0.6]]);
    poly(g, b, [[0.25, 0.5], [0.16, 0.22], [0.25, 0.3], [0.33, 0.22]]);
    poly(g, b, [[-0.15, 0.25], [-0.23, 0.0], [-0.15, 0.06], [-0.07, 0.0]]);
    rect(g, a, -0.5, -0.72, 0.5, -0.64);
  },
  sunburst: (g, [a, b]) => {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI;
      const a1 = a0 + Math.PI / n / 2;
      poly(g, a, [[0, -0.9], [Math.cos(a0) * 3, -0.9 + Math.sin(a0) * 3], [Math.cos(a1) * 3, -0.9 + Math.sin(a1) * 3]]);
    }
    circle(g, b, 0, -0.9, 0.34);
  },
  skull: (g, [a, b]) => {
    circle(g, a, 0, 0.15, 0.36);
    rect(g, a, -0.2, -0.4, 0.2, -0.05);
    circle(g, b, -0.13, 0.12, 0.1);
    circle(g, b, 0.13, 0.12, 0.1);
    poly(g, b, [[0, -0.02], [0.05, -0.12], [-0.05, -0.12]]);
    for (const x of [-0.1, 0, 0.1]) rect(g, b, x - 0.012, -0.4, x + 0.012, -0.26);
    //crossbones under
    for (const s of [1, -1]) {
      g.save();
      g.translate(0, -0.75);
      g.rotate(s * 0.7);
      rect(g, a, -0.06, -0.38, 0.06, 0.38);
      circle(g, a, -0.06, 0.38, 0.06);
      circle(g, a, 0.06, 0.38, 0.06);
      circle(g, a, -0.06, -0.38, 0.06);
      circle(g, a, 0.06, -0.38, 0.06);
      g.restore();
    }
  },
  crown: (g, [a, b]) => {
    poly(g, a, [[-0.38, -0.25], [-0.38, 0.35], [-0.19, 0.08], [0, 0.45], [0.19, 0.08], [0.38, 0.35], [0.38, -0.25]]);
    for (const x of [-0.38, 0, 0.38]) circle(g, a, x, x ? 0.38 : 0.48, 0.05);
    for (const x of [-0.2, 0, 0.2]) circle(g, b, x, -0.1, 0.05);
  },
  drips: (g, [a, b]) => {
    //paint running down from the nose
    const pts: number[][] = [[-0.5, LEN], [0.5, LEN]];
    const n = 5;
    for (let i = n; i >= 0; i--) {
      const x = -0.5 + i / n;
      const len = 0.6 + 0.9 * ((i * 7) % 5) / 4;
      pts.push([x + 0.06, LEN - len], [x - 0.06, LEN - len], [x - 0.1, LEN - 0.45]);
    }
    poly(g, a, pts);
    for (let i = 0; i <= n; i++) circle(g, a, -0.5 + i / n, LEN - (0.6 + 0.9 * ((i * 7) % 5) / 4), 0.06);
    circle(g, b, 0.1, -0.5, 0.07);
    circle(g, b, -0.2, -0.95, 0.05);
  },
};

// the deck outline in deck widths, nose up: a long rounded rectangle
function outline(g: G): void {
  const r = 0.5;
  g.beginPath();
  g.arc(0, LEN - r, r, 0, Math.PI);
  g.arc(0, -LEN + r, r, Math.PI, Math.PI * 2);
  g.closePath();
}

// paint `art` onto a canvas w across and h along (h about 4w). `cut`: the deck's outline, inked, on a clear
// background (a card's picture); otherwise the whole canvas, edge to edge (the board's texture, the mesh cuts it)
export function paintDeck(canvas: HTMLCanvasElement, art: DeckArt, cut = false, graphicOnly = false): void {
  const g = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  g.clearRect(0, 0, w, h);
  g.save();
  const s = cut ? Math.min(w / 1.12, h / (2 * LEN + 0.12)) : w;
  g.translate(w / 2, h / 2);
  g.scale(s, -s);
  if (cut) {
    outline(g);
    g.save();
    g.clip();
  }
  if (!graphicOnly) {
    g.fillStyle = hex(art.base);
    g.fillRect(-1, -LEN - 1, 2, 2 * LEN + 2);
  }
  SHAPES[art.shape](g, art.ink, art.base);
  if (cut) {
    g.restore();
    outline(g);
    g.lineWidth = 0.05;
    g.strokeStyle = '#000';
    g.stroke();
  }
  g.restore();
}

// a card's picture of the deck, as an image URL (cached)
const urls = new Map<string, string>();
export function deckArtUrl(art: DeckArt): string {
  let u = urls.get(art.id);
  if (!u) {
    const c = document.createElement('canvas');
    c.width = 120;
    c.height = 440;
    paintDeck(c, art, true);
    urls.set(art.id, (u = c.toDataURL()));
  }
  return u;
}

// the graphic for the board's underside: the shapes only, on clear (the deck's own vertex colour is its base, so the
// wear can rub both through to the wood)
export function deckTexture(art: DeckArt): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 1024;
  paintDeck(c, art, false, true);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
