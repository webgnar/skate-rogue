// Plays the game's sound (cues in src/audio/cues.ts) through Web Audio: one-shot samples, the grind loop, rolling
// wheels and a siren synthesized from noise and an oscillator, and the soundtrack (MUSIC in cues.ts). Browsers only start audio after a
// tap, so the context is made on the first press. Any failure (no Web Audio, a sample that won't load) is silent:
// the game never waits on sound.
import { COIN_VERB, coinMix, LOOPS, MUSIC, SAMPLES, rollGain, sirenGain, type Cue, type MusicId } from './cues';
import { SETTINGS } from '../ui/settings';

export interface SoundFrame {
  mode: string; // the skater's mode
  speed: number; // px/frame
  heat: number;
  skating: boolean; // on a floor (not a menu, not busted)
  over: boolean; // the run summary: the title music
  paused: boolean;
}

export class Sound {
  private ctx: AudioContext | null = null;
  private sfx!: GainNode;
  private musicBus!: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private grind: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private roll: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private siren: { gain: GainNode; osc: OscillatorNode; lfo: OscillatorNode } | null = null;
  private music: { id: MusicId; src: AudioBufferSourceNode } | null = null;
  private want: MusicId | null = null;
  private track: Record<MusicId, number> = { gameplay: 0, title: 0 }; // where each slot is in its list
  private away = false; // the app is in the background (sleep)
  private verb: GainNode | null = null; // the coins' reverb send (COIN_VERB)
  private coins!: AudioNode; // the coins' bus, dry and wet: a gentle limiter so a stack swells instead of clipping
  private coinsAt: number[] = []; // when the last few coins started, for how piled up they are

  constructor(private readonly base: string) {}

  // call from a user gesture: makes the context (or wakes it) and starts loading the samples
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.away) void this.ctx.resume().catch(() => {});
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    try {
      this.ctx = new Ctx();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.sfx = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfx.connect(ctx.destination);
    this.musicBus.connect(ctx.destination);
    this.applyVolumes();
    this.makeRoll();
    this.makeSiren();
    this.makeVerb();
    for (const id of SAMPLES) void this.load(`sounds/${id}`);
    this.loadMusic();
  }

  // the soundtrack only downloads once the music volume is above zero (it starts at zero)
  private musicLoading = false;
  private loadMusic(): void {
    if (this.musicLoading || SETTINGS.music <= 0) return;
    this.musicLoading = true;
    for (const id of new Set(Object.values(MUSIC).flat())) void this.load(`music/${id}`);
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    this.sfx.gain.value = SETTINGS.sound;
    this.musicBus.gain.value = SETTINGS.music * LOOPS.music;
    this.loadMusic();
  }

  private async load(id: string): Promise<void> {
    try {
      const res = await fetch(`${this.base}${id}.mp3`);
      const buf = await this.ctx!.decodeAudioData(await res.arrayBuffer());
      this.buffers.set(id.slice(id.indexOf('/') + 1), buf);
      if (this.want && !this.music) this.playMusic(this.want);
    } catch {
      //no sound for this one
    }
  }

  play(cue: Cue | null): void {
    if (!cue || !this.ctx || this.ctx.state !== 'running') return;
    const buf = this.buffers.get(cue.sample);
    if (!buf) return;
    if (cue.sample === 'coin' && this.verb) return this.playCoin(cue, buf);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = cue.rate ?? 1;
    const g = this.ctx.createGain();
    g.gain.value = cue.vol;
    src.connect(g).connect(this.sfx);
    src.start();
  }

  // a coin: ducked and sent up into the reverb the more of them are stacking (coinMix), with the shimmer ghost
  private playCoin(cue: Cue, buf: AudioBuffer): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.coinsAt = this.coinsAt.filter((at) => t - at < COIN_VERB.window);
    const mix = coinMix(this.coinsAt.length);
    this.coinsAt.push(t);
    const rate = cue.rate ?? 1; // never detuned: off-pitch coins turn dissonant as they stack
    const voice = (r: number, dry: number, wet: number): void => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = r;
      if (dry > 0) {
        const g = ctx.createGain();
        g.gain.value = cue.vol * dry;
        src.connect(g).connect(this.coins);
      }
      const w = ctx.createGain();
      w.gain.value = cue.vol * wet;
      src.connect(w).connect(this.verb!);
      src.start();
    };
    voice(rate, mix.dry, mix.wet);
    if (mix.shimmer > 0.01) voice(rate * 2, 0, mix.shimmer);
  }

  // the coins' reverb: a convolver on an impulse made here from decaying noise, different on each channel and
  // every time the game loads, so its tails never ring in a set pattern; high-passed so it sits above the street
  private makeVerb(): void {
    const ctx = this.ctx!;
    try {
      const rate = ctx.sampleRate;
      const len = Math.floor(rate * COIN_VERB.seconds);
      const pre = Math.floor(rate * COIN_VERB.predelay);
      const ir = ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        //a few sparse early reflections, then the dense tail
        for (let n = 0; n < 6; n++) d[pre + Math.floor(Math.random() * rate * 0.06)] += (Math.random() * 2 - 1) * 0.5;
        for (let i = pre; i < len; i++) {
          const s = (i - pre) / rate;
          d[i] += (Math.random() * 2 - 1) * Math.exp(-s * COIN_VERB.decay) * Math.min(1, s / 0.01);
        }
      }
      const conv = ctx.createConvolver();
      conv.buffer = ir;
      const cut = ctx.createBiquadFilter();
      cut.type = 'highpass';
      cut.frequency.value = COIN_VERB.lowCut;
      const limit = ctx.createDynamicsCompressor();
      limit.threshold.value = COIN_VERB.limit;
      limit.knee.value = 6;
      limit.ratio.value = 8;
      limit.attack.value = 0.003;
      limit.release.value = 0.25;
      limit.connect(this.sfx);
      this.coins = limit;
      const send = ctx.createGain();
      send.connect(conv).connect(cut).connect(limit);
      this.verb = send;
    } catch {
      this.verb = null; // the coins play dry
    }
  }

  // silent while the app is in the background: frames stop there, so update() can't do it, and phones keep a web
  // page's audio playing behind other apps
  sleep(on: boolean): void {
    this.away = on;
    if (on && this.ctx?.state === 'running') void this.ctx.suspend().catch(() => {});
  }

  // the loops and the music, every frame
  update(f: SoundFrame): void {
    if (!this.ctx || this.away) return;
    if (f.paused) {
      if (this.ctx.state === 'running') void this.ctx.suspend().catch(() => {});
      return;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    const t = this.ctx.currentTime;
    const grinding = f.skating && (f.mode === 'grind' || f.mode === 'rail');
    this.setGrind(grinding);
    if (this.roll) {
      this.roll.gain.gain.setTargetAtTime(f.skating ? rollGain(f.mode, f.speed) : 0, t, 0.05);
      this.roll.filter.frequency.setTargetAtTime(300 + f.speed * 120, t, 0.1);
    }
    if (this.siren) {
      this.siren.gain.gain.setTargetAtTime(f.skating ? sirenGain(f.heat) : 0, t, 0.3);
      this.siren.lfo.frequency.setTargetAtTime(0.5 + f.heat / 50, t, 0.3); // the wail quickens with Heat
    }
    this.setMusic(f.over ? 'title' : 'gameplay');
  }

  setMusic(id: MusicId): void {
    if (this.want === id) return;
    this.want = id;
    this.playMusic(id);
  }

  // starts the slot's current track; when it ends, the next one in the list
  private playMusic(id: MusicId): void {
    if (!this.ctx || this.music?.id === id) return;
    const list = MUSIC[id];
    const old = this.music;
    this.music = null;
    if (old) {
      old.src.onended = null;
      old.src.stop();
    }
    if (!list.length) return;
    const buf = this.buffers.get(list[this.track[id] % list.length]);
    if (!buf) return; // still loading: load() starts it
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = list.length === 1;
    src.onended = () => {
      if (this.music?.src !== src) return;
      this.track[id] = (this.track[id] + 1) % list.length;
      this.music = null;
      this.playMusic(id);
    };
    src.connect(this.musicBus);
    src.start();
    this.music = { id, src };
  }

  private setGrind(on: boolean): void {
    if (!this.ctx) return;
    if (on && !this.grind) {
      const buf = this.buffers.get('grind');
      if (!buf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = LOOPS.grind;
      src.connect(gain).connect(this.sfx);
      src.start();
      this.grind = { src, gain };
    } else if (!on && this.grind) {
      const g = this.grind;
      g.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
      g.src.stop(this.ctx.currentTime + 0.15);
      this.grind = null;
    }
  }

  // wheels on the street: looped brown-ish noise through a low-pass, opened up with speed
  private makeRoll(): void {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.sfx);
    src.start();
    this.roll = { gain, filter };
  }

  // a two-tone police wail, far off: a triangle wave swept by a slow oscillator
  private makeSiren(): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 760;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.6;
    const depth = ctx.createGain();
    depth.gain.value = 180;
    lfo.connect(depth).connect(osc.frequency);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter).connect(gain).connect(this.sfx);
    osc.start();
    lfo.start();
    this.siren = { gain, osc, lfo };
  }
}
