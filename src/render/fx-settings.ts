// Effect settings: a quality tier for older phones and two accessibility switches. One shared object the
// effects read each frame. Saved in browser storage, and set from the pause card's settings or the URL:
//   ?fx=low | ?fx=high   force a tier (auto by default: the view drops to low when frames stay slow)
//   ?calm                reduce motion and reduce flashing
//   ?nomotion ?noflash   either one alone
//   ?heatcue             a striped edge that shows Heat without relying on red and blue
//   ?pixel=4             the chunky low-res look: each rendered pixel covers 4 x 4 screen pixels (1: sharp)
//   ?ghost=yellow        the colour of Lou's dithered shape where the foreground hides him (pink by default)
//   ?fliplines=swoosh    the comic lines round a flipping board: ink (default), swoosh, or pixels (the old trail)
// Add =0 to turn one back off (?calm=0). The device's "reduce motion" setting turns reduce motion on.
import { FLIP_LINE_STYLES, type FlipLineStyle } from './flip-lines';

const KEY = 'gnar-run-fx';

export type Tier = 'high' | 'low';

export interface FxSettings {
  quality: 'auto' | Tier;
  reduceMotion: boolean; // no camera punch or shake, focus lines, hit-stop or speed lines
  reduceFlashing: boolean; // no impact flash or lightning; police flares glow steady
  heatCue: boolean;
  pixel: number; // the low-res look: screen pixels per rendered pixel, 1 (sharp) to PIXEL_MAX
  ghost: Ghost; // Lou's dithered shape through the foreground (ghost.ts)
  flipLines: FlipLineStyle; // the comic lines round a flipping board (flip-lines.ts)
}

export type Ghost = 'pink' | 'yellow';
export const GHOSTS: Ghost[] = ['pink', 'yellow'];

export const PIXEL_MAX = 4; // past 4 the one-pixel ink swallows the skater

export const FX: FxSettings & { tier: Tier } = {
  quality: 'auto',
  reduceMotion: false,
  reduceFlashing: false,
  heatCue: false,
  pixel: 1,
  ghost: 'pink',
  flipLines: 'ink',
  tier: 'high',
};

// saved settings, then the device's preference, then the URL; URL changes are saved
export function initFx(params: URLSearchParams, prefersReducedMotion = false): void {
  let saved: Partial<FxSettings> = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<FxSettings>;
  } catch {
    //blocked storage: defaults
  }
  Object.assign(FX, applyParams({ ...defaults(prefersReducedMotion), ...saved }, params));
  FX.tier = FX.quality === 'low' ? 'low' : 'high';
  if (['fx', 'calm', 'nomotion', 'noflash', 'heatcue', 'pixel', 'ghost', 'fliplines'].some((k) => params.has(k))) saveFx();
}

// remember the settings (the URL flags, or the pause card)
export function saveFx(): void {
  try {
    const { quality, reduceMotion, reduceFlashing, heatCue, pixel, ghost, flipLines } = FX;
    localStorage.setItem(KEY, JSON.stringify({ quality, reduceMotion, reduceFlashing, heatCue, pixel, ghost, flipLines }));
  } catch {
    //not remembered in a private window
  }
}

function defaults(prefersReducedMotion: boolean): FxSettings {
  return { quality: 'auto', reduceMotion: prefersReducedMotion, reduceFlashing: false, heatCue: false, pixel: 1, ghost: 'pink', flipLines: 'ink' };
}

export function applyParams(s: FxSettings, params: URLSearchParams): FxSettings {
  const on = (k: string) => params.get(k) !== '0';
  const out = { ...s };
  const q = params.get('fx');
  if (q === 'low' || q === 'high' || q === 'auto') out.quality = q;
  if (params.has('calm')) out.reduceMotion = out.reduceFlashing = on('calm');
  if (params.has('nomotion')) out.reduceMotion = on('nomotion');
  if (params.has('noflash')) out.reduceFlashing = on('noflash');
  if (params.has('heatcue')) out.heatCue = on('heatcue');
  if (params.has('pixel')) out.pixel = Number(params.get('pixel')) || 1;
  out.pixel = clampPixel(out.pixel);
  const g = params.get('ghost');
  if (g && (GHOSTS as string[]).includes(g)) out.ghost = g as Ghost;
  if (!GHOSTS.includes(out.ghost)) out.ghost = 'pink';
  const fl = params.get('fliplines');
  if (fl && (FLIP_LINE_STYLES as string[]).includes(fl)) out.flipLines = fl as FlipLineStyle;
  if (!FLIP_LINE_STYLES.includes(out.flipLines)) out.flipLines = 'ink';
  return out;
}

// a whole number from 1 to PIXEL_MAX (bad saved values and URL junk come back sharp)
export function clampPixel(n: unknown): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(PIXEL_MAX, Math.max(1, v)) : 1;
}
