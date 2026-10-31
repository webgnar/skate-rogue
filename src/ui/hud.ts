// The in-run HUD from zack's mockup (openspec/changes/ui1-hud): logo and floor, score and combo, cash and Stoken,
// pause, Stoke into GNAR MODE, Heat with the cruiser and stars, board mods bottom left, gear wear bottom right.
//
// Cheap on an old phone: the game calls most of this every frame, so every write goes through a cache and only
// touches the DOM when what it shows changes. Meters move in whole segments, so a draining meter writes a few
// times a second at most.
import { modDef, type ModId, type Slots } from '../board/mods';
import { actOf, FLOORS_PER_ACT } from '../gen/escape';
import { label, type Road } from '../gen/roads';
import { GEAR, type Gear, type GearPart } from '../run/gear';
import { drawWires } from './board-wires';
import { whole } from '../run/save';

export const STOKE_SEGS = 10;
export const HEAT_SEGS = 10;
export const WEAR_SEGS = 5;
export const NG_PIPS = 7; // NO GROUND's pieces to the cap (SKY_LINE, src/sim/sky.ts)
export const HEAT_STARS = [25, 50, 75, 90]; // Heat for each star
export const GEAR_ORDER: GearPart[] = ['deck', 'trucks', 'wheels', 'bearings', 'shoes']; // the mockup's order, bearings by the wheels

// small inked icons for the gear bars
export const GEAR_ICONS: Record<GearPart, string> = {
  deck: '<svg viewBox="0 0 24 24"><rect x="9" y="1" width="6" height="22" rx="3" transform="rotate(35 12 12)" fill="#e8e0d0" stroke="#000" stroke-width="2"/><circle cx="8" cy="7" r="1.4" fill="#000"/><circle cx="16" cy="17" r="1.4" fill="#000"/></svg>',
  trucks: '<svg viewBox="0 0 24 24"><path d="M2 12h20v3H2zM9 8h6v4H9z" fill="#c9ced6" stroke="#000" stroke-width="1.8" stroke-linejoin="round"/><circle cx="3.5" cy="13.5" r="2.5" fill="#f2e8d0" stroke="#000" stroke-width="1.5"/><circle cx="20.5" cy="13.5" r="2.5" fill="#f2e8d0" stroke="#000" stroke-width="1.5"/></svg>',
  wheels: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f2e8d0" stroke="#000" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="#9aa0a8" stroke="#000" stroke-width="1.6"/></svg>',
  //a shielded bearing: black shield with a red ring, the silver races showing (zack's Swiss bearing refs)
  bearings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#c9ced6" stroke="#000" stroke-width="2"/><circle cx="12" cy="12" r="7.6" fill="#1a1a1e"/><circle cx="12" cy="12" r="5.6" fill="none" stroke="#e8322a" stroke-width="1.4"/><circle cx="12" cy="12" r="3.6" fill="#c9ced6" stroke="#000" stroke-width="1.4"/><circle cx="12" cy="12" r="1.6" fill="#000"/></svg>',
  shoes: '<svg viewBox="0 0 24 24"><path d="M2 8l6-1 2 3 5 2 6 2 1 4H2z" fill="#f4f4f4" stroke="#000" stroke-width="1.8" stroke-linejoin="round"/><path d="M2 17h20" stroke="#ff2fb4" stroke-width="2"/></svg>',
};

// lit segments of a 0..1 meter: anything above zero shows at least one
export function segments(v: number, n: number): number {
  if (!(v > 0)) return 0;
  return Math.max(1, Math.min(n, Math.round(v * n)));
}

export function stars(heat: number): number {
  return HEAT_STARS.filter((h) => heat >= h).length;
}

// the gameplay thread's wear lines (src/run/gear.ts): worn below half, busted from 15
export function wearLevel(condition: number): 'fresh' | 'worn' | 'busted' {
  return condition <= GEAR.busted ? 'busted' : condition < GEAR.wornFrom ? 'worn' : 'fresh';
}

// lit segments of a gear bar: any condition left shows one
export function wearSegments(condition: number): number {
  const c = Math.max(0, Math.min(100, condition));
  return c > 0 ? Math.ceil((c / 100) * WEAR_SEGS) : 0;
}

// ACT 1-2 · FLOOR 2, or the act's escape
export function floorText(n: number, road: Road): string {
  if (road.kind === 'escape') return `ACT ${road.act} · ESCAPE`;
  return `ACT ${actOf(n)}-${((n - 1) % FLOORS_PER_ACT) + 1} · FLOOR ${n}`;
}

// a DOM node that only writes when its value changes
export class Cell {
  private last: string | null = null;
  constructor(readonly el: Pick<HTMLElement, 'textContent' | 'dataset'> & Partial<HTMLElement>) {}
  text(s: string): void {
    if (s === this.last) return;
    this.last = s;
    this.el.textContent = s;
  }
  data(key: string, s: string): void {
    if (this.el.dataset[key] !== s) this.el.dataset[key] = s;
  }
}

// a row of segments, lit from the left
class Meter {
  private lit = -1;
  private readonly segs: HTMLElement[];
  constructor(el: HTMLElement, n: number, color: (i: number) => string) {
    el.innerHTML = Array.from({ length: n }, (_, i) => `<b style="--c:${color(i)}"></b>`).join('');
    this.segs = [...el.children] as HTMLElement[];
  }
  set(on: number): void {
    if (on === this.lit) return;
    this.segs.forEach((s, i) => {
      const was = i < this.lit;
      const now = i < on;
      if (was !== now || this.lit < 0) s.classList.toggle('on', now);
    });
    this.lit = on;
  }
}

function mix(a: number[], b: number[], t: number): string {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

const $ = (id: string) => document.getElementById(id)!;

export class HudView {
  private readonly floor = new Cell($('floortext'));
  private readonly road = new Cell($('road'));
  private readonly score = new Cell($('score'));
  private readonly combo = new Cell($('combo'));
  private readonly pending = new Cell($('pending'));
  private readonly comboBox = new Cell($('combobox'));
  private readonly cash = new Cell($('cash'));
  private readonly stoken = new Cell($('stoken'));
  private readonly stokeBox = new Cell($('stoke'));
  private readonly heatBox = new Cell($('heat'));
  private readonly stoke: Meter;
  private readonly heat: Meter;
  private readonly slotsEl = $('slots');
  private readonly ngBox = new Cell($('ngbox'));
  private readonly ngMult = new Cell($('ngmult'));
  private readonly ngBonus = new Cell($('ngbonus'));
  private readonly ngPips: Meter;
  private ngLast = 0;
  private boardKey = '';
  private readonly gearBars: Partial<Record<GearPart, { meter: Meter; box: Cell }>> = {};

  constructor() {
    this.stoke = new Meter($('stokebar'), STOKE_SEGS, (i) => mix([255, 226, 58], [255, 47, 180], i / (STOKE_SEGS - 1)));
    this.ngPips = new Meter($('ngpips'), NG_PIPS, () => '');
    this.heat = new Meter($('heatbar'), HEAT_SEGS, (i) => mix([255, 120, 70], [255, 30, 60], i / (HEAT_SEGS - 1)));
    $('stars').innerHTML = HEAT_STARS.map(() => '<i>★</i>').join('');
    const gear = $('gearbars');
    gear.innerHTML = GEAR_ORDER.map(
      (p) => `<div class="part" data-part="${p}"><span class="icon">${GEAR_ICONS[p]}</span><span class="name">${GEAR.names[p].toUpperCase()}</span><span class="meter"></span></div>`,
    ).join('');
    gear.querySelectorAll<HTMLElement>('.part').forEach((el) => {
      const p = el.dataset.part as GearPart;
      this.gearBars[p] = { meter: new Meter(el.querySelector('.meter')!, WEAR_SEGS, () => 'var(--wear)'), box: new Cell(el) };
    });
    this.gear({ deck: 100, trucks: 100, wheels: 100, bearings: 100, shoes: 100 });
    this.board([]);
    //held boons sit just under the top bar, wherever it ends (zack: "upgrades shouldnt overlap stoke meter on mobile"):
    //the bar's height changes with the screen, the font and how it wraps, so it is measured, not guessed
    const top = $('top');
    const below = () => top.parentElement?.style.setProperty('--top-b', `${top.offsetTop + top.offsetHeight}px`);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(below).observe(top);
    below();
  }

  setFloor(n: number, road: Road): void {
    this.floor.text(floorText(n, road));
    this.road.text(road.kind === 'escape' ? 'ESCAPE' : label(road));
    this.road.data('kind', road.kind);
  }

  money(cash: number, stoken: number): void {
    this.cash.text(`$${cash}`);
    this.stoken.text(String(whole(stoken)));
  }

  // stoke and gnar 0..1; pending is the live combo's points before the speed bonus
  setScore(score: number, combo: number, stoke: number, gnar: number, pending: number): void {
    this.score.text(score.toLocaleString('en-US'));
    const live = combo > 1;
    this.comboBox.data('live', live ? '1' : '0');
    if (live) {
      this.combo.text(`x${combo}`);
      this.pending.text(`+ ${Math.round(pending).toLocaleString('en-US')}`);
    }
    const isGnar = gnar > 0;
    this.stokeBox.data('gnar', isGnar ? '1' : '0');
    this.stoke.set(segments(isGnar ? gnar : stoke, STOKE_SEGS));
  }

  // NO GROUND: n sky pieces chained (shown from 2), the coin multiplier, the extra cash it's paid; banked holds
  // the last line up a moment in gold after you touch down
  setNoGround(n: number, mult: number, bonus: number, banked: boolean): void {
    this.ngBox.data('live', n >= 2 ? '1' : '0');
    this.ngBox.data('banked', banked ? '1' : '0');
    this.ngBox.data('cap', n >= NG_PIPS ? '1' : '0');
    if (n < 2) {
      this.ngLast = 0;
      return;
    }
    this.ngMult.text(`x${mult}`);
    this.ngBonus.text(banked ? `BANKED +$${bonus}` : bonus > 0 ? `+$${bonus} BONUS` : 'LAND ON THE NEXT ONE');
    this.ngPips.set(Math.min(NG_PIPS, n));
    //each step up, the multiplier pops
    if (n > this.ngLast && !banked) {
      const el = this.ngBox.el as HTMLElement;
      el.classList?.remove('step');
      void el.offsetWidth;
      el.classList?.add('step');
    }
    this.ngLast = n;
  }

  setHeat(value: number): void {
    const on = segments(value / 100, HEAT_SEGS);
    this.heat.set(on);
    const s = stars(value);
    this.heatBox.data('stars', String(s));
    this.heatBox.data('hot', value >= 50 ? '1' : '0');
  }

  board(slots: Slots): void {
    const key = slots.join(',');
    if (key === this.boardKey && this.slotsEl.childElementCount) return;
    this.boardKey = key;
    this.slotsEl.innerHTML = slots.map((id: ModId | null) => {
      if (!id) return '<span class="slot empty"></span>';
      const m = modDef(id);
      return `<span class="slot ${m.kind}"><small>${m.kind === 'trigger' ? 'ON' : m.kind === 'modifier' ? 'MOD' : 'DO'}</small>${esc(m.short)}</span>`;
    }).join('');
    drawWires(this.slotsEl, slots);
  }

  fire(i: number): void {
    const el = this.slotsEl.children[i] as HTMLElement | undefined;
    if (!el) return;
    el.classList.remove('fire');
    void el.offsetWidth; // restart the flash
    el.classList.add('fire');
  }

  // a part just took a hit of wear (a puddle soaking the deck): its icon flashes
  gearTick(part: GearPart): void {
    const el = this.gearBars[part]?.box.el as HTMLElement | undefined;
    if (!el) return;
    el.classList.remove('tick');
    void el.offsetWidth; // restart the flash
    el.classList.add('tick');
  }

  gear(g: Gear): void {
    for (const p of GEAR_ORDER) {
      const bar = this.gearBars[p]!;
      bar.meter.set(wearSegments(g[p]));
      bar.box.data('wear', wearLevel(g[p]));
    }
  }
}
