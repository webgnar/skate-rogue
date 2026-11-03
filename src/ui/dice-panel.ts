// The end-of-run street dice (src/run/dice.ts): a pair of dice per roll on a strip of curb under a street lamp. The
// dice sit shaking until the first tap throws them; each one tumbles in from the bottom right, its face flickering,
// and lands on its result, then the roll's name and prize stamp in under the pair. Boxcars (the MATCH) flashes gold.
// A tap while they tumble lands them all. Reduce motion: the throw just shows where they landed.
import type { DiceView } from '../game/game';
import { DICE_MS } from '../game/game';
import type { Face } from '../run/dice';

// which of a 3x3 grid's spots hold a pip, per face
const PIPS: Record<Face, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const LAND = [0.62, 0.8, 1]; // when each pair lands, as a share of DICE_MS (later pairs land later)
const FLICKER_MS = 70;

// a die's face; a one's single pip is red, like real dice
const face = (n: Face) => Array.from({ length: 9 }, (_, i) => `<i${PIPS[n].includes(i) ? (n === 1 ? ' class="on ace"' : ' class="on"') : ''}></i>`).join('');

export class DicePanel {
  private anims: Animation[] = [];
  private timers: number[] = [];
  private view: DiceView | null = null;

  constructor(
    private readonly el: HTMLElement,
    private readonly calm: () => boolean,
  ) {}

  show(v: DiceView | null): void {
    this.stop();
    this.view = v;
    this.el.hidden = !v;
    this.el.classList.remove('thrown', 'landed', 'matched');
    if (!v) return;
    const n = v.rolls.length;
    this.el.classList.toggle('many', n > 2);
    this.el.classList.toggle('solo', n === 1);
    this.el.querySelector('.title')!.textContent = n > 1 ? `${n} ROLLS` : 'ROLL ’EM';
    this.el.querySelector('.sub')!.textContent = n > 1 ? `1 FREE + ${n - 1} CHIP${n > 2 ? 'S' : ''}` : 'ONE FREE ROLL EVERY RUN';
    this.button('ROLL ▶', true);
    //before the throw every die shows a random face; the result only shows once it lands
    this.el.querySelector('.curb')!.innerHTML = v.rolls
      .map(
        (r, k) =>
          `<div class="pair${r.big ? ' big' : ''}${r.match ? ' match' : ''}">` +
          `<div class="dice">${r.dice.map((_, j) => `<div class="die d${j}">${face((((k * 2 + j) % 6) + 1) as Face)}</div>`).join('')}</div>` +
          `<div class="name">${r.name}</div><div class="prize">${r.text}</div></div>`,
      )
      .join('');
  }

  // the first tap: the dice fly
  throw(): void {
    const v = this.view;
    if (!v) return;
    this.el.classList.add('thrown');
    this.button('', false);
    const calm = this.calm();
    this.el.querySelectorAll<HTMLElement>('.pair').forEach((pair, k) => {
      const r = v.rolls[k];
      const land = DICE_MS * (v.rolls.length > 1 ? LAND[Math.min(LAND.length - 1, Math.round((k / (v.rolls.length - 1)) * 2))] : 1);
      pair.querySelectorAll<HTMLElement>('.die').forEach((die, j) => {
        if (calm) return void (die.innerHTML = face(r.dice[j]));
        //the face flickers as it tumbles, and settles on the result as it lands
        const flick = window.setInterval(() => (die.innerHTML = face((1 + Math.floor(Math.random() * 6)) as Face)), FLICKER_MS);
        this.timers.push(flick, window.setTimeout(() => (clearInterval(flick), (die.innerHTML = face(r.dice[j]))), land * 0.86));
        const spin = (j ? -1 : 1) * (540 + 90 * ((k + j) % 3));
        const tilt = j ? 9 : -12;
        this.anims.push(
          die.animate(
            [
              { transform: `translate(${120 + j * 30}vw, 40vh) rotate(${spin}deg) scale(0.7)` },
              { transform: `translate(0, -32px) rotate(${tilt - 20}deg) scale(1.08)`, offset: 0.72 },
              { transform: `translate(0, 0) rotate(${tilt + 6}deg) scale(1)`, offset: 0.86 },
              { transform: `translate(0, -6px) rotate(${tilt - 2}deg)`, offset: 0.93 },
              { transform: `translate(0, 0) rotate(${tilt}deg)` },
            ],
            { duration: land, easing: 'cubic-bezier(0.25, 0.7, 0.4, 1)', fill: 'forwards' },
          ),
        );
      });
      if (calm) return;
      for (const sel of ['.name', '.prize'])
        this.anims.push(
          pair.querySelector<HTMLElement>(sel)!.animate(
            [
              { opacity: 0, transform: 'scale(0.4)' },
              { opacity: 1, transform: 'scale(1.25)', offset: 0.6 },
              { opacity: 1, transform: 'scale(1)' },
            ],
            { duration: 260, delay: land, fill: 'backwards' },
          ),
        );
    });
    this.timers.push(window.setTimeout(() => this.landed(), calm ? 0 : DICE_MS + 120));
  }

  // land every die now
  skip(): void {
    const v = this.view;
    if (!v) return;
    for (const a of this.anims) a.finish();
    this.anims = [];
    for (const t of this.timers) (clearTimeout(t), clearInterval(t));
    this.timers = [];
    this.el.querySelectorAll<HTMLElement>('.pair').forEach((pair, k) => pair.querySelectorAll<HTMLElement>('.die').forEach((die, j) => (die.innerHTML = face(v.rolls[k].dice[j]))));
    this.landed();
  }

  private landed(): void {
    this.el.classList.add('landed');
    this.el.classList.toggle('matched', !!this.view?.rolls.some((r) => r.match));
    this.button('COLLECT', true);
  }

  private stop(): void {
    for (const a of this.anims) a.cancel();
    this.anims = [];
    for (const t of this.timers) (clearTimeout(t), clearInterval(t));
    this.timers = [];
  }

  private button(text: string, go: boolean): void {
    const b = this.el.querySelector<HTMLElement>('.btn')!;
    b.textContent = text;
    b.hidden = !text;
    b.classList.toggle('go', go);
  }
}
