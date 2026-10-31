// The soundtrack split into bass, mids and highs, 0..1 each, for the gnar glow to dance to (zack, 2026-10-31: "play
// with the gnar mode outline as like a music visualizer"). Each band is measured against its own recent peak, so a
// quiet track moves the glow as much as a loud one; what counts is how far it pokes above its running average, so a
// steady hum reads as nothing and a hit reads as a hit. It jumps up fast and falls back slower, like a VU meter.
export type Bands = { bass: number; mid: number; high: number };

// the bands' edges in Hz
export const BAND_HZ = { bass: 180, mid: 2500 };

export class BandMeter {
  readonly out: Bands = { bass: 0, mid: 0, high: 0 };
  private readonly peak: Bands = { bass: 0, mid: 0, high: 0 };
  private avg: Bands | null = null; // starts at the first spectrum, so a track's opening isn't one big hit

  // bins: the analyser's byte spectrum (0..255 per bin); binHz: the width of a bin; dt: seconds since last time
  update(bins: Uint8Array, binHz: number, dt: number): Bands {
    let b = 0, nb = 0, m = 0, nm = 0, h = 0, nh = 0;
    for (let i = 1; i < bins.length; i++) {
      const hz = i * binHz;
      const v = bins[i] / 255;
      if (hz < BAND_HZ.bass) (b += v), nb++;
      else if (hz < BAND_HZ.mid) (m += v), nm++;
      else if (hz < 12000) (h += v), nh++;
    }
    const raw: Bands = { bass: nb ? b / nb : 0, mid: nm ? m / nm : 0, high: nh ? h / nh : 0 };
    const avg = (this.avg ??= { ...raw });
    for (const k of ['bass', 'mid', 'high'] as const) {
      //the average follows over about a second; the peak (above it) eases down over a few
      avg[k] += (raw[k] - avg[k]) * Math.min(1, dt * 1.5);
      const over = raw[k] - avg[k];
      this.peak[k] = Math.max(over, this.peak[k] * Math.exp(-dt / 4), 0.06);
      const level = Math.min(1, Math.max(0, over / this.peak[k]));
      const was = this.out[k];
      this.out[k] = level > was ? level : was + (level - was) * Math.min(1, dt * 8);
    }
    return this.out;
  }

  // no music: everything falls to rest
  rest(dt: number): Bands {
    this.avg = null;
    for (const k of ['bass', 'mid', 'high'] as const) this.out[k] *= Math.exp(-dt * 8);
    return this.out;
  }
}
