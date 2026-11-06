// The web portal build (npm run build:crazygames, docs/CRAZYGAMES.md). The same game, built with VITE_PORTAL=crazygames,
// talks to the CrazyGames HTML5 SDK v3: it reports loading and every stretch of play (gameplayStart / gameplayStop),
// celebrates a new best or an escape (happytime), honours the site's mute, and keeps the save in their Data module
// so progress follows a signed-in player. Anywhere else (Vercel, npm run dev) every call here is a no-op.
//
// ADS ARE PAUSED (zack, 2026-10-31). breakAd and rewardAd are wired so the call sites exist, but ADS_ENABLED is false
// and both resolve at once without asking the SDK. CrazyGames' Basic Launch forbids ads anyway; turning them on is
// zack's call at Full Launch.
export const ON_CRAZYGAMES = import.meta.env.VITE_PORTAL === 'crazygames';
export const ADS_ENABLED = false;

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

type Settings = { muteAudio?: boolean; disableChat?: boolean };
type AdCallbacks = { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void };
type CrazySdk = {
  init(): Promise<void>;
  environment: 'local' | 'crazygames' | 'disabled';
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
    happytime(): void;
    settings: Settings;
    addSettingsChangeListener(fn: (s: Settings) => void): void;
  };
  ad: { requestAd(kind: 'midgame' | 'rewarded', cb: AdCallbacks): void };
  data: { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };
};

let sdk: CrazySdk | null = null;
let playing = false;

// the site's mute switch: true silences the game whatever its own volume settings say (Sound.applyVolumes reads it)
export let portalMuted = false;
let onMute: (() => void) | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.append(s);
  });
}

// before anything reads the save (src/entry.ts awaits it): loads and starts the SDK. Off the portal, or if the SDK
// can't load or reports the 'disabled' environment, the game carries on without it.
export async function initPortal(): Promise<void> {
  if (!ON_CRAZYGAMES) return;
  try {
    await loadScript(SDK_URL);
    const cg = (window as unknown as { CrazyGames?: { SDK: CrazySdk } }).CrazyGames?.SDK;
    if (!cg) return;
    await cg.init();
    if (cg.environment === 'disabled') return;
    sdk = cg;
    portalMuted = !!cg.game.settings?.muteAudio;
    cg.game.addSettingsChangeListener((s) => {
      portalMuted = !!s.muteAudio;
      onMute?.();
    });
    cg.game.loadingStart();
  } catch (err) {
    console.warn('CrazyGames SDK unavailable, playing without it', err);
    sdk = null;
  }
}

// the game's sound re-applies its volumes when the site's mute changes
export function watchPortalMute(fn: () => void): void {
  onMute = fn;
}

export function loadingDone(): void {
  try {
    sdk?.game.loadingStop();
  } catch {
    //ignored: reporting must never stop the game
  }
}

// called every frame with whether the player is skating (not on the title, a menu, the shop, a pick or the pause
// card); only a change is reported, as CrazyGames asks
export function setPlaying(now: boolean): void {
  if (!sdk || now === playing) return;
  playing = now;
  try {
    if (now) sdk.game.gameplayStart();
    else sdk.game.gameplayStop();
  } catch {
    //ignored
  }
}

// a big moment only (an escape, a new best score), so the site's celebration stays special
export function happyTime(): void {
  try {
    sdk?.game.happytime();
  } catch {
    //ignored
  }
}

function requestAd(kind: 'midgame' | 'rewarded', mute: (on: boolean) => void): Promise<boolean> {
  const cg = sdk;
  if (!ADS_ENABLED || !cg) return Promise.resolve(false);
  return new Promise((resolve) => {
    cg.ad.requestAd(kind, {
      adStarted: () => mute(true),
      adFinished: () => {
        mute(false);
        resolve(true);
      },
      adError: () => {
        mute(false);
        resolve(false);
      },
    });
  });
}

// between runs (the game over card). A no-op while ads are paused.
export const breakAd = (mute: (on: boolean) => void = () => {}): Promise<boolean> => requestAd('midgame', mute);
// a watched-for reward; resolves true only if the ad played to the end. A no-op while ads are paused.
export const rewardAd = (mute: (on: boolean) => void = () => {}): Promise<boolean> => requestAd('rewarded', mute);

// The saves: on the portal, the Data module first (it follows a signed-in player between devices; it needs Progress
// Save ticked at submission) with localStorage kept in step as the fallback. Everywhere else, just localStorage.
// Every call can throw (a private window, blocked storage), as localStorage's can, so callers keep their try/catch.
export const store = {
  getItem(key: string): string | null {
    if (sdk) {
      try {
        const v = sdk.data.getItem(key);
        if (v !== null && v !== undefined) return v;
      } catch {
        //fall back to this browser's copy
      }
    }
    return localStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    if (sdk) {
      try {
        sdk.data.setItem(key, value);
      } catch {
        //kept locally below
      }
    }
    localStorage.setItem(key, value);
  },
  removeItem(key: string): void {
    if (sdk) {
      try {
        sdk.data.removeItem(key);
      } catch {
        //removed locally below
      }
    }
    localStorage.removeItem(key);
  },
};
