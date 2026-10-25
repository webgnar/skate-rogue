// The collision debug overlay (?debug=collision, or C to toggle): draws what the sim collides with, straight from
// its data (src/physics/level.ts, src/physics/skater.ts), never the render meshes. A 2D canvas over the game, every
// point projected through the game camera from the skate lane (z = 0). Made on first use, so off it costs nothing.
import * as THREE from 'three';
import { at } from '../game/interp';
import { PHYS, TILE } from '../physics/constants';
import { FEEL } from '../physics/feel';
import { isStreetAt, surfaceMaterial, surfaceSlope, surfaceY, type Car, type CurvedRail, type Level, type Surface } from '../physics/level';
import type { Mode, Skater } from '../physics/skater';
import { DEV, devSpeed, saveDev } from '../ui/dev';

// one colour per kind of thing the sim collides with (the readout's legend shows them)
export const COLLIDER = {
  street: '#a8b0b8',
  gap: '#ff3b3b',
  roof: '#4da3ff',
  ledge: '#ffb020',
  rail: '#ff4fd8', // flat bars, the L's running rails, train roofs
  curve: '#ff8af0', // curved handrails
  wire: '#c38bff', // power lines
  stairs: '#ffe14d',
  bank: '#39d98a',
  hill: '#2ec4b6',
  kicker: '#ff7a1a',
  overpass: '#00e5ff',
  carSide: '#ff3b3b', // a slam
  carRoof: '#b6ff3b', // a car hop
  ceiling: '#ff6b6b',
  body: '#ffffff',
  ray: '#00e5ff',
  speed: '#ffe14d',
} as const;

const MODE_COLOR: Record<Mode, string> = { roll: '#39d98a', air: '#ffffff', grind: '#ff4fd8', rail: '#ff8af0', bail: '#ff3b3b', exit: '#a8b0b8' };
const TRAIL = 150; // steps of the feet's path kept (2.5 s)
const MARK_LIFE = 1.6; // s a contact marker stays up

interface Mark {
  x: number;
  y: number;
  kind: 'land' | 'grind' | 'hop' | 'slam' | 'leave';
  text: string;
  t: number;
}

function surfaceColor(s: Surface): string {
  if (s.kicker) return COLLIDER.kicker;
  if (s.hill) return COLLIDER.hill;
  return COLLIDER[s.kind];
}

function surfaceTags(s: Surface): string {
  const tags: string[] = [s.kind];
  if (s.y1 !== undefined) tags.push(`m ${surfaceSlope(s).toFixed(2)}`);
  if (s.manual) tags.push('manual');
  if (s.crumble) tags.push('crumble');
  if (s.conveyor) tags.push(`belt ${s.conveyor}`);
  if (s.el) tags.push('L');
  if (s.hill) tags.push('hill');
  if (s.kicker) tags.push('kicker');
  if (s.tow) tags.push(`tow ${s.tow}`);
  if (s.top) tags.push('top');
  if (s.side) tags.push('side');
  return tags.join(' ');
}

export class CollisionDebug {
  on = false;
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly panel = document.createElement('pre');
  private readonly v = new THREE.Vector3();
  private w = 0;
  private h = 0;
  private trail: { x: number; y: number; mode: Mode }[] = [];
  private marks: Mark[] = [];
  private last: { mode: Mode; surface: Surface | null; rail: CurvedRail | null; slamT: number; hopped: Car | null } | null = null;

  constructor(
    app: HTMLElement,
    gameCanvas: HTMLCanvasElement,
  ) {
    this.ctx = this.canvas.getContext('2d')!;
    this.canvas.className = 'coldebug';
    gameCanvas.after(this.canvas);
    this.panel.className = 'coldebug-panel';
    //a tap opens the full readout (position, speeds, the legend) or shrinks it back to one line; the tap never ollies
    this.panel.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      DEV.full = !DEV.full;
      saveDev();
    });
    app.append(this.panel);
    this.show(false);
  }

  show(on: boolean): void {
    this.on = on;
    this.canvas.hidden = !on;
    this.panel.hidden = !on;
  }

  // a new floor: its own coordinates
  reset(): void {
    this.trail = [];
    this.marks = [];
    this.last = null;
  }

  // after each physics step: the feet's path, and where contact began, changed or ended
  afterStep(sk: Skater): void {
    this.trail.push({ x: sk.x, y: sk.y, mode: sk.mode });
    if (this.trail.length > TRAIL) this.trail.shift();
    const was = this.last;
    if (was) {
      const mark = (kind: Mark['kind'], text: string) => this.marks.push({ x: sk.x, y: sk.y, kind, text, t: MARK_LIFE });
      if (sk.slamT > was.slamT) mark('slam', 'SLAM');
      if (sk.hopped !== was.hopped && sk.hopped) mark('hop', 'HOP');
      if (sk.mode === 'rail' && sk.rail !== was.rail) mark('grind', sk.rail?.wire ? 'WIRE' : 'RAIL');
      else if (sk.mode === 'grind' && (was.mode !== 'grind' || sk.surface !== was.surface)) mark('grind', `GRIND ${sk.surface?.kind ?? ''}`);
      else if (sk.mode === 'roll' && was.mode === 'air') mark('land', `LAND ${sk.surface ? sk.surface.kind : 'street'}`);
      else if (sk.mode === 'air' && was.mode !== 'air') mark('leave', 'OFF');
    }
    this.last = { mode: sk.mode, surface: sk.surface, rail: sk.rail, slamT: sk.slamT, hopped: sk.hopped };
  }

  // `perf`: the game's fps line (fps, worst frame, draws, triangles, resolution, effects tier)
  // drawn: where the skater is drawn this frame (between the sim's steps); left out, where the sim has it
  draw(level: Level, sk: Skater, camera: THREE.Camera, dt: number, perf = '', drawn?: { x: number; y: number }): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (w !== this.w || h !== this.h) {
      this.canvas.width = this.w = w;
      this.canvas.height = this.h = h;
    }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const cw = rect.width;
    const ch = rect.height;

    //sim px -> screen px, through the game camera (the skate lane is z = 0)
    const P = (px: number, py: number): [number, number] => {
      this.v.set(px / TILE, (level.streetY - py) / TILE, 0).project(camera);
      return [((this.v.x + 1) / 2) * cw, ((1 - this.v.y) / 2) * ch];
    };
    //what's on screen, in sim px (plus a margin), so a long floor only draws what you can see
    const [lx] = P(sk.x, sk.y);
    const [rx] = P(sk.x + TILE, sk.y);
    const scale = Math.max(1e-3, rx - lx); // screen px per tile
    const x0 = sk.x - ((lx + 40) / scale) * TILE;
    const x1 = sk.x + ((cw - lx + 40) / scale) * TILE;
    const seen = (a: number, b: number) => b >= x0 && a <= x1;
    const labels = scale >= 9;
    ctx.font = '10px ui-monospace, monospace';

    const line = (pts: [number, number][], color: string, width: number, dash: number[] = []) => {
      //a dark edge first, so it reads over a busy background
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = width + 2;
      ctx.setLineDash(dash);
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    };
    //labels never stack on each other: one that would cover another is left out (a train's cars, a stair set's flights)
    const placed: [number, number, number][] = [];
    const label = (text: string, [x, y]: [number, number], color: string) => {
      if (!labels) return;
      const tw = ctx.measureText(text).width;
      if (placed.some(([px, py, pw]) => x < px + pw && px < x + tw && Math.abs(py - y) < 12)) return;
      placed.push([x, y, tw]);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(x - 1, y - 10, tw + 3, 12);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    };
    //one-way: short ticks hanging under a line, on the side you can't land from (pointing `side`: 1 down, -1 up)
    const ticks = (a: [number, number], b: [number, number], color: string, side = 1) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 1) return;
      const nx = (-(b[1] - a[1]) / len) * side;
      const ny = ((b[0] - a[0]) / len) * side;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      for (let d = 4; d < len; d += 10) {
        const x = a[0] + ((b[0] - a[0]) * d) / len;
        const y = a[1] + ((b[1] - a[1]) * d) / len;
        ctx.moveTo(x, y);
        ctx.lineTo(x + nx * 6 - ((b[0] - a[0]) / len) * 3, y + ny * 6 - ((b[1] - a[1]) / len) * 3);
      }
      ctx.stroke();
    };
    const arrow = (a: [number, number], b: [number, number], color: string, width = 2) => {
      line([a, b], color, width);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.lineTo(b[0] - 7 * Math.cos(ang - 0.4), b[1] - 7 * Math.sin(ang - 0.4));
      ctx.lineTo(b[0] - 7 * Math.cos(ang + 0.4), b[1] - 7 * Math.sin(ang + 0.4));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    const ring = (p: [number, number], r: number, color: string, width = 2) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      ctx.stroke();
    };

    //the street: solid where it's there, the gaps in red at the depth that ends the run
    const c0 = Math.max(0, Math.floor(x0 / TILE));
    const c1 = Math.min(level.street.length, Math.ceil(x1 / TILE));
    for (let c = c0; c < c1; ) {
      const solid = level.street[c];
      let e = c;
      while (e < c1 && level.street[e] === solid) e++;
      const a = P(c * TILE, level.streetY);
      const b = P(e * TILE, level.streetY);
      if (solid) {
        line([a, b], COLLIDER.street, 2);
        ticks(a, b, COLLIDER.street);
      } else {
        const bail = level.streetY + PHYS.bailDepth;
        line([P(c * TILE, bail), P(e * TILE, bail)], COLLIDER.gap, 1.5, [6, 4]);
        label('GAP', P(c * TILE + 4, level.streetY + PHYS.bailDepth - 4), COLLIDER.gap);
      }
      c = e;
    }

    //one-way surfaces: you land on them from above and pass through from below
    const current = sk.surface;
    const magnet = sk.mods.railMagnet;
    const ghost = sk.ghost;
    const surfaces = ghost ? [...level.surfaces, ghost] : level.surfaces;
    for (const s of surfaces) {
      if (!seen(s.x0, s.x1)) continue;
      const a = P(s.x0, s.y);
      const b = P(s.x1, s.y1 ?? s.y);
      const gone = sk.gone.has(s);
      const color = gone ? '#666' : surfaceColor(s);
      if (s === current) line([a, b], '#fff', 8);
      line([a, b], color, s.kind === 'rail' ? 3 : 2.5, gone ? [4, 4] : s === ghost ? [8, 4] : []);
      if (!gone) ticks(a, b, color);
      //the ends, where a landing gets clamped to the edge
      line([[a[0], a[1] - 4], [a[0], a[1] + 4]], color, 1.5);
      line([[b[0], b[1] - 4], [b[0], b[1] + 4]], color, 1.5);
      if (s.kind === 'rail' && magnet > 0) line([P(s.x0 - magnet, s.y), a], color, 1, [2, 3]);
      if (s.tow) arrow(P(s.x0 + (s.x1 - s.x0) * 0.3, surfaceY(s, s.x0 + (s.x1 - s.x0) * 0.3) - 10), P(s.x0 + (s.x1 - s.x0) * 0.7, surfaceY(s, s.x0 + (s.x1 - s.x0) * 0.7) - 10), '#fff', 1.5);
      if (s.conveyor) arrow(P((s.x0 + s.x1) / 2, s.y - 8), P((s.x0 + s.x1) / 2 + Math.sign(s.conveyor) * 24, s.y - 8), color, 1.5);
      const crumble = sk.crumbling.get(s);
      label(surfaceTags(s) + (crumble !== undefined ? ` falls ${crumble}f` : '') + (s === ghost ? ' ghost' : ''), [a[0] + 2, a[1] - 5], color);
    }

    //curved rails and power lines: you catch them from above as you fall past
    for (const rail of level.rails) {
      if (!seen(rail.xs[0], rail.xs[rail.xs.length - 1])) continue;
      const pts = rail.xs.map((x, i) => P(x, rail.ys[i]));
      const ignored = rail === sk.railIgnore;
      const color = ignored ? '#777' : rail.wire ? COLLIDER.wire : COLLIDER.curve;
      if (rail === sk.rail) line(pts, '#fff', 8);
      line(pts, color, 3, ignored ? [4, 4] : []);
      ctx.fillStyle = color;
      if (scale >= 14) for (const [x, y] of pts) ctx.fillRect(x - 1, y - 1, 2, 2);
      if (magnet > 0) line([P(rail.xs[0] - magnet, rail.ys[0]), pts[0]], color, 1, [2, 3]);
      label(`${rail.wire ? 'wire' : 'rail'} ${Math.round(rail.length)}px ${rail.material}${rail.top ? ' top' : ''}${ignored ? ` ignored ${sk.railIgnoreT}f` : ''}`, [pts[0][0] + 2, pts[0][1] - 5], color);
    }

    //cars: a roof to hop (it reaches half a skater either side), sides that slam you; an L train's car is a
    //one-way platform you pass through, its roof a grind (drawn with the surfaces above, as it's a rail)
    const half = PHYS.width / 2;
    const cars = sk.movers.length ? [...level.cars, ...sk.movers] : level.cars;
    for (const car of cars) {
      if (!seen(car.x0 - half, car.x1 + half)) continue;
      //a moving car is drawn where it is on screen, between the sim's steps (src/game/interp.ts)
      const dx = at(car, 'x0') - car.x0;
      const Pc = (px: number, py: number) => P(px + dx, py);
      const wrecked = sk.wrecked.has(car);
      const tl = Pc(car.x0, car.roof);
      const br = Pc(car.x1, car.bottom);
      if (car.ledge) {
        line([tl, [br[0], tl[1]], br, [tl[0], br[1]], tl], '#888', 1, [4, 4]);
        const l = car.ledge;
        if (l !== current && seen(l.x0, l.x1)) {
          const a = Pc(l.x0, l.y);
          const b = Pc(l.x1, l.y);
          line([a, b], COLLIDER.rail, 3);
          ticks(a, b, COLLIDER.rail);
        } else if (l === current) {
          line([Pc(l.x0, l.y), Pc(l.x1, l.y)], '#fff', 8);
          line([Pc(l.x0, l.y), Pc(l.x1, l.y)], COLLIDER.rail, 3);
        }
        label('train roof', [tl[0] + 2, tl[1] - 5], COLLIDER.rail);
        continue;
      }
      if (wrecked) {
        line([tl, [br[0], tl[1]], br, [tl[0], br[1]], tl], '#666', 1, [3, 3]);
        continue;
      }
      //the side box: overlap it below roof + 6 and you slam
      const side = Pc(car.x0, car.roof + 6);
      ctx.fillStyle = sk.hitCars.has(car) ? 'rgba(255,59,59,0.35)' : 'rgba(255,59,59,0.12)';
      ctx.fillRect(side[0], side[1], br[0] - side[0], br[1] - side[1]);
      line([side, [br[0], side[1]], br, [side[0], br[1]], side], COLLIDER.carSide, 1.5);
      //the hop line
      const hop = [Pc(car.x0 - half, car.roof), Pc(car.x1 + half, car.roof)];
      if (car === sk.hopped) line(hop, '#fff', 7);
      line(hop, COLLIDER.carRoof, 3);
      ticks(hop[0], hop[1], COLLIDER.carRoof);
      if (car.kicker) {
        const k0 = Pc(car.x0 - car.kicker, level.streetY);
        line([k0, Pc(car.x0, level.streetY - PHYS.tailgateLip)], COLLIDER.kicker, 3);
        label('tailgate', [k0[0], k0[1] - 5], COLLIDER.kicker);
      }
      label(`${car.model ?? (level.cars.includes(car) ? 'parked' : 'traffic')}${sk.mods.roofRider && level.cars.includes(car) ? ' roof grind' : ' hop'}`, [hop[0][0] + 2, hop[0][1] - 5], COLLIDER.carRoof);
    }

    //broken glass on the street, the Art Museum's ceilings (you bump up into them)
    for (const g of level.glass) {
      if (!seen(g.x0, g.x1)) continue;
      const pts: [number, number][] = [];
      for (let x = g.x0, i = 0; x <= g.x1; x += 4, i++) pts.push(P(x, level.streetY - (i % 2 ? 4 : 0)));
      line(pts, COLLIDER.gap, 1.5);
      label('glass', [pts[0][0], pts[0][1] - 6], COLLIDER.gap);
    }
    for (const c of level.ceiling ?? []) {
      if (!seen(c.x0, c.x1)) continue;
      const a = P(c.x0, c.y);
      const b = P(c.x1, c.y);
      line([a, b], COLLIDER.ceiling, 2.5);
      ticks(a, b, COLLIDER.ceiling, -1);
    }
    for (const c of level.currents ?? []) {
      if (!seen(c.x0, c.x1)) continue;
      const y = level.streetY - 4 * TILE;
      arrow(P((c.x0 + c.x1) / 2, y), P((c.x0 + c.x1) / 2 + Math.sign(c.push) * 2 * TILE, y), '#7fd8ff', 1.5);
    }

    //the feet's path over the last couple of seconds, coloured by mode
    for (let i = 1; i < this.trail.length; i++) {
      const p = this.trail[i - 1];
      const q = this.trail[i];
      if (Math.abs(q.x - p.x) > 4 * TILE) continue; // a jump between floors
      ctx.globalAlpha = 0.25 + 0.6 * (i / this.trail.length);
      line([P(p.x, p.y), P(q.x, q.y)], MODE_COLOR[q.mode], 1.5);
    }
    ctx.globalAlpha = 1;

    //contact markers: where a landing, grind, hop or slam happened
    for (const m of this.marks) {
      m.t -= dt;
      const p = P(m.x, m.y);
      ctx.globalAlpha = Math.max(0, m.t / MARK_LIFE);
      const color = m.kind === 'slam' ? COLLIDER.gap : m.kind === 'hop' ? COLLIDER.carRoof : m.kind === 'grind' ? COLLIDER.rail : m.kind === 'land' ? COLLIDER.bank : '#fff';
      ring(p, 5 + (MARK_LIFE - m.t) * 10, color);
      ctx.fillStyle = color;
      ctx.fillText(m.text, p[0] + 6, p[1] + 14);
    }
    ctx.globalAlpha = 1;
    this.marks = this.marks.filter((m) => m.t > 0);

    //the skater: the body box cars hit, the feet (the one point that lands), the trucks, the speed, and in the air
    //the ray straight down the landing pose reads
    //(where it's drawn on screen, between the sim's steps, so the shapes sit on the skater)
    const me = drawn ?? sk;
    const feet = P(me.x, me.y);
    const head = P(me.x - half, me.y - PHYS.height);
    const toe = P(me.x + half, me.y);
    line([head, [toe[0], head[1]], toe, [head[0], toe[1]], head], COLLIDER.body, 2);
    const pitch = sk.feel.pitch;
    const wb = FEEL.wheelbase / 2;
    const back = P(me.x - wb * Math.cos(pitch), me.y + wb * Math.sin(pitch));
    const front = P(me.x + wb * Math.cos(pitch), me.y - wb * Math.sin(pitch));
    line([back, front], '#fff', 3);
    for (const t of [back, front]) ring(t, 3, sk.grounded ? MODE_COLOR[sk.mode] : '#fff', 1.5);
    ring(feet, 4, MODE_COLOR[sk.mode], 2.5);
    //the lip probe: an ollie this close to the edge pops off the lip
    if (sk.mode === 'roll') {
      const lip = P(me.x + FEEL.lipPx, me.y);
      line([[lip[0], lip[1] - 5], [lip[0], lip[1] + 5]], '#fff', 1);
    }
    //speed: 8 frames of it
    const vx = sk.mode === 'rail' && sk.rail ? sk.rail.at(sk.railD).tx * sk.railV : sk.hsp;
    const vy = sk.mode === 'rail' && sk.rail ? sk.rail.at(sk.railD).ty * sk.railV : sk.vsp;
    arrow(P(me.x, me.y - PHYS.height / 2), P(me.x + vx * 8, me.y - PHYS.height / 2 + vy * 8), COLLIDER.speed, 2);
    const below = sk.mode === 'air' ? sk.below() : null;
    if (sk.mode === 'air') {
      if (below) {
        const hit = P(me.x, me.y + below.depth);
        line([feet, hit], COLLIDER.ray, 1.5, [4, 3]);
        //the ground's angle where the ray hits
        const r = 14;
        line([[hit[0] - r * Math.cos(below.angle), hit[1] + r * Math.sin(below.angle)], [hit[0] + r * Math.cos(below.angle), hit[1] - r * Math.sin(below.angle)]], COLLIDER.ray, 2);
        label(`${Math.round(below.depth)}px`, [hit[0] + 4, hit[1] - 4], COLLIDER.ray);
      } else {
        line([feet, [feet[0], ch]], COLLIDER.gap, 1.5, [4, 3]);
      }
    }

    this.readout(level, sk, below, perf);
  }

  private readout(level: Level, sk: Skater, below: { angle: number; depth: number } | null, perf: string): void {
    const deg = (r: number) => `${((r * 180) / Math.PI).toFixed(1)}°`;
    const s = sk.surface;
    const on =
      sk.mode === 'rail' && sk.rail
        ? `${sk.rail.wire ? 'wire' : 'curved rail'} ${sk.rail.material} · d ${sk.railD.toFixed(0)}/${sk.rail.length.toFixed(0)} · v ${sk.railV.toFixed(2)}`
        : s
          ? `${surfaceTags(s)} · ${surfaceMaterial(s)} · x ${s.x0.toFixed(0)}–${s.x1.toFixed(0)} y ${s.y.toFixed(0)}${s.y1 !== undefined ? `→${s.y1.toFixed(0)}` : ''}`
          : sk.grounded
            ? 'street'
            : '—';
    const street = isStreetAt(level, sk.x) ? 'street' : 'GAP';
    const lines = [
      perf,
      `${sk.mode.toUpperCase()}${sk.fakie ? ' fakie' : ''} on ${on}`,
      `x ${sk.x.toFixed(1)} (col ${Math.floor(sk.x / TILE)}) y ${sk.y.toFixed(1)} (${((level.streetY - sk.y) / TILE).toFixed(2)}t up) · under: ${street}`,
      `hsp ${sk.hsp.toFixed(2)} vsp ${sk.vsp.toFixed(2)} px/f · carry ${sk.carry.toFixed(2)} · jumps ${sk.jumps} coyote ${sk.coyote}`,
      `pitch ${deg(sk.feel.pitch)}` + (below ? ` · ray ${below.depth.toFixed(0)}px to ${deg(below.angle)}` : sk.mode === 'air' ? ' · ray: nothing below' : '') + (sk.slamT ? ` · slam ${sk.slamT}f` : ''),
      `${devSpeed() === 0 ? 'FROZEN (. or STEP: one frame)' : `speed ${devSpeed()}×`} · [ ] slow/fast · C off`,
    ];
    const speed = devSpeed();
    const slow = speed === 0 ? ' · FROZEN' : speed !== 1 ? ` · ${speed}×` : '';
    this.panel.classList.toggle('full', DEV.full);
    if (!DEV.full) {
      //one line: fps and worst frame, what you're on, speed; tap for the rest
      const fps = perf.split(' · ').slice(0, 2).join(' ');
      const hsp = sk.mode === 'rail' ? sk.railV : sk.hsp;
      this.panel.textContent = `${fps} · ${sk.mode.toUpperCase()} ${sk.mode === 'rail' && sk.rail ? (sk.rail.wire ? 'wire' : 'rail') : s ? s.kind : sk.grounded ? 'street' : ''} · ${hsp.toFixed(1)} px/f${slow} ▸`;
      return;
    }
    lines[lines.length - 1] += ' · tap to shrink';
    const key = (c: string, t: string) => `<i style="color:${c}">■</i>${t}`;
    this.panel.innerHTML =
      lines.join('\n') +
      '\n' +
      [
        key(COLLIDER.street, 'street'),
        key(COLLIDER.roof, 'roof'),
        key(COLLIDER.ledge, 'ledge'),
        key(COLLIDER.rail, 'bar/grind'),
        key(COLLIDER.curve, 'rail'),
        key(COLLIDER.wire, 'wire'),
        key(COLLIDER.stairs, 'stairs'),
        key(COLLIDER.bank, 'bank'),
        key(COLLIDER.hill, 'hill'),
        key(COLLIDER.kicker, 'kicker'),
        key(COLLIDER.overpass, 'overpass'),
        key(COLLIDER.carRoof, 'hop'),
        key(COLLIDER.carSide, 'slam'),
      ].join(' ') +
      '\none-way lines: land from the clean side, pass up through the ticked side · dashed = ignored/gone/pass-through';
  }
}
