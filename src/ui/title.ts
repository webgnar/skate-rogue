// The title screen (zack 2026-11-02: "i also got title screen music. we should probably build a title screen").
// Over its own scene (src/title/title-scene.ts), once the loading screen is done. Phones only let a page make sound
// after a tap, so it's a press-start: high over the city, the first tap anywhere starts the title music (MUSIC.title
// in src/audio/cues.ts) and sends the camera down through the city to Webster; a tap on the way skips to him; then
// SKATE starts the run. With the music off it starts down by itself.
// Test links (?floor, ?bot ...) skip the screen, and so does a reload the game asks for itself (skipTitleOnce).

const SKIP = 'gnarrun.skipTitle';

export interface TitleHooks {
  music: () => boolean; // is the music on (the title music would play)
  wake: () => void; // the first tap: make the sound
  down: () => void; // send the title scene's camera down (src/title/title-scene.ts), or skip to the bottom
  go: () => void; // SKATE: the run starts
}

// the reloads the game does itself (a new skater, the daily run, a Gnar level) go straight back into a run
export function skipTitleOnce(): void {
  try {
    sessionStorage.setItem(SKIP, '1');
  } catch {
    //no storage: the title shows again, which is fine
  }
}

// should the title show this time? (and forget a skipTitleOnce)
export function wantTitle(params: URLSearchParams, testing: boolean): boolean {
  let skip = false;
  try {
    skip = sessionStorage.getItem(SKIP) === '1';
    sessionStorage.removeItem(SKIP);
  } catch {
    //no storage: show it
  }
  const dev = ['notitle', 'clouds', 'sewer', 'shop', 'debug', 'collision', 'ship', 'ending', 'cutscene'].some((k) => params.has(k));
  return !skip && !testing && !dev;
}

export class TitleScreen {
  // start: high over the city under the logo; down: the camera on its way to Webster; go: SKATE is up
  private step: 'start' | 'down' | 'go' | 'gone' = 'start';
  private readonly startBtn: HTMLElement;
  private readonly goBtn: HTMLElement;

  constructor(
    private readonly el: HTMLElement,
    private readonly hooks: TitleHooks,
    best: number,
  ) {
    this.startBtn = el.querySelector('.start')!;
    this.goBtn = el.querySelector('.go')!;
    el.querySelector('.best')!.textContent = best > 0 ? `BEST ${best.toLocaleString('en-US')}` : '';
    //the one button listens on the whole game: the title keeps its presses, so none of them ollie
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const t = e.target instanceof Element ? e.target : null;
      this.press(!!t?.closest('.go'));
    });
    el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    window.addEventListener('keydown', this.key, { capture: true });
  }

  show(): void {
    document.getElementById('app')!.classList.add('titled');
    this.el.hidden = false;
    //no music to start: straight down to Webster
    if (!this.hooks.music()) this.descend();
  }

  // Space, Enter or Up: the same as a tap
  private key = (e: KeyboardEvent): void => {
    if (this.step === 'gone' || !['Space', 'Enter', 'ArrowUp'].includes(e.code)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) this.press(true);
  };

  private press(onGo: boolean): void {
    if (this.step === 'start') {
      this.hooks.wake();
      this.descend();
    } else if (this.step === 'down') this.hooks.down(); // skip to Webster
    else if (this.step === 'go' && onGo) this.leave();
  }

  // the music's in: the logo kicks and lifts away, the camera starts down
  private descend(): void {
    this.step = 'down';
    this.startBtn.hidden = true;
    this.el.classList.add('live', 'flying');
    this.hooks.down();
  }

  // the camera's down at Webster (the title scene says): the logo comes back and SKATE comes up
  arrived(): void {
    if (this.step !== 'down') return;
    this.step = 'go';
    this.goBtn.hidden = false;
    this.el.classList.remove('flying');
    this.el.classList.add('landed');
  }

  private leave(): void {
    this.step = 'gone';
    window.removeEventListener('keydown', this.key, { capture: true });
    document.getElementById('app')!.classList.remove('titled');
    this.el.classList.add('leaving');
    this.hooks.go();
    window.setTimeout(() => this.el.remove(), 350);
  }
}
