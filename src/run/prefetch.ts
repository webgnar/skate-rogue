// The next floor, built ahead of time so a run flows from floor to floor with no stop (src/game/game.ts). Floors
// come from a worker (src/run/floor-worker.ts) while you skate; where there's no worker (tests, the bot's node
// runs) they're built on the spot. Same spec, same floor: floorLevel is pure.
import { CurvedRail, type Level } from '../physics/level';
import { floorLevel, type FloorSpec } from './floor-level';

export function specKey(s: FloorSpec): string {
  return JSON.stringify([s.seed, s.floor, s.road, s.library, s.gnar, !!s.tutorial]);
}

// a level that came through postMessage lost its classes: give its rails theirs back
function revive(level: Level): Level {
  for (const r of level.rails) Object.setPrototypeOf(r, CurvedRail.prototype);
  return level;
}

export class FloorPrefetch {
  private readonly done = new Map<string, Level>();
  private readonly waiting = new Map<number, string>();
  private readonly asked = new Set<string>();
  private worker: Worker | null = null;
  private id = 0;
  onReady: ((key: string, level: Level) => void) | null = null; // a floor came back from the worker

  constructor(useWorker = typeof Worker !== 'undefined') {
    if (!useWorker) return;
    try {
      this.worker = new Worker(new URL('./floor-worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<{ id: number; level?: Level; error?: string }>) => {
        const key = this.waiting.get(e.data.id);
        this.waiting.delete(e.data.id);
        if (key === undefined || !this.asked.has(key)) return;
        if (!e.data.level) {
          console.warn('floor worker failed, building on the main thread', e.data.error);
          return;
        }
        const level = revive(e.data.level);
        this.done.set(key, level);
        this.onReady?.(key, level);
      };
      this.worker.onerror = (err) => {
        console.warn('floor worker failed, building floors on the main thread', err);
        this.worker = null;
      };
    } catch {
      this.worker = null;
    }
  }

  // start building a floor (a no-op if it's built or on its way)
  want(spec: FloorSpec): string {
    const key = specKey(spec);
    if (this.asked.has(key)) return key;
    this.asked.add(key);
    if (this.worker) {
      const id = ++this.id;
      this.waiting.set(id, key);
      this.worker.postMessage({ id, spec });
    }
    return key;
  }

  ready(spec: FloorSpec): Level | null {
    return this.done.get(specKey(spec)) ?? null;
  }

  // the floor now: from the worker if it's back, otherwise built here (a hitch, but never a wrong floor)
  get(spec: FloorSpec): Level {
    const key = specKey(spec);
    let level = this.done.get(key);
    if (!level) {
      level = floorLevel(spec);
      this.asked.add(key);
      this.done.set(key, level);
    }
    return level;
  }

  // forget everything but the floors still wanted (a new floor began, or a new run)
  keep(specs: FloorSpec[]): void {
    const keys = new Set(specs.map(specKey));
    for (const k of [...this.done.keys()]) if (!keys.has(k)) this.done.delete(k);
    for (const k of [...this.asked]) if (!keys.has(k)) this.asked.delete(k);
  }
}
