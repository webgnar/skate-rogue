// What the game sounds like (GDD: Immersion, sound first). Pure: which sound each sim event makes, and how the
// loops sit under the skating. src/audio/sound.ts plays them. The samples are Lou Gnar's (excaliburSkate's
// public/sounds, as mp3 so every phone decodes them); a few are pitched to make more than one sound, and the
// roll and the siren are synthesized. Logged overnight (2026-10-24).
import type { FloorEvent } from '../sim/floor';

export type SampleId = 'ollie' | 'trick' | 'impact' | 'grind' | 'coin' | 'game_over' | 'game_start' | 'ufo_explode';
export type MusicId = 'gameplay' | 'title';

// The soundtrack: drop mp3s in public/music/ and list their names (no .mp3) here. Each slot plays its list in
// order and loops back to the first; a slot with one track loops it; an empty slot is silence. 'title' plays on
// the run summary, 'gameplay' while skating.
export const MUSIC: Record<MusicId, string[]> = {
  gameplay: [],
  title: [],
};

export const SAMPLES: SampleId[] = ['ollie', 'trick', 'impact', 'grind', 'coin', 'game_over', 'game_start', 'ufo_explode'];

export interface Cue {
  sample: SampleId;
  vol: number; // 0-1, before the master volume
  rate?: number; // playback rate: above 1 is higher and shorter
}

// the volumes Lou Gnar used, as the starting point
const VOL: Record<SampleId, number> = {
  ollie: 0.8,
  trick: 0.4,
  impact: 0.9,
  grind: 0.5,
  coin: 0.6,
  game_over: 0.8,
  game_start: 1,
  ufo_explode: 1,
};

const cue = (sample: SampleId, scale = 1, rate = 1): Cue => ({ sample, vol: VOL[sample] * scale, rate });

// the sound a sim event makes, if any (grinds are the loop, below)
export function cueFor(e: FloorEvent): Cue | null {
  switch (e.type) {
    case 'ollie':
      return cue('ollie', e.lip ? 1 : 0.85);
    case 'trick':
      return cue('trick');
    case 'land': {
      //harder landings are louder, like Lou Gnar's 0.3-1.0 by fall speed; a sketchy one rattles higher
      const hit = Math.min(1, Math.max(0.3, (e.impact ?? 3) / 10));
      return cue('impact', hit, e.quality === 'sketchy' ? 1.25 : 1);
    }
    case 'slam':
      return cue('impact', 1.1, 0.7);
    case 'pad':
    case 'tuck':
      return cue('impact', 0.5, 1.4);
    case 'doorSlam':
      return cue('impact', 1, 0.85); // a car door slammed shut: big and low
    case 'clack':
      return cue('impact', 0.45, 2.2); // a firecracker's tail on the next step: a quick high clack
    case 'hop':
      return cue('impact', 0.7, 1.6); // the hollow bonk of a car roof
    case 'kicker':
      return cue('ollie', 1, 0.8);
    case 'pickup':
      return e.kind === 'stoken' ? cue('coin', 1, 1.5) : cue('coin', 0.8);
    case 'smash':
      return cue('ufo_explode', e.how === 'roll' ? 0.4 : 0.6, 1.3 + ((e.index * 7) % 5) * 0.08);
    case 'drone':
      return cue('ufo_explode');
    case 'birds':
      return cue('impact', 0.5, 1.8); // a flurry of wings
    case 'dent':
      //the hop's bonk is the hop's own; a wreck goes off like a drone
      return e.stage === 3 ? cue('ufo_explode', 0.9, 0.8) : null;
    case 'mod':
      return cue('coin', 0.3, 2);
    case 'bail':
      return cue('game_over');
    default:
      return null;
  }
}

// moments that aren't sim events
export const MOMENT: Record<'start' | 'gate' | 'busted' | 'pick', Cue> = {
  start: cue('game_start', 0.8),
  gate: cue('coin', 1, 0.75),
  busted: cue('game_over'),
  pick: cue('trick', 1.2, 0.8),
};

export const LOOPS = {
  grind: VOL.grind, // the grind sample, while on a rail or ledge
  rollMax: 0.22, // wheels on the street, by speed
  sirenFrom: 25, // the siren comes in at this Heat
  sirenMax: 0.12,
  music: 0.35,
};

// how loud the rolling wheels are at a speed (px/frame); silent in the air or stopped
export function rollGain(mode: string, speed: number): number {
  if (mode !== 'roll') return 0;
  return LOOPS.rollMax * Math.min(1, Math.max(0, speed) / 6);
}

// how loud the siren is at a Heat
export function sirenGain(heat: number): number {
  if (heat < LOOPS.sirenFrom) return 0;
  return LOOPS.sirenMax * Math.min(1, (heat - LOOPS.sirenFrom) / (100 - LOOPS.sirenFrom));
}

// haptics (GDD: a short buzz on landing, a longer one on a slam): ms, or a pattern
export function buzzFor(e: FloorEvent): number | number[] | null {
  if (e.type === 'land') return e.quality === 'heavy' || e.quality === 'sketchy' ? 25 : 10;
  if (e.type === 'slam') return 60;
  if (e.type === 'tuck') return 40;
  if (e.type === 'hop') return 15;
  if (e.type === 'clack') return 6;
  if (e.type === 'dent' && e.stage === 3) return [30, 40, 50];
  return null;
}
