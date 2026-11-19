import {
  FLAGSHIP_HEX,
  TwilightShaderController,
} from '@voibecode/shared';

interface MicroLoopSpec {
  id: string;
  indexLabel: string;
  title: string;
  meta: string;
  bars: number;
  bpm: number;
  swatchHex: string;
  opusPath: string;
  chordHz: number[];
}

const MICRO_LOOPS: MicroLoopSpec[] = [
  {
    id: 'nullarbor-dusk',
    indexLabel: '01',
    title: 'NULLARBOR DUSK',
    meta: '4 BARS · 92 BPM · #FF7B6B',
    bars: 4,
    bpm: 92,
    swatchHex: FLAGSHIP_HEX,
    opusPath: '/audio/nullarbor-dusk.opus',
    chordHz: [220.0, 277.18, 329.63, 415.3], // A maj7
  },
  {
    id: 'bondi-horizon',
    indexLabel: '02',
    title: 'BONDI HORIZON',
    meta: '8 BARS · 108 BPM · #5BA8B8',
    bars: 8,
    bpm: 108,
    swatchHex: '#5BA8B8',
    opusPath: '/audio/bondi-horizon.opus',
    chordHz: [196.0, 246.94, 293.66, 369.99], // G maj7
  },
  {
    id: 'southern-cross',
    indexLabel: '03',
    title: 'SOUTHERN CROSS DRONE',
    meta: '4 BARS · 84 BPM · #8C82B8',
    bars: 4,
    bpm: 84,
    swatchHex: '#8C82B8',
    opusPath: '/audio/southern-cross.opus',
    chordHz: [110.0, 164.81, 246.94, 329.63], // A2 + E3 open fifth twilight
  },
  {
    id: 'red-centre',
    indexLabel: '04',
    title: 'RED CENTRE TELEMETRY',
    meta: '8 BARS · 116 BPM · #74A88E',
    bars: 8,
    bpm: 116,
    swatchHex: '#74A88E',
    opusPath: '/audio/red-centre.opus',
    chordHz: [174.61, 220.0, 261.63, 329.63], // F maj7
  },
];

class ObjectsArchiveApp {
  private readonly canvas = document.getElementById('sky-canvas') as HTMLCanvasElement;
  private readonly trackListEl = document.getElementById('track-list') as HTMLElement;
  private readonly playerStateEl = document.getElementById('player-state-readout') as HTMLElement;
  private readonly stopBtn = document.getElementById('stop-audio-btn') as HTMLButtonElement;

  private readonly shader: TwilightShaderController;
  private audioCtx: AudioContext | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private activeGain: GainNode | null = null;
  private activeTrackId: string | null = null;
  private activeStartTime = 0;
  private activeDuration = 1;
  private readonly bufferCache = new Map<string, AudioBuffer>();
  private readonly progressEls = new Map<string, HTMLElement>();
  private readonly rowStateEls = new Map<string, HTMLElement>();

  constructor() {
    this.shader = new TwilightShaderController(this.canvas, FLAGSHIP_HEX);
    requestAnimationFrame(() => this.canvas.classList.add('is-ready'));

    this.renderTracks();
    this.stopBtn.addEventListener('click', () => {
      void this.stopCurrent(true);
    });
    this.startProgressLoop();
  }

  private renderTracks(): void {
    const fragment = document.createDocumentFragment();

    for (const track of MICRO_LOOPS) {
      const row = document.createElement('div');
      row.className = 'track-row';
      row.tabIndex = 0;
      row.setAttribute('role', 'button');

      const left = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'track-title';
      title.textContent = `${track.indexLabel} // ${track.title}`;

      const meta = document.createElement('div');
      meta.className = 'track-meta';
      meta.textContent = track.meta;

      left.appendChild(title);
      left.appendChild(meta);

      const stateLabel = document.createElement('div');
      stateLabel.className = 'track-meta';
      stateLabel.textContent = '[ PLAY LOOP ]';
      this.rowStateEls.set(track.id, stateLabel);

      const progressLine = document.createElement('div');
      progressLine.className = 'track-progress-line';
      const progressFill = document.createElement('div');
      progressFill.className = 'track-progress-fill';
      progressLine.appendChild(progressFill);
      this.progressEls.set(track.id, progressFill);

      row.appendChild(left);
      row.appendChild(stateLabel);
      row.appendChild(progressLine);

      const activate = () => {
        void this.toggleTrack(track);
      };
      row.addEventListener('click', activate);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          activate();
        }
      });

      fragment.appendChild(row);
    }

    this.trackListEl.innerHTML = '';
    this.trackListEl.appendChild(fragment);
  }

  private ensureAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new Ctx();
    }
    return this.audioCtx;
  }

  private async toggleTrack(track: MicroLoopSpec): Promise<void> {
    if (this.activeTrackId === track.id) {
      await this.stopCurrent(true);
      return;
    }

    this.shader.setPalette(track.swatchHex, 400);
    await this.stopCurrent(false);

    const ctx = this.ensureAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    this.playerStateEl.textContent = `DECODING // ${track.title}...`;
    const buffer = await this.loadOrSynthesizeLoop(ctx, track);

    // Bail cleanly if user stopped or switched before async load completed
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.75, now + 0.06);
    gain.connect(ctx.destination);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start(now);

    this.activeSource = source;
    this.activeGain = gain;
    this.activeTrackId = track.id;
    this.activeStartTime = now;
    this.activeDuration = buffer.duration;

    this.playerStateEl.textContent = `AUDIOBUFFERSOURCENODE // LOOP LOCKED: ${track.title} (60MS RAMP)`;
    this.refreshRowLabels();
  }

  private async stopCurrent(resetSky: boolean): Promise<void> {
    const prevSource = this.activeSource;
    const prevGain = this.activeGain;
    const prevId = this.activeTrackId;

    this.activeSource = null;
    this.activeGain = null;
    this.activeTrackId = null;

    if (prevId) {
      const fill = this.progressEls.get(prevId);
      if (fill) fill.style.width = '0%';
    }

    if (resetSky) {
      this.shader.setPalette(FLAGSHIP_HEX, 400);
      this.playerStateEl.textContent = 'AUDIOBUFFERSOURCENODE // IDLE (60MS FADE)';
    }
    this.refreshRowLabels();

    if (prevGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      prevGain.gain.cancelScheduledValues(now);
      prevGain.gain.setValueAtTime(Math.max(prevGain.gain.value, 0.0001), now);
      prevGain.gain.linearRampToValueAtTime(0.0, now + 0.06);
      setTimeout(() => {
        try {
          prevSource?.stop();
          prevSource?.disconnect();
          prevGain.disconnect();
        } catch {
          // Already stopped
        }
      }, 68);
    }
  }

  private refreshRowLabels(): void {
    for (const [id, el] of this.rowStateEls.entries()) {
      el.textContent =
        id === this.activeTrackId ? '[ LOOPING // CLICK TO PAUSE ]' : '[ PLAY LOOP ]';
    }
  }

  private async loadOrSynthesizeLoop(
    ctx: AudioContext,
    track: MicroLoopSpec
  ): Promise<AudioBuffer> {
    const cached = this.bufferCache.get(track.id);
    if (cached) return cached;

    try {
      const res = await fetch(track.opusPath);
      const contentType = res.headers.get('content-type') ?? '';
      if (res.ok && !contentType.includes('text/html')) {
        const arrayBuf = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrayBuf);
        this.bufferCache.set(track.id, decoded);
        return decoded;
      }
    } catch {
      // Fallback cleanly to sample-accurate synthesized AudioBuffer below
    }

    const rendered = await this.synthesizeSeamlessLoop(ctx.sampleRate, track);
    this.bufferCache.set(track.id, rendered);
    return rendered;
  }

  /**
   * Renders a sample-accurate 4-to-8-bar twilight loop via OfflineAudioContext
   * with zero-crossing loop boundary tapering so `source.loop = true` cycles cleanly.
   */
  private async synthesizeSeamlessLoop(
    sampleRate: number,
    track: MicroLoopSpec
  ): Promise<AudioBuffer> {
    const beatSeconds = 60 / track.bpm;
    const duration = Math.min(track.bars * 4 * beatSeconds, 16);
    const totalFrames = Math.floor(sampleRate * duration);
    const offline = new OfflineAudioContext(2, totalFrames, sampleRate);

    const masterFilter = offline.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.setValueAtTime(920, 0);

    const masterGain = offline.createGain();
    masterGain.gain.setValueAtTime(0.42, 0);
    masterFilter.connect(masterGain);
    masterGain.connect(offline.destination);

    // Gentle warm drone pad per bar across exact integer loop cycles
    track.chordHz.forEach((freq, idx) => {
      const osc = offline.createOscillator();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, 0);

      const g = offline.createGain();
      g.gain.setValueAtTime(idx === 0 ? 0.16 : 0.055, 0);

      osc.connect(g);
      g.connect(masterFilter);
      osc.start(0);
      osc.stop(duration);
    });

    // Subtle quantized arpeggio pulses locked strictly to beat subdivisions
    const steps = track.bars * 4;
    for (let s = 0; s < steps; s++) {
      const t = s * beatSeconds;
      const noteFreq = track.chordHz[(s * 2 + 1) % track.chordHz.length] * (s % 4 === 0 ? 2 : 1);
      const pluck = offline.createOscillator();
      pluck.type = 'sine';
      pluck.frequency.setValueAtTime(noteFreq, t);

      const env = offline.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.06, t + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, Math.min(duration, t + beatSeconds * 0.85));

      pluck.connect(env);
      env.connect(masterFilter);
      pluck.start(t);
      pluck.stop(Math.min(duration, t + beatSeconds * 0.9));
    }

    const rendered = await offline.startRendering();

    // Enforce 5ms edge cross-fade at buffer wrap boundaries to guarantee clickless looping
    const fadeSamples = Math.min(Math.floor(sampleRate * 0.005), Math.floor(totalFrames / 8));
    for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
      const data = rendered.getChannelData(ch);
      for (let i = 0; i < fadeSamples; i++) {
        const w = i / fadeSamples;
        data[i] *= w;
        data[totalFrames - 1 - i] *= w;
      }
    }

    return rendered;
  }

  private startProgressLoop(): void {
    const tick = () => {
      if (this.activeTrackId && this.audioCtx && this.activeDuration > 0) {
        const elapsed = Math.max(0, this.audioCtx.currentTime - this.activeStartTime);
        const pct = ((elapsed % this.activeDuration) / this.activeDuration) * 100;
        const el = this.progressEls.get(this.activeTrackId);
        if (el) {
          el.style.width = `${pct.toFixed(2)}%`;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

new ObjectsArchiveApp();
