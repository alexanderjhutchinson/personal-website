import { Radio } from "./radio";

/**
 * Projector sounds synthesized with the Web Audio API: the switch, the motor
 * spinning up, the film clattering through the gate, the countdown's 2-pop,
 * and the tail of the film flapping on the reel. Also the paper, the lamp
 * switches and the radio's knob. No audio files, except the radio's record
 * (radio.ts).
 */
export class ProjectorSound {
  enabled = false;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private click: AudioBuffer | null = null;
  private motor: { oscs: OscillatorNode[]; gain: GainNode; hum: AudioBufferSourceNode } | null = null;
  private timer = 0;
  private nextClick = 0;
  private rate = { from: 0, to: 0, start: 0, duration: 0, loud: 1 };
  private radio: Radio | null = null;
  private radioOn = false;
  private radioDucked = false;

  /** Turn sound on or off. Call from a click or key press so the browser lets audio start. */
  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.ensure();
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
    }
    this.tuneRadio();
  }

  /** Switch the radio on or off. It only plays while sound is on. */
  setRadio(on: boolean) {
    this.radioOn = on;
    this.tuneRadio();
  }

  /** Turn the radio down while the film runs. */
  duckRadio(down: boolean) {
    this.radioDucked = down;
    this.radio?.duck(down);
  }

  private tuneRadio() {
    const ctx = this.radioOn ? this.ensure() : null;
    if (ctx && this.master && this.noise) {
      this.radio ??= new Radio(ctx, this.master, this.noise);
      this.radio.duck(this.radioDucked);
      this.radio.switchOn();
    } else {
      this.radio?.switchOff();
    }
  }

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(ctx.destination);

      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const n = this.noise.getChannelData(0);
      for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;

      const len = Math.floor(ctx.sampleRate * 0.03);
      this.click = ctx.createBuffer(1, len, ctx.sampleRate);
      const c = this.click.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const env = Math.exp(-i / (len * 0.12));
        c[i] = (Math.random() * 2 - 1) * env + Math.sin(i * 0.35) * env * 0.4;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Paper being picked up, turned, or put down. */
  rustle(strength = 1) {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(2200, t);
    band.frequency.linearRampToValueAtTime(4400, t + 0.2);
    band.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.16 * strength, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    src.connect(band).connect(gain).connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + 0.32);
  }

  /** The power switch. */
  clunk() {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.click) return;
    const t = ctx.currentTime;
    const thump = ctx.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(140, t);
    thump.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    thump.connect(g).connect(this.master);
    thump.start(t);
    thump.stop(t + 0.2);
    this.tick(t, 0.6, 2500);
  }

  /** A lamp's switch: a small, bright double click. */
  snap() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tick(t, 0.5, 2800);
    this.tick(t + 0.035, 0.22, 4200);
  }

  /** The radio's knob: a dull, chunky click. */
  knob() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tick(t, 0.7, 900);
    this.tick(t + 0.018, 0.25, 2400);
  }

  /** Motor and clatter speed up to running speed over `seconds`. */
  startMotor(seconds: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noise) return;
    this.stopMotor(0);
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.16, t + seconds);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520;
    filter.connect(gain).connect(this.master);

    const oscs = [
      { type: "sawtooth" as OscillatorType, mult: 1, level: 0.6 },
      { type: "square" as OscillatorType, mult: 3, level: 0.12 },
    ].map(({ type, mult, level }) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(14 * mult, t);
      o.frequency.exponentialRampToValueAtTime(54 * mult, t + seconds);
      const og = ctx.createGain();
      og.gain.value = level;
      o.connect(og).connect(filter);
      o.start(t);
      return o;
    });

    const hum = ctx.createBufferSource();
    hum.buffer = this.noise;
    hum.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(120, t);
    band.frequency.exponentialRampToValueAtTime(420, t + seconds);
    band.Q.value = 0.9;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.35;
    hum.connect(band).connect(humGain).connect(gain);
    hum.start(t);

    this.motor = { oscs, gain, hum };
    this.setClatter(0, 18, seconds, 1);
  }

  /** Motor winds down over `seconds`. */
  stopMotor(seconds: number) {
    if (!this.ctx || !this.motor) {
      this.setClatter(0, 0, 0, 1);
      return;
    }
    const t = this.ctx.currentTime;
    const { oscs, gain, hum } = this.motor;
    const end = t + Math.max(0.02, seconds);
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    for (const o of oscs) {
      o.frequency.cancelScheduledValues(t);
      o.frequency.setValueAtTime(o.frequency.value, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, o.frequency.value * 0.2), end);
      o.stop(end + 0.05);
    }
    hum.stop(end + 0.05);
    this.motor = null;
    this.setClatter(this.currentRate(), 0, seconds, 1);
  }

  /** The 1 kHz beep on the "2" of the countdown. */
  pop() {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.value = 1000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.004);
    g.gain.setValueAtTime(0.14, t + 1 / 24);
    g.gain.linearRampToValueAtTime(0.0001, t + 1 / 24 + 0.006);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.08);
  }

  /** The end of the film slapping against the reel. */
  runout(seconds: number) {
    if (!this.ensure()) return;
    this.setClatter(30, 26, seconds * 0.5, 1.6);
  }

  private currentRate() {
    if (!this.ctx) return 0;
    const { from, to, start, duration } = this.rate;
    const p = duration > 0 ? Math.min(1, (this.ctx.currentTime - start) / duration) : 1;
    return from + (to - from) * p;
  }

  private setClatter(from: number, to: number, duration: number, loud: number) {
    if (!this.ctx) return;
    this.rate = { from, to, start: this.ctx.currentTime, duration, loud };
    this.nextClick = Math.max(this.nextClick, this.ctx.currentTime);
    if (!this.timer && (from > 0 || to > 0)) {
      this.timer = window.setInterval(() => this.schedule(), 25);
    }
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const horizon = ctx.currentTime + 0.12;
    while (this.nextClick < horizon) {
      const rate = this.currentRate();
      if (rate < 0.5) {
        const { to, start, duration } = this.rate;
        if (to < 0.5 && ctx.currentTime > start + duration) {
          window.clearInterval(this.timer);
          this.timer = 0;
        }
        this.nextClick = horizon;
        break;
      }
      this.tick(this.nextClick, (0.12 + Math.random() * 0.08) * this.rate.loud, 1400 + Math.random() * 900);
      this.nextClick += (1 / rate) * (0.94 + Math.random() * 0.12);
    }
  }

  private tick(at: number, level: number, highpass: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.click) return;
    const src = ctx.createBufferSource();
    src.buffer = this.click;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = highpass;
    const g = ctx.createGain();
    g.gain.value = level;
    src.connect(hp).connect(g).connect(this.master);
    src.start(at);
  }
}
