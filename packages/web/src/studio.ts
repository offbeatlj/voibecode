import {
  FLAGSHIP_HEX,
  TwilightAudioEngine,
  TwilightShaderController,
  normalizeHex,
} from '@voibecode/shared';
import { TwilightStudioAudioEngine } from './studio-audio.js';
import {
  STUDIO_PRESETS,
  STUDIO_TOTAL_STEPS,
  StudioCompileResult,
  StudioPreset,
  StudioTrack,
  compileStudioCode,
  stepsToPattern,
} from './studio-compiler.js';

class VoibeStudioApp {
  private readonly skyCanvas = document.getElementById('sky-canvas') as HTMLCanvasElement;
  private readonly presetBar = document.getElementById('preset-bar') as HTMLElement;
  private readonly voiceReadout = document.getElementById('studio-voice-readout') as HTMLElement;
  private readonly voiceToggleBtn = document.getElementById('studio-voice-toggle') as HTMLButtonElement;
  private readonly voiceTestBtn = document.getElementById('studio-voice-test') as HTMLButtonElement;
  private readonly codeInput = document.getElementById('studio-code') as HTMLTextAreaElement;
  private readonly compileStatusEl = document.getElementById('studio-compile-status') as HTMLElement;
  private readonly telemetryEl = document.getElementById('studio-telemetry') as HTMLElement;
  private readonly sequencerEl = document.getElementById('studio-sequencer') as HTMLElement;
  private readonly scopeCanvas = document.getElementById('studio-scope') as HTMLCanvasElement;
  private readonly playBtn = document.getElementById('play-toggle-btn') as HTMLButtonElement;
  private readonly stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;
  private readonly droneBtn = document.getElementById('drone-btn') as HTMLButtonElement;
  private readonly syntaxToggleBtn = document.getElementById('syntax-toggle-btn') as HTMLButtonElement;
  private readonly syntaxDrawer = document.getElementById('syntax-drawer') as HTMLElement;

  private readonly shader: TwilightShaderController;
  private readonly audio = new TwilightStudioAudioEngine();
  private readonly announcer = new TwilightAudioEngine();

  private activePresetId = STUDIO_PRESETS[0].id;
  private compiled: StudioCompileResult;
  private currentSkyHex = FLAGSHIP_HEX;
  private manualDroneOverride: boolean | null = null;
  private workspaceName = 'Voibcode';

  private isPlaying = false;
  private currentStep = 0;
  private nextNoteTime = 0;
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private compileDebounce: ReturnType<typeof setTimeout> | null = null;
  private pulseEnergy = 0;
  private uiStepEls: HTMLElement[][] = [];

  constructor() {
    this.shader = new TwilightShaderController(this.skyCanvas, FLAGSHIP_HEX);
    requestAnimationFrame(() => this.skyCanvas.classList.add('is-ready'));

    this.announcer.onCallout((spoken) => {
      this.voiceReadout.textContent = `AU VOICE // "${spoken}"`;
    });

    this.codeInput.value = STUDIO_PRESETS[0].code;
    this.compiled = compileStudioCode(this.codeInput.value);

    this.renderPresets();
    this.applyCompiledState();
    this.bindEvents();
    this.startScopeAndPulseLoop();
    void this.fetchWorkspaceState();
  }

  private async fetchWorkspaceState(): Promise<void> {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) return;
      const data = (await res.json()) as { workspaceName?: string };
      if (data.workspaceName) {
        this.workspaceName = data.workspaceName;
        this.announcer.setWorkspaceName(data.workspaceName);
        this.voiceReadout.textContent = `AU VOICE READY // WORKSPACE: ${data.workspaceName.toUpperCase()}`;
      }
    } catch {
      // Retain default workspace label
    }
  }

  private renderPresets(): void {
    this.presetBar.innerHTML = '';
    for (const preset of STUDIO_PRESETS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hairline-btn';
      btn.classList.toggle('is-active', preset.id === this.activePresetId);
      btn.textContent = `[ ${preset.label} ]`;
      btn.addEventListener('click', () => this.loadPreset(preset));
      this.presetBar.appendChild(btn);
    }
  }

  private loadPreset(preset: StudioPreset): void {
    this.activePresetId = preset.id;
    this.manualDroneOverride = null;
    this.codeInput.value = preset.code;
    this.compiled = compileStudioCode(preset.code);
    this.renderPresets();
    this.applyCompiledState();
  }

  private bindEvents(): void {
    this.codeInput.addEventListener('input', () => {
      if (this.compileDebounce) clearTimeout(this.compileDebounce);
      this.compileDebounce = setTimeout(() => {
        this.compiled = compileStudioCode(this.codeInput.value);
        this.applyCompiledState();
      }, 90);
    });

    this.playBtn.addEventListener('click', () => {
      void this.togglePlay();
    });

    this.stopBtn.addEventListener('click', () => {
      this.stopPlayback();
    });

    this.droneBtn.addEventListener('click', () => {
      void this.toggleDroneButton();
    });

    this.voiceToggleBtn.addEventListener('click', () => {
      const next = !this.announcer.isVoiceEnabled();
      this.announcer.setVoiceEnabled(next);
      this.voiceToggleBtn.textContent = next ? '[ AU VOICE: ON ]' : '[ AU VOICE: OFF ]';
      this.voiceToggleBtn.classList.toggle('is-active', next);
    });

    this.voiceTestBtn.addEventListener('click', () => {
      this.announcer.setVoiceEnabled(true);
      this.voiceToggleBtn.textContent = '[ AU VOICE: ON ]';
      this.voiceToggleBtn.classList.add('is-active');
      void this.announcer.speakCallout('start', this.workspaceName);
    });

    this.syntaxToggleBtn.addEventListener('click', () => {
      this.syntaxDrawer.hidden = !this.syntaxDrawer.hidden;
      this.syntaxToggleBtn.classList.toggle('is-active', !this.syntaxDrawer.hidden);
    });

    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void this.togglePlay();
      }
    });
  }

  private applyCompiledState(): void {
    const targetHex = normalizeHex(this.compiled.skyHex);
    if (targetHex !== this.currentSkyHex) {
      this.currentSkyHex = targetHex;
      this.shader.setPalette(targetHex, 400);
    }

    this.audio.setFx(this.compiled.reverb, this.compiled.delay, this.compiled.filter);

    const effectiveDrone =
      this.manualDroneOverride !== null ? this.manualDroneOverride : this.compiled.drone;
    if (this.isPlaying) {
      void this.audio.setDrone(effectiveDrone);
    }
    this.updateDroneLabel(effectiveDrone);

    this.compileStatusEl.textContent =
      this.compiled.logs.length > 0
        ? this.compiled.logs[0]
        : `${this.compiled.tracks.length} VOICES · ${this.compiled.scale.name.toUpperCase()}`;

    this.renderTelemetry();
    this.renderSequencerGrid();
  }

  private updateDroneLabel(on: boolean): void {
    this.droneBtn.textContent = on ? '[ DRONE ON ]' : '[ DRONE OFF ]';
    this.droneBtn.classList.toggle('is-active', on);
  }

  private async toggleDroneButton(): Promise<void> {
    const current = this.audio.isDroneActive();
    const next = !current;
    this.manualDroneOverride = next;
    await this.audio.resume();
    await this.audio.setDrone(next);
    this.updateDroneLabel(next);
  }

  private renderTelemetry(): void {
    const stepStr = String(this.currentStep + 1).padStart(2, '0');
    this.telemetryEl.textContent = `BPM ${Math.round(this.compiled.bpm)} · STEP ${stepStr}/16 · ${this.currentSkyHex}`;
  }

  private renderSequencerGrid(): void {
    this.sequencerEl.innerHTML = '';
    this.uiStepEls = [];

    if (this.compiled.tracks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'track-meta';
      empty.textContent = 'ADD VOICE CALLS SUCH AS kick("x...x...") OR chime("....x...")';
      this.sequencerEl.appendChild(empty);
      return;
    }

    for (const track of this.compiled.tracks) {
      const row = document.createElement('div');
      row.className = 'studio-track-row';

      const label = document.createElement('div');
      label.className = 'studio-track-label';
      label.textContent = track.name;
      row.appendChild(label);

      const stepsWrap = document.createElement('div');
      stepsWrap.className = 'studio-steps';
      const stepNodes: HTMLElement[] = [];

      for (let i = 0; i < STUDIO_TOTAL_STEPS; i++) {
        const val = track.steps[i];
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'studio-step';
        if (val > 0) cell.classList.add('is-hit');
        if (val >= 1.2) cell.classList.add('is-accent');
        if (val > 0 && val < 0.8) cell.classList.add('is-ghost');
        if (val < 0) cell.classList.add('is-hold');
        if (i % 4 === 0) cell.classList.add('is-beat');
        if (this.isPlaying && i === this.currentStep) cell.classList.add('is-now');

        cell.addEventListener('click', () => this.toggleStepInCode(track, i));
        stepsWrap.appendChild(cell);
        stepNodes.push(cell);
      }

      row.appendChild(stepsWrap);
      this.sequencerEl.appendChild(row);
      this.uiStepEls.push(stepNodes);
    }
  }

  private toggleStepInCode(track: StudioTrack, stepIdx: number): void {
    const nextSteps = [...track.steps];
    const current = nextSteps[stepIdx];
    if (current === 0) nextSteps[stepIdx] = 1;
    else if (current === 1) nextSteps[stepIdx] = 1.25;
    else if (current >= 1.2) nextSteps[stepIdx] = 0.45;
    else nextSteps[stepIdx] = 0;

    const newPattern = stepsToPattern(nextSteps);
    const lines = this.codeInput.value.split(/\r?\n/);
    if (track.lineIndex >= 0 && track.lineIndex < lines.length) {
      lines[track.lineIndex] = `${track.name}("${newPattern}")`;
      this.codeInput.value = lines.join('\n');
      this.compiled = compileStudioCode(this.codeInput.value);
      this.applyCompiledState();
    }
  }

  private async togglePlay(): Promise<void> {
    if (this.isPlaying) {
      this.stopPlayback();
      return;
    }

    await this.audio.resume();
    this.isPlaying = true;
    this.currentStep = 0;
    this.playBtn.textContent = '[ ⏸ PAUSE ]';

    const effectiveDrone =
      this.manualDroneOverride !== null ? this.manualDroneOverride : this.compiled.drone;
    await this.audio.setDrone(effectiveDrone);
    this.updateDroneLabel(effectiveDrone);

    // Speak Australian Woman voice intro BEFORE the beat drops in
    if (this.announcer.isVoiceEnabled()) {
      await this.announcer.speakCallout('start', this.workspaceName);
      if (!this.isPlaying) return;
    }

    this.nextNoteTime = this.audio.getCurrentTime() + 0.04;
    this.schedulerTimer = setInterval(() => this.schedulerTick(), 25);
  }

  private stopPlayback(): void {
    this.isPlaying = false;
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.currentStep = 0;
    this.playBtn.textContent = '[ ▶ RUN_CODE ]';
    this.manualDroneOverride = null;
    void this.audio.setDrone(false);
    this.updateDroneLabel(false);
    this.shader.setPulse(0);
    this.highlightCurrentStep(-1);
    this.renderTelemetry();
  }

  private schedulerTick(): void {
    if (!this.isPlaying) return;
    const now = this.audio.getCurrentTime();
    const stepSeconds = 60 / this.compiled.bpm / 4;

    while (this.nextNoteTime < now + 0.1) {
      const scheduledStep = this.currentStep;
      const swingOffset =
        scheduledStep % 2 === 1 ? stepSeconds * this.compiled.swing : 0;
      const triggerTime = this.nextNoteTime + swingOffset;

      let stepEnergy = 0;
      for (const track of this.compiled.tracks) {
        const val = track.steps[scheduledStep];
        if (val > 0) {
          stepEnergy = Math.max(
            stepEnergy,
            this.audio.triggerVoice(
              track,
              triggerTime,
              val,
              scheduledStep,
              stepSeconds,
              this.compiled.scale
            )
          );
        }
      }

      const uiDelayMs = Math.max(0, (triggerTime - now) * 1000);
      setTimeout(() => {
        if (!this.isPlaying) return;
        this.highlightCurrentStep(scheduledStep);
        this.telemetryEl.textContent = `BPM ${Math.round(this.compiled.bpm)} · STEP ${String(scheduledStep + 1).padStart(2, '0')}/16 · ${this.currentSkyHex}`;
        if (stepEnergy > 0) {
          this.pulseEnergy = Math.max(this.pulseEnergy, stepEnergy);
        }
      }, uiDelayMs);

      this.nextNoteTime += stepSeconds;
      this.currentStep = (this.currentStep + 1) % STUDIO_TOTAL_STEPS;
    }
  }

  private highlightCurrentStep(stepIdx: number): void {
    for (const row of this.uiStepEls) {
      for (let i = 0; i < row.length; i++) {
        row[i].classList.toggle('is-now', i === stepIdx);
      }
    }
  }

  private startScopeAndPulseLoop(): void {
    const scopeCtx = this.scopeCanvas.getContext('2d');
    const timeData = new Uint8Array(512);

    const frame = () => {
      this.pulseEnergy *= 0.88;
      if (this.pulseEnergy < 0.005) this.pulseEnergy = 0;
      this.shader.setPulse(this.pulseEnergy);

      if (scopeCtx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(100, Math.floor(this.scopeCanvas.clientWidth * dpr));
        const h = Math.max(40, Math.floor(this.scopeCanvas.clientHeight * dpr));
        if (this.scopeCanvas.width !== w || this.scopeCanvas.height !== h) {
          this.scopeCanvas.width = w;
          this.scopeCanvas.height = h;
        }

        scopeCtx.clearRect(0, 0, w, h);
        const analyser = this.audio.getAnalyser();

        scopeCtx.strokeStyle = 'rgba(246, 243, 240, 0.72)';
        scopeCtx.lineWidth = Math.max(1, dpr);
        scopeCtx.beginPath();

        if (analyser && this.isPlaying) {
          analyser.getByteTimeDomainData(timeData);
          const slice = w / timeData.length;
          for (let i = 0; i < timeData.length; i++) {
            const v = (timeData[i] - 128) / 128;
            const x = i * slice;
            const y = h * 0.5 + v * (h * 0.42);
            if (i === 0) scopeCtx.moveTo(x, y);
            else scopeCtx.lineTo(x, y);
          }
        } else {
          scopeCtx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
          scopeCtx.moveTo(0, h * 0.5);
          scopeCtx.lineTo(w, h * 0.5);
        }

        scopeCtx.stroke();
      }

      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  }
}

new VoibeStudioApp();
