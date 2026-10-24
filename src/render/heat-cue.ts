// A Heat cue that doesn't rely on red and blue: diagonal hazard stripes along the screen edges that thicken as
// Heat climbs and breathe slowly (about once a second, never a flash). A DOM overlay, so it costs no draw calls.
// On only when the player turns it on (?heatcue).
import { FX } from './fx-settings';

const FROM = 25; // Heat where the stripes start, same as the police light
const BREATH = 1.1; // seconds per breath

export class HeatCue {
  private readonly el: HTMLDivElement;
  private t = 0;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'heat-cue';
    this.el.setAttribute('aria-hidden', 'true');
    parent.appendChild(this.el);
  }

  // heat 0..100; dt in real seconds
  update(heat: number, dt: number): void {
    const k = FX.heatCue ? Math.min(1, Math.max(0, (heat - FROM) / (100 - FROM))) : 0;
    this.el.style.display = k > 0 ? '' : 'none';
    if (k <= 0) return;
    this.t += dt;
    const breath = 0.8 + 0.2 * Math.sin((this.t / BREATH) * Math.PI * 2);
    this.el.style.setProperty('--edge', `${Math.round(6 + 18 * k)}px`);
    this.el.style.opacity = (0.35 + 0.55 * k * breath).toFixed(2);
  }
}
