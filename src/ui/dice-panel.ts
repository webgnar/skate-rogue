// The end-of-run street dice (src/run/dice.ts): real 3D casino dice (src/render/dice3d.ts) on a strip of curb under
// a street lamp, a pair per roll. They rattle in your hand until you shake the phone or tap ROLL; then each pair
// tumbles onto the curb and lands on its result, and the roll's name and prize stamp in under it, spelled out (what
// you got and what it's for). Boxcars (the MATCH) glows and flashes gold. A tap while they tumble lands them all.
// Reduce motion: the throw just shows where they landed.
// Shaking (zack, 2026-11-04): devicemotion, which iOS only allows after a tap asks for it, so on an iPhone the first
// ROLL tap asks, and shaking works from then on.
import type { DiceView } from '../game/game';
import { DICE_MS } from '../game/game';
import type { PrizeIcon } from '../run/dice';
import { Dice3D, type DieSlot } from '../render/dice3d';

const LAND = [0.62, 0.8, 1]; // when each pair lands, as a share of DICE_MS (later pairs land later)

export const SHAKE = {
  jolt: 13, // m/s² of change between two motion readings that counts as a shake
  jolts: 3, // jolts in a row that throw the dice
  within: 900, // ms the jolts have to come in
};

// the prize icons, inked like the rest of the game (the Stoken gem is the HUD's)
const ink = (d: string, fill: string, box = '0 0 24 24') => `<svg viewBox="${box}" aria-hidden="true"><path d="${d}" fill="${fill}" stroke="#000" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
const ICON: Record<PrizeIcon, string> = {
  stoken:
    '<svg viewBox="0 0 24 20" aria-hidden="true"><path d="M5 1h14l4 6-11 12L1 7z" fill="#e04cff" stroke="#000" stroke-width="2" stroke-linejoin="round"/><path d="M1 7h22M8 1l-2 6 6 12 6-12-2-6" stroke="#ffb8ff" stroke-width="1.2" fill="none"/></svg>',
  cash: '<b class="cash">$</b>',
  boon: ink('M14 1 4 13.5h6.5L8.5 23 20 9.5h-6.8z', '#ffd23a'),
  heart: ink('M12 21.5S2 15 2 8.3A5.2 5.2 0 0 1 12 5.6a5.2 5.2 0 0 1 10 2.7C22 15 12 21.5 12 21.5z', '#ff3b4e'),
  grip: ink('M5 3h14a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z', '#22d3ee'),
};

type Permissioned = { requestPermission?: () => Promise<'granted' | 'denied'> };

export class DicePanel {
  private anims: Animation[] = [];
  private timers: number[] = [];
  private view: DiceView | null = null;
  private dice3d: Dice3D | null = null;
  private thrown = false;
  private jolts: number[] = [];
  private last: { x: number; y: number; z: number } | null = null;
  private asked = false; // iOS's motion permission was asked for this session
  private readonly resize = new ResizeObserver(() => this.layout());

  constructor(
    private readonly el: HTMLElement,
    private readonly calm: () => boolean,
    private readonly onShake: () => void,
  ) {
    //iOS asks for motion on a tap: the first one on the dice screen (it also throws, so shaking is for next time)
    const ask = () => this.askMotion();
    el.addEventListener('touchend', ask);
    el.addEventListener('click', ask);
    this.resize.observe(el);
  }

  show(v: DiceView | null): void {
    this.stop();
    this.view = v;
    this.thrown = false;
    this.el.hidden = !v;
    this.el.classList.remove('thrown', 'landed', 'matched');
    window.removeEventListener('devicemotion', this.onMotion);
    if (!v) return void this.dice3d?.stop();
    const n = v.rolls.length;
    this.el.classList.toggle('many', n > 2);
    this.el.classList.toggle('solo', n === 1);
    this.el.querySelector('.title')!.textContent = n > 1 ? `${n} ROLLS` : 'ROLL ’EM';
    this.el.querySelector('.sub')!.textContent = n > 1 ? `1 FREE + ${n - 1} CHIP${n > 2 ? 'S' : ''}` : 'ONE FREE ROLL EVERY RUN';
    this.el.querySelector('.how')!.textContent = this.canShake() ? 'SHAKE YOUR PHONE OR TAP ROLL' : 'TAP ROLL';
    this.button('ROLL ▶', true);
    this.el.querySelector('.curb')!.innerHTML = v.rolls
      .map(
        (r) =>
          `<div class="pair${r.big ? ' big' : ''}${r.match ? ' match' : ''}">` +
          `<div class="dice"><div class="die"></div><div class="die"></div></div>` +
          `<div class="name">${r.name}</div>` +
          `<div class="prize"><span class="icon">${ICON[r.prize.icon]}</span><span class="what"><b>${r.prize.main}</b><small>${r.prize.sub}</small></span></div></div>`,
      )
      .join('');
    //the 3D dice: made once, kept
    if (!this.dice3d) {
      this.dice3d = new Dice3D();
      this.el.querySelector('.street')!.after(this.dice3d.canvas);
    }
    const lands = v.rolls.flatMap((_, k) => [this.landMs(k), this.landMs(k) + 60]);
    this.dice3d.set(
      v.rolls.flatMap((r) => r.dice),
      this.slots(),
      this.hand(),
      lands,
      v.rolls.flatMap((r) => [r.match, r.match]),
    );
    this.layout();
    window.addEventListener('devicemotion', this.onMotion);
  }

  // the first tap or a shake: the dice fly
  throw(): void {
    const v = this.view;
    if (!v || this.thrown) return;
    this.thrown = true;
    window.removeEventListener('devicemotion', this.onMotion);
    this.el.classList.add('thrown');
    this.button('', false);
    const calm = this.calm();
    if (calm) this.dice3d?.finish();
    else this.dice3d?.throwNow();
    if (!calm)
      this.el.querySelectorAll<HTMLElement>('.pair').forEach((pair, k) => {
        for (const sel of ['.name', '.prize'])
          this.anims.push(
            pair.querySelector<HTMLElement>(sel)!.animate(
              [
                { opacity: 0, transform: 'scale(0.4)' },
                { opacity: 1, transform: 'scale(1.2)', offset: 0.6 },
                { opacity: 1, transform: 'scale(1)' },
              ],
              { duration: 260, delay: this.landMs(k) + 60, fill: 'backwards' },
            ),
          );
      });
    this.timers.push(window.setTimeout(() => this.landed(), calm ? 0 : DICE_MS + 180));
  }

  // land every die now
  skip(): void {
    if (!this.view) return;
    for (const a of this.anims) a.finish();
    this.anims = [];
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.dice3d?.finish();
    this.landed();
  }

  private landMs(k: number): number {
    const n = this.view?.rolls.length ?? 1;
    return DICE_MS * (n > 1 ? LAND[Math.min(LAND.length - 1, Math.round((k / (n - 1)) * 2))] : 1) - 60;
  }

  // each die's slot on the curb, in the panel's pixels
  private slots(): DieSlot[] {
    const box = this.el.getBoundingClientRect();
    return [...this.el.querySelectorAll<HTMLElement>('.die')].map((d) => {
      const r = d.getBoundingClientRect();
      return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2, size: r.width };
    });
  }

  // the hand: just above the ROLL button
  private hand(): { x: number; y: number } {
    const box = this.el.getBoundingClientRect();
    const b = this.el.querySelector<HTMLElement>('.btn')!.getBoundingClientRect();
    const die = this.el.querySelector<HTMLElement>('.die')?.getBoundingClientRect().width ?? 60;
    return { x: b.left - box.left + b.width / 2, y: b.top - box.top - die * 0.55 };
  }

  private layout(): void {
    if (!this.view || !this.dice3d) return;
    const box = this.el.getBoundingClientRect();
    this.dice3d.layout(box.width, box.height, this.slots(), this.hand());
  }

  private landed(): void {
    this.el.classList.add('landed');
    this.el.classList.toggle('matched', !!this.view?.rolls.some((r) => r.match));
    this.button('COLLECT', true);
  }

  private stop(): void {
    for (const a of this.anims) a.cancel();
    this.anims = [];
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.jolts = [];
    this.last = null;
  }

  private button(text: string, go: boolean): void {
    const b = this.el.querySelector<HTMLElement>('.btn')!;
    b.textContent = text;
    b.hidden = !text;
    b.classList.toggle('go', go);
  }

  private canShake(): boolean {
    return 'DeviceMotionEvent' in window && matchMedia('(pointer: coarse)').matches;
  }

  private askMotion(): void {
    if (this.asked || !this.canShake()) return;
    const ask = (window.DeviceMotionEvent as unknown as Permissioned).requestPermission;
    if (!ask) return;
    this.asked = true;
    ask.call(window.DeviceMotionEvent).catch(() => {});
  }

  // three hard jolts in a row throw the dice; every jolt rattles them in the hand
  private readonly onMotion = (e: DeviceMotionEvent): void => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null || a.y === null || a.z === null || this.thrown) return;
    const now = performance.now();
    const prev = this.last;
    this.last = { x: a.x, y: a.y, z: a.z };
    if (!prev) return;
    const d = Math.abs(a.x - prev.x) + Math.abs(a.y - prev.y) + Math.abs(a.z - prev.z);
    if (d < SHAKE.jolt) return;
    this.dice3d?.rattle(d / (SHAKE.jolt * 2));
    this.jolts = [...this.jolts.filter((t) => now - t < SHAKE.within), now];
    if (this.jolts.length >= SHAKE.jolts) this.onShake();
  };
}
