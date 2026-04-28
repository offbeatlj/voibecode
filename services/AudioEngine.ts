import { InstrumentType, Scale } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private destination: AudioNode | null = null;
  private recorderDest: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  constructor() {
    // Lazy init in getContext
  }

  public getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.setupMasterChain();
    }
    return this.ctx;
  }

  public getAnalyser(): AnalyserNode | null {
    if (!this.ctx) this.getContext();
    return this.analyser;
  }

  private setupMasterChain() {
    if (!this.ctx) return;

    // Create Nodes
    this.masterGain = this.ctx.createGain();
    this.masterFilter = this.ctx.createBiquadFilter();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.recorderDest = this.ctx.createMediaStreamDestination();

    // Default Config
    this.masterGain.gain.value = 0.8;
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 22000; // Open by default
    this.masterFilter.Q.value = 1;

    // Graph: MasterGain -> MasterFilter -> Analyser -> Destination (Speakers)
    //                                              -> Recorder (Stream)
    this.masterGain.connect(this.masterFilter);
    this.masterFilter.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.analyser.connect(this.recorderDest);
  }

  public async resume() {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  public getCurrentTime(): number {
    return this.getContext().currentTime;
  }

  // --- Global FX ---
  public setMasterFilter(val: number) {
    if (!this.masterFilter || !this.ctx) return;

    if (val === 0) {
      this.masterFilter.frequency.setValueAtTime(22000, this.ctx.currentTime);
      this.masterFilter.type = 'lowpass';
    } else if (val < 0) {
      // Lowpass
      const norm = (val + 100) / 100; // 0 to 1
      const freq = Math.pow(norm, 3) * 20000 + 100; 
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
    } else {
      // Highpass
      const norm = val / 100;
      const freq = Math.pow(norm, 3) * 10000 + 50;
      this.masterFilter.type = 'highpass';
      this.masterFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
    }
  }

  // --- Recorder ---
  public startRecording(videoStream?: MediaStream) {
    if (!this.recorderDest) this.getContext();
    if (!this.recorderDest) return;

    this.chunks = [];
    
    let finalStream = this.recorderDest.stream;

    // Combine Audio + Video if provided
    if (videoStream) {
        const audioTracks = this.recorderDest.stream.getAudioTracks();
        const videoTracks = videoStream.getVideoTracks();
        finalStream = new MediaStream([...audioTracks, ...videoTracks]);
    }

    const mimeTypes = [
        'video/mp4;codecs=avc1,aac', 
        'video/mp4',
        'video/webm;codecs=vp9,opus', 
        'video/webm', 
        'audio/webm'
    ];
    
    let selectedType = '';
    for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
            selectedType = type;
            break;
        }
    }
    
    try {
        this.mediaRecorder = new MediaRecorder(finalStream, selectedType ? { mimeType: selectedType, videoBitsPerSecond: 2500000 } : undefined);
    } catch (e) {
        console.warn("MediaRecorder initialization failed", e);
        return;
    }

    this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            this.chunks.push(e.data);
        }
    };
    this.mediaRecorder.start();
  }

  public stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject('No recorder');
        return;
      }
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder?.mimeType || 'video/webm' });
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }

  // --- Synthesis ---

  public playSound(type: InstrumentType, time: number, volume: number, stepIndex: number, scale?: Scale, velocity: number = 1) {
    const ctx = this.getContext();
    if (!this.masterGain) return;

    const trackGain = ctx.createGain();
    // Apply velocity to volume
    trackGain.gain.value = volume * velocity;
    trackGain.connect(this.masterGain);

    // If velocity is negative (sustain), we typically shouldn't have reached here from the scheduler if implemented purely,
    // but if we did, we treat it as a continuation.
    // For this simple engine, we will treat playSound as "Trigger Attack".
    // Sustain steps (-1) are handled in the App scheduler by *not* calling playSound but extending the previous note if possible.
    // However, since this engine is "fire and forget", we will just play a normal note for now if called.
    
    const createNoise = (duration: number, highpass: boolean = false, freq: number = 1000) => {
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        
        const noiseGain = ctx.createGain();
        
        if (highpass) {
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = freq;
            noise.connect(filter).connect(noiseGain);
        } else {
            noise.connect(noiseGain);
        }
        return { source: noise, gain: noiseGain };
    };

    const createOsc = (type: OscillatorType, freq: number) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        osc.connect(gain);
        return { source: osc, gain: gain };
    };

    switch (type) {
      case InstrumentType.KICK: {
        const { source: osc, gain: env } = createOsc('sine', 150);
        env.connect(trackGain);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        env.gain.setValueAtTime(1, time);
        env.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
        osc.start(time);
        osc.stop(time + 0.5);
        break;
      }
      case InstrumentType.LOFI_KICK: {
        const { source: osc, gain: env } = createOsc('square', 100);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 120;
        
        env.connect(filter).connect(trackGain);
        osc.frequency.exponentialRampToValueAtTime(30, time + 0.3);
        env.gain.setValueAtTime(0.8, time);
        env.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
        osc.start(time);
        osc.stop(time + 0.3);
        break;
      }
      case InstrumentType.SNARE: {
        const { source: noise, gain: noiseGain } = createNoise(0.2, true, 1000);
        noiseGain.connect(trackGain);
        noiseGain.gain.setValueAtTime(1, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
        noise.start(time);
        
        const { source: osc, gain: oscGain } = createOsc('triangle', 250);
        oscGain.connect(trackGain);
        oscGain.gain.setValueAtTime(0.5, time);
        oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        osc.start(time);
        osc.stop(time + 0.2);
        break;
      }
      case InstrumentType.LOFI_SNARE: {
        const { source: noise, gain: noiseGain } = createNoise(0.15, false);
        const shaper = ctx.createWaveShaper();
        noiseGain.connect(shaper).connect(trackGain);
        noiseGain.gain.setValueAtTime(0.8, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
        noise.start(time);
        break;
      }
      case InstrumentType.CLAP: {
         const dur = 0.2;
         const { source: noise, gain: noiseGain } = createNoise(dur, true, 1200);
         noiseGain.connect(trackGain);
         const t = time;
         noiseGain.gain.setValueAtTime(0, t);
         noiseGain.gain.linearRampToValueAtTime(1, t + 0.01);
         noiseGain.gain.exponentialRampToValueAtTime(0.1, t + 0.03);
         noiseGain.gain.setValueAtTime(1, t + 0.035);
         noiseGain.gain.exponentialRampToValueAtTime(0.1, t + 0.06);
         noiseGain.gain.setValueAtTime(1, t + 0.065);
         noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
         noise.start(time);
         break;
      }
      case InstrumentType.HIHAT: {
        const { source: noise, gain } = createNoise(0.1, true, 6000);
        gain.connect(trackGain);
        gain.gain.setValueAtTime(0.7, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
        noise.start(time);
        break;
      }
      case InstrumentType.OPENHAT: {
        const { source: noise, gain } = createNoise(0.4, true, 5000);
        gain.connect(trackGain);
        gain.gain.setValueAtTime(0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
        noise.start(time);
        break;
      }
      case InstrumentType.TOM: {
        const { source: osc, gain: env } = createOsc('sine', 200);
        env.connect(trackGain);
        osc.frequency.setValueAtTime(200, time);
        osc.frequency.exponentialRampToValueAtTime(50, time + 0.3);
        env.gain.setValueAtTime(1, time);
        env.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
        osc.start(time);
        osc.stop(time + 0.3);
        break;
      }
      case InstrumentType.CRASH: {
        const { source: noise, gain } = createNoise(1.5, true, 3000);
        gain.connect(trackGain);
        gain.gain.setValueAtTime(0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 1.2);
        noise.start(time);
        break;
      }
      case InstrumentType.RIDE: {
        const { source: noise, gain } = createNoise(0.8, true, 8000);
        gain.connect(trackGain);
        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
        noise.start(time);
        break;
      }
      case InstrumentType.PERC: {
         const { source: osc, gain: env } = createOsc('sine', 800);
         env.connect(trackGain);
         env.gain.setValueAtTime(0.7, time);
         env.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
         osc.start(time);
         osc.stop(time + 0.1);
         break;
      }
      case InstrumentType.BASS: {
        const { source: osc, gain: env } = createOsc('sawtooth', 55);
        let freq = 55;
        if (scale && scale.frequencies.length > 0) {
             freq = scale.frequencies[stepIndex % 4] / 4; 
        }
        osc.frequency.setValueAtTime(freq, time);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, time);
        env.connect(filter).connect(trackGain);
        env.gain.setValueAtTime(1, time);
        env.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
        osc.start(time);
        osc.stop(time + 0.4);
        break;
      }
      case InstrumentType.PLUCK: {
        const { source: osc, gain: env } = createOsc('square', 440);
        let freq = 440;
        if (scale && scale.frequencies.length > 0) {
            freq = scale.frequencies[(stepIndex * 2) % scale.frequencies.length];
        }
        osc.frequency.setValueAtTime(freq, time);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, time);
        filter.frequency.exponentialRampToValueAtTime(200, time + 0.2);
        
        env.connect(filter).connect(trackGain);
        env.gain.setValueAtTime(0.6, time);
        env.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
        osc.start(time);
        osc.stop(time + 0.3);
        break;
      }
      case InstrumentType.SYNTH_LEAD: {
        const freq = scale && scale.frequencies.length > 0 
            ? scale.frequencies[(stepIndex * 3) % scale.frequencies.length]
            : 440;
        
        const { source: osc, gain: env } = createOsc('triangle', freq);
        const { source: osc2, gain: env2 } = createOsc('triangle', freq + 3); // Detune
        
        env.connect(trackGain);
        env2.connect(trackGain);
        
        const now = time;
        env.gain.setValueAtTime(0.3, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        env2.gain.setValueAtTime(0.3, now);
        env2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        
        osc.start(now);
        osc.stop(now + 0.4);
        osc2.start(now);
        osc2.stop(now + 0.4);
        break;
      }
      case InstrumentType.FX: {
         const { source: osc, gain: env } = createOsc('sine', 200);
         const filter = ctx.createBiquadFilter();
         filter.type = 'bandpass';
         env.connect(filter).connect(trackGain);
         
         const startFreq = 200 + Math.random() * 800;
         const endFreq = 100 + Math.random() * 200;
         
         osc.frequency.setValueAtTime(startFreq, time);
         osc.frequency.linearRampToValueAtTime(endFreq, time + 0.5);
         
         env.gain.setValueAtTime(0.5, time);
         env.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
         osc.start(time);
         osc.stop(time + 0.6);
         break;
      }
    }
  }
}

export const audioEngine = new AudioEngine();