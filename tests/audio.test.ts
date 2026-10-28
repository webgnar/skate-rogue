import { describe, expect, it } from 'vitest';
import { buzzFor, coinMix, cueFor, MOMENT, MUSIC, rollGain, SAMPLES, sirenGain } from '../src/audio/cues';

describe('sound cues', () => {
  it('every sample the cues use ships in public/sounds', async () => {
    const fsId = 'node:fs';
    const { existsSync } = (await import(/* @vite-ignore */ fsId)) as { existsSync(p: string): boolean };
    for (const id of SAMPLES) expect(existsSync(`public/sounds/${id}.mp3`)).toBe(true);
    for (const id of Object.values(MUSIC).flat()) expect(existsSync(`public/music/${id}.mp3`)).toBe(true);
    for (const c of Object.values(MOMENT)) expect(SAMPLES).toContain(c.sample);
  });

  it('the core moves each make a sound; harder landings are louder', () => {
    expect(cueFor({ type: 'ollie', spin: 0 })?.sample).toBe('ollie');
    expect(cueFor({ type: 'trick', index: 0, name: 'kickflip', spin: 0, fakie: false } as never)?.sample).toBe('trick');
    expect(cueFor({ type: 'slam' })?.sample).toBe('impact');
    expect(cueFor({ type: 'pickup', kind: 'cash', index: 0 })?.sample).toBe('coin');
    const soft = cueFor({ type: 'land', impact: 2 })!.vol;
    const hard = cueFor({ type: 'land', impact: 9 })!.vol;
    expect(hard).toBeGreaterThan(soft);
    expect(cueFor({ type: 'near' })).toBeNull();
  });

  it('stacked coins are ducked and pushed up into the reverb; a lone coin stays mostly dry', () => {
    const alone = coinMix(0);
    const pile = coinMix(8);
    expect(alone.shimmer).toBe(0);
    expect(alone.dry).toBeGreaterThan(alone.wet);
    expect(pile.dry).toBeLessThan(alone.dry);
    expect(pile.wet).toBeGreaterThan(alone.wet);
    expect(pile.shimmer).toBeGreaterThan(0);
  });

  it('the wheels roll louder with speed and go quiet in the air; the siren comes in with Heat', () => {
    expect(rollGain('roll', 6)).toBeGreaterThan(rollGain('roll', 2));
    expect(rollGain('air', 6)).toBe(0);
    expect(sirenGain(10)).toBe(0);
    expect(sirenGain(90)).toBeGreaterThan(sirenGain(40));
  });

  it('a slam buzzes longer than a landing', () => {
    expect(buzzFor({ type: 'slam' })).toBeGreaterThan(buzzFor({ type: 'land', quality: 'clean' }) as number);
    expect(buzzFor({ type: 'ollie', spin: 0 })).toBeNull();
  });
});
