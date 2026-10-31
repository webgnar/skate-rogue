import { describe, expect, it } from 'vitest';
import { BandMeter } from '../src/audio/bands';

const BIN_HZ = 44100 / 512;
const spectrum = (bass: number, mid: number, high: number) =>
  Uint8Array.from({ length: 256 }, (_, i) => (i * BIN_HZ < 180 ? bass : i * BIN_HZ < 2500 ? mid : high));

describe('BandMeter', () => {
  it('a kick lights the bass, not the highs', () => {
    const m = new BandMeter();
    for (let i = 0; i < 60; i++) m.update(spectrum(60, 60, 60), BIN_HZ, 1 / 60);
    const out = m.update(spectrum(250, 60, 60), BIN_HZ, 1 / 60);
    expect(out.bass).toBeGreaterThan(0.8);
    expect(out.high).toBeLessThan(0.3);
  });

  it('falls back after the hit, and rests with no music', () => {
    const m = new BandMeter();
    m.update(spectrum(250, 250, 250), BIN_HZ, 1 / 60);
    for (let i = 0; i < 30; i++) m.update(spectrum(20, 20, 20), BIN_HZ, 1 / 60);
    expect(m.out.bass).toBeLessThan(0.1);
    m.update(spectrum(250, 250, 250), BIN_HZ, 1 / 60);
    for (let i = 0; i < 60; i++) m.rest(1 / 60);
    expect(m.out.mid).toBeLessThan(0.01);
  });

  it('a quiet track still moves the meter', () => {
    const m = new BandMeter();
    let top = 0;
    for (let i = 0; i < 300; i++) top = Math.max(i > 240 ? m.update(spectrum(i % 30 < 3 ? 40 : 10, 10, 10), BIN_HZ, 1 / 60).bass : (m.update(spectrum(i % 30 < 3 ? 40 : 10, 10, 10), BIN_HZ, 1 / 60), 0), top);
    expect(top).toBeGreaterThan(0.5);
  });
});
