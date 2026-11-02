// What the game sounds like (GDD: Immersion, sound first). Pure: which sound each sim event makes, and how the
// loops sit under the skating. src/audio/sound.ts plays them. zack's own set (2026-11-02, the list in the project
// files' audio/sound-effects-list.md): one sound per moment, mp3 for the one-shots, WAV for the three loops so
// they loop without the gap an mp3 adds. Lou Gnar's old 'impact' still covers a clean landing (no land.wav yet)
// and rolling over glass.
import type { FloorEvent } from '../sim/floor';

export type SampleId =
  | 'ollie' | 'trick' | 'kicker' | 'impact' | 'land_sketchy' | 'slam' | 'pad' | 'tuck' | 'car_hop' | 'door_slam'
  | 'clack' | 'bail' | 'coin' | 'stoken' | 'mod' | 'smash' | 'drone_down' | 'car_wreck' | 'birds' | 'gun_aim'
  | 'gun_shot' | 'start' | 'gate' | 'pick' | 'busted' | 'grind' | 'roll' | 'siren';
export type MusicId = 'gameplay' | 'title';

// The soundtrack: drop mp3s in public/music/ and list their names (no .mp3) here. Each slot plays its list in
// order and loops back to the first; a slot with one track loops it; an empty slot is silence. 'title' plays on
// the run summary, 'gameplay' while skating.
export const MUSIC: Record<MusicId, string[]> = {
  gameplay: ['funkadelic_miester'],
  title: [],
};

// the loops: WAV files (public/sounds/<id>.wav); every other sample is an mp3
export const LOOP_SAMPLES: SampleId[] = ['grind', 'roll', 'siren'];
export const sampleFile = (id: SampleId): string => `sounds/${id}.${LOOP_SAMPLES.includes(id) ? 'wav' : 'mp3'}`;

// each sample's level, before the master volume (zack's files are all mastered near 0 dB, so these sit close)
const VOL: Record<SampleId, number> = {
  ollie: 0.8,
  trick: 0.6,
  kicker: 0.8,
  impact: 0.9,
  land_sketchy: 0.8,
  slam: 0.9,
  pad: 0.8,
  tuck: 0.6,
  car_hop: 0.7,
  door_slam: 0.9,
  clack: 0.5,
  bail: 0.9,
  coin: 0.7,
  stoken: 0.9,
  mod: 0.5,
  smash: 0.6,
  drone_down: 0.9,
  car_wreck: 0.9,
  birds: 0.9,
  gun_aim: 0.7,
  gun_shot: 0.9,
  start: 0.9,
  gate: 0.9,
  pick: 0.9,
  busted: 0.9,
  grind: 0.5,
  roll: 0.3,
  siren: 0.25,
};

export const SAMPLES = Object.keys(VOL) as SampleId[];

export interface Cue {
  sample: SampleId;
  vol: number; // 0-1, before the master volume
  rate?: number; // playback rate: above 1 is higher and shorter
}

const cue = (sample: SampleId, scale = 1, rate = 1): Cue => ({ sample, vol: VOL[sample] * scale, rate });

// The coins ring out in a reverb (src/audio/sound.ts: a convolver on a freshly made, random impulse, so no two
// tails ring alike). A lone coin is mostly dry; when they pile up (a line taken at speed) each one is ducked and
// more of it goes up into the reverb, with a ghost an octave up feeding only the reverb: the shimmer.
export const COIN_VERB = {
  seconds: 2.6, // the impulse's length
  decay: 2.6, // how fast it dies (higher: shorter)
  predelay: 0.025, // s before the tail starts
  lowCut: 700, // Hz: the tail is the high end only, so it rings above the street instead of muddying it
  window: 0.4, // s: coins started within this of each other count as piled up
  shimmer: 0.28, // the octave-up ghost, into the reverb only, at full pile
  limit: -10, // dB: the coins' bus is held under this, so a stack swells instead of clipping
};

// how one coin splits between dry and the reverb, given how many others started inside COIN_VERB.window
export function coinMix(pile: number): { dry: number; wet: number; shimmer: number } {
  const p = Math.max(0, pile);
  const k = Math.min(1, p / 6); // 0 alone, 1 at six or more stacked
  return { dry: 1 / (1 + p * 0.35), wet: 0.1 + 0.32 * k, shimmer: COIN_VERB.shimmer * k };
}

// the sound a sim event makes, if any (grinds are the loop, below)
export function cueFor(e: FloorEvent): Cue | null {
  switch (e.type) {
    case 'ollie':
      return cue('ollie', e.lip ? 1 : 0.85);
    case 'trick':
      return cue('trick');
    case 'land': {
      //harder landings are louder, like Lou Gnar's 0.3-1.0 by fall speed; a sketchy one has its own rattle
      const hit = Math.min(1, Math.max(0.3, (e.impact ?? 3) / 10));
      return e.quality === 'sketchy' ? cue('land_sketchy', Math.max(0.7, hit)) : cue('impact', hit);
    }
    case 'slam':
      return cue('slam');
    case 'pad':
      return cue('pad');
    case 'tuck':
      return cue('tuck');
    case 'doorSlam':
      return cue('door_slam');
    case 'shot':
      return cue('gun_shot');
    case 'aim':
      return cue('gun_aim');
    case 'clack':
      return cue('clack');
    case 'glass':
      return cue('impact', 0.5, 2.8); // rolling over broken glass: a high crunch
    case 'hop':
      return cue('car_hop');
    case 'kicker':
      return cue('kicker');
    case 'pickup':
      //a spin token has no file of its own yet: the Stoken's, a little higher
      return e.kind === 'cash' ? cue('coin') : cue('stoken', 1, e.kind === 'spin' ? 1.2 : 1);
    case 'smash':
      //each prop pitched a little differently so a bunch doesn't sound like one sound repeating
      return cue('smash', e.how === 'roll' ? 0.7 : 1, 0.92 + ((e.index * 7) % 5) * 0.04);
    case 'drone':
      return cue('drone_down');
    case 'birds':
      return cue('birds');
    case 'dent':
      //the hop's bonk is the hop's own; the final hit wrecks it
      return e.stage === 3 ? cue('car_wreck') : null;
    case 'mod':
      return cue('mod');
    case 'bail':
      return cue('bail');
    default:
      return null;
  }
}

// moments that aren't sim events
export const MOMENT: Record<'start' | 'gate' | 'busted' | 'pick', Cue> = {
  start: cue('start'),
  gate: cue('gate'),
  busted: cue('busted'),
  pick: cue('pick'),
};

export const LOOPS = {
  grind: VOL.grind, // the grind loop, while on a rail or ledge
  rollMax: VOL.roll, // the wheels loop on the street, by speed
  sirenFrom: 25, // the siren loop comes in at this Heat
  sirenMax: VOL.siren,
  music: 0.35,
  pauseDuck: 0.35, // the music's level under the pause card, of its own
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
