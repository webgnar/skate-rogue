// The set editor (?sets; zack, 2026-11-10: "i COULD just use the assets we already have to make the levels"): draw a
// short line out of the game's own pieces (decks, rails, ledges, stairs with a handrail, kickers, coins, Stoken) on the
// tile grid, watch the plain sky bot skate it, play it in the game, and turn it on for act 3's cloud line and act 5's
// station line (src/gen/hand-sets.ts). Built on the desktop with a mouse and keys; on a phone, nudge what's there with
// the +/- buttons and play it. Saving writes src/gen/hand-sets.json through the dev server; anywhere else it copies the
// sets as text to paste to Claude. docs/set-editor.md.
import '../levels/levels.css';
import './sets.css';
import { TILE } from '../physics/constants';
import { layerScale } from '../gen/clouds';
import { CHECK_FLOOR, CLEAR_SHARE, type SetRun } from '../gen/hand-set-check';
import { formatHandSets, isHandSets, PART_KINDS, SAVED_SETS, setShape, type HandAct, type HandPart, type HandPartKind, type HandSet, type HandSets } from '../gen/hand-sets';
import { loadSetDrafts, saveSetDrafts } from './drafts';

const ACTS: HandAct[] = [3, 5];

// what each tray piece is, and the size it comes in
const TRAY: Record<HandPartKind, { name: string; help: string; make: (x: number, y: number) => HandPart }> = {
  deck: { name: 'deck', help: 'a flat one-way platform: a cloud in act 3, a station deck in act 5', make: (x, y) => ({ kind: 'deck', x0: x, y0: y, x1: x + 8 }) },
  rail: { name: 'rail', help: 'a rail to grind: flat, sloped, or bent with curve', make: (x, y) => ({ kind: 'rail', x0: x, y0: y + 1, x1: x + 6, y1: y + 1 }) },
  ledge: { name: 'ledge', help: 'a concrete ledge to grind (a rainbow hubba in act 3, a hull ledge in act 5)', make: (x, y) => ({ kind: 'ledge', x0: x, y0: y + 0.5, x1: x + 5, y1: y + 0.5 }) },
  stairs: { name: 'stairs', help: 'steps down with a handrail over them: ollie them or grind the rail (roll onto the steps and you slam)', make: (x, y) => ({ kind: 'stairs', x0: x, y0: y, x1: x + 4, y1: y - 1.5 }) },
  kicker: { name: 'kicker', help: 'a ramp up to a lip: roll up it and fly off at your speed', make: (x, y) => ({ kind: 'kicker', x0: x, y0: y, x1: x + 3, y1: y + 1.5 }) },
  coins: { name: 'coins', help: 'a line of coins, one a tile', make: (x, y) => ({ kind: 'coins', x0: x, y0: y + 1, x1: x + 4, y1: y + 1 }) },
  stoken: { name: 'Stoken', help: 'one Stoken', make: (x, y) => ({ kind: 'stoken', x0: x, y0: y + 2 }) },
};
const COLOR: Record<HandPartKind, string> = {
  deck: '#eef4ff',
  rail: '#3fdcff',
  ledge: '#ff9ad5',
  stairs: '#c9bfe6',
  kicker: '#ff9a3d',
  coins: '#ffd23f',
  stoken: '#3fdcff',
};
const MODE: Record<string, string> = { roll: '#ffffff', air: '#ffd23f', grind: '#6ee7a0', rail: '#6ee7a0' };

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const round = (n: number) => Math.round(n * 100) / 100;
const hasEnd = (p: HandPart) => p.kind !== 'stoken';

interface CheckResult {
  act: HandAct;
  ok: boolean;
  laid: number;
  runs: SetRun[];
  error?: string;
}

export function startSets(): void {
  document.getElementById('app')?.remove();
  document.title = 'Skate Escape · set editor';
  const params = new URLSearchParams(location.search);

  // ---------- state ----------
  let all: HandSets = loadSetDrafts() ?? clone(SAVED_SETS);
  let cur = Math.max(0, all.sets.findIndex((s) => s.name === params.get('set')));
  let sel = -1; // the picked part
  let act: HandAct = params.get('act') === '5' ? 5 : 3; // the act whose bot line is drawn and "play it" opens
  let snap = 0.5;
  let zoom = 26; // px a tile
  const checks = new Map<HandAct, CheckResult | 'checking'>();
  const undo: string[] = [];
  const redo: string[] = [];
  const set = (): HandSet | undefined => all.sets[cur];
  const dirty = () => formatHandSets(all) !== formatHandSets(SAVED_SETS);

  // ---------- page ----------
  const root = document.createElement('div');
  root.id = 'levels';
  root.className = 'sets';
  root.innerHTML = `
    <header class="lv-bar">
      <b class="lv-title">SETS</b>
      <label>set <select id="st-pick"></select></label>
      <button id="st-new" type="button">+ new</button>
      <button id="st-dup" type="button">copy set</button>
      <button id="st-del" type="button">delete set</button>
      <label>bot line in <select id="st-act"><option value="3">act 3 (clouds)</option><option value="5">act 5 (station)</option></select></label>
      <label>snap <select id="st-snap"><option value="1">1 tile</option><option value="0.5">½ tile</option><option value="0.25">¼ tile</option></select></label>
      <span class="st-zoom"><button id="st-zout" type="button" aria-label="zoom out">−</button><button id="st-zin" type="button" aria-label="zoom in">+</button></span>
      <button id="st-undo" type="button" aria-label="undo">↶</button><button id="st-redo" type="button" aria-label="redo">↷</button>
      <span class="lv-grow"></span>
      <button id="st-play" type="button">play it</button>
      <button id="st-copy" type="button">copy sets</button>
      <button id="st-save" type="button" class="hot">save</button>
    </header>
    <div class="st-tray" id="st-tray"></div>
    <div class="lv-view st-view" id="st-view"></div>
    <div class="lv-result" id="st-result"></div>
    <div class="lv-panels">
      <section class="lv-panel">
        <div class="lv-head"><h2>Piece</h2><span class="lv-tag" id="st-kind"></span></div>
        <div id="st-part"></div>
      </section>
      <section class="lv-panel">
        <div class="lv-head"><h2>Set</h2></div>
        <div id="st-props"></div>
      </section>
      <section class="lv-panel">
        <div class="lv-head"><h2>How it works</h2></div>
        <p class="lv-help">Tap a piece in the tray to add it after the last one. Drag a piece to move it, drag its dots to stretch it; on a phone, pick it and use the + and − buttons. You roll in at the green flag (0, 0, where the line before leaves you) and the line carries on from the set's last deck. Every change, the plain bot (no boons) skates it on a few floors at cruising speed and in the gnar state; it has to get through ${Math.round(CLEAR_SHARE * 100)}% of the times it meets it before the set can go in floors. Sets are drawn at act 3's size; act 5 grows them with its lighter gravity.</p>
        <p class="lv-help">Keys: delete removes the picked piece, arrows nudge it, ctrl+d copies it, ctrl+z / ctrl+shift+z undo and redo, ctrl+s saves.</p>
      </section>
    </div>
    <textarea class="lv-out" id="st-out" hidden readonly></textarea>
  `;
  document.body.appendChild(root);
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const view = $('st-view');

  let toastT = 0;
  const toast = (text: string) => {
    let t = root.querySelector<HTMLElement>('.lv-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'lv-toast';
      root.appendChild(t);
    }
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = window.setTimeout(() => (t!.hidden = true), 3500);
  };

  // ---------- changes ----------
  const snapshot = () => JSON.stringify({ all, cur, sel });
  function before(): void {
    undo.push(snapshot());
    if (undo.length > 200) undo.shift();
    redo.length = 0;
  }
  function restore(s: string): void {
    const d = JSON.parse(s) as { all: HandSets; cur: number; sel: number };
    all = d.all;
    cur = d.cur;
    sel = d.sel;
    changed();
  }
  // something about the sets changed: keep the draft, redraw, and check the set again
  let checkT = 0;
  function changed(recheck = true): void {
    saveSetDrafts(dirty() ? all : null);
    $('st-save').textContent = dirty() ? 'save •' : 'save';
    drawAll();
    if (recheck) {
      checks.clear();
      clearTimeout(checkT);
      checkT = window.setTimeout(check, 350);
      drawResult();
    }
  }

  // ---------- the bot gate, in a worker ----------
  let worker: Worker | null = null;
  let asked = 0;
  try {
    worker = new Worker(new URL('./check-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<CheckResult & { id: number }>) => {
      if (e.data.id !== asked) return;
      checks.set(e.data.act, e.data);
      drawResult();
      drawView();
    };
  } catch {
    worker = null;
  }
  function check(): void {
    const s = set();
    if (!s) return;
    asked++;
    for (const a of ACTS) {
      checks.set(a, 'checking');
      if (worker) worker.postMessage({ id: asked, set: s, act: a });
      else {
        //(no worker: on the main thread, a moment later so the page draws first)
        const id = asked;
        window.setTimeout(async () => {
          const { checkSet } = await import('../gen/hand-set-check');
          if (id !== asked) return;
          const c = checkSet(s, a);
          checks.set(a, { act: a, ok: c.ok, laid: c.laid, runs: c.runs });
          drawResult();
          drawView();
        }, 30);
      }
    }
    drawResult();
  }
  const passes = (s: HandSet) => s.acts.length > 0 && s.acts.every((a) => {
    const c = checks.get(a);
    return c && c !== 'checking' && c.ok;
  });

  // ---------- the view ----------
  interface Frame {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
  }
  let frame: Frame = { x0: -4, x1: 40, y0: -8, y1: 8 };
  const sx = (x: number) => (x - frame.x0) * zoom;
  const sy = (y: number) => (frame.y1 - y) * zoom;
  function frameFor(s: HandSet): Frame {
    const sh = setShape(s);
    return { x0: -4, x1: Math.max(40, Math.ceil(sh.length) + 10), y0: Math.min(-8, Math.floor(sh.bottom) - 5), y1: Math.max(8, Math.ceil(sh.top) + 6) };
  }

  function partSVG(p: HandPart, i: number): string {
    const c = COLOR[p.kind];
    const [x0, y0, x1, y1] = [sx(p.x0), sy(p.y0), sx(p.x1 ?? p.x0), sy(p.kind === 'deck' ? p.y0 : (p.y1 ?? p.y0))];
    const on = i === sel ? ' on' : '';
    const hit = (d: string) => `<path class="st-hit" d="${d}" data-part="${i}" data-grab="move"/>`;
    let g = '';
    if (p.kind === 'deck') {
      g = `<rect x="${Math.min(x0, x1)}" y="${y0}" width="${Math.abs(x1 - x0)}" height="${zoom * 0.5}" rx="${zoom * 0.2}" fill="${c}" opacity="0.9"/>` + hit(`M${x0},${y0}H${x1}`);
    } else if (p.kind === 'stairs') {
      const n = Math.max(2, Math.round(Math.abs((p.x1 ?? p.x0) - p.x0)));
      let d = `M${x0},${y0}`;
      for (let k = 0; k < n; k++) {
        const ax = x0 + ((x1 - x0) * (k + 1)) / n;
        const ay = y0 + ((y1 - y0) * (k + 1)) / n;
        d += `H${ax}V${ay}`;
      }
      const rh = 0.9 * zoom;
      g = `<path d="${d}" fill="none" stroke="${c}" stroke-width="3"/><path d="M${x0 - zoom / 2},${y0 - rh}L${x1 + zoom / 2},${y1 - rh}" stroke="#ffd23f" stroke-width="2"/>` + hit(`M${x0},${y0}L${x1},${y1}`);
    } else if (p.kind === 'rail' || p.kind === 'ledge') {
      const cv = (p.curve ?? 0) * zoom;
      const d = `M${x0},${y0}Q${(x0 + x1) / 2},${(y0 + y1) / 2 + cv} ${x1},${y1}`;
      g = `<path d="${d}" fill="none" stroke="${c}" stroke-width="${p.kind === 'ledge' ? 6 : 3}" stroke-linecap="round"/>` + `<path class="st-hit" d="${d}" data-part="${i}" data-grab="move"/>`;
    } else if (p.kind === 'kicker') {
      g = `<path d="M${x0},${y0}L${x1},${y1}V${y0}Z" fill="${c}" opacity="0.85"/>` + hit(`M${x0},${y0}L${x1},${y1}`);
    } else if (p.kind === 'coins') {
      const n = Math.max(1, Math.round(Math.abs((p.x1 ?? p.x0) - p.x0)));
      for (let k = 0; k <= n; k++) g += `<circle cx="${x0 + ((x1 - x0) * k) / n}" cy="${y0 + ((y1 - y0) * k) / n}" r="${zoom * 0.18}" fill="${c}"/>`;
      g += hit(`M${x0},${y0}L${x1},${y1}`);
    } else {
      g = `<path d="M${x0},${y0 - zoom * 0.35}l${zoom * 0.3},${zoom * 0.35}l${-zoom * 0.3},${zoom * 0.35}l${-zoom * 0.3},${-zoom * 0.35}Z" fill="${c}"/>` + `<circle class="st-hit" cx="${x0}" cy="${y0}" r="${zoom * 0.6}" data-part="${i}" data-grab="move"/>`;
    }
    return `<g class="st-part${on}">${g}</g>`;
  }

  // the picked piece's ends, to stretch it by (drawn over everything, so nothing else catches the drag)
  function dotsSVG(p: HandPart | undefined): string {
    if (!p) return '';
    const [x0, y0, x1, y1] = [sx(p.x0), sy(p.y0), sx(p.x1 ?? p.x0), sy(p.kind === 'deck' ? p.y0 : (p.y1 ?? p.y0))];
    let d = `<circle class="st-dot" cx="${x0}" cy="${y0}" r="9" data-part="${sel}" data-grab="a"/>`;
    if (hasEnd(p)) d += `<circle class="st-dot" cx="${x1}" cy="${y1}" r="9" data-part="${sel}" data-grab="b"/>`;
    return d;
  }

  function drawView(): void {
    const s = set();
    if (!s) {
      view.innerHTML = '<p class="lv-help st-empty">No sets yet: tap + new.</p>';
      return;
    }
    const w = (frame.x1 - frame.x0) * zoom;
    const h = (frame.y1 - frame.y0) * zoom;
    let grid = '';
    for (let x = Math.ceil(frame.x0); x <= frame.x1; x++) grid += `<line x1="${sx(x)}" y1="0" x2="${sx(x)}" y2="${h}" class="${x % 5 ? 'g1' : 'g5'}"/>`;
    for (let y = Math.ceil(frame.y0); y <= frame.y1; y++) grid += `<line x1="0" y1="${sy(y)}" x2="${w}" y2="${sy(y)}" class="${y % 5 ? 'g1' : 'g5'}"/>`;
    let nums = '';
    for (let x = 0; x <= frame.x1; x += 5) nums += `<text x="${sx(x) + 3}" y="${h - 4}" class="st-num">${x}</text>`;
    for (let y = Math.ceil(frame.y0 / 5) * 5; y <= frame.y1; y += 5) nums += `<text x="3" y="${sy(y) - 3}" class="st-num">${y}</text>`;
    const sh = setShape(s);
    //where you roll in, and where the line carries on
    const marks =
      `<path d="M${sx(0)},${sy(0)}V${sy(0) - 2.2 * zoom}l${zoom},${0.4 * zoom}l${-zoom},${0.4 * zoom}" class="st-in"/><text x="${sx(0) + 4}" y="${sy(0) + 16}" class="st-lab in">in</text>` +
      `<path d="M${sx(sh.length)},${sy(sh.endY)}V${sy(sh.endY) - 2.2 * zoom}" class="st-out"/><text x="${sx(sh.length) + 4}" y="${sy(sh.endY) + 16}" class="st-lab">on →</text>`;
    //the bot's line through it (the first time it met it up on the line, at cruising speed)
    let bot = '';
    const c = checks.get(act);
    if (c && c !== 'checking' && c.runs[0]?.trace.length) {
      const k = TILE * layerScale(CHECK_FLOOR[act]);
      const t = c.runs[0].trace;
      for (let i = 1; i < t.length; i += 1) {
        bot += `<line x1="${sx(t[i - 1].x / k)}" y1="${sy(t[i - 1].y / k) - 2}" x2="${sx(t[i].x / k)}" y2="${sy(t[i].y / k) - 2}" stroke="${MODE[t[i].mode] ?? '#fff'}" stroke-width="2" opacity="0.85"/>`;
      }
    }
    //(a scrolling box in the page's grid shrinks to nothing on a short screen unless it's told its height)
    view.style.minHeight = `${Math.round(Math.min(h + 14, window.innerHeight * 0.62))}px`;
    view.innerHTML = `<svg id="st-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g class="st-grid">${grid}</g>${nums}${marks}${s.parts.map(partSVG).join('')}<g class="st-bot">${bot}</g>${dotsSVG(s.parts[sel])}</svg>`;
  }

  // ---------- dragging ----------
  let drag: { i: number; grab: string; start: [number, number]; orig: HandPart; moved: boolean } | null = null;
  const toTiles = (ev: PointerEvent): [number, number] => {
    const svg = view.querySelector('svg')!;
    const r = svg.getBoundingClientRect();
    return [(ev.clientX - r.left) / zoom + frame.x0, frame.y1 - (ev.clientY - r.top) / zoom];
  };
  const snapTo = (v: number) => Math.round(v / snap) * snap;
  view.addEventListener('pointerdown', (ev) => {
    const t = ev.target as Element;
    const i = Number(t.getAttribute('data-part'));
    if (!t.hasAttribute('data-part') || !set()) {
      if (sel !== -1 && t.closest('svg')) {
        sel = -1;
        drawAll();
      }
      return;
    }
    ev.preventDefault();
    if (sel !== i) {
      sel = i;
      drawAll();
    }
    drag = { i, grab: t.getAttribute('data-grab')!, start: toTiles(ev), orig: clone(set()!.parts[i]), moved: false };
    view.setPointerCapture(ev.pointerId);
  });
  view.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const s = set()!;
    const [x, y] = toTiles(ev);
    const [dx, dy] = [snapTo(x - drag.start[0]), snapTo(y - drag.start[1])];
    if (!drag.moved && !dx && !dy) return;
    if (!drag.moved) before();
    drag.moved = true;
    const o = drag.orig;
    const p: HandPart = { ...o };
    if (drag.grab === 'move') {
      p.x0 = round(o.x0 + dx);
      p.y0 = round(o.y0 + dy);
      if (o.x1 !== undefined) p.x1 = round(o.x1 + dx);
      if (o.y1 !== undefined) p.y1 = round(o.y1 + dy);
    } else if (drag.grab === 'a') {
      p.x0 = round(snapTo(x));
      p.y0 = round(snapTo(y));
    } else {
      p.x1 = round(snapTo(x));
      if (p.kind !== 'deck') p.y1 = round(snapTo(y));
    }
    s.parts[drag.i] = p;
    drawView();
    drawPart();
  });
  const endDrag = () => {
    if (drag?.moved) changed();
    drag = null;
  };
  view.addEventListener('pointerup', endDrag);
  view.addEventListener('pointercancel', endDrag);

  // ---------- panels ----------
  function drawTray(): void {
    $('st-tray').innerHTML = PART_KINDS.map((k) => `<button type="button" data-add="${k}" title="${TRAY[k].help}" style="--c:${COLOR[k]}">+ ${TRAY[k].name}</button>`).join('');
  }
  $('st-tray').addEventListener('click', (ev) => {
    const k = (ev.target as Element).closest('[data-add]')?.getAttribute('data-add') as HandPartKind | null;
    const s = set();
    if (!k || !s) return;
    before();
    //after the last piece, at the height the line's at there
    const sh = setShape(s);
    const x = s.parts.length ? Math.ceil(sh.length) + (k === 'deck' ? 3 : 0) : 0;
    const y = s.parts.length ? (k === 'deck' ? sh.endY : sh.endY) : 0;
    const p = TRAY[k].make(x, y);
    //(coins, Stoken and rails go over what's there, not after it)
    if (k !== 'deck' && k !== 'stairs' && k !== 'kicker' && s.parts.length) {
      const last = [...s.parts].reverse().find((q) => q.kind === 'deck');
      if (last) {
        const lx = Math.min(last.x0, last.x1 ?? last.x0);
        const lw = Math.abs((last.x1 ?? last.x0) - last.x0);
        p.x0 = lx + Math.max(1, lw / 4);
        if (p.x1 !== undefined) p.x1 = p.x0 + Math.max(2, lw / 2);
        const up = p.y0 - y;
        p.y0 = last.y0 + up;
        if (p.y1 !== undefined) p.y1 = last.y0 + up;
      }
    }
    s.parts.push(p);
    sel = s.parts.length - 1;
    frame = frameFor(s);
    changed();
  });

  function stepper(label: string, key: keyof HandPart, value: number, help = ''): string {
    return `<div class="st-row"><span class="st-k">${label}</span><button type="button" data-step="${key}" data-by="-1">−</button><output>${round(value)}</output><button type="button" data-step="${key}" data-by="1">+</button><span class="dh">${help}</span></div>`;
  }
  function drawPart(): void {
    const s = set();
    const p = s?.parts[sel];
    $('st-kind').textContent = p ? TRAY[p.kind].name : '';
    if (!p) {
      $('st-part').innerHTML = '<p class="lv-help">Pick a piece in the view to change it.</p>';
      return;
    }
    let h = `<p class="lv-help">${TRAY[p.kind].help}</p>`;
    h += stepper('start along', 'x0', p.x0, 'tiles');
    h += stepper('start height', 'y0', p.y0, 'tiles up');
    if (hasEnd(p)) {
      h += stepper('end along', 'x1', p.x1 ?? p.x0, 'tiles');
      if (p.kind !== 'deck') h += stepper('end height', 'y1', p.y1 ?? p.y0, 'tiles up');
    }
    if (p.kind === 'rail' || p.kind === 'ledge') h += stepper('curve', 'curve', p.curve ?? 0, '+ sags, − arches');
    h += `<div class="st-row"><button type="button" id="st-pdup">copy piece</button><button type="button" id="st-pdel">delete piece</button></div>`;
    $('st-part').innerHTML = h;
  }
  $('st-part').addEventListener('click', (ev) => {
    const t = ev.target as Element;
    const s = set();
    const p = s?.parts[sel];
    if (!s || !p) return;
    if (t.id === 'st-pdel') return deletePart();
    if (t.id === 'st-pdup') return dupPart();
    const key = t.getAttribute('data-step') as keyof HandPart | null;
    if (!key) return;
    before();
    const by = Number(t.getAttribute('data-by')) * snap;
    const v = (p[key] as number | undefined) ?? (key === 'x1' ? p.x0 : key === 'y1' ? p.y0 : 0);
    (p as unknown as Record<string, number>)[key] = round(v + by);
    if (key === 'curve' && !p.curve) delete p.curve;
    changed();
  });

  function deletePart(): void {
    const s = set();
    if (!s || sel < 0) return;
    before();
    s.parts.splice(sel, 1);
    sel = -1;
    changed();
  }
  function dupPart(): void {
    const s = set();
    const p = s?.parts[sel];
    if (!s || !p) return;
    before();
    const w = hasEnd(p) ? Math.abs((p.x1 ?? p.x0) - p.x0) + 2 : 2;
    const q: HandPart = { ...p, x0: p.x0 + w };
    if (p.x1 !== undefined) q.x1 = p.x1 + w;
    s.parts.push(q);
    sel = s.parts.length - 1;
    frame = frameFor(s);
    changed();
  }

  function drawProps(): void {
    const s = set();
    if (!s) {
      $('st-props').innerHTML = '';
      return;
    }
    const ok = passes(s);
    $('st-props').innerHTML = `
      <label class="st-row"><span class="st-k">name</span><input id="st-name" type="text" value="${s.name.replace(/"/g, '&quot;')}"></label>
      <div class="st-row"><span class="st-k">comes up in</span>${ACTS.map((a) => `<label><input type="checkbox" data-act="${a}" ${s.acts.includes(a) ? 'checked' : ''}> act ${a}</label>`).join('')}</div>
      <div class="st-row"><span class="st-k">how often</span><button type="button" data-prop="weight" data-by="-0.5">−</button><output>${s.weight}</output><button type="button" data-prop="weight" data-by="0.5">+</button><span class="dh">a code stair set is 5, a hubba 2.5</span></div>
      <div class="st-row"><span class="st-k">most a floor</span><button type="button" data-prop="most" data-by="-1">−</button><output>${s.most}</output><button type="button" data-prop="most" data-by="1">+</button></div>
      <label class="st-row st-on"><input id="st-on" type="checkbox" ${s.on ? 'checked' : ''} ${!s.on && !ok ? 'disabled' : ''}> <b>in floors</b> <span class="dh">${s.on ? 'it comes up on the lines' : ok ? 'the bot clears it: turn it on to put it in floors' : 'turns on once the bot clears it in every act it comes up in'}</span></label>
    `;
  }
  $('st-props').addEventListener('change', (ev) => {
    const t = ev.target as HTMLInputElement;
    const s = set();
    if (!s) return;
    before();
    if (t.id === 'st-name') {
      const name = t.value.trim() || s.name;
      s.name = all.sets.some((o, i) => i !== cur && o.name === name) ? `${name} 2` : name;
    } else if (t.id === 'st-on') s.on = t.checked;
    else if (t.dataset.act) {
      const a = Number(t.dataset.act) as HandAct;
      s.acts = t.checked ? [...new Set([...s.acts, a])].sort() : s.acts.filter((x) => x !== a);
    }
    changed(t.id !== 'st-on' && t.id !== 'st-name');
  });
  $('st-props').addEventListener('click', (ev) => {
    const t = ev.target as Element;
    const key = t.getAttribute('data-prop') as 'weight' | 'most' | null;
    const s = set();
    if (!key || !s) return;
    before();
    s[key] = Math.max(key === 'most' ? 1 : 0.5, round(s[key] + Number(t.getAttribute('data-by'))));
    changed(false);
  });

  function drawResult(): void {
    const s = set();
    if (!s) {
      $('st-result').innerHTML = '';
      return;
    }
    const sh = setShape(s);
    let h = `<span><b>${round(sh.length)}</b> tiles long, ends <b>${round(sh.endY)}</b> up</span>`;
    for (const a of s.acts) {
      const c = checks.get(a);
      if (!c || c === 'checking') {
        h += `<span>act ${a}: <i>bot skating it…</i></span>`;
        continue;
      }
      if (c.error) {
        h += `<span class="bad">act ${a}: ${c.error}</span>`;
        continue;
      }
      if (!c.laid) {
        h += `<span class="bad">act ${a}: doesn't fit on the line (too tall or too low)</span>`;
        continue;
      }
      const runs = c.runs.map((r) => `${r.speed > 1 ? 'gnar' : 'cruising'} ${r.cleared}/${r.reached}`).join(', ');
      const why = c.runs.find((r) => !r.ok)?.why;
      h += `<span class="${c.ok ? 'ok' : 'bad'}">act ${a}: ${c.ok ? '✓ the bot clears it' : `✗ ${why}`} <i>(${runs})</i></span>`;
    }
    if (!s.acts.length) h += '<span class="warn">tick an act for it to come up in</span>';
    h += `<div class="st-legend">bot line in act ${act}: <i style="color:#fff">rolling</i> <i style="color:#ffd23f">air</i> <i style="color:#6ee7a0">grinding</i></div>`;
    $('st-result').innerHTML = h;
    drawProps();
  }

  function drawPick(): void {
    $<HTMLSelectElement>('st-pick').innerHTML = all.sets.map((s, i) => `<option value="${i}" ${i === cur ? 'selected' : ''}>${s.name}${s.on ? ' ●' : ''}</option>`).join('');
  }

  function drawAll(): void {
    drawPick();
    drawView();
    drawPart();
    drawProps();
    drawResult();
  }

  // ---------- the bar ----------
  $<HTMLSelectElement>('st-pick').addEventListener('change', (ev) => {
    cur = Number((ev.target as HTMLSelectElement).value);
    sel = -1;
    frame = frameFor(set()!);
    changed();
  });
  const freshName = (base: string) => {
    let n = 1;
    while (all.sets.some((s) => s.name === (n === 1 ? base : `${base} ${n}`))) n++;
    return n === 1 ? base : `${base} ${n}`;
  };
  $('st-new').addEventListener('click', () => {
    before();
    all.sets.push({ name: freshName('new set'), acts: [3, 5], on: false, weight: 3, most: 1, parts: [{ kind: 'deck', x0: 0, y0: 0, x1: 10 }] });
    cur = all.sets.length - 1;
    sel = 0;
    frame = frameFor(set()!);
    changed();
  });
  $('st-dup').addEventListener('click', () => {
    const s = set();
    if (!s) return;
    before();
    all.sets.push({ ...clone(s), name: freshName(`${s.name} copy`), on: false });
    cur = all.sets.length - 1;
    changed();
  });
  $('st-del').addEventListener('click', () => {
    const s = set();
    if (!s || !confirm(`Delete "${s.name}"? (undo brings it back)`)) return;
    before();
    all.sets.splice(cur, 1);
    cur = Math.max(0, cur - 1);
    sel = -1;
    changed();
  });
  const actIn = $<HTMLSelectElement>('st-act');
  actIn.value = String(act);
  actIn.addEventListener('change', () => {
    act = Number(actIn.value) as HandAct;
    drawView();
    drawResult();
  });
  const snapIn = $<HTMLSelectElement>('st-snap');
  snapIn.value = String(snap);
  snapIn.addEventListener('change', () => (snap = Number(snapIn.value)));
  const zoomBy = (k: number) => {
    zoom = Math.max(8, Math.min(60, Math.round(zoom * k)));
    drawView();
  };
  $('st-zin').addEventListener('click', () => zoomBy(1.25));
  $('st-zout').addEventListener('click', () => zoomBy(0.8));
  $('st-undo').addEventListener('click', () => {
    const s = undo.pop();
    if (!s) return;
    redo.push(snapshot());
    restore(s);
  });
  $('st-redo').addEventListener('click', () => {
    const s = redo.pop();
    if (!s) return;
    undo.push(snapshot());
    restore(s);
  });

  // ---------- saving and playing ----------
  const text = () => formatHandSets(all);
  async function copy(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text());
      return true;
    } catch {
      const out = $<HTMLTextAreaElement>('st-out');
      out.value = text();
      out.hidden = false;
      out.select();
      return false;
    }
  }
  $('st-copy').addEventListener('click', async () => {
    toast((await copy()) ? 'Sets copied. Paste them to Claude to put them in the game.' : 'Copy the sets from the box below and paste them to Claude.');
  });
  $('st-save').addEventListener('click', async () => {
    try {
      const res = await fetch('./__hand-sets', { method: 'POST', body: text() });
      if (!res.ok) throw new Error(await res.text());
      const saved = JSON.parse(text()) as unknown;
      if (isHandSets(saved)) SAVED_SETS.sets = saved.sets;
      saveSetDrafts(null);
      changed(false);
      toast('Saved to src/gen/hand-sets.json. Commit it to keep it.');
    } catch {
      //no dev server here (a phone, the deployed site): hand the sets over as text
      toast((await copy()) ? 'No dev server here, so the sets were copied instead. Paste them to Claude.' : 'No dev server here: copy the sets from the box below and paste them to Claude.');
    }
  });
  $('st-play').addEventListener('click', () => {
    const s = set();
    if (!s) return;
    saveSetDrafts(all);
    location.href = `${location.pathname}?seed=2026&floor=${CHECK_FLOOR[act]}&setdrafts&playset=${encodeURIComponent(s.name)}`;
  });

  window.addEventListener('keydown', (ev) => {
    const typing = (ev.target as Element).closest('input, textarea, select');
    const mod = ev.metaKey || ev.ctrlKey;
    if (mod && ev.key === 's') {
      ev.preventDefault();
      $('st-save').click();
      return;
    }
    if (typing) return;
    if (mod && ev.key.toLowerCase() === 'z') {
      ev.preventDefault();
      $(ev.shiftKey ? 'st-redo' : 'st-undo').click();
    } else if (mod && ev.key === 'd') {
      ev.preventDefault();
      dupPart();
    } else if (ev.key === 'Delete' || ev.key === 'Backspace') {
      ev.preventDefault();
      deletePart();
    } else if (ev.key.startsWith('Arrow') && sel >= 0) {
      ev.preventDefault();
      const p = set()!.parts[sel];
      const [dx, dy] = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[ev.key] ?? [0, 0];
      before();
      p.x0 = round(p.x0 + dx * snap);
      p.y0 = round(p.y0 + dy * snap);
      if (p.x1 !== undefined) p.x1 = round(p.x1 + dx * snap);
      if (p.y1 !== undefined) p.y1 = round(p.y1 + dy * snap);
      changed();
    } else if (ev.key === 'Escape') {
      sel = -1;
      drawAll();
    }
  });

  // ---------- go ----------
  if (window.innerWidth < 600) zoom = 16;
  drawTray();
  if (set()) frame = frameFor(set()!);
  changed();
}
