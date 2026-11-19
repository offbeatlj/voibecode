import {
  AudioMode,
  AudioStemMix,
  VOIBE_CARTRIDGES,
  VoibeCartridgeId,
  VoibeCartridgeSpec,
  VoiceCalloutKind,
} from './types.js';

interface AudioContextConstructorLike {
  new (): AudioContext;
}

function getAudioContextConstructor(): AudioContextConstructorLike | null {
  const g = globalThis as unknown as {
    AudioContext?: AudioContextConstructorLike;
    webkitAudioContext?: AudioContextConstructorLike;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

interface ChordVoicing {
  bass: number;
  notes: number[];
  arp: number[];
}

const CARTRIDGE_PROGRESSIONS: Record<VoibeCartridgeId, ChordVoicing[]> = {
  'coding-down-under': [
    { bass: 55.0, notes: [220.0, 277.18, 329.63, 415.3, 493.88], arp: [493.88, 659.25, 830.61] },
    { bass: 46.25, notes: [185.0, 220.0, 277.18, 329.63, 440.0], arp: [440.0, 554.37, 659.25] },
    { bass: 73.42, notes: [146.83, 220.0, 277.18, 329.63, 369.99], arp: [369.99, 554.37, 659.25] },
    { bass: 82.41, notes: [164.81, 220.0, 246.94, 329.63, 415.3], arp: [415.3, 493.88, 659.25] },
  ],
  'tape-field': [
    { bass: 65.41, notes: [261.63, 329.63, 392.0, 493.88, 587.33], arp: [523.25, 659.25, 783.99] },
    { bass: 55.0, notes: [220.0, 261.63, 329.63, 392.0, 493.88], arp: [440.0, 523.25, 659.25] },
    { bass: 43.65, notes: [174.61, 220.0, 261.63, 329.63, 392.0], arp: [349.23, 523.25, 659.25] },
    { bass: 49.0, notes: [196.0, 261.63, 293.66, 349.23, 440.0], arp: [392.0, 523.25, 587.33] },
  ],
  'eno-airport': [
    { bass: 38.89, notes: [155.56, 196.0, 233.08, 293.66, 349.23], arp: [466.16, 587.33, 698.46] },
    { bass: 36.71, notes: [146.83, 233.08, 293.66, 349.23, 440.0], arp: [440.0, 587.33, 880.0] },
    { bass: 65.41, notes: [130.81, 196.0, 233.08, 293.66, 349.23], arp: [392.0, 523.25, 783.99] },
    { bass: 51.91, notes: [207.65, 261.63, 311.13, 392.0, 466.16], arp: [523.25, 622.25, 783.99] },
  ],
  'tokyo-rain': [
    { bass: 73.42, notes: [146.83, 220.0, 261.63, 329.63, 392.0], arp: [523.25, 659.25, 783.99] },
    { bass: 49.0, notes: [196.0, 233.08, 293.66, 349.23, 440.0], arp: [440.0, 587.33, 698.46] },
    { bass: 58.27, notes: [233.08, 293.66, 349.23, 440.0, 523.25], arp: [523.25, 698.46, 880.0] },
    { bass: 55.0, notes: [220.0, 277.18, 329.63, 392.0, 466.16], arp: [466.16, 554.37, 659.25] },
  ],
};

export const DEFAULT_AUDIO_MIX: AudioStemMix = {
  synth: 0.85,
  beats: 0.65,
  rain: 0.35,
  drone: 0.45,
  voice: 1.0,
  warmth: 0.78,
};

/**
 * Studio-grade 5-stem procedural Web Audio soundscape engine + Australian Woman Voice Announcer:
 * - Independent live stem faders: SYNTH, BEATS, RAIN (procedural stereo rainfall), DRONE (180Hz brown noise + fifth pad), VOICE, and WARMTH cutoff.
 * - Exposes AnalyserNode for real-time horizon oscilloscope rendering.
 * - Speaks natural en-AU female callouts routed through a vocal preamp + twilight reverb BEFORE swelling the synth engine up.
 */
export class TwilightAudioEngine {
  private ctx: AudioContext | null = null;
  private mode: AudioMode = 'OFF';
  private cartridgeId: VoibeCartridgeId = 'coding-down-under';
  private workspaceName = 'Voibcode';
  private voiceEnabled = true;
  private mix: AudioStemMix = { ...DEFAULT_AUDIO_MIX };

  private masterBus: GainNode | null = null;
  private synthDuckGain: GainNode | null = null;
  private synthStemGain: GainNode | null = null;
  private beatsStemGain: GainNode | null = null;
  private rainStemGain: GainNode | null = null;
  private droneStemGain: GainNode | null = null;
  private reactiveFilter: BiquadFilterNode | null = null;
  private reverbSend: GainNode | null = null;
  private delaySend: GainNode | null = null;
  private vocalInput: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  private droneNoiseSource: AudioBufferSourceNode | null = null;
  private droneOscA: OscillatorNode | null = null;
  private droneOscE: OscillatorNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private whiteNoiseBuf: AudioBuffer | null = null;
  private activeVoiceSource: AudioBufferSourceNode | null = null;

  private sequencerTimer: ReturnType<typeof setInterval> | null = null;
  private stopTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private stepIndex = 0;
  private barIndex = 0;
  private nextStepTime = 0;
  private isStallDucked = false;
  private voiceBufferCache = new Map<string, AudioBuffer>();
  private onCalloutCallbacks = new Set<(text: string) => void>();
  private onPulseCallbacks = new Set<(energy: number) => void>();

  public getMode(): AudioMode {
    return this.mode;
  }

  public getCartridgeId(): VoibeCartridgeId {
    return this.cartridgeId;
  }

  public getCartridgeSpec(): VoibeCartridgeSpec {
    return (
      VOIBE_CARTRIDGES.find((c) => c.id === this.cartridgeId) ??
      VOIBE_CARTRIDGES[0]
    );
  }

  public getMix(): AudioStemMix {
    return { ...this.mix };
  }

  public setMix(partial: Partial<AudioStemMix>): AudioStemMix {
    const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
    if (typeof partial.synth === 'number') this.mix.synth = clamp01(partial.synth);
    if (typeof partial.beats === 'number') this.mix.beats = clamp01(partial.beats);
    if (typeof partial.rain === 'number') this.mix.rain = clamp01(partial.rain);
    if (typeof partial.drone === 'number') this.mix.drone = clamp01(partial.drone);
    if (typeof partial.voice === 'number') {
      this.mix.voice = clamp01(partial.voice);
      this.voiceEnabled = this.mix.voice > 0.02;
    }
    if (typeof partial.warmth === 'number') this.mix.warmth = clamp01(partial.warmth);

    this.applyStemGains();
    return this.getMix();
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public setWorkspaceName(name: string): void {
    const clean = name.trim().replace(/[\\/]+$/, '');
    if (clean) {
      this.workspaceName = clean;
    }
  }

  public getWorkspaceName(): string {
    return this.workspaceName;
  }

  public setVoiceEnabled(enabled: boolean): void {
    this.voiceEnabled = enabled;
    if (enabled && this.mix.voice < 0.05) {
      this.mix.voice = 1.0;
    }
    this.applyStemGains();
  }

  public isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }

  public onCallout(cb: (text: string) => void): () => void {
    this.onCalloutCallbacks.add(cb);
    return () => this.onCalloutCallbacks.delete(cb);
  }

  public onPulse(cb: (energy: number) => void): () => void {
    this.onPulseCallbacks.add(cb);
    return () => this.onPulseCallbacks.delete(cb);
  }

  public async setCartridge(
    id: VoibeCartridgeId,
    announce = true
  ): Promise<VoibeCartridgeSpec> {
    this.cartridgeId = id;
    const spec = this.getCartridgeSpec();
    this.stepIndex = 0;
    this.barIndex = 0;

    // Give Tokyo Rain a lush default rain presence automatically if rain was low
    if (id === 'tokyo-rain' && this.mix.rain < 0.5) {
      this.mix.rain = 0.65;
      this.applyStemGains();
    }

    if (this.mode === 'SYNTH' && announce && this.voiceEnabled) {
      await this.speakCallout('cartridge', this.workspaceName);
    }
    return spec;
  }

  public async setMode(
    nextMode: AudioMode,
    introCallout: VoiceCalloutKind = 'start'
  ): Promise<void> {
    if (this.mode === nextMode) return;
    this.mode = nextMode;

    if (nextMode === 'SYNTH') {
      await this.startSynthWithVoiceIntro(introCallout);
    } else {
      await this.fadeOutAndStop();
    }
  }

  public async toggleMode(): Promise<AudioMode> {
    const next: AudioMode = this.mode === 'OFF' ? 'SYNTH' : 'OFF';
    await this.setMode(next);
    return this.mode;
  }

  public async speakCallout(
    kind: VoiceCalloutKind,
    workspaceOverride?: string
  ): Promise<string> {
    const ws = (workspaceOverride || this.workspaceName || 'VoibeCode').trim();
    const spec = this.getCartridgeSpec();

    let spokenText = `Time to Voibe code. Workspace ${ws}.`;
    let fallbackSlug = 'time-to-voibecode';

    switch (kind) {
      case 'start':
        spokenText = `Time to Voibe code. Workspace ${ws}.`;
        fallbackSlug = 'time-to-voibecode';
        break;
      case 'working':
        spokenText = `Agent working in ${ws}.`;
        fallbackSlug = 'agent-working';
        break;
      case 'stall':
        spokenText = `Stall detected in ${ws}. Waiting on your input.`;
        fallbackSlug = 'stall';
        break;
      case 'complete':
        spokenText = `Task complete in ${ws}.`;
        fallbackSlug = 'complete';
        break;
      case 'error':
        spokenText = `Check error in ${ws}.`;
        fallbackSlug = 'error';
        break;
      case 'cartridge':
        spokenText = `Cartridge ${spec.code}. ${spec.name}. Time to Voibe code.`;
        fallbackSlug = spec.id;
        break;
    }

    for (const cb of this.onCalloutCallbacks) {
      cb(spokenText.toUpperCase());
    }

    if (!this.voiceEnabled || this.mix.voice <= 0.02) {
      return spokenText;
    }

    const ctx = await this.ensureContext();
    if (!ctx) return spokenText;

    this.duckSynthForVoice(true);

    const playedBuffer = await this.tryPlayNeuralAustralianVoice(
      ctx,
      spokenText,
      fallbackSlug
    );

    if (!playedBuffer) {
      await this.speakBrowserAustralianFallback(spokenText);
    }

    this.duckSynthForVoice(false);
    return spokenText;
  }

  public async triggerStallChime(workspaceOverride?: string): Promise<void> {
    const ctx = await this.ensureContext();
    if (!ctx) return;

    this.isStallDucked = true;
    if (this.reactiveFilter) {
      this.reactiveFilter.frequency.setTargetAtTime(340, ctx.currentTime, 0.12);
    }

    if (this.voiceEnabled && this.mix.voice > 0.02) {
      void this.speakCallout('stall', workspaceOverride);
    }

    const now = ctx.currentTime + (this.voiceEnabled ? 0.12 : 0);
    const notes = [528.0, 792.0, 1056.0];

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.13;
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime((idx - 1) * 0.45, start);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(0.11 / (idx * 0.35 + 1), start + 0.014);
      env.gain.exponentialRampToValueAtTime(0.0001, start + 1.15);

      const carrier = ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(freq, start);

      const mod = ctx.createOscillator();
      mod.type = 'triangle';
      mod.frequency.setValueAtTime(freq * 2.0, start);

      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(freq * 0.35, start);
      modGain.gain.exponentialRampToValueAtTime(0.01, start + 0.22);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(env);
      env.connect(panner);

      if (this.masterBus) panner.connect(this.masterBus);
      if (this.reverbSend) panner.connect(this.reverbSend);
      if (this.delaySend) panner.connect(this.delaySend);

      carrier.start(start);
      mod.start(start);
      carrier.stop(start + 1.2);
      mod.stop(start + 1.2);
    });

    this.emitPulse(0.85);
  }

  public async triggerStateTransition(
    state: 'RUNNING' | 'COMPLETE' | 'ERROR' | 'IDLE',
    workspaceOverride?: string
  ): Promise<void> {
    const ctx = await this.ensureContext();
    if (!ctx) return;

    this.isStallDucked = false;
    this.applyStemGains();

    if (state === 'ERROR' && this.reactiveFilter) {
      this.reactiveFilter.frequency.setTargetAtTime(680, ctx.currentTime, 0.18);
    }

    if (state === 'RUNNING') {
      void this.speakCallout('working', workspaceOverride);
    } else if (state === 'COMPLETE') {
      void this.speakCallout('complete', workspaceOverride);
      this.playResolutionArpeggio(ctx);
    } else if (state === 'ERROR') {
      void this.speakCallout('error', workspaceOverride);
    }
  }

  public fadeOutAndStop(): Promise<void> {
    if (!this.ctx || !this.masterBus) {
      this.cleanupSynthNodes();
      return Promise.resolve();
    }

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const gainParam = this.masterBus.gain;

    gainParam.cancelScheduledValues(now);
    gainParam.setValueAtTime(Math.max(gainParam.value, 0.0001), now);
    gainParam.linearRampToValueAtTime(0.0, now + 0.06);

    return new Promise((resolve) => {
      if (this.stopTimeoutId !== null) {
        clearTimeout(this.stopTimeoutId);
      }
      this.stopTimeoutId = setTimeout(() => {
        this.cleanupSynthNodes();
        resolve();
      }, 70);
    });
  }

  public dispose(): void {
    this.mode = 'OFF';
    if (this.stopTimeoutId !== null) {
      clearTimeout(this.stopTimeoutId);
      this.stopTimeoutId = null;
    }
    this.cleanupSynthNodes();
    if (this.ctx && this.ctx.state !== 'closed') {
      void this.ctx.close().catch(() => undefined);
    }
    this.ctx = null;
  }

  private emitPulse(energy: number): void {
    for (const cb of this.onPulseCallbacks) {
      cb(energy);
    }
  }

  private applyStemGains(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.synthStemGain) {
      this.synthStemGain.gain.setTargetAtTime(this.mix.synth, now, 0.05);
    }
    if (this.beatsStemGain) {
      this.beatsStemGain.gain.setTargetAtTime(this.mix.beats, now, 0.05);
    }
    if (this.rainStemGain) {
      this.rainStemGain.gain.setTargetAtTime(this.mix.rain * 0.22, now, 0.08);
    }
    if (this.droneStemGain) {
      this.droneStemGain.gain.setTargetAtTime(this.mix.drone * 0.16, now, 0.08);
    }
    if (this.vocalInput) {
      this.vocalInput.gain.setTargetAtTime(
        this.voiceEnabled ? this.mix.voice * 1.08 : 0,
        now,
        0.04
      );
    }
    if (this.reactiveFilter && !this.isStallDucked) {
      const freq = 420 + Math.pow(this.mix.warmth, 2.2) * 16080;
      this.reactiveFilter.frequency.setTargetAtTime(freq, now, 0.08);
    }
  }

  private async ensureContext(): Promise<AudioContext | null> {
    const AudioCtx = getAudioContextConstructor();
    if (!AudioCtx) return null;
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioCtx();
      this.buildMasterStudioBus(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // Ignored until user gesture
      }
    }
    return this.ctx;
  }

  private buildMasterStudioBus(ctx: AudioContext): void {
    const masterBus = ctx.createGain();
    masterBus.gain.value = 0.92;

    const synthDuckGain = ctx.createGain();
    synthDuckGain.gain.value = 1.0;

    const synthStemGain = ctx.createGain();
    synthStemGain.gain.value = this.mix.synth;

    const beatsStemGain = ctx.createGain();
    beatsStemGain.gain.value = this.mix.beats;

    const rainStemGain = ctx.createGain();
    rainStemGain.gain.value = this.mix.rain * 0.22;

    const droneStemGain = ctx.createGain();
    droneStemGain.gain.value = this.mix.drone * 0.16;

    const reactiveFilter = ctx.createBiquadFilter();
    reactiveFilter.type = 'lowpass';
    reactiveFilter.frequency.value = 420 + Math.pow(this.mix.warmth, 2.2) * 16080;
    reactiveFilter.Q.value = 0.72;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 16;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.008;
    comp.release.value = 0.2;

    const tapeShaper = ctx.createWaveShaper();
    const curve = new Float32Array(new ArrayBuffer(1024 * 4));
    for (let i = 0; i < 1024; i++) {
      const x = (i * 2) / 1024 - 1;
      curve[i] = Math.tanh(x * 1.35);
    }
    tapeShaper.curve = curve;
    tapeShaper.oversample = '2x';

    // Stereo algorithmic twilight impulse reverb
    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.44;
    const convolver = ctx.createConvolver();
    const revLen = Math.floor(ctx.sampleRate * 2.6);
    const impulse = ctx.createBuffer(2, revLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = impulse.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < revLen; i++) {
        const env = Math.pow(1 - i / revLen, 2.3);
        lp = lp * 0.74 + (Math.random() * 2 - 1) * env * 0.26;
        d[i] = lp;
      }
    }
    convolver.buffer = impulse;

    // Stereo ping-pong tape delay
    const delaySend = ctx.createGain();
    delaySend.gain.value = 0.24;
    const delayL = ctx.createDelay(1.0);
    const delayR = ctx.createDelay(1.0);
    delayL.delayTime.value = 0.318;
    delayR.delayTime.value = 0.477;
    const delayFb = ctx.createGain();
    delayFb.gain.value = 0.34;
    const delayLp = ctx.createBiquadFilter();
    delayLp.type = 'lowpass';
    delayLp.frequency.value = 1600;

    // Studio Vocal Preamp for Australian Woman Voice
    const vocalInput = ctx.createGain();
    vocalInput.gain.value = this.voiceEnabled ? this.mix.voice * 1.08 : 0;
    const vocalHp = ctx.createBiquadFilter();
    vocalHp.type = 'highpass';
    vocalHp.frequency.value = 185;
    const vocalPresence = ctx.createBiquadFilter();
    vocalPresence.type = 'peaking';
    vocalPresence.frequency.value = 3100;
    vocalPresence.gain.value = 2.8;
    const vocalReverbSend = ctx.createGain();
    vocalReverbSend.gain.value = 0.16;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.84;

    vocalInput.connect(vocalHp);
    vocalHp.connect(vocalPresence);
    vocalPresence.connect(comp);
    vocalPresence.connect(vocalReverbSend);
    vocalReverbSend.connect(convolver);

    // Stem routing into shared ducking & reactive filter bus
    synthStemGain.connect(synthDuckGain);
    beatsStemGain.connect(synthDuckGain);
    droneStemGain.connect(synthDuckGain);
    rainStemGain.connect(masterBus); // Rain stays lush and ambient above low-pass filter

    synthDuckGain.connect(reactiveFilter);
    reactiveFilter.connect(tapeShaper);
    tapeShaper.connect(masterBus);

    reactiveFilter.connect(reverbSend);
    reverbSend.connect(convolver);
    convolver.connect(masterBus);

    reactiveFilter.connect(delaySend);
    delaySend.connect(delayL);
    delayL.connect(delayR);
    delayR.connect(delayLp);
    delayLp.connect(delayFb);
    delayFb.connect(delayL);
    delayLp.connect(masterBus);

    masterBus.connect(comp);
    comp.connect(analyser);
    analyser.connect(ctx.destination);

    // Pre-build 2s white noise buffer for brushed hats
    const wLen = ctx.sampleRate * 2;
    const wBuf = ctx.createBuffer(1, wLen, ctx.sampleRate);
    const wData = wBuf.getChannelData(0);
    for (let i = 0; i < wLen; i++) {
      wData[i] = Math.random() * 2 - 1;
    }

    this.masterBus = masterBus;
    this.synthDuckGain = synthDuckGain;
    this.synthStemGain = synthStemGain;
    this.beatsStemGain = beatsStemGain;
    this.rainStemGain = rainStemGain;
    this.droneStemGain = droneStemGain;
    this.reactiveFilter = reactiveFilter;
    this.reverbSend = reverbSend;
    this.delaySend = delaySend;
    this.vocalInput = vocalInput;
    this.analyser = analyser;
    this.whiteNoiseBuf = wBuf;
  }

  private duckSynthForVoice(ducked: boolean): void {
    if (!this.ctx || !this.synthDuckGain) return;
    const now = this.ctx.currentTime;
    this.synthDuckGain.gain.cancelScheduledValues(now);
    this.synthDuckGain.gain.setTargetAtTime(ducked ? 0.16 : 1.0, now, ducked ? 0.04 : 0.24);
  }

  private async tryPlayNeuralAustralianVoice(
    ctx: AudioContext,
    text: string,
    fallbackSlug: string
  ): Promise<boolean> {
    if (!this.vocalInput) return false;

    const cacheKey = `${text}::${fallbackSlug}`;
    let audioBuf = this.voiceBufferCache.get(cacheKey);

    if (!audioBuf) {
      const candidates = [
        `/api/voice?q=${encodeURIComponent(text)}&fallback=${encodeURIComponent(fallbackSlug)}`,
        `/voice/${fallbackSlug}.mp3`,
      ];

      for (const url of candidates) {
        try {
          const res = await fetch(url);
          const ct = res.headers.get('content-type') ?? '';
          if (res.ok && !ct.includes('text/html')) {
            const raw = await res.arrayBuffer();
            if (raw.byteLength > 256) {
              audioBuf = await ctx.decodeAudioData(raw.slice(0));
              this.voiceBufferCache.set(cacheKey, audioBuf);
              break;
            }
          }
        } catch {
          // Try next candidate
        }
      }
    }

    if (!audioBuf) return false;

    if (this.activeVoiceSource) {
      try {
        this.activeVoiceSource.stop();
        this.activeVoiceSource.disconnect();
      } catch {
        // Ignore
      }
    }

    return new Promise<boolean>((resolve) => {
      const src = ctx.createBufferSource();
      src.buffer = audioBuf!;
      src.connect(this.vocalInput!);
      this.activeVoiceSource = src;
      src.onended = () => {
        if (this.activeVoiceSource === src) {
          this.activeVoiceSource = null;
        }
        resolve(true);
      };
      src.start(ctx.currentTime);
    });
  }

  private speakBrowserAustralianFallback(text: string): Promise<void> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'en-AU';
        utter.rate = 0.98;
        utter.pitch = 1.08;

        const voices = window.speechSynthesis.getVoices();
        const auFemale =
          voices.find(
            (v) =>
              v.lang.toLowerCase().includes('en-au') &&
              /natasha|catherine|karen|freya|female|google/i.test(v.name)
          ) ??
          voices.find((v) => v.lang.toLowerCase().includes('en-au')) ??
          voices.find((v) => /zira|aria|jenny|samantha|victoria|female/i.test(v.name));

        if (auFemale) {
          utter.voice = auFemale;
        }

        const safetyTimer = setTimeout(() => resolve(), 3200);
        utter.onend = () => {
          clearTimeout(safetyTimer);
          resolve();
        };
        utter.onerror = () => {
          clearTimeout(safetyTimer);
          resolve();
        };

        window.speechSynthesis.speak(utter);
      } catch {
        resolve();
      }
    });
  }

  private async startSynthWithVoiceIntro(
    introCallout: VoiceCalloutKind = 'start'
  ): Promise<void> {
    if (this.stopTimeoutId !== null) {
      clearTimeout(this.stopTimeoutId);
      this.stopTimeoutId = null;
    }
    this.cleanupSynthNodes();

    const ctx = await this.ensureContext();
    if (!ctx || this.mode !== 'SYNTH' || !this.masterBus) return;

    const now = ctx.currentTime;
    this.masterBus.gain.cancelScheduledValues(now);
    this.masterBus.gain.setValueAtTime(0.0001, now);
    this.masterBus.gain.linearRampToValueAtTime(0.92, now + 0.3);

    this.applyStemGains();
    this.startDroneAndRainLayers(ctx);

    this.stepIndex = 0;
    this.barIndex = 0;
    this.nextStepTime = ctx.currentTime + 0.08;
    this.sequencerTimer = setInterval(() => this.schedulerTick(), 30);

    if (this.voiceEnabled && this.mix.voice > 0.02) {
      void this.speakCallout(introCallout, this.workspaceName);
    }
  }

  private startDroneAndRainLayers(ctx: AudioContext): void {
    // 1. Warm brown noise + subtle vinyl crackle + 110Hz A2 / 164.81Hz E3 drone bed
    if (this.droneStemGain) {
      const dLen = ctx.sampleRate * 4;
      const dBuf = ctx.createBuffer(2, dLen, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = dBuf.getChannelData(ch);
        let last = 0;
        for (let i = 0; i < dLen; i++) {
          last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
          const dust = Math.random() > 0.9993 ? (Math.random() * 2 - 1) * 0.35 : 0;
          d[i] = last * 3.1 + dust;
        }
      }
      const dSrc = ctx.createBufferSource();
      dSrc.buffer = dBuf;
      dSrc.loop = true;

      const dLp = ctx.createBiquadFilter();
      dLp.type = 'lowpass';
      dLp.frequency.value = 180;

      dSrc.connect(dLp);
      dLp.connect(this.droneStemGain);
      dSrc.start(ctx.currentTime);
      this.droneNoiseSource = dSrc;

      const padLp = ctx.createBiquadFilter();
      padLp.type = 'lowpass';
      padLp.frequency.value = 300;
      const padG = ctx.createGain();
      padG.gain.value = 0.24;

      const oscA = ctx.createOscillator();
      oscA.type = 'sine';
      oscA.frequency.value = 110;
      const oscE = ctx.createOscillator();
      oscE.type = 'triangle';
      oscE.frequency.value = 164.81;

      oscA.connect(padLp);
      oscE.connect(padLp);
      padLp.connect(padG);
      padG.connect(this.droneStemGain);

      oscA.start(ctx.currentTime);
      oscE.start(ctx.currentTime);
      this.droneOscA = oscA;
      this.droneOscE = oscE;
    }

    // 2. Stereo procedural rainfall acoustics (Voss-style pink noise + droplet shimmer)
    if (this.rainStemGain) {
      const rLen = ctx.sampleRate * 5;
      const rBuf = ctx.createBuffer(2, rLen, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = rBuf.getChannelData(ch);
        let b0 = 0;
        let b1 = 0;
        let b2 = 0;
        let b3 = 0;
        for (let i = 0; i < rLen; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99765 * b0 + white * 0.099046;
          b1 = 0.96300 * b1 + white * 0.2965164;
          b2 = 0.57000 * b2 + white * 1.0526913;
          b3 = 0.1848 * white;
          const droplet = Math.random() > 0.9985 ? (Math.random() * 2 - 1) * 0.65 : 0;
          d[i] = (b0 + b1 + b2 + b3) * 0.14 + droplet;
        }
      }
      const rSrc = ctx.createBufferSource();
      rSrc.buffer = rBuf;
      rSrc.loop = true;

      const rBp = ctx.createBiquadFilter();
      rBp.type = 'bandpass';
      rBp.frequency.value = 1350;
      rBp.Q.value = 0.45;

      rSrc.connect(rBp);
      rBp.connect(this.rainStemGain);
      rSrc.start(ctx.currentTime);
      this.rainSource = rSrc;
    }
  }

  private schedulerTick(): void {
    if (this.mode !== 'SYNTH' || !this.ctx || !this.synthStemGain || !this.beatsStemGain) return;

    const spec = this.getCartridgeSpec();
    const progression = CARTRIDGE_PROGRESSIONS[this.cartridgeId];
    const stepSeconds = 60 / spec.bpm / 4;
    const now = this.ctx.currentTime;

    while (this.nextStepTime < now + 0.12) {
      const step = this.stepIndex;
      const bar = this.barIndex;
      const t = this.nextStepTime;
      const chord = progression[bar % progression.length];

      // Synth melodic / harmonic stem
      if (step === 0) {
        this.playChorusPadAndRhodes(this.ctx, chord, t, stepSeconds * 16);
        this.playWarmSubBass(this.ctx, chord.bass, t, stepSeconds * 14);
        this.emitPulse(0.28 * this.mix.synth);
      }

      if (step === 10 && this.cartridgeId !== 'eno-airport') {
        this.playWarmSubBass(this.ctx, chord.bass * 1.5, t, stepSeconds * 5);
      }

      if (step === 4 || step === 12 || (this.cartridgeId === 'eno-airport' && step === 8)) {
        const arpFreq = chord.arp[(step + bar) % chord.arp.length];
        this.playCrystalBellNote(this.ctx, arpFreq, t, stepSeconds * 6, (step - 8) / 12);
      }

      // Beats rhythmic stem (independently mixable to 0% for pure ambient!)
      if (this.cartridgeId !== 'eno-airport') {
        if (step === 0 || step === 10) {
          this.playSoftKick(this.ctx, t);
          if (this.mix.beats > 0.1) {
            this.emitPulse(0.45 * this.mix.beats);
          }
        }
        if (step === 4 || step === 12) {
          this.playSoftRimSnare(this.ctx, t);
        }
        if (step % 2 === 0) {
          const swing = step % 4 === 2 ? stepSeconds * 0.14 : 0;
          this.playBrushedHat(this.ctx, t + swing, step % 4 === 0 ? 0.05 : 0.028);
        }
      }

      this.nextStepTime += stepSeconds;
      this.stepIndex = (this.stepIndex + 1) % 16;
      if (this.stepIndex === 0) {
        this.barIndex++;
      }
    }
  }

  private playChorusPadAndRhodes(
    ctx: AudioContext,
    chord: ChordVoicing,
    t: number,
    dur: number
  ): void {
    if (!this.synthStemGain) return;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, t);
    filter.frequency.linearRampToValueAtTime(1450, t + dur * 0.45);
    filter.frequency.linearRampToValueAtTime(420, t + dur);
    filter.connect(this.synthStemGain);

    chord.notes.forEach((freq, idx) => {
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime(((idx % 3) - 1) * 0.55, t);
      pan.connect(filter);

      [-5, 5].forEach((detuneCents, dIdx) => {
        const osc = ctx.createOscillator();
        osc.type = dIdx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        osc.detune.setValueAtTime(detuneCents, t);

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(0.036 / (idx * 0.2 + 1), t + 0.35);
        env.gain.setValueAtTime(0.028 / (idx * 0.2 + 1), t + dur * 0.7);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(env);
        env.connect(pan);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      });
    });
  }

  private playWarmSubBass(
    ctx: AudioContext,
    freq: number,
    t: number,
    dur: number
  ): void {
    if (!this.synthStemGain) return;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    const tri = ctx.createOscillator();
    tri.type = 'triangle';
    tri.frequency.setValueAtTime(freq * 2, t);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(210, t);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.15, t + 0.04);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const triGain = ctx.createGain();
    triGain.gain.value = 0.22;

    osc.connect(env);
    tri.connect(triGain);
    triGain.connect(lp);
    lp.connect(env);
    env.connect(this.synthStemGain);

    osc.start(t);
    tri.start(t);
    osc.stop(t + dur + 0.04);
    tri.stop(t + dur + 0.04);
  }

  private playCrystalBellNote(
    ctx: AudioContext,
    freq: number,
    t: number,
    dur: number,
    panVal: number
  ): void {
    if (!this.synthStemGain) return;

    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(Math.max(-0.8, Math.min(0.8, panVal)), t);
    pan.connect(this.synthStemGain);

    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, t);

    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.setValueAtTime(freq * 3.0, t);

    const modEnv = ctx.createGain();
    modEnv.gain.setValueAtTime(freq * 0.25, t);
    modEnv.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.046, t + 0.018);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    mod.connect(modEnv);
    modEnv.connect(carrier.frequency);
    carrier.connect(env);
    env.connect(pan);

    carrier.start(t);
    mod.start(t);
    carrier.stop(t + dur + 0.04);
    mod.stop(t + 0.22);
  }

  private playSoftKick(ctx: AudioContext, t: number): void {
    if (!this.beatsStemGain) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(118, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.085);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.28, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

    osc.connect(env);
    env.connect(this.beatsStemGain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private playSoftRimSnare(ctx: AudioContext, t: number): void {
    if (!this.beatsStemGain) return;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(165, t + 0.055);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.085, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

    osc.connect(env);
    env.connect(this.beatsStemGain);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  private playBrushedHat(ctx: AudioContext, t: number, amp: number): void {
    if (!this.beatsStemGain || !this.whiteNoiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(6800, t);
    hp.Q.value = 1.6;

    const env = ctx.createGain();
    env.gain.setValueAtTime(amp, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);

    src.connect(hp);
    hp.connect(env);
    env.connect(this.beatsStemGain);
    src.start(t);
    src.stop(t + 0.065);
  }

  private playResolutionArpeggio(ctx: AudioContext): void {
    const now = ctx.currentTime + 0.08;
    const notes = [220.0, 277.18, 329.63, 415.3, 493.88, 659.25];
    notes.forEach((f, i) => {
      this.playCrystalBellNote(ctx, f, now + i * 0.075, 1.4, (i - 2.5) * 0.25);
    });
  }

  private cleanupSynthNodes(): void {
    if (this.sequencerTimer !== null) {
      clearInterval(this.sequencerTimer);
      this.sequencerTimer = null;
    }
    const stopNode = (n: { stop: () => void; disconnect: () => void } | null) => {
      if (!n) return;
      try {
        n.stop();
        n.disconnect();
      } catch {
        // Ignore
      }
    };
    stopNode(this.droneNoiseSource);
    stopNode(this.droneOscA);
    stopNode(this.droneOscE);
    stopNode(this.rainSource);
    stopNode(this.activeVoiceSource);
    this.droneNoiseSource = null;
    this.droneOscA = null;
    this.droneOscE = null;
    this.rainSource = null;
    this.activeVoiceSource = null;
  }
}
