// Dev tools (the pause card's DEV TOOLS, src/ui/dev-panel.ts): the collision overlay, the fps line, slow motion and
// frame stepping, and the momentum rule. The switches are saved in browser storage like the settings; the game
// speed isn't, so a reload never comes back frozen.
import { MOMENTUM, MOMENTUM_MODES, type MomentumMode } from '../physics/feel';

const KEY = 'gnar-run-dev';

export const SPEEDS = [1, 0.5, 0.25, 0.1, 0]; // the slow-motion steps; 0 freezes (STEP runs one frame)

export const DEV = {
  collision: false, // the collision overlay (src/render/collision-debug.ts)
  fps: false, // the fps / draws / triangles line
  speed: 0, // index into SPEEDS
  full: false, // the overlay's full readout (tap it), else one line
  // MODELS: the skaters rebuilt from zack's Meshy models (NEW) or the old ones. zack (2026-11-02): OLD is the default,
  // always: NEW lasts only for this tab (session storage), so a fresh visit or a relaunch from the home screen is back
  // on OLD, and an older saved NEW is ignored. ?models=new or ?models=old wins.
  meshy: false,
};
const MESHY_KEY = 'gnarrun.meshy';

// the skater models to load: the URL's ?models=new / ?models=old, else the DEV TOOLS switch
export function meshyModels(params: URLSearchParams): boolean {
  const m = params.get('models');
  return m === 'new' ? true : m === 'old' ? false : DEV.meshy;
}

let stepAsk = false;

export function devSpeed(): number {
  return SPEEDS[DEV.speed];
}

// step through the speeds (wrapping round): 1x, 0.5x, 0.25x, 0.1x, frozen
export function slower(by: number): void {
  DEV.speed = (DEV.speed + by + SPEEDS.length) % SPEEDS.length;
}

// frozen: one physics step; running: freeze
export function stepFrame(): void {
  if (devSpeed() !== 0) DEV.speed = SPEEDS.length - 1;
  else stepAsk = true;
}

// the game asks once per frame while frozen: whether to run one step
export function takeStep(): boolean {
  const ask = stepAsk;
  stepAsk = false;
  return ask;
}

export function loadDev(): void {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { collision?: unknown; fps?: unknown; full?: unknown; momentum?: unknown; meshy?: unknown };
    DEV.collision = d.collision === true;
    DEV.fps = d.fps === true;
    DEV.full = d.full === true;
    DEV.meshy = d.meshy === true;
    if (MOMENTUM_MODES.includes(d.momentum as MomentumMode)) MOMENTUM.mode = d.momentum as MomentumMode;
  } catch {
    //blocked storage: all off
  }
  try {
    DEV.meshy = sessionStorage.getItem(MESHY_KEY) === '1';
  } catch {
    DEV.meshy = false;
  }
}

export function saveDev(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ collision: DEV.collision, fps: DEV.fps, full: DEV.full, momentum: MOMENTUM.mode, meshy: DEV.meshy }));
  } catch {
    //not remembered in a private window
  }
  try {
    if (DEV.meshy) sessionStorage.setItem(MESHY_KEY, '1');
    else sessionStorage.removeItem(MESHY_KEY);
  } catch {
    //no storage: the switch can't carry over the reload, so it stays OLD
  }
}
