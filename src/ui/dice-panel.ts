// The end-of-run street dice (src/run/dice.ts): real 3D casino dice (src/render/dice3d.ts) on a strip of curb under
// a street lamp. One big pair at a time (zack, 2026-11-06): the free roll first, then one per chip. Each pair rattles
// in your hand until you shake the phone or tap ROLL, tumbles onto the curb and lands; its name and prize stamp in,
// spelled out (what you got and what it's for). A tap claims it: the prize drops into the WON row, and if a chip's
// left, it pops out of the chip count, flies down to your hand and turns into the next pair. Boxcars (the MATCH)
// glows and flashes gold. A tap while the dice tumble lands them, a tap while a chip flies skips the flight.
// Reduce motion: the throw and the chip just show where they end up.
// Shaking (zack, 2026-11-04): devicemotion, which iOS only allows after a tap asks for it, so on an iPhone the first
// ROLL tap asks, and shaking works from then on.
import type { DiceView } from '../game/game';
import { DICE_MS } from '../game/game';
import type { PrizeIcon } from '../run/dice';
import { Dice3D, type DieSlot } from '../render/dice3d';
import { STOKEN_SVG } from './stoken-icon';

export const SHAKE = {
  jolt: 13, // m/s² of change between two motion readings that counts as a shake
  jolts: 3, // jolts in a row that throw the dice
  within: 900, // ms the jolts have to come in
};

export const CHIP_MS = 650; // a chip's flight from the count down to your hand, before it turns into dice

// the prize icons, inked like the rest of the game (the Stoken particle is the HUD's)
const ink = (d: string, fill: string, box = '0 0 24 24') => `<svg viewBox="${box}" aria-hidden="true"><path d="${d}" fill="${fill}" stroke="#000" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
const ICON: Record<PrizeIcon, string> = {
  stoken: STOKEN_SVG,
  cash: '<b class="cash">$</b>',
  boon: ink('M14 1 4 13.5h6.5L8.5 23 20 9.5h-6.8z', '#ffd23a'),
  heart: ink('M12 21.5S2 15 2 8.3A5.2 5.2 0 0 1 12 5.6a5.2 5.2 0 0 1 10 2.7C22 15 12 21.5 12 21.5z', '#ff3b4e'),
  grip: ink('M5 3h14a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z', '#22d3ee'),
};
// a chip: the red casino chip with a gold star, as found in runs
const CHIP = '<i class="chip"><b>&#9733;</b></i>';

type Permissioned = { requestPermission?: () => Promise<'granted' | 'denied'> };
// where a pair is: in your hand, tumbling, landed (its prize showing), or a chip on its way to become it
type Phase = 'hand' | 'tumble' | 'landed' | 'chip';

export class DicePanel {
  private anims: Animation[] = [];
  private timers: number[] = [];
  private view: DiceView | null = null;
  private dice3d: Dice3D | null = null;
  private at = 0; // the roll showing
  private phase: Phase = 'hand';
  private jolts: number[] = [];
  private last: { x: number; y: number; z: number } | null = null;
  private asked = false; // iOS's motion permission was asked for this session
  private readonly resize = new ResizeObserver(() => this.layout());

  constructor(
    private readonly el: HTMLElement,
    private readonly calm: () => boolean,
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
    this.el.hidden = !v;
    window.removeEventListener('devicemotion', this.onMotion);
    if (!v) return void this.dice3d?.stop();
    this.el.querySelector('.won')!.innerHTML = '';
    if (!this.dice3d) {
      this.dice3d = new Dice3D();
      this.el.querySelector('.street')!.after(this.dice3d.canvas);
    }
    this.roll(0, false);
    window.addEventListener('devicemotion', this.onMotion);
  }

  // a tap: throws the pair in your hand, lands one tumbling, claims a landed one (then the next chip flies in), or
  // skips a chip's flight. True once the last prize is claimed: the summary's next
  tap(): boolean {
    if (!this.view) return true;
    switch (this.phase) {
      case 'hand':
        this.throw();
        return false;
      case 'tumble':
        this.land();
        return false;
      case 'chip':
        this.roll(this.at, false);
        return false;
      case 'landed':
        this.claim();
        if (this.at + 1 >= this.view.rolls.length) return true;
        this.chipIn(this.at + 1);
        return false;
    }
  }

  // roll k's pair, in your hand. pop: it just came out of a chip
  private roll(k: number, pop: boolean): void {
    const v = this.view!;
    this.stop();
    this.at = k;
    this.phase = 'hand';
    const r = v.rolls[k];
    const n = v.rolls.length;
    this.el.classList.remove('thrown', 'landed', 'matched', 'flying');
    this.el.querySelector('.title')!.textContent = n > 1 ? `ROLL ${k + 1} OF ${n}` : 'ROLL ’EM';
    this.el.querySelector('.sub')!.textContent = k === 0 ? 'THE FREE ROLL, EVERY RUN' : 'A CHIP ROLL';
    this.chips(n - 1 - k);
    this.el.querySelector('.how')!.textContent = this.canShake() ? 'SHAKE YOUR PHONE OR TAP ROLL' : 'TAP ROLL';
    this.button('ROLL ▶', true);
    this.el.querySelector('.curb')!.innerHTML =
      `<div class="pair${r.big ? ' big' : ''}${r.match ? ' match' : ''}">` +
      `<div class="dice"><div class="die"></div><div class="die"></div></div>` +
      `<div class="name">${r.name}</div>` +
      `<div class="prize"><span class="icon">${ICON[r.prize.icon]}</span><span class="what"><b>${r.prize.main}</b><small>${r.prize.sub}</small></span></div></div>`;
    this.dice3d!.set(r.dice, this.slots(), this.hand(), [DICE_MS - 60, DICE_MS], [r.match, r.match], pop && !this.calm());
    this.layout();
  }

  // the pair leaves your hand
  private throw(): void {
    if (this.phase !== 'hand') return;
    this.phase = 'tumble';
    this.el.classList.add('thrown');
    this.button('', false);
    if (this.calm()) return this.land();
    this.dice3d?.throwNow();
    for (const sel of ['.name', '.prize'])
      this.anims.push(
        this.el.querySelector<HTMLElement>(`.pair ${sel}`)!.animate(
          [
            { opacity: 0, transform: 'scale(0.4)' },
            { opacity: 1, transform: 'scale(1.2)', offset: 0.6 },
            { opacity: 1, transform: 'scale(1)' },
          ],
          { duration: 260, delay: DICE_MS, fill: 'backwards' },
        ),
      );
    this.timers.push(window.setTimeout(() => this.land(), DICE_MS + 180));
  }

  // the pair on its result, the prize showing
  private land(): void {
    if (this.phase !== 'tumble') return;
    for (const a of this.anims) a.finish();
    this.anims = [];
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.dice3d?.finish();
    this.phase = 'landed';
    const v = this.view!;
    this.el.classList.add('landed');
    this.el.classList.toggle('matched', v.rolls[this.at].match);
    this.button(this.at + 1 < v.rolls.length ? 'NEXT ROLL ▶' : 'COLLECT', true);
  }

  // the prize drops into the WON row
  private claim(): void {
    const r = this.view!.rolls[this.at];
    const won = this.el.querySelector('.won')!;
    const item = document.createElement('span');
    item.className = 'item';
    item.innerHTML = `<span class="icon">${ICON[r.prize.icon]}</span>${r.prize.main.replace(/^MATCH! /, '')}`;
    won.append(item);
    if (!this.calm()) item.animate([{ opacity: 0, transform: 'translateY(-30px) scale(1.6)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
  }

  // the next chip pops out of the count, flies down to your hand and turns into roll k's dice
  private chipIn(k: number): void {
    this.stop();
    this.phase = 'chip';
    this.at = k;
    this.el.classList.remove('thrown', 'landed', 'matched');
    this.el.classList.add('flying');
    const hand = this.hand(); // before the button hides: your hand is just above it
    this.button('', false);
    this.dice3d?.set([], [], hand, [], []);
    const box = this.el.getBoundingClientRect();
    const from = this.el.querySelector<HTMLElement>('.chips .chip:last-of-type');
    const fr = from?.getBoundingClientRect() ?? { left: box.width / 2, top: 0, width: 30, height: 30 };
    this.el.querySelector('.title')!.textContent = `ROLL ${k + 1} OF ${this.view!.rolls.length}`;
    this.el.querySelector('.sub')!.textContent = 'A CHIP ROLL';
    //the count drops by one as the chip leaves it
    this.chips(this.view!.rolls.length - 1 - k);
    if (this.calm()) return this.roll(k, false);
    const fly = document.createElement('div');
    fly.className = 'flychip';
    fly.innerHTML = CHIP;
    this.el.append(fly);
    const x0 = fr.left - box.left + fr.width / 2;
    const y0 = fr.top - box.top + fr.height / 2;
    //one transform list in every key, so it tweens cleanly: up and over in an arc, flipping, growing into the dice
    const at = (x: number, y: number, turn: number, scale: number) => `translate(${x}px, ${y}px) rotateY(${turn}deg) scale(${scale})`;
    this.anims.push(
      fly.animate(
        [
          { transform: at(x0, y0, 0, 1) },
          { transform: at((x0 + hand.x) / 2 - 40, Math.min(y0, hand.y) - 30, 540, 2.2), offset: 0.45 },
          { transform: at(hand.x, hand.y, 1080, 2.6), offset: 0.85 },
          { transform: at(hand.x, hand.y, 1080, 3.4), opacity: 0 },
        ],
        { duration: CHIP_MS, easing: 'cubic-bezier(0.3, 0.6, 0.4, 1)', fill: 'forwards' },
      ),
    );
    //the dice come out of the chip as it flashes away
    this.timers.push(window.setTimeout(() => this.roll(k, true), CHIP_MS * 0.85));
  }

  // the chips left to roll, as a row of chips under the title
  private chips(left: number): void {
    const el = this.el.querySelector<HTMLElement>('.chips')!;
    el.hidden = left <= 0 && (this.view?.rolls.length ?? 1) <= 1;
    el.innerHTML = `${CHIP.repeat(Math.max(0, left))}<span class="left">${left > 0 ? `×${left} CHIP${left > 1 ? 'S' : ''} LEFT` : 'NO CHIPS LEFT'}</span>`;
  }

  // the pair's slots on the curb, in the panel's pixels
  private slots(): DieSlot[] {
    const box = this.el.getBoundingClientRect();
    return [...this.el.querySelectorAll<HTMLElement>('.die')].map((d) => {
      const r = d.getBoundingClientRect();
      return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2, size: r.width };
    });
  }

  // your hand: just above the ROLL button
  private hand(): { x: number; y: number } {
    const box = this.el.getBoundingClientRect();
    const b = this.el.querySelector<HTMLElement>('.btn')!.getBoundingClientRect();
    const die = this.el.querySelector<HTMLElement>('.die')?.getBoundingClientRect().width ?? 80;
    return { x: b.left - box.left + b.width / 2, y: b.top - box.top - die * 0.55 };
  }

  private layout(): void {
    if (!this.view || !this.dice3d) return;
    const box = this.el.getBoundingClientRect();
    this.dice3d.layout(box.width, box.height, this.slots(), this.hand());
  }

  private stop(): void {
    for (const a of this.anims) a.cancel();
    this.anims = [];
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.jolts = [];
    this.last = null;
    for (const f of this.el.querySelectorAll('.flychip')) f.remove();
  }

  private button(text: string, go: boolean): void {
    const b = this.el.querySelector<HTMLElement>('.btn')!;
    //an empty button keeps its room (hidden, not gone), so nothing on the screen jumps while the dice fly
    b.textContent = text || 'ROLL ▶';
    b.style.visibility = text ? '' : 'hidden';
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

  // three hard jolts in a row throw the pair in your hand; every jolt rattles it
  private readonly onMotion = (e: DeviceMotionEvent): void => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null || a.y === null || a.z === null || this.phase !== 'hand') return;
    const now = performance.now();
    const prev = this.last;
    this.last = { x: a.x, y: a.y, z: a.z };
    if (!prev) return;
    const d = Math.abs(a.x - prev.x) + Math.abs(a.y - prev.y) + Math.abs(a.z - prev.z);
    if (d < SHAKE.jolt) return;
    this.dice3d?.rattle(d / (SHAKE.jolt * 2));
    this.jolts = [...this.jolts.filter((t) => now - t < SHAKE.within), now];
    if (this.jolts.length >= SHAKE.jolts) this.throw();
  };
}
