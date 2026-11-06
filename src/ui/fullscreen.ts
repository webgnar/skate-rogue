// Full screen on phones. Where the browser has the Fullscreen API (Android Chrome, iPad Safari, desktop) the pause
// card's FULL SCREEN switch turns it on and the game goes back into it on the next tap after leaving. iPhone Safari
// has no Fullscreen API for pages, so there the switch explains Add to Home Screen: launched from the home screen
// icon it runs as an app with no browser bars (public/manifest.webmanifest and the apple- meta tags in index.html).
import { SETTINGS, saveSettings } from './settings';
import { ON_CRAZYGAMES } from '../net/portal';

type WebkitDoc = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type WebkitEl = HTMLElement & { webkitRequestFullscreen?: () => void };

const doc = document as WebkitDoc;

// the page can go full screen itself
// never on the portal: CrazyGames runs its own full screen and forbids a game's own button
export const canFullscreen = (): boolean => !ON_CRAZYGAMES && !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);

export const isFull = (): boolean => !!(doc.fullscreenElement || doc.webkitFullscreenElement);

// opened from the home screen icon, already without browser bars. A page put in full screen by the switch also
// matches display-mode: fullscreen, so that case doesn't count, or the switch would hide itself and strand the player.
export const isApp = (): boolean =>
  !isFull() &&
  (matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

// an iPhone or iPod (iPads report themselves as Macs with touch, and have the API)
export const isIPhone = (): boolean => /iPhone|iPod/.test(navigator.userAgent);

export function enterFullscreen(): void {
  if (isFull() || !canFullscreen()) return;
  const el = document.documentElement as WebkitEl;
  const done = () => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {});
  if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(done, () => {});
  else el.webkitRequestFullscreen?.();
}

export function exitFullscreen(): void {
  if (!isFull()) return;
  if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
  else doc.webkitExitFullscreen?.();
}

export function setFullscreen(on: boolean): void {
  SETTINGS.fullscreen = on;
  saveSettings();
  if (on) enterFullscreen();
  else exitFullscreen();
}

// with the switch on, a tap that ends outside full screen (a fresh load, or after the phone's back gesture) goes back
// in. Browsers only allow it inside a tap, and on touch that's the finger lifting, not landing.
export function watchFullscreen(changed: () => void): void {
  window.addEventListener(
    'pointerup',
    () => {
      if (SETTINGS.fullscreen && !isApp()) enterFullscreen();
    },
    { capture: true },
  );
  // on a computer, leaving full screen with Esc turns the switch off too, so the next click doesn't pull the game back
  // in. Phones keep it on: there leaving is usually the back gesture, and going back in on the next tap is the point.
  const left = () => {
    if (!isFull() && SETTINGS.fullscreen && !matchMedia('(pointer: coarse)').matches) {
      SETTINGS.fullscreen = false;
      saveSettings();
    }
    changed();
  };
  document.addEventListener('fullscreenchange', left);
  document.addEventListener('webkitfullscreenchange', left);
}
