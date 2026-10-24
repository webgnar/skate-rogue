// The game's own settings (GDD: Pause has settings): sound, music and vibration. The effect settings (quality,
// reduce motion, reduce flashing, the Heat cue) are in src/render/fx-settings.ts; the pause card edits both.
// Saved in browser storage, guarded like the save.
const KEY = 'gnar-run-settings';

export interface Settings {
  sound: number; // effects volume, 0-1
  music: number; // 0-1
  haptics: boolean;
}

export const SETTINGS: Settings = { sound: 1, music: 0.7, haptics: true };

const unit = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);

export function loadSettings(): void {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    SETTINGS.sound = unit(s.sound, SETTINGS.sound);
    SETTINGS.music = unit(s.music, SETTINGS.music);
    if (typeof s.haptics === 'boolean') SETTINGS.haptics = s.haptics;
  } catch {
    //blocked storage: defaults
  }
}

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(SETTINGS));
  } catch {
    //not remembered in a private window
  }
}

// a vibration, if the phone has one and it's switched on (Android; iOS web has no vibration API)
export function buzz(pattern: number | number[]): void {
  if (SETTINGS.haptics) navigator.vibrate?.(pattern);
}
