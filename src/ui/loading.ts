// The loading screen (performance thread, zack 2026-10-26: "lots of hang ups from stuff loading... if we need a
// dedicated Loading screen at the begining of the game, so be it"). Everything a run draws is loaded, built and
// compiled behind it: the models (the car-hop damage too), the city's tiles, the skater, the first floor and every
// shader. The meter fills as each piece comes in. Its look is inline in index.html so it shows at once.
const TIPS = [
  'TAP / HOLD = OLLIE · TAP IN THE AIR = FLIP',
  'Add Skate Escape to your Home Screen to play it fullscreen',
];

export class Loading {
  private total = 0;
  private done = 0;
  private readonly blocks: HTMLElement[];

  constructor(private readonly el: HTMLElement) {
    this.blocks = [...el.querySelectorAll<HTMLElement>('.meter i')];
    const tip = el.querySelector('.tip');
    if (tip) tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  }

  say(what: string): void {
    const el = this.el.querySelector('.what');
    if (el) el.textContent = what;
  }

  // count a piece of work toward the meter; it fills a step when the piece is done
  add(n = 1): () => void {
    this.total += n;
    this.draw();
    return () => {
      this.done++;
      this.draw();
    };
  }

  track<T>(job: Promise<T>): Promise<T> {
    const tick = this.add();
    return job.finally(tick);
  }

  // a frame for the page to paint the meter before the next long step
  paint(): Promise<void> {
    return new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 0)));
  }

  private draw(): void {
    const lit = this.total ? Math.round((this.done / this.total) * this.blocks.length) : 0;
    this.blocks.forEach((b, i) => b.classList.toggle('on', i < lit));
  }

  finish(): void {
    this.blocks.forEach((b) => b.classList.add('on'));
    this.el.classList.add('done');
    window.setTimeout(() => this.el.remove(), 300);
  }

  fail(err: unknown): void {
    this.el.classList.add('error');
    this.say(`COULDN'T START: ${err}`);
  }

  remove(): void {
    this.el.remove();
  }
}
