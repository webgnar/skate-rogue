// The game's own settings (GDD: Pause has settings): sound, music, vibration, full screen, gyro tilt and the camera's
// close-ups and zoom. The effect settings (quality, reduce motion, reduce flashing, the Heat cue) are in
// src/render/fx-settings.ts; the pause card edits both.
// Saved in browser storage, guarded like the save.
import { clampUserZoom } from '../render/camera';

const KEY = 'gnar-run-settings';
// bumped when the default mix changes: volumes saved under an older mix are dropped once for the new defaults
const MIX = 2;

export interface Settings {
  sound: number; // effects volume, 0-1
  music: number; // 0-1
  haptics: boolean;
  fullscreen: boolean; // src/ui/fullscreen.ts
  tilt: boolean; // gyro tilt, src/render/tilt.ts (off until the pause card's switch gets motion permission)
  closeUp: boolean; // the camera rushing in on grinds and combo flips (camera.ts CloseUp; reduce motion skips it too)
  zoom: number; // the player's own camera zoom, from pinching the street (camera.ts USER_ZOOM)
}

// full screen starts on for touch screens, where the browser bars eat the most of the view
export const SETTINGS: Settings = { sound: 0.25, music: 0.75, haptics: true, fullscreen: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches, tilt: false, closeUp: true, zoom: 1 };

const unit = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);

export function loadSettings(): void {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings> & { mix?: number };
    if (s.mix === MIX) {
      SETTINGS.sound = unit(s.sound, SETTINGS.sound);
      SETTINGS.music = unit(s.music, SETTINGS.music);
    }
    if (typeof s.haptics === 'boolean') SETTINGS.haptics = s.haptics;
    if (typeof s.fullscreen === 'boolean') SETTINGS.fullscreen = s.fullscreen;
    if (typeof s.tilt === 'boolean') SETTINGS.tilt = s.tilt;
    if (typeof s.closeUp === 'boolean') SETTINGS.closeUp = s.closeUp;
    if (typeof s.zoom === 'number') SETTINGS.zoom = clampUserZoom(s.zoom);
  } catch {
    //blocked storage: defaults
  }
}

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...SETTINGS, mix: MIX }));
  } catch {
    //not remembered in a private window
  }
}

// a vibration, if the phone has one and it's switched on (Android; iOS web has no vibration API)
export function buzz(pattern: number | number[]): void {
  if (SETTINGS.haptics) navigator.vibrate?.(pattern);
}
