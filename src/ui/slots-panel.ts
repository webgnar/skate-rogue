// The end-of-run slot machine (src/run/slots.ts): one three-reel machine per spin token, all pulled at once. Each
// reel spins a strip of symbols and stops on its result, left to right, then the prize stamps in under the machine.
// A tap stops every reel where it lands. Reduce motion: the reels just show where they landed.
import type { Reel } from '../run/slots';
import type { SlotsView } from '../game/game';
import { SLOT_MS } from '../game/game';

const SYMBOL: Record<Reel, string> = { stoken: '◆', cash: '$', boon: '⚡', heart: '♥', star: '★' };
const ORDER: Reel[] = ['stoken', 'cash', 'boon', 'heart', 'star'];
const STRIP = 14; // symbols a reel spins through before its result
const STOPS = [0.5, 0.75, 1]; // when each reel stops, as a share of SLOT_MS

const cell = (r: Reel) => `<span class="sym ${r}">${SYMBOL[r]}</span>`;

export class SlotsPanel {
  private anims: Animation[] = [];

  constructor(
    private readonly el: HTMLElement,
    private readonly calm: () => boolean,
  ) {}

  show(v: SlotsView | null): void {
    this.anims = [];
    this.el.hidden = !v;
    if (!v) return;
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

  // stop every reel on its result now
  skip(): void {
    for (const a of this.anims) a.finish();
    this.anims = [];
  }
}
