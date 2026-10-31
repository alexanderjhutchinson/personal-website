/**
 * The radio's one station: "Tiger Rag" by the Original Dixieland Jass Band (1918), a public-domain
 * 78 that brings its own crackle (public/radio/tiger-rag.mp3, from Wikimedia Commons). It plays
 * through the radio's small speaker: no deep bass or bright treble, and a little to the right, where
 * the radio sits on the sideboard. The file only loads once the radio is first switched on, and the
 * record keeps its place while the radio is off.
 */

const RECORD = "/radio/tiger-rag.mp3";
/** How loud the radio plays, and how far down it turns while the film runs. */
const LEVEL = 0.55;
const DUCKED = 0.3;

export class Radio {
  private ctx: AudioContext;
  private noise: AudioBuffer;
  private audio: HTMLAudioElement;
  private gain: GainNode;
  private out: StereoPannerNode;
  private on = false;
  private ducked = false;
  private pauseTimer = 0;

  constructor(ctx: AudioContext, destination: AudioNode, noise: AudioBuffer) {
    this.ctx = ctx;
    this.noise = noise;
    this.audio = new Audio(RECORD);
    this.audio.loop = true;
    const source = ctx.createMediaElementSource(this.audio);
    const low = ctx.createBiquadFilter();
    low.type = "highpass";
    low.frequency.value = 170;
    const high = ctx.createBiquadFilter();
    high.type = "lowpass";
    high.frequency.value = 4800;
    const middle = ctx.createBiquadFilter();
    middle.type = "peaking";
    middle.frequency.value = 1600;
    middle.Q.value = 0.8;
    middle.gain.value = 3;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.out = ctx.createStereoPanner();
    this.out.pan.value = 0.25;
    source.connect(low).connect(high).connect(middle).connect(this.gain).connect(this.out).connect(destination);
  }

  /** A moment of static while the set warms up, then the record fades in where it left off. */
  switchOn() {
    window.clearTimeout(this.pauseTimer);
    this.on = true;
    const t = this.ctx.currentTime;
    this.static(t);
    this.fade(this.level, 0.9);
    // Blocked or failed playback (offline, say) just leaves the radio quiet.
    this.audio.play().catch(() => {});
  }

  switchOff() {
    this.on = false;
    this.fade(0, 0.08);
    this.pauseTimer = window.setTimeout(() => this.audio.pause(), 120);
  }

  /** Turn down while the film runs, and back up after. */
  duck(down: boolean) {
    this.ducked = down;
    if (this.on) this.fade(this.level, 0.8);
  }

  private get level() {
    return this.ducked ? LEVEL * DUCKED : LEVEL;
  }

  private fade(to: number, seconds: number) {
    const t = this.ctx.currentTime;
    const g = this.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(to, t + seconds);
  }

  private static(t: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const band = this.ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 1.2;
    band.frequency.setValueAtTime(900, t);
    band.frequency.exponentialRampToValueAtTime(2600, t + 0.2);
    band.frequency.exponentialRampToValueAtTime(1400, t + 0.45);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    src.connect(band).connect(gain).connect(this.out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + 0.5);
  }
}
