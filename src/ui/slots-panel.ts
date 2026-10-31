// The end-of-run slot machine (src/run/slots.ts): one three-reel machine per spin token, all pulled at once. Each
// reel spins a strip of symbols and stops on its result, left to right, then the prize stamps in under the machine.
// A tap stops every reel where it lands. Reduce motion: the reels just show where they landed.
import type { Reel } from '../run/slots';
import type { SlotsView } from '../game/game';
import { SLOT_MS } from '../game/game';

// the symbols, inked like the rest of the game: a thick black outline and a flat fill ($ is a glyph)
const ink = (d: string, fill: string) => `<svg viewBox="0 0 24 24"><path d="${d}" fill="${fill}" stroke="#000" stroke-width="2.6" stroke-linejoin="round"/></svg>`;
const SYMBOL: Record<Reel, string> = {
  stoken: ink('M12 1.5 22.5 12 12 22.5 1.5 12z', '#b98cff'),
  cash: '$',
  boon: ink('M14 1 4 13.5h6.5L8.5 23 20 9.5h-6.8z', '#ffd23a'),
  heart: ink('M12 21.5S2 15 2 8.3A5.2 5.2 0 0 1 12 5.6a5.2 5.2 0 0 1 10 2.7C22 15 12 21.5 12 21.5z', '#ff3b4e'),
  star: ink('m12 1.8 3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5L7 14.3l-5.3-5 7.2-.9z', '#ffd23a'),
};
const ORDER: Reel[] = ['stoken', 'cash', 'boon', 'heart', 'star'];
const STRIP = 14; // symbols a reel spins through before its result
const STOPS = [0.5, 0.75, 1]; // when each reel stops, as a share of SLOT_MS

const cell = (r: Reel) => `<span class="sym ${r}">${SYMBOL[r]}</span>`;

export class SlotsPanel {
  private anims: Animation[] = [];
  private done = 0; // the timer that turns STOP into COLLECT

  constructor(
    private readonly el: HTMLElement,
    private readonly calm: () => boolean,
  ) {}

  show(v: SlotsView | null): void {
    this.anims = [];
    clearTimeout(this.done);
    this.el.hidden = !v;
    if (!v) return;
    //the lever pulls, the button says STOP while the reels spin and COLLECT once they've stopped
    this.el.classList.remove('pulled');
    void this.el.offsetWidth;
    this.el.classList.add('pulled');
    this.button(false);
    this.done = window.setTimeout(() => this.button(true), this.calm() ? 0 : SLOT_MS + 200);
    this.el.classList.toggle('many', v.pulls.length > 3);
    this.el.querySelector('.title')!.textContent = v.pulls.length > 1 ? `${v.pulls.length} SPIN TOKENS` : 'SPIN TOKEN';
    const box = this.el.querySelector('.machines')!;
    box.innerHTML = v.pulls
      .map((p, m) => {
        const reels = p.reels
          .map((r, k) => {
            //a strip of other symbols, the result last
            const strip = Array.from({ length: STRIP }, (_, i) => ORDER[(i * 3 + k * 2 + m) % ORDER.length]);
            return `<div class="reel"><div class="strip">${[...strip, r].map(cell).join('')}</div></div>`;
          })
          .join('');
        return `<div class="machine${p.big ? ' big' : ''}"><div class="reels">${reels}</div><div class="prize">${p.text}</div></div>`;
      })
      .join('');
    const calm = this.calm();
    box.querySelectorAll<HTMLElement>('.machine').forEach((mach) => {
      mach.querySelectorAll<HTMLElement>('.strip').forEach((strip, k) => {
        const end = `translateY(${(-100 * STRIP) / (STRIP + 1)}%)`;
        if (calm) {
          strip.style.transform = end;
          return;
        }
        this.anims.push(
          strip.animate([{ transform: 'translateY(0)' }, { transform: end }], {
            duration: SLOT_MS * STOPS[k],
            easing: 'cubic-bezier(0.2, 0.6, 0.35, 1.08)',
            fill: 'forwards',
          }),
        );
      });
      const prize = mach.querySelector<HTMLElement>('.prize')!;
      if (calm) return;
      this.anims.push(
        prize.animate(
          [
            { opacity: 0, transform: 'scale(0.4)' },
            { opacity: 1, transform: 'scale(1.25)', offset: 0.6 },
            { opacity: 1, transform: 'scale(1)' },
          ],
          { duration: 260, delay: SLOT_MS, fill: 'backwards' },
        ),
      );
    });
  }

  private button(stopped: boolean): void {
    const b = this.el.querySelector<HTMLElement>('.btn')!;
    b.textContent = stopped ? 'COLLECT' : 'STOP';
    b.classList.toggle('go', stopped);
  }

  // stop every reel on its result now
  skip(): void {
    for (const a of this.anims) a.finish();
    this.anims = [];
    clearTimeout(this.done);
    this.button(true);
  }
}
