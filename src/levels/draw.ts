// Side views for the level editor: a floor to scale (1 tile = 32 px), as an SVG string. Pure drawing, no game state.
import { label } from '../gen/roads';
import { TILE } from '../physics/constants';
import { inHill, type Level } from '../physics/level';
import type { Spawn } from '../traffic/traffic';

export interface BotLine {
  path: [number, number, string][]; // x, y (feet), mode, every other frame
  slams: [number, number][];
}

const C = {
  hill: '#5f5874',
  top: '#8d84a6',
  street: '#3a3450',
  water: '#2b6fd6',
  rail: '#3fdcff',
  ledge: '#8d84a6',
  side: '#ff3d9a',
  cash: '#ffd23f',
  stoken: '#3fdcff',
  air: '#ffd23f',
  grind: '#6ee7a0',
  roll: '#ffffff',
  slam: '#ff5a5a',
  text: '#f2eef8',
  dim: '#a69db8',
  gate: '#ff3d9a',
  el: '#6b5a3a',
  cable: '#c8a2ff',
  kicker: '#ff9a3d',
  wire: '#d8d2e6',
  sky: '#7af0c8', // the sky beats over the power line
  up: '#5fa8ff', // the top route (sky blue: the side line has pink)
  cloud: '#eef4ff', // the cloud layer
  rainbow: '#ff9ad5',
  mover: '#ffb86b', // a sky set piece that moves
  sewer: '#1f3b30', // the sewer tunnel
  sewerEdge: '#7fd17a',
  pipe: '#a6c46a',
  runoff: '#4ac0a8',
};

// the route layers the editor can show or hide
export interface Layers {
  sky: boolean;
  clouds: boolean;
  sewer: boolean;
}
export const ALL_LAYERS: Layers = { sky: true, clouds: true, sewer: true };

// which layer a sky piece is in: the cloud layer (src/gen/clouds.ts) or the sky beats under it (src/gen/sky-beats.ts)
const CLOUD_KINDS = ['step', 'wisp', 'cloud', 'thin', 'rainbow', 'balloon'];
export const inClouds = (kind: string | undefined) => !!kind && CLOUD_KINDS.includes(kind);

const MONO = 'font-family="JetBrains Mono, ui-monospace, Menlo, monospace"';

// the floor's stretches of hill (the opening descent, then one per cable car) and the street between and after them
export function hillSpans(L: Level): [number, number][] {
  return L.hillSpans?.length ? L.hillSpans : [[0, L.finaleX]];
}
export function streetSpans(L: Level): [number, number][] {
  const out: [number, number][] = [];
  let x = 0;
  for (const [a, b] of hillSpans(L)) {
    if (a > x) out.push([x, a]);
    x = Math.max(x, b);
  }
  if (x < L.width) out.push([x, L.width]);
  return out;
}
const spanOf = (L: Level, x: number) => hillSpans(L).findIndex(([a, b]) => x >= a && x < b);

// the descent's sections, named from its surfaces in order
export function sectionNotes(level: Level): { x: number; y: number; text: string; kind: string }[] {
  const ds = level.surfaces
    .filter((s) => inHill(level, s.x0) && (s.kind === 'roof' || s.kind === 'stairs' || s.kind === 'bank') && !s.side)
    .sort((a, b) => a.x0 - b.x0);
  const notes: { x: number; y: number; text: string; kind: string }[] = [];
  for (let i = 0; i < ds.length; i++) {
    const s = ds[i];
    if (s.kind === 'stairs') {
      const steps = Math.round((s.x1 - s.x0) / TILE);
      const rail = level.rails.some((r) => Math.abs(r.x0 - (s.x0 - TILE / 2)) < 2);
      notes.push({ x: (s.x0 + s.x1) / 2, y: s.y, text: `${steps} stairs${rail ? ' + rail' : ''}`, kind: 'stairs' });
    } else if (s.kind === 'bank' && s.tow && s.y1 !== undefined) {
      notes.push({ x: (s.x0 + s.x1) / 2, y: s.y1, text: `cable car ↑${Math.round((s.y - s.y1) / TILE)}`, kind: 'cable' });
    } else if (s.kind === 'bank' && s.y1 !== undefined) {
      const d = Math.round((s.y1 - s.y) / TILE);
      if (d < 0) notes.push({ x: (s.x0 + s.x1) / 2, y: s.y1, text: `kicker ↑${-d}`, kind: 'kicker' });
      else if (d > 0) {
        const rail = level.rails.some((r) => Math.abs(r.x0 - (s.x0 - TILE / 2)) < 2);
        notes.push({ x: (s.x0 + s.x1) / 2, y: s.y, text: `hill ↓${d}${rail ? ' + rail' : ''}`, kind: 'hill' });
      }
    }
    const n = ds[i + 1];
    if (!n || spanOf(level, n.x0) !== spanOf(level, s.x0)) continue;
    const endY = s.y1 ?? s.y;
    const gap = Math.round((n.x0 - s.x1) / TILE);
    const drop = Math.round((n.y - endY) / TILE);
    if (gap >= 1) notes.push({ x: (s.x1 + n.x0) / 2, y: Math.min(endY, n.y), text: `${gap}-tile jump`, kind: 'gap' });
    else if (drop >= 1 && s.kind === 'roof' && n.kind !== 'stairs') notes.push({ x: s.x1, y: endY, text: `drop ↓${drop}`, kind: 'drop' });
  }
  return notes;
}

export function floorSVG(L: Level, scale: number, opts: { bot?: BotLine | null; spawns?: Spawn[]; layers?: Layers } = {}): string {
  const lay = opts.layers ?? ALL_LAYERS;
  const minY = Math.min(L.startY, L.streetY, ...L.surfaces.map((s) => Math.min(s.y, s.y1 ?? s.y)), ...L.pickups.map((p) => p.y), ...(L.skyMovers ?? []).map((m) => m.y - 40)) - 70;
  const maxY = Math.max(L.streetY + 100, ...(lay.sewer ? (L.sewers ?? []).map((s) => s.y + 110) : []));
  const holeAt = (x: number) => (L.sewers ?? []).some((s) => (x >= s.drain[0] && x < s.drain[1]) || (x >= s.outlet[0] && x < s.outlet[1]));
  const showSky = (kind: string) => (inClouds(kind) ? lay.clouds : lay.sky);
  const W = L.width + 2 * TILE;
  const f = (n: number) => n.toFixed(1);
  const X = (x: number) => (x + TILE) * scale;
  const Y = (y: number) => (y - minY) * scale + 34;
  const w = W * scale;
  const h = (maxY - minY) * scale + 34;
  const g: string[] = [];
  const base = L.streetY + 60;
  const text = (x: number, y: number, s: string, col: string, extra = '') =>
    g.push(`<text x="${f(x)}" y="${f(y)}" fill="${col}" font-size="10" ${MONO} ${extra}>${s}</text>`);
  // the hill and its stairways, solid down to the ground
  for (const s of L.surfaces) {
    if (!inHill(L, s.x0) || s.side) continue;
    if (s.kind === 'roof' || s.kind === 'bank') {
      const y1 = s.y1 ?? s.y;
      g.push(`<polygon points="${f(X(s.x0))},${f(Y(s.y))} ${f(X(s.x1))},${f(Y(y1))} ${f(X(s.x1))},${f(Y(base))} ${f(X(s.x0))},${f(Y(base))}" fill="${C.hill}"/>`);
      //the cable car's slot: you're towed up it
      g.push(`<line x1="${f(X(s.x0))}" y1="${f(Y(s.y))}" x2="${f(X(s.x1))}" y2="${f(Y(y1))}" stroke="${s.tow ? C.cable : C.top}" stroke-width="${s.tow ? 3 : 2}"${s.tow ? ' stroke-dasharray="6 3"' : ''}/>`);
    } else if (s.kind === 'stairs' && s.y1 !== undefined) {
      const n = Math.max(1, Math.round((s.x1 - s.x0) / TILE));
      const rise = (s.y1 - s.y) / n;
      let pts = `${f(X(s.x0))},${f(Y(s.y))}`;
      for (let i = 0; i < n; i++) pts += ` ${f(X(s.x0 + (i + 1) * TILE))},${f(Y(s.y + i * rise))} ${f(X(s.x0 + (i + 1) * TILE))},${f(Y(s.y + (i + 1) * rise))}`;
      g.push(`<polygon points="${pts} ${f(X(s.x1))},${f(Y(base))} ${f(X(s.x0))},${f(Y(base))}" fill="${C.hill}"/>`);
      g.push(`<polyline points="${pts}" fill="none" stroke="${C.top}" stroke-width="1.5"/>`);
    }
  }
  // the street (the chases between the hills, then the last run to the gate), its canals and its pieces
  const st = L.finaleX;
  for (const [a, b] of streetSpans(L)) {
    g.push(`<rect x="${f(X(a))}" y="${f(Y(L.streetY))}" width="${f((b - a) * scale)}" height="${f(40 * scale + 6)}" fill="${C.street}"/>`);
    g.push(`<line x1="${f(X(a))}" y1="${f(Y(L.streetY))}" x2="${f(X(b))}" y2="${f(Y(L.streetY))}" stroke="${C.top}" stroke-width="2"/>`);
  }
  for (let c = Math.floor(st / TILE); c < L.street.length; c++) {
    if (!L.street[c] && !inHill(L, c * TILE) && !holeAt(c * TILE)) g.push(`<rect x="${f(X(c * TILE))}" y="${f(Y(L.streetY - 2))}" width="${f(TILE * scale + 0.6)}" height="${f(40 * scale + 8)}" fill="${C.water}"/>`);
  }
  L.layout.pieces.forEach((p, i) => {
    const x = st + i * 16 * TILE;
    if (p.name === 'hill') return;
    g.push(`<line x1="${f(X(x))}" y1="${f(Y(L.streetY + 46))}" x2="${f(X(x))}" y2="${f(Y(L.streetY + 96))}" stroke="${C.dim}" stroke-dasharray="2 3"/>`);
    text(X(x) + 4, Y(L.streetY + 46) + 12, p.name, C.dim);
  });
  hillSpans(L).forEach(([a, b], i) => {
    if (b > a) text(X(a + 8), Y(L.streetY + 46) + 12, `${i ? `HILL ${i + 1}` : 'HILL'} · ${Math.round((b - a) / TILE)} tiles`, C.cash);
  });
  streetSpans(L).forEach(([a, b], i, all) => {
    if (i < all.length - 1) text(X(a + 8), Y(L.streetY + 46) + 26, `CHASE · ${Math.round((b - a) / TILE)} tiles`, C.cash);
  });
  // the sewer route under the street chases: the tunnel, its runoff, the drain and the outlet (pipes are rails below)
  if (lay.sewer) {
    for (const [i, sw] of (L.sewers ?? []).entries()) {
      g.push(`<rect x="${f(X(sw.x0))}" y="${f(Y(L.streetY) + 40 * scale + 6)}" width="${f((sw.x1 - sw.x0) * scale)}" height="${f(Math.max(4, Y(sw.y) - Y(L.streetY) - 40 * scale - 6))}" fill="${C.sewer}"/>`);
      for (const [a, b] of [sw.drain, sw.outlet].filter(([a, b]) => b > a)) g.push(`<rect x="${f(X(a))}" y="${f(Y(L.streetY) - 2)}" width="${f((b - a) * scale)}" height="${f(40 * scale + 10)}" fill="#0c1612" stroke="#f2c230" stroke-width="1.2"/>`);
      for (const [a, b] of sw.wet) g.push(`<rect x="${f(X(a))}" y="${f(Y(sw.y) - 3)}" width="${f((b - a) * scale)}" height="3" fill="${C.runoff}"/>`);
      if (sw.drain[1] > sw.drain[0]) text(X(sw.drain[0]), Y(L.streetY) - 6, sw.entry === 'ramp' ? 'plank ramp ↓' : 'dig ↓', '#f2c230');
      if (sw.outlet[1] > sw.outlet[0]) text(X(sw.outlet[0]), Y(L.streetY) - 6, sw.gate ? 'SEWER ROAD → spot' : 'outlet ↑', '#f2c230');
      if (sw.entry === 'drop') text(X(sw.x0), Y(sw.y) + 12, 'the deep ↓', '#7cff4a');
      //kick-outs: a quarterpipe up through a grate in the street
      for (const k of sw.kicks ?? []) {
        g.push(`<rect x="${f(X(k.grate[0]))}" y="${f(Y(L.streetY) - 1)}" width="${f((k.grate[1] - k.grate[0]) * scale)}" height="3" fill="none" stroke="${C.kicker}" stroke-dasharray="2 2"/>`);
        g.push(`<line x1="${f(X((k.x0 + k.x1) / 2))}" y1="${f(Y(sw.y) - 4)}" x2="${f(X((k.x0 + k.x1) / 2))}" y2="${f(Y(L.streetY) - 14)}" stroke="${C.kicker}" stroke-dasharray="3 2" marker-end=""/>`);
        text(X(k.x0), Y(sw.y) - 16, 'kick-out ↑', C.kicker);
      }
      //its set piece, the alligator
      const p = sw.piece;
      if (p) {
        const [px, name] =
          p.kind === 'rats' ? [p.x, `🐀 rats ×${p.n} ←`] : p.kind === 'surge' ? [p.x, '🌊 flood surge →'] : p.kind === 'bowl' ? [p.x0, 'full pipe bowl'] : [p.x0, '🚇 subway gap'];
        text(X(px), Y(sw.y) - 30, name, C.runoff);
        if (p.kind === 'subway') g.push(`<rect x="${f(X(p.x0))}" y="${f(Y(sw.y) - 1)}" width="${f((p.x1 - p.x0) * scale)}" height="${f(30 * scale + 4)}" fill="#0c1612" stroke="${C.runoff}" stroke-dasharray="2 2"/>`);
      }
      for (const pr of L.props ?? []) {
        if (!pr.stash || pr.x < sw.x0 || pr.x >= sw.x1) continue;
        g.push(`<rect x="${f(X(pr.x) - 4)}" y="${f(Y(sw.y) - 8)}" width="8" height="8" fill="${C.cash}" stroke="#000"/>`);
        text(X(pr.x), Y(sw.y) - 58, `stash: ${pr.loot === 'gear' ? 'gear part' : 'spin token'}`, C.cash);
      }
      if (sw.gator) {
        g.push(`<rect x="${f(X(sw.gator[0]))}" y="${f(Y(sw.y) - 8 * scale - 3)}" width="${f((sw.gator[1] - sw.gator[0]) * scale)}" height="${f(8 * scale + 3)}" rx="2" fill="#5fbf3f"/>`);
        text(X(sw.gator[0]), Y(sw.y) - 44, '🐊 alligator', '#5fbf3f');
      }
      text(X(sw.x0) + 4, Y(sw.y) + 44 * scale + 18, `SEWER · ${Math.round((sw.x1 - sw.x0) / TILE)} tiles · ${Math.round((sw.y - L.streetY) / TILE)} down`, C.sewerEdge, i ? '' : 'data-anchor="sewer"');
    }
  }
  // the L overhead
  for (const e of L.el ?? []) g.push(`<rect x="${f(X(e.x0))}" y="${f(Y(e.y))}" width="${f((e.x1 - e.x0) * scale)}" height="${f(Math.max(3, (e.under - e.y) * scale))}" fill="${C.el}"/>`);
  // ledges, flat rails, platforms, the overpass
  for (const s of L.surfaces) {
    const fin = !inHill(L, s.x0);
    if (s.el) continue;
    if (s.sewer) {
      //the sewer's floor and its outlet ramp up to the street
      if (!lay.sewer) continue;
      g.push(`<line x1="${f(X(s.x0))}" y1="${f(Y(s.y))}" x2="${f(X(s.x1))}" y2="${f(Y(s.y1 ?? s.y))}" stroke="${C.sewerEdge}" stroke-width="2"/>`);
    } else if (s.sky) {
      //a sky beat (a deck, or a billboard's rail, over the power line) or a cloud, labelled with what it is
      if (!showSky(s.sky)) continue;
      const cloud = inClouds(s.sky);
      const col = cloud ? C.cloud : C.sky;
      g.push(`<rect x="${f(X(s.x0))}" y="${f(Y(s.y))}" width="${f((s.x1 - s.x0) * scale)}" height="${f(Math.max(2, (s.kind === 'rail' ? 4 : cloud ? 14 : 10) * scale))}" rx="${cloud ? f(Math.max(1, 6 * scale)) : 0}" fill="${col}"${s.sky === 'thin' ? ' opacity="0.55" stroke-dasharray="3 2" stroke="#fff"' : ''}/>`);
      text(X(s.x0), Y(s.y) - 4, s.sky, col);
    } else if (s.kind === 'bank' && s.kicker) {
      //the L's kicker: a steel ramp up off the street
      const y1 = s.y1 ?? s.y;
      g.push(`<polygon points="${f(X(s.x0))},${f(Y(s.y))} ${f(X(s.x1))},${f(Y(y1))} ${f(X(s.x1))},${f(Y(s.y))}" fill="${C.kicker}"/>`);
      text(X((s.x0 + s.x1) / 2), Y(y1) - 6, 'L kicker', C.kicker, 'text-anchor="middle"');
    } else if (s.kind === 'ledge' || (fin && s.kind === 'roof')) {
      g.push(`<rect x="${f(X(s.x0))}" y="${f(Y(s.y))}" width="${f((s.x1 - s.x0) * scale)}" height="${f(Math.max(2, 10 * scale))}" fill="${s.top ? C.up : s.side ? C.side : C.ledge}"/>`);
    } else if (s.kind === 'rail') {
      g.push(`<line x1="${f(X(s.x0))}" y1="${f(Y(s.y))}" x2="${f(X(s.x1))}" y2="${f(Y(s.y))}" stroke="${C.rail}" stroke-width="2"/>`);
    } else if (s.kind === 'overpass') {
      g.push(`<rect x="${f(X(s.x0))}" y="${f(Y(s.y))}" width="${f((s.x1 - s.x0) * scale)}" height="${f(Math.max(3, 14 * scale))}" fill="${C.top}" opacity="0.85"/>`);
    }
  }
  for (const r of L.rails) {
    let pts = '';
    for (let i = 0; i < r.xs.length; i += 2) pts += `${f(X(r.xs[i]))},${f(Y(r.ys[i]))} `;
    pts += `${f(X(r.xs[r.xs.length - 1]))},${f(Y(r.ys[r.ys.length - 1]))}`;
    //a power line strung over the hill is a thin wire; the rest are tubes
    if ((r.sky && !showSky(r.sky)) || (r.sewer && !lay.sewer)) continue;
    if (r.sky === 'rainbow') {
      g.push(`<polyline points="${pts}" fill="none" stroke="${C.rainbow}" stroke-width="3"/>`);
      text(X(r.x0), Y(r.y0) - 6, 'rainbow', C.rainbow);
      continue;
    }
    g.push(r.sewer
      ? `<polyline points="${pts}" fill="none" stroke="${C.pipe}" stroke-width="3"/>`
      : r.sky
      ? `<polyline points="${pts}" fill="none" stroke="${C.sky}" stroke-width="2.4"/>`
      : r.top
      ? `<polyline points="${pts}" fill="none" stroke="${C.up}" stroke-width="1.8" stroke-dasharray="6 3"/>`
      : r.wire
      ? `<polyline points="${pts}" fill="none" stroke="${C.wire}" stroke-width="1.2" stroke-dasharray="4 2"/>`
      : `<polyline points="${pts}" fill="none" stroke="${C.rail}" stroke-width="2.2"/>`);
  }
  // the sky's moving set pieces, each with how it moves, and paper billboards to burst through
  for (const m of L.skyMovers ?? []) {
    const cloud = m.kind === 'cloud' || m.kind === 'balloon';
    if (cloud ? !lay.clouds : !lay.sky) continue;
    const [x0, x1, y] = [X(m.x0), X(m.x1), Y(m.y)];
    const col = cloud ? C.cloud : C.mover;
    const deck = (h: number, extra = '') => g.push(`<rect x="${f(x0)}" y="${f(y)}" width="${f(x1 - x0)}" height="${f(Math.max(2, h * scale))}" fill="${col}"${extra}/>`);
    if (m.kind === 'blimp') {
      g.push(`<ellipse cx="${f((x0 + x1) / 2)}" cy="${f(y + 30 * scale)}" rx="${f((x1 - x0) / 2)}" ry="${f(Math.max(3, 30 * scale))}" fill="none" stroke="${col}" stroke-width="1.5"/>`);
      deck(6);
      text(x0, y - 4, 'blimp ↕ bobs', col);
    } else if (m.kind === 'rig') {
      deck(8);
      if (m.floor !== undefined) g.push(`<line x1="${f((x0 + x1) / 2)}" y1="${f(y)}" x2="${f((x0 + x1) / 2)}" y2="${f(Y(m.floor))}" stroke="${col}" stroke-dasharray="3 3"/><rect x="${f(x0)}" y="${f(Y(m.floor))}" width="${f(x1 - x0)}" height="2" fill="${col}" opacity="0.4"/>`);
      text(x0, y - 4, 'rig ↓ drops', col);
    } else if (m.kind === 'swing') {
      deck(5);
      if (m.mast !== undefined) g.push(`<line x1="${f(X(m.mast))}" y1="${f(y - 20 * scale)}" x2="${f(X(m.mast))}" y2="${f(Y(L.streetY))}" stroke="${col}" stroke-width="1.5" opacity="0.6"/>`);
      text(x0, y - 4, 'crane jib ⟲ swings', col);
    } else if (m.kind === 'beam') {
      g.push(`<line x1="${f(x0)}" y1="${f(y)}" x2="${f(x1)}" y2="${f(y)}" stroke="#ff5a3d" stroke-width="3"/><line x1="${f((x0 + x1) / 2)}" y1="${f(y)}" x2="${f((x0 + x1) / 2)}" y2="${f(y - 60 * scale)}" stroke="${C.dim}" stroke-dasharray="2 2"/>`);
      text(x0, y - 4, 'I-beam ↔ swings', '#ff5a3d');
    } else if (m.kind === 'cloud') {
      deck(14, ` rx="${f(Math.max(1, 6 * scale))}"`);
      text(x0, y - 4, '↔ drifting cloud', col);
    } else {
      deck(8);
      g.push(`<circle cx="${f((x0 + x1) / 2)}" cy="${f(y - 50 * scale)}" r="${f(Math.max(3, 34 * scale))}" fill="none" stroke="${C.rainbow}" stroke-width="1.5"/>`);
      text(x0, y - 4 - 84 * scale, 'balloon ↕', C.rainbow);
    }
  }
  if (lay.sky) for (const b of L.busts ?? []) {
    g.push(`<rect x="${f(X(b.x) - 2)}" y="${f(Y(b.y0))}" width="4" height="${f((b.y1 - b.y0) * scale)}" fill="#f2eef8" opacity="0.7" stroke-dasharray="2 2" stroke="${C.mover}"/>`);
    text(X(b.x), Y(b.y0) - 4, 'paper bust', C.mover, 'text-anchor="middle"');
  }
  // layer names over the first piece of each
  const firstSky = L.surfaces.filter((s) => s.sky && !inClouds(s.sky)).sort((a, b) => a.x0 - b.x0)[0];
  if (firstSky && lay.sky) text(X(firstSky.x0), Y(firstSky.y) - 18, 'SKY ROUTE ↘', C.sky, 'font-weight="700" data-anchor="sky"');
  const firstCloud = L.surfaces.filter((s) => s.sky && inClouds(s.sky)).sort((a, b) => a.x0 - b.x0)[0];
  if (firstCloud && lay.clouds) text(X(firstCloud.x0), Y(firstCloud.y) - 18, 'CLOUD LAYER ↗', C.cloud, 'font-weight="700" data-anchor="clouds"');
  for (const c of L.cars) {
    const col = c.model === 'bus' ? C.cash : c.model === 'cruiser' ? '#5b8cff' : '#9a93ad';
    g.push(`<rect x="${f(X(c.x0))}" y="${f(Y(c.roof))}" width="${f((c.x1 - c.x0) * scale)}" height="${f((c.bottom - c.roof) * scale)}" rx="2" fill="${col}"/>`);
  }
  for (const gl of L.glass) g.push(`<rect x="${f(X(gl.x0))}" y="${f(Y(L.streetY - 4))}" width="${f((gl.x1 - gl.x0) * scale)}" height="4" fill="${C.slam}"/>`);
  for (const gr of L.grass ?? []) g.push(`<rect x="${f(X(gr.x0))}" y="${f(Y(L.streetY - 3))}" width="${f((gr.x1 - gr.x0) * scale)}" height="3" fill="#5fbf3f"/>`);
  for (const p of L.pickups) {
    //coins in a hidden layer hide with it
    if (!lay.sewer && (L.sewers ?? []).some((sw) => p.x >= sw.x0 && p.x < sw.x1 && p.y > L.streetY + TILE)) continue;
    if (p.kind === 'stoken') {
      const cx = X(p.x), cy = Y(p.y), r = 5;
      g.push(`<polygon points="${f(cx)},${f(cy - r)} ${f(cx + r)},${f(cy)} ${f(cx)},${f(cy + r)} ${f(cx - r)},${f(cy)}" fill="${C.stoken}" stroke="#000"/>`);
    } else if (p.kind === 'spin') g.push(`<circle cx="${f(X(p.x))}" cy="${f(Y(p.y))}" r="5" fill="#ff3b4e" stroke="#000"/>`);
    else g.push(`<circle cx="${f(X(p.x))}" cy="${f(Y(p.y))}" r="${f(Math.max(1.4, 5 * scale))}" fill="${C.cash}"/>`);
  }
  // the top route: pigeons in the way, and its name over the first stretch of it
  for (const k of L.flocks ?? []) text(X(k.x), Y(k.y) - 2, 'ᵛᵛᵛ pigeons', C.up, 'text-anchor="middle"');
  const firstUp = L.rails.find((r) => r.top) ?? L.surfaces.find((s) => s.top);
  if (firstUp) text(X(firstUp.x0), Y('y0' in firstUp ? firstUp.y0 : firstUp.y) - 10, 'TOP ROUTE ↘', C.up);
  // traffic: where vehicles are set off, cross streets, bus stops
  const lane = L.streetY + 30;
  for (const s of opts.spawns ?? []) text(X(s.at), Y(lane), `${s.kind === 'oncoming' ? '◀' : '▶'} ${s.kind}`, s.kind === 'oncoming' ? C.slam : C.text);
  for (const c of L.crossings) text(X(c.x), Y(lane) + 12, '✚ cross street', C.cash);
  for (const b of L.busStops) text(X(b.x), Y(lane) + 12, '▣ bus stop', C.cash);
  // start, the fork, the gate
  g.push(`<circle cx="${f(X(L.startX))}" cy="${f(Y(L.startY))}" r="5" fill="${C.gate}"/>`);
  text(X(L.startX) - 4, Y(L.startY) + 18, `START · ${Math.round((L.streetY - L.startY) / TILE)} up`, C.gate);
  if (L.fork) {
    text(X(L.fork.x0), Y(L.fork.y) - 8, `HIGH → ${label(L.fork.high)}`, C.cash);
    text(X(L.fork.x0), Y(L.streetY) - 6, `LOW → ${label(L.fork.low)}`, C.text);
    if (L.fork.sewer && lay.sewer) text(X(L.fork.x0), Y(L.streetY) + 40 * scale + 20, `SEWER → ${label(L.fork.sewer)}`, C.sewerEdge);
  }
  g.push(`<rect x="${f(X(L.exitX))}" y="${f(Y(L.streetY - 90))}" width="4" height="${f(90 * scale)}" fill="${C.gate}"/>`);
  // section names
  let alt = 0;
  for (const n of sectionNotes(L)) {
    const col = n.kind === 'gap' ? C.slam : n.kind === 'kicker' ? C.grind : n.kind === 'cable' ? C.cable : C.text;
    text(X(n.x), Y(n.y) - 16 - (alt++ % 2) * 12, n.text, col, 'text-anchor="middle"');
  }
  // the bot's line, coloured by what it was doing
  if (opts.bot) {
    const colOf = (m: string) => (m === 'air' ? C.air : m === 'grind' || m === 'rail' ? C.grind : C.roll);
    let seg: string[] = [];
    let mode = '';
    const flush = () => {
      if (seg.length > 1) g.push(`<polyline points="${seg.join(' ')}" fill="none" stroke="${colOf(mode)}" stroke-width="1.6" opacity="0.9"/>`);
    };
    for (const [x, y, m] of opts.bot.path) {
      const pt = `${f(X(x))},${f(Y(y - 4))}`;
      if (m !== mode) {
        const last = seg[seg.length - 1];
        flush();
        seg = last ? [last] : [];
        mode = m;
      }
      seg.push(pt);
    }
    flush();
    for (const [x, y] of opts.bot.slams) g.push(`<text x="${f(X(x))}" y="${f(Y(y))}" fill="${C.slam}" font-size="14" font-weight="700" text-anchor="middle">✕</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(h)}" viewBox="0 0 ${f(w)} ${f(h)}">${g.join('')}</svg>`;
}

// a small silhouette for the floors 1-15 strip: the hill, its rails and the street, at a shared scale
export function silhouetteSVG(L: Level, scale: number, maxW: number, top: number): string {
  const g: string[] = [];
  const h = Math.round((top + 200) * scale) + 6;
  const X = (x: number) => (x * scale).toFixed(1);
  const Y = (y: number) => ((y - (L.streetY - top)) * scale).toFixed(1);
  for (const s of L.surfaces) {
    if (!inHill(L, s.x0) || s.side) continue;
    if (s.kind === 'roof' || s.kind === 'bank' || s.kind === 'stairs') {
      g.push(`<polygon points="${X(s.x0)},${Y(s.y)} ${X(s.x1)},${Y(s.y1 ?? s.y)} ${X(s.x1)},${h} ${X(s.x0)},${h}" fill="${s.tow ? C.cable : C.hill}"/>`);
    }
  }
  for (const r of L.rails) if (inHill(L, r.x0)) g.push(`<line x1="${X(r.x0)}" y1="${Y(r.y0)}" x2="${X(r.x1)}" y2="${Y(r.y1)}" stroke="${r.top ? C.up : r.wire ? C.wire : C.rail}" stroke-width="${r.wire ? 1 : 1.5}"/>`);
  for (const s of L.surfaces) if (s.sky) g.push(`<rect x="${X(s.x0)}" y="${Math.max(0, Number(Y(s.y)))}" width="${X(s.x1 - s.x0)}" height="1.5" fill="${inClouds(s.sky) ? C.cloud : C.sky}"/>`);
  for (const sw of L.sewers ?? []) g.push(`<rect x="${X(sw.x0)}" y="${Y(L.streetY + 20)}" width="${X(sw.x1 - sw.x0)}" height="${((sw.y - L.streetY - 20) * scale).toFixed(1)}" fill="${C.sewerEdge}" opacity="0.7"/>`);
  for (const s of L.surfaces) if (s.top) g.push(`<rect x="${X(s.x0)}" y="${Y(s.y)}" width="${X(s.x1 - s.x0)}" height="1.5" fill="${C.up}"/>`);
  for (const [a, b] of streetSpans(L)) g.push(`<rect x="${X(a)}" y="${Y(L.streetY)}" width="${X(b - a)}" height="4" fill="#4a4262"/>`);
  if (L.fork) g.push(`<rect x="${X(L.fork.x0)}" y="${Y(L.fork.y)}" width="${X(L.fork.x1 - L.fork.x0)}" height="2" fill="${C.cash}"/>`);
  g.push(`<rect x="${X(L.exitX)}" y="${Y(L.streetY - 60)}" width="2" height="${(60 * scale).toFixed(1)}" fill="${C.gate}"/>`);
  return `<svg viewBox="0 0 ${(maxW * scale).toFixed(1)} ${h}" preserveAspectRatio="xMinYMax meet">${g.join('')}</svg>`;
}
