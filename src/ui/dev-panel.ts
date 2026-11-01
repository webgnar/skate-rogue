// The pause card's DEV TOOLS (zack, 2026-10-25: debug switches you can reach on a phone, no URL flags): the collision
// overlay, the fps line, slow motion, the momentum rule and the autopilot apply at once; a floor jump, unlock-all and
// the MODELS switch (the old skaters or the Meshy rebuilds) reload into a new run. Plus the SLOW / STEP bar over the
// game while the overlay is on or time is slowed.
import { MOMENTUM, MOMENTUM_MODES } from '../physics/feel';
import type { PilotStyle } from '../bot/pilot';
import { DEV, devSpeed, saveDev, slower, stepFrame } from './dev';

const PILOTS: (PilotStyle | null)[] = [null, 'ref', 'mash', 'high'];

export interface DevHooks {
  collision(on: boolean): void;
  fps(on: boolean): void;
  pilot(): PilotStyle | null;
  setPilot(style: PilotStyle | null): void;
  // where a floor jump can go, and the one this run started at
  targets: string[]; // 'floor 4', 'escape 2'
  start: number; // index into targets
  jump(target: number): void; // reloads
  unlockAll: boolean;
  setUnlockAll(on: boolean): void; // reloads
  reset(): void; // wipes the saved progress, reloads as a fresh player
  meshy: boolean; // the NEW (Meshy) skater models are on (src/ui/dev.ts meshyModels)
  reload(): void; // reloads with the MODELS switch flipped
}

export class DevPanel {
  private readonly body: HTMLElement;
  private readonly bar = document.createElement('div');
  private target: number;
  private confirmReset = 0; // when the first tap on RESET PROGRESS was; a second tap within 4 s wipes

  constructor(
    head: HTMLElement,
    private readonly hooks: DevHooks,
  ) {
    this.target = hooks.start;
    head.insertAdjacentHTML(
      'afterend',
      `<div class="settings dev" hidden>
        <button class="row" data-dev="collision"><span>COLLISION</span><b></b></button>
        <button class="row" data-dev="fps"><span>FPS + PERF</span><b></b></button>
        <button class="row" data-dev="speed"><span>GAME SPEED</span><b></b></button>
        <button class="row" data-dev="momentum"><span>MOMENTUM</span><b></b></button>
        <button class="row" data-dev="pilot"><span>AUTOPILOT</span><b></b></button>
        <button class="row" data-dev="models"><span>MODELS</span><b></b></button>
        <button class="row" data-dev="unlock"><span>UNLOCK ALL</span><b></b></button>
        <button class="row reset" data-dev="reset"><span>RESET PROGRESS</span><b></b></button>
        <div class="row jump"><span>JUMP</span><button data-dev="prev">◀</button><b></b><button data-dev="next">▶</button><button data-dev="go">GO</button></div>
      </div>`,
    );
    this.body = head.nextElementSibling as HTMLElement;
    //the card's taps never reach the one button
    for (const el of [head, this.body, this.bar]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
    head.addEventListener('click', () => {
      this.body.hidden = !this.body.hidden;
      this.render();
    });
    this.body.addEventListener('click', (e) => {
      const key = (e.target as Element).closest<HTMLElement>('[data-dev]')?.dataset.dev;
      const n = hooks.targets.length;
      if (key === 'collision') hooks.collision(!DEV.collision);
      else if (key === 'fps') hooks.fps((DEV.fps = !DEV.fps));
      else if (key === 'speed') slower(1);
      else if (key === 'momentum') MOMENTUM.mode = MOMENTUM_MODES[(MOMENTUM_MODES.indexOf(MOMENTUM.mode) + 1) % MOMENTUM_MODES.length];
      else if (key === 'pilot') hooks.setPilot(PILOTS[(PILOTS.indexOf(hooks.pilot()) + 1) % PILOTS.length]);
      else if (key === 'unlock') hooks.setUnlockAll(!hooks.unlockAll);
      else if (key === 'models') {
        //the skater loads once, at the start: switch and reload
        DEV.meshy = !hooks.meshy;
        saveDev();
        return hooks.reload();
      }
      else if (key === 'prev') this.target = (this.target + n - 1) % n;
      else if (key === 'next') this.target = (this.target + 1) % n;
      else if (key === 'go') hooks.jump(this.target);
      else if (key === 'reset') {
        //two taps: the first asks, the second (within 4 s) wipes and reloads
        if (performance.now() - this.confirmReset < 4000) return hooks.reset();
        this.confirmReset = performance.now();
        setTimeout(() => this.render(), 4000);
      } else return;
      saveDev();
      this.render();
    });
    //over the game: slow motion and one frame at a time, for a thumb
    this.bar.className = 'devbar';
    this.bar.innerHTML = '<button data-c="slow">SLOW</button><button data-c="step">STEP</button>';
    this.bar.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const c = (e.target as HTMLElement).closest<HTMLElement>('[data-c]')?.dataset.c;
      if (c === 'slow') slower(1);
      else if (c === 'step') stepFrame();
      this.render();
    });
    document.getElementById('app')!.append(this.bar);
    this.render();
  }

  render(): void {
    const set = (key: string, text: string, on: boolean) => {
      const b = this.body.querySelector<HTMLElement>(`[data-dev="${key}"]`)!;
      b.classList.toggle('on', on);
      b.querySelector('b')!.textContent = text;
    };
    const onOff = (key: string, on: boolean) => set(key, on ? 'ON' : 'OFF', on);
    onOff('collision', DEV.collision);
    onOff('fps', DEV.fps);
    const speed = devSpeed();
    set('speed', speed === 0 ? 'FROZEN' : `${speed}×`, speed !== 1);
    set('momentum', MOMENTUM.mode.toUpperCase(), MOMENTUM.mode !== 'real');
    const pilot = this.hooks.pilot();
    set('pilot', pilot ? pilot.toUpperCase() : 'OFF', !!pilot);
    onOff('unlock', this.hooks.unlockAll);
    set('models', this.hooks.meshy ? 'NEW' : 'OLD', this.hooks.meshy);
    const asking = performance.now() - this.confirmReset < 4000;
    set('reset', asking ? 'TAP AGAIN' : 'WIPE', asking);
    this.body.querySelector('.jump b')!.textContent = this.hooks.targets[this.target].toUpperCase();
    this.bar.hidden = !DEV.collision && speed === 1;
    const slow = this.bar.querySelector<HTMLElement>('[data-c="slow"]')!;
    slow.textContent = speed === 1 ? 'SLOW' : speed === 0 ? 'FROZEN' : `${speed}×`;
  }
}
