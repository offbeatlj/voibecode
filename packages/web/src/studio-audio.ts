import type { StudioInstrument, StudioScale, StudioTrack } from './studio-compiler.js';

export class TwilightStudioAudioEngine {
  private ctx: AudioContext | null = null;
  private masterInput: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private reverbSend: GainNode | null = null;
  private delaySend: GainNode | null = null;

  private droneActive = false;
  private droneMaster: GainNode | null = null;
  private droneNoise: AudioBufferSourceNode | null = null;
  private droneOscA: OscillatorNode | null = null;
  private droneOscE: OscillatorNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.setupGraph(this.ctx);
    }
    return this.ctx;
  }

  public async resume(): Promise<AudioContext> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    return ctx;
  }

  public getCurrentTime(): number {
    return this.ensureContext().currentTime;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public setFx(reverb: number, delay: number, filterVal: number): void {
    if (!this.ctx || !this.reverbSend || !this.delaySend || !this.masterFilter) return;
    const now = this.ctx.currentTime;
    this.reverbSend.gain.setTargetAtTime(Math.max(0, Math.min(0.85, reverb * 0.72)), now, 0.08);
    this.delaySend.gain.setTargetAtTime(Math.max(0, Math.min(0.6, delay * 0.48)), now, 0.08);

    if (filterVal === 0) {
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.setTargetAtTime(19500, now, 0.08);
    } else if (filterVal < 0) {
      const norm = (filterVal + 100) / 100;
      const freq = Math.pow(Math.max(0.05, norm), 2.8) * 16000 + 140;
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.setTargetAtTime(freq, now, 0.08);
    } else {
      const norm = filterVal / 100;
      const freq = Math.pow(norm, 2.4) * 5200 + 70;
      this.masterFilter.type = 'highpass';
      this.masterFilter.frequency.setTargetAtTime(freq, now, 0.08);
    }
  }

  public async setDrone(enabled: boolean): Promise<void> {
    if (this.droneActive === enabled) return;
    this.droneActive = enabled;
    if (enabled) {
      await this.startDrone();
    } else {
      this.stopDrone();
    }
  }

  public isDroneActive(): boolean {
    return this.droneActive;
  }

  /**
   * Computes how many consecutive sustain steps (`~` / `-`) follow `stepIndex`
   */
  public computeSustainSteps(steps: number[], stepIndex: number): number {
    let hold = 1;
    for (let i = 1; i < steps.length; i++) {
      const next = steps[(stepIndex + i) % steps.length];
      if (next === -1) hold++;
      else break;
    }
    return hold;
  }

  public triggerVoice(
    track: StudioTrack,
    time: number,
    velocity: number,
    stepIndex: number,
    stepSeconds: number,
    scale: StudioScale
  ): number {
    const ctx = this.ensureContext();
    if (!this.masterInput) return 0;

    const holdSteps = this.computeSustainSteps(track.steps, stepIndex);
    const holdSeconds = Math.max(stepSeconds * 0.9, holdSteps * stepSeconds);
    const gain = ctx.createGain();
    gain.gain.value = 0.72 * velocity;
    gain.connect(this.masterInput);

    const freqList = scale.frequencies;
    const note = (offset: number) => freqList[(stepIndex + offset) % freqList.length];

    let visualEnergy = 0;

    switch (track.instrument as StudioInstrument) {
      case 'kick': {
        this.playAnalogKick(ctx, gain, time, 148, 38, 0.42);
        visualEnergy = 0.55 * velocity;
        break;
      }
      case 'lofi_kick': {
        this.playAnalogKick(ctx, gain, time, 108, 34, 0.34, true);
        visualEnergy = 0.45 * velocity;
        break;
      }
      case 'snare': {
        this.playSnare(ctx, gain, time, false);
        visualEnergy = 0.25 * velocity;
        break;
      }
      case 'lofi_snare': {
        this.playSnare(ctx, gain, time, true);
        visualEnergy = 0.2 * velocity;
        break;
      }
      case 'clap': {
        this.playClap(ctx, gain, time);
        visualEnergy = 0.22 * velocity;
        break;
      }
      case 'hat': {
        this.playHat(ctx, gain, time, 0.055, 6800);
        break;
      }
      case 'openhat': {
        this.playHat(ctx, gain, time, 0.28, 5400);
        break;
      }
      case 'tom': {
        this.playAnalogKick(ctx, gain, time, 195, 68, 0.28);
        break;
      }
      case 'crash': {
        this.playHat(ctx, gain, time, 1.35, 3400);
        visualEnergy = 0.3;
        break;
      }
      case 'ride': {
        this.playHat(ctx, gain, time, 0.65, 8200);
        break;
      }
      case 'rim': {
        this.playRim(ctx, gain, time);
        break;
      }
      case 'bass': {
        this.playWarmBass(ctx, gain, time, note(0) / 4, holdSeconds);
        visualEnergy = 0.35 * velocity;
        break;
      }
      case 'rhodes': {
        this.playTwilightRhodes(ctx, gain, time, [note(0), note(2), note(4)], holdSeconds);
        visualEnergy = 0.22;
        break;
      }
      case 'pad': {
        this.playFifthPad(ctx, gain, time, note(0) * 0.5, holdSeconds);
        break;
      }
      case 'chime': {
        this.playStallChime(ctx, gain, time, stepIndex);
        visualEnergy = 0.65 * velocity;
        break;
      }
      case 'pluck': {
        this.playAnalogPluck(ctx, gain, time, note(stepIndex % 3), holdSeconds * 0.7);
        break;
      }
      case 'lead': {
        this.playAnalogLead(ctx, gain, time, note(2), holdSeconds);
        break;
      }
      case 'fx': {
        this.playTwilightWash(ctx, gain, time);
        visualEnergy = 0.3;
        break;
      }
    }

    return visualEnergy;
  }

  public dispose(): void {
    this.stopDrone();
    if (this.ctx && this.ctx.state !== 'closed') {
      void this.ctx.close().catch(() => undefined);
    }
    this.ctx = null;
  }

  private setupGraph(ctx: AudioContext): void {
    const input = ctx.createGain();
    input.gain.value = 0.85;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 3;
    comp.attack.value = 0.008;
    comp.release.value = 0.18;

    const tapeShaper = ctx.createWaveShaper();
    tapeShaper.curve = this.makeSoftSaturationCurve();
    tapeShaper.oversample = '2x';

    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.value = 19500;
    masterFilter.Q.value = 0.7;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.92;

    // Warm stereo twilight impulse reverb
    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.38;
    const convolver = ctx.createConvolver();
    convolver.buffer = this.createTwilightImpulse(ctx, 2.5);
    const reverbOut = ctx.createGain();
    reverbOut.gain.value = 0.7;

    // Dotted-eighth tape echo
    const delaySend = ctx.createGain();
    delaySend.gain.value = 0.18;
    const delayNode = ctx.createDelay(1.5);
    delayNode.delayTime.value = 0.312;
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.36;
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 1550;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.82;

    input.connect(tapeShaper);
    tapeShaper.connect(masterFilter);
    masterFilter.connect(dryGain);
    dryGain.connect(comp);

    masterFilter.connect(reverbSend);
    reverbSend.connect(convolver);
    convolver.connect(reverbOut);
    reverbOut.connect(comp);

    masterFilter.connect(delaySend);
    delaySend.connect(delayNode);
    delayNode.connect(delayFilter);
    delayFilter.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayFilter.connect(comp);

    comp.connect(analyser);
    analyser.connect(ctx.destination);

    this.masterInput = input;
    this.masterFilter = masterFilter;
    this.reverbSend = reverbSend;
    this.delaySend = delaySend;
    this.analyser = analyser;

    // Pre-build white noise buffer
    const nLen = ctx.sampleRate * 2;
    const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
    const nData = nBuf.getChannelData(0);
    for (let i = 0; i < nLen; i++) {
      nData[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = nBuf;
  }

  private makeSoftSaturationCurve(): Float32Array<ArrayBuffer> {
    const samples = 1024;
    const buffer = new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT);
    const curve = new Float32Array(buffer);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = Math.tanh(x * 1.45);
    }
    return curve;
  }

  private createTwilightImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2.4);
        const white = (Math.random() * 2 - 1) * decay;
        lp = lp * 0.72 + white * 0.28;
        data[i] = lp;
      }
    }
    return impulse;
  }

  private async startDrone(): Promise<void> {
    const ctx = await this.resume();
    if (!this.droneActive || !this.masterInput) return;
    this.cleanupDroneNodes();

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(0.55, now + 0.3);
    master.connect(this.masterInput);

    // 180Hz low-pass brown noise bed
    const nLen = ctx.sampleRate * 4;
    const bBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
    const bData = bBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < nLen; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      bData[i] = last * 3.5;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = bBuf;
    noiseSrc.loop = true;

    const noiseLp = ctx.createBiquadFilter();
    noiseLp.type = 'lowpass';
    noiseLp.frequency.setValueAtTime(180, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08, now);

    noiseSrc.connect(noiseLp);
    noiseLp.connect(noiseGain);
    noiseGain.connect(master);

    // 110Hz A2 sine + 164.81Hz E3 triangle fifth drone through 320Hz LPF
    const padLp = ctx.createBiquadFilter();
    padLp.type = 'lowpass';
    padLp.frequency.setValueAtTime(320, now);

    const padGain = ctx.createGain();
    padGain.gain.setValueAtTime(0.075, now);

    const oscA = ctx.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.setValueAtTime(110, now);

    const oscE = ctx.createOscillator();
    oscE.type = 'triangle';
    oscE.frequency.setValueAtTime(164.81, now);

    const eGain = ctx.createGain();
    eGain.gain.setValueAtTime(0.55, now);

    oscA.connect(padLp);
    oscE.connect(eGain);
    eGain.connect(padLp);
    padLp.connect(padGain);
    padGain.connect(master);

    noiseSrc.start(now);
    oscA.start(now);
    oscE.start(now);

    this.droneMaster = master;
    this.droneNoise = noiseSrc;
    this.droneOscA = oscA;
    this.droneOscE = oscE;
  }

  private stopDrone(): void {
    if (!this.ctx || !this.droneMaster) {
      this.cleanupDroneNodes();
      return;
    }
    const now = this.ctx.currentTime;
    const master = this.droneMaster;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
    master.gain.linearRampToValueAtTime(0, now + 0.06);
    setTimeout(() => this.cleanupDroneNodes(), 70);
  }

  private cleanupDroneNodes(): void {
    for (const node of [this.droneNoise, this.droneOscA, this.droneOscE]) {
      if (!node) continue;
      try {
        node.stop();
        node.disconnect();
      } catch {
        // Ignore
      }
    }
    try {
      this.droneMaster?.disconnect();
    } catch {
      // Ignore
    }
    this.droneNoise = null;
    this.droneOscA = null;
    this.droneOscE = null;
    this.droneMaster = null;
  }

  private playAnalogKick(
    ctx: AudioContext,
    out: GainNode,
    t: number,
    startHz: number,
    endHz: number,
    dur: number,
    lofi = false
  ): void {
    const osc = ctx.createOscillator();
    osc.type = lofi ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(startHz, t);
    osc.frequency.exponentialRampToValueAtTime(endHz, t + 0.09);
    osc.frequency.exponentialRampToValueAtTime(Math.max(24, endHz * 0.72), t + dur);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, t);
    env.gain.linearRampToValueAtTime(1.0, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    if (lofi) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(195, t);
      osc.connect(env);
      env.connect(lp);
      lp.connect(out);
    } else {
      osc.connect(env);
      env.connect(out);
    }

    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private playSnare(ctx: AudioContext, out: GainNode, t: number, lofi: boolean): void {
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = lofi ? 'bandpass' : 'highpass';
      filter.frequency.setValueAtTime(lofi ? 1150 : 950, t);

      const nEnv = ctx.createGain();
      nEnv.gain.setValueAtTime(lofi ? 0.55 : 0.72, t);
      nEnv.gain.exponentialRampToValueAtTime(0.001, t + (lofi ? 0.14 : 0.21));

      src.connect(filter);
      filter.connect(nEnv);
      nEnv.connect(out);
      src.start(t);
      src.stop(t + 0.24);
    }

    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(lofi ? 175 : 210, t);
    body.frequency.exponentialRampToValueAtTime(95, t + 0.09);

    const bEnv = ctx.createGain();
    bEnv.gain.setValueAtTime(0.45, t);
    bEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    body.connect(bEnv);
    bEnv.connect(out);
    body.start(t);
    body.stop(t + 0.14);
  }

  private playClap(ctx: AudioContext, out: GainNode, t: number): void {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1450, t);
    bp.Q.value = 1.4;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, t);
    env.gain.linearRampToValueAtTime(0.75, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.15, t + 0.025);
    env.gain.linearRampToValueAtTime(0.7, t + 0.032);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    src.connect(bp);
    bp.connect(env);
    env.connect(out);
    src.start(t);
    src.stop(t + 0.25);
  }

  private playHat(ctx: AudioContext, out: GainNode, t: number, dur: number, cutoff: number): void {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(cutoff, t);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.32, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(hp);
    hp.connect(env);
    env.connect(out);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private playRim(ctx: AudioContext, out: GainNode, t: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(640, t);
    osc.frequency.exponentialRampToValueAtTime(340, t + 0.045);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.35, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(env);
    env.connect(out);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  private playWarmBass(
    ctx: AudioContext,
    out: GainNode,
    t: number,
    freq: number,
    dur: number
  ): void {
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(freq, t);

    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(freq * 2, t);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2.4;
    lp.frequency.setValueAtTime(720, t);
    lp.frequency.exponentialRampToValueAtTime(160, t + Math.min(dur, 0.35));

    const sawGain = ctx.createGain();
    sawGain.gain.value = 0.28;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, t);
    env.gain.linearRampToValueAtTime(0.65, t + 0.014);
    env.gain.setValueAtTime(0.55, Math.max(t + 0.02, t + dur - 0.04));
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    sub.connect(env);
    saw.connect(lp);
    lp.connect(sawGain);
    sawGain.connect(env);
    env.connect(out);

    sub.start(t);
    saw.start(t);
    sub.stop(t + dur + 0.03);
    saw.stop(t + dur + 0.03);
  }

  private playTwilightRhodes(
    ctx: AudioContext,
    out: GainNode,
    t: number,
    freqs: number[],
    dur: number
  ): void {
    freqs.forEach((f, idx) => {
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime(((idx % 3) - 1) * 0.48, t);
      pan.connect(out);

      const carrier = ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(f, t);

      // FM harmonic modulator for authentic warm electric piano bell tine
      const mod = ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.setValueAtTime(f * 2.0, t);

      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(f * 0.42, t);
      modGain.gain.exponentialRampToValueAtTime(f * 0.03, t + 0.22);

      const tine = ctx.createOscillator();
      tine.type = 'triangle';
      tine.frequency.setValueAtTime(f * 6.0, t);

      const tineEnv = ctx.createGain();
      tineEnv.gain.setValueAtTime(0.035, t);
      tineEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.095);

      const env = ctx.createGain();
      const noteDur = Math.max(dur, 0.72);
      env.gain.setValueAtTime(0.001, t);
      env.gain.linearRampToValueAtTime(0.18 / (idx * 0.25 + 1), t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0008, t + noteDur);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(env);
      tine.connect(tineEnv);
      tineEnv.connect(env);
      env.connect(pan);

      carrier.start(t);
      mod.start(t);
      tine.start(t);
      carrier.stop(t + noteDur + 0.04);
      mod.stop(t + noteDur + 0.04);
      tine.stop(t + 0.12);
    });
  }

  private playFifthPad(
    ctx: AudioContext,
    out: GainNode,
    t: number,
    rootFreq: number,
    dur: number
  ): void {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(360, t);
    lp.frequency.linearRampToValueAtTime(1180, t + Math.max(dur, 0.9) * 0.5);
    lp.frequency.linearRampToValueAtTime(420, t + Math.max(dur, 0.9));
    lp.connect(out);

    const intervals = [1, 1.25, 1.4983, 1.875];
    intervals.forEach((mult, idx) => {
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime((idx - 1.5) * 0.4, t);
      pan.connect(lp);

      [-6, 6].forEach((cents, dIdx) => {
        const osc = ctx.createOscillator();
        osc.type = dIdx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(rootFreq * mult, t);
        osc.detune.setValueAtTime(cents, t);

        const env = ctx.createGain();
        const totalDur = Math.max(dur, 0.95);
        env.gain.setValueAtTime(0.0005, t);
        env.gain.linearRampToValueAtTime(0.085, t + Math.min(0.28, totalDur * 0.35));
        env.gain.exponentialRampToValueAtTime(0.0005, t + totalDur);

        osc.connect(env);
        env.connect(pan);
        osc.start(t);
        osc.stop(t + totalDur + 0.05);
      });
    });
  }

  private playStallChime(
    ctx: AudioContext,
    out: GainNode,
    t: number,
    stepIndex: number
  ): void {
    // 3-voice stereo FM crystal harmonic ping (528Hz -> 792Hz -> 1056Hz)
    const mult = stepIndex % 8 === 0 ? 1 : 1.125;
    const cascade = [528 * mult, 792 * mult, 1056 * mult];

    cascade.forEach((freq, idx) => {
      const start = t + idx * 0.095;
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime((idx - 1) * 0.5, start);
      pan.connect(out);

      const carrier = ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(freq, start);

      const mod = ctx.createOscillator();
      mod.type = 'triangle';
      mod.frequency.setValueAtTime(freq * 2, start);

      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(freq * 0.3, start);
      modGain.gain.exponentialRampToValueAtTime(0.01, start + 0.2);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0005, start);
      env.gain.linearRampToValueAtTime(0.18 / (idx * 0.3 + 1), start + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0005, start + 0.85);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(env);
      env.connect(pan);

      carrier.start(start);
      mod.start(start);
      carrier.stop(start + 0.9);
      mod.stop(start + 0.9);
    });
  }

  private playAnalogPluck(
    ctx: AudioContext,
    out: GainNode,
    t: number,
    freq: number,
    dur: number
  ): void {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, t);
    lp.frequency.exponentialRampToValueAtTime(280, t + 0.24);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, t);
    env.gain.linearRampToValueAtTime(0.32, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.26, dur));

    osc.connect(lp);
    lp.connect(env);
    env.connect(out);
    osc.start(t);
    osc.stop(t + Math.max(0.3, dur));
  }

  private playAnalogLead(
    ctx: AudioContext,
    out: GainNode,
    t: number,
    freq: number,
    dur: number
  ): void {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1850, t);
    lp.connect(out);

    [-2.5, 2.5].forEach((cents) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.detune.setValueAtTime(cents, t);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.001, t);
      env.gain.linearRampToValueAtTime(0.11, t + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.28, dur));

      osc.connect(env);
      env.connect(lp);
      osc.start(t);
      osc.stop(t + Math.max(0.32, dur));
    });
  }

  private playTwilightWash(ctx: AudioContext, out: GainNode, t: number): void {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3.2;
    bp.frequency.setValueAtTime(420, t);
    bp.frequency.exponentialRampToValueAtTime(1600, t + 0.55);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, t);
    env.gain.linearRampToValueAtTime(0.14, t + 0.18);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

    src.connect(bp);
    bp.connect(env);
    env.connect(out);
    src.start(t);
    src.stop(t + 0.7);
  }
}
