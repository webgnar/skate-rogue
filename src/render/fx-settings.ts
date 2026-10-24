// Effect settings: a quality tier for older phones and two accessibility switches. One shared object the
// effects read each frame. Saved in browser storage, and set from the URL until the game has a settings menu:
//   ?fx=low | ?fx=high   force a tier (auto by default: the view drops to low when frames stay slow)
//   ?calm                reduce motion and reduce flashing
//   ?nomotion ?noflash   either one alone
//   ?heatcue             a striped edge that shows Heat without relying on red and blue
// Add =0 to turn one back off (?calm=0). The device's "reduce motion" setting turns reduce motion on.
const KEY = 'gnar-run-fx';

export type Tier = 'high' | 'low';

export interface FxSettings {
  quality: 'auto' | Tier;
  reduceMotion: boolean; // no camera punch or shake, focus lines, hit-stop or speed lines
  reduceFlashing: boolean; // no impact flash or lightning; police flares glow steady
  heatCue: boolean;
}

export const FX: FxSettings & { tier: Tier } = {
  quality: 'auto',
  reduceMotion: false,
  reduceFlashing: false,
  heatCue: false,
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
  if (['fx', 'calm', 'nomotion', 'noflash', 'heatcue'].some((k) => params.has(k))) {
    try {
      const { quality, reduceMotion, reduceFlashing, heatCue } = FX;
      localStorage.setItem(KEY, JSON.stringify({ quality, reduceMotion, reduceFlashing, heatCue }));
    } catch {
      //not remembered in a private window
    }
  }
}

function defaults(prefersReducedMotion: boolean): FxSettings {
  return { quality: 'auto', reduceMotion: prefersReducedMotion, reduceFlashing: false, heatCue: false };
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
  return out;
}
