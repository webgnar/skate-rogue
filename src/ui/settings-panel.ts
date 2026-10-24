// The settings on the pause card (GDD: UI, Pause): sound and music volume, vibration, the effects quality, the
// chunky pixel look and the three accessibility switches. Each change applies at once and is saved.
import { FX, PIXEL_MAX, saveFx, type FxSettings } from '../render/fx-settings';
import { SETTINGS, saveSettings, buzz } from './settings';

type Toggle = 'haptics' | 'reduceMotion' | 'reduceFlashing' | 'heatCue';

const QUALITY: FxSettings['quality'][] = ['auto', 'high', 'low'];

export interface SettingsHooks {
  volumes(): void; // the sound's gains
  tier(tier: 'high' | 'low'): void; // the view's effects tier
  look(): void; // the classes the CSS reads (calm, noflash)
  pixel(): void; // the view's render resolution, for the chunky look
}

export class SettingsPanel {
  constructor(
    private readonly el: HTMLElement,
    private readonly hooks: SettingsHooks,
  ) {
    el.innerHTML = `
      <label class="row"><span>SOUND</span><input type="range" min="0" max="100" step="5" data-vol="sound"></label>
      <label class="row"><span>MUSIC</span><input type="range" min="0" max="100" step="5" data-vol="music"></label>
      <button class="row" data-toggle="haptics"><span>VIBRATION</span><b></b></button>
      <button class="row" data-quality><span>EFFECTS</span><b></b></button>
      <label class="row"><span>PIXELS</span><input type="range" min="1" max="${PIXEL_MAX}" step="1" data-pixel><b></b></label>
      <button class="row" data-toggle="reduceMotion"><span>REDUCE MOTION</span><b></b></button>
      <button class="row" data-toggle="reduceFlashing"><span>REDUCE FLASHING</span><b></b></button>
      <button class="row" data-toggle="heatCue"><span>HEAT STRIPES</span><b></b></button>`;
    //the card's taps never reach the one button (a slider still needs its default drag)
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.dataset.pixel !== undefined) {
        FX.pixel = Number(t.value);
        saveFx();
        this.hooks.pixel();
        this.render();
        return;
      }
      const key = t.dataset.vol as 'sound' | 'music' | undefined;
      if (!key) return;
      SETTINGS[key] = Number(t.value) / 100;
      saveSettings();
      this.hooks.volumes();
    });
    el.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('button');
      if (!b) return;
      const key = b.dataset.toggle as Toggle | undefined;
      if (key === 'haptics') {
        SETTINGS.haptics = !SETTINGS.haptics;
        saveSettings();
        buzz(30);
      } else if (key) {
        FX[key] = !FX[key];
        saveFx();
        this.hooks.look();
      } else if (b.dataset.quality !== undefined) {
        FX.quality = QUALITY[(QUALITY.indexOf(FX.quality) + 1) % QUALITY.length];
        saveFx();
        if (FX.quality !== 'auto') this.hooks.tier(FX.quality);
      }
      this.render();
    });
    this.render();
  }

  render(): void {
    for (const r of this.el.querySelectorAll<HTMLInputElement>('[data-vol]')) r.value = String(Math.round(SETTINGS[r.dataset.vol as 'sound' | 'music'] * 100));
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-toggle]')) {
      const key = b.dataset.toggle as Toggle;
      const on = key === 'haptics' ? SETTINGS.haptics : FX[key];
      b.classList.toggle('on', on);
      b.querySelector('b')!.textContent = on ? 'ON' : 'OFF';
    }
    this.el.querySelector('[data-quality] b')!.textContent = FX.quality.toUpperCase();
    const px = this.el.querySelector<HTMLInputElement>('[data-pixel]')!;
    px.value = String(FX.pixel);
    px.parentElement!.querySelector('b')!.textContent = FX.pixel === 1 ? 'SHARP' : `${FX.pixel}X`;
  }
}
