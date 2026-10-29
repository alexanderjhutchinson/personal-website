import type { Material } from "./tiles";

/** Lobby sound effects, synthesized with the Web Audio API. Off until the visitor turns sound on. */
export class Sfx {
  enabled = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.ensure();
  }

  private ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private burst(opts: { type: BiquadFilterType; freq: number; q: number; gain: number; decay: number; sweepTo?: number }) {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = opts.type;
    f.frequency.setValueAtTime(opts.freq, t);
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + opts.decay);
    f.Q.value = opts.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + opts.decay);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + opts.decay + 0.02);
  }

  private tone(freq: number, to: number, gain: number, decay: number, type: OscillatorType = "square") {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(to, t + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + decay + 0.02);
  }

  dig(material: Material) {
    const freq = { dirt: 500, stone: 1800, wood: 900 }[material];
    this.burst({ type: "bandpass", freq: freq * (0.85 + Math.random() * 0.3), q: 1.4, gain: 0.5, decay: 0.08 });
    if (material === "stone") this.tone(1400 + Math.random() * 300, 900, 0.05, 0.06);
  }

  breakBlock(material: Material) {
    const freq = { dirt: 380, stone: 1300, wood: 650 }[material];
    this.burst({ type: "lowpass", freq: freq * 2, q: 0.7, gain: 0.6, decay: 0.16, sweepTo: freq / 2 });
  }

  swing() {
    this.burst({ type: "bandpass", freq: 600, q: 2, gain: 0.25, decay: 0.16, sweepTo: 2200 });
  }

  hit(crit: boolean) {
    this.tone(crit ? 220 : 160, 60, 0.3, 0.12, "triangle");
    this.burst({ type: "lowpass", freq: 900, q: 0.8, gain: 0.4, decay: 0.08 });
  }

  pickup() {
    this.tone(660, 1320, 0.06, 0.07, "square");
  }

  /** The film slipping between frames: a quick run of clicks through the gate. */
  roll() {
    if (!this.ensure()) return;
    for (let i = 0; i < 6; i++) {
      setTimeout(() => this.burst({ type: "bandpass", freq: 2600, q: 3, gain: 0.22, decay: 0.03 }), i * 55);
    }
  }

  place(material: Material) {
    const freq = { dirt: 300, stone: 900, wood: 500 }[material];
    this.burst({ type: "bandpass", freq, q: 1.2, gain: 0.45, decay: 0.06 });
  }
}
