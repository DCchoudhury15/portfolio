// The soundtrack engine. Four original tracks are synthesised in a Web Worker
// (public/synth-worker.js) and played as a setlist through the Web Audio API.
// A tiny external store lets React components subscribe to its state.

export const TRACKS = [
  { id: "cream", title: "Liquid Light", style: "Cream" },
  { id: "doors", title: "Desert Highway Rain", style: "The Doors" },
  { id: "floyd", title: "Echoes in the Wire", style: "Pink Floyd" },
  { id: "zep", title: "Hammer of the Hills", style: "Led Zeppelin" },
] as const;

const SAMPLE_RATE = 32000;

type Song = { id: string; sr: number; L: Float32Array; R: Float32Array };
export type MusicState = { playing: boolean; index: number; status: string | null };

class Music {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private bins: Uint8Array<ArrayBuffer> | null = null;
  private src: AudioBufferSourceNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private songs = new Map<string, Promise<Song>>();
  private waiting = new Map<string, (s: Song) => void>();
  private worker: Worker | null = null;
  private startedAt = 0;
  private offset = 0;
  private token = 0;
  private volume = 0.8;
  private listeners = new Set<() => void>();
  state: MusicState = { playing: false, index: 0, status: null };

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getState = () => this.state;
  private set(patch: Partial<MusicState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((f) => f()); }

  private render(id: string): Promise<Song> {
    const cached = this.songs.get(id);
    if (cached) return cached;
    const p = new Promise<Song>((resolve, reject) => {
      if (!this.worker) {
        try {
          this.worker = new Worker("/synth-worker.js");
          this.worker.onmessage = (e: MessageEvent<Song>) => { const done = this.waiting.get(e.data.id); this.waiting.delete(e.data.id); done?.(e.data); };
          this.worker.onerror = () => { this.waiting.clear(); this.songs.clear(); this.worker = null; };
        } catch { reject(new Error("no worker")); return; }
      }
      this.waiting.set(id, resolve);
      this.worker.postMessage({ id, sr: SAMPLE_RATE });
    });
    this.songs.set(id, p);
    return p;
  }

  /** Start rendering a track in the background so it is ready when needed. */
  warm(index = this.state.index) { this.render(TRACKS[(index + TRACKS.length) % TRACKS.length].id).catch(() => {}); }

  private ensureContext() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.75;
    this.bins = new Uint8Array(this.analyser.frequencyBinCount);
    this.gain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    return this.ctx;
  }

  private async buffer(id: string) {
    const ready = this.buffers.get(id);
    if (ready) return ready;
    const s = await this.render(id);
    const b = this.ctx!.createBuffer(2, s.L.length, s.sr);
    b.copyToChannel(s.L as Float32Array<ArrayBuffer>, 0);
    b.copyToChannel(s.R as Float32Array<ArrayBuffer>, 1);
    this.buffers.set(id, b);
    return b;
  }

  private position() { return this.offset + (this.state.playing && this.src && this.ctx ? this.ctx.currentTime - this.startedAt : 0); }

  private stopSource(fade: boolean) {
    const src = this.src;
    this.src = null;
    if (!src || !this.ctx || !this.gain) return;
    src.onended = null;
    if (!fade) { try { src.stop(); } catch {} return; }
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(0, now + 0.25);
    setTimeout(() => { try { src.stop(); } catch {} }, 300);
  }

  play() {
    let ctx: AudioContext;
    try { ctx = this.ensureContext(); } catch { this.set({ status: "Sound isn't available in this browser." }); return; }
    const resumed = Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 1500))]);
    const track = TRACKS[this.state.index];
    const my = ++this.token;
    this.set({ playing: true, status: this.buffers.has(track.id) ? null : "Tuning up the band…" });
    Promise.all([this.buffer(track.id), resumed])
      .then(([buf]) => {
        if (my !== this.token || !this.state.playing) return;
        if (ctx.state !== "running") { this.set({ playing: false, status: "Your browser blocked sound. Press play again." }); return; }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.gain!);
        const at = Math.min(this.offset, buf.duration - 0.05);
        const now = ctx.currentTime;
        src.start(now, at);
        src.onended = () => { if (this.src === src && this.state.playing) this.go(1, true); };
        this.src = src;
        this.startedAt = now;
        this.offset = at;
        this.gain!.gain.cancelScheduledValues(now);
        this.gain!.gain.setValueAtTime(this.gain!.gain.value, now);
        this.gain!.gain.linearRampToValueAtTime(this.volume, now + 0.5);
        this.set({ status: null });
        this.warm(this.state.index + 1);
      })
      .catch(() => this.set({ playing: false, status: "Sound isn't available in this browser." }));
  }

  pause() {
    if (!this.state.playing) return;
    this.offset = this.position();
    this.token++;
    this.set({ playing: false });
    this.stopSource(true);
  }

  toggle() { if (this.state.playing) this.pause(); else this.play(); }

  go(step: number, auto = false) {
    const resume = this.state.playing || auto;
    this.stopSource(!auto);
    this.offset = 0;
    this.token++;
    const index = (this.state.index + step + TRACKS.length) % TRACKS.length;
    this.set({ index, playing: false, status: null });
    if (resume) this.play(); else this.warm(index);
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx && this.gain && this.state.playing) this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  /** Bass energy 0..1, used to make the light show pulse with the music. */
  energy() {
    if (!this.state.playing || !this.analyser || !this.bins) return 0;
    this.analyser.getByteFrequencyData(this.bins);
    let s = 0;
    for (let i = 1; i < 10; i++) s += this.bins[i];
    return Math.min(1, (s / (9 * 255)) * 1.2);
  }
}

export const music = new Music();
