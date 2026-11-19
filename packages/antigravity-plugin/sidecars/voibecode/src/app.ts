import {
  AwayAlertConfig,
  FLAGSHIP_HEX,
  TwilightAudioEngine,
  TwilightShaderController,
  VoibeCartridgeId,
  VoibeTelemetryStats,
  WorkspaceAgentStatus,
} from '@voibecode/shared';

interface SidecarState extends VoibeTelemetryStats {
  elapsedMs: number;
  now: number;
  workspaces?: WorkspaceAgentStatus[];
}

function formatClock(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatFlow(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function formatAgo(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

class VoibeSidecarRadar {
  private readonly skyCanvas = document.getElementById('sky-canvas') as HTMLCanvasElement;
  private readonly brandDot = document.getElementById('brand-dot') as HTMLSpanElement;
  private readonly simStallBtn = document.getElementById('sim-stall-btn') as HTMLButtonElement;
  private readonly heroChip = document.getElementById('hero-chip') as HTMLSpanElement;
  private readonly heroTitle = document.getElementById('hero-title') as HTMLHeadingElement;
  private readonly heroSub = document.getElementById('hero-sub') as HTMLParagraphElement;
  private readonly heroTimer = document.getElementById('hero-timer') as HTMLDivElement;

  private readonly voiceBtn = document.getElementById('voice-btn') as HTMLButtonElement;
  private readonly audioBtn = document.getElementById('audio-btn') as HTMLButtonElement;
  private readonly cartridgeSelect = document.getElementById('cartridge-select') as HTMLSelectElement;
  private readonly voiceLine = document.getElementById('voice-line') as HTMLDivElement;

  private readonly wsCount = document.getElementById('ws-count') as HTMLSpanElement;
  private readonly wsList = document.getElementById('ws-list') as HTMLDivElement;

  private readonly awayChip = document.getElementById('away-chip') as HTMLSpanElement;
  private readonly awaySwitch = document.getElementById('away-switch') as HTMLButtonElement;
  private readonly ntfyInput = document.getElementById('ntfy-input') as HTMLInputElement;
  private readonly testPingBtn = document.getElementById('test-ping-btn') as HTMLButtonElement;
  private readonly ntfyLink = document.getElementById('ntfy-link') as HTMLAnchorElement;
  private readonly pingStatus = document.getElementById('ping-status') as HTMLSpanElement;

  private readonly mFlow = document.getElementById('m-flow') as HTMLSpanElement;
  private readonly mSteps = document.getElementById('m-steps') as HTMLSpanElement;
  private readonly mStalls = document.getElementById('m-stalls') as HTMLSpanElement;
  private readonly mGreen = document.getElementById('m-green') as HTMLSpanElement;
  private readonly streakText = document.getElementById('streak-text') as HTMLSpanElement;

  private readonly shader: TwilightShaderController;
  private readonly audio: TwilightAudioEngine;
  private voiceEnabled = true;
  private simUntil = 0;
  private lastWsState = new Map<string, string>();
  private latestWorkspace = 'Voibcode';
  private alertCfg: AwayAlertConfig = {
    awayMode: false,
    channel: 'ntfy',
    ntfyTopic: 'voibecode-live',
    webhookUrl: '',
    notifyOnStall: true,
    notifyOnComplete: true,
    notifyOnLoop: true,
    stallThresholdSec: 10,
  };

  constructor() {
    this.shader = new TwilightShaderController(this.skyCanvas, FLAGSHIP_HEX);
    this.audio = new TwilightAudioEngine();
    this.audio.onCallout((line: string) => {
      this.voiceLine.textContent = line;
      this.voiceLine.hidden = false;
      window.setTimeout(() => {
        if (this.voiceLine.textContent === line) this.voiceLine.hidden = true;
      }, 4000);
    });

    this.bindEvents();
    void this.loadAlerts();
    void this.poll();
    window.setInterval(() => void this.poll(), 1000);
  }

  private async loadAlerts(): Promise<void> {
    try {
      const res = await fetch('api/alerts');
      if (!res.ok) return;
      this.alertCfg = (await res.json()) as AwayAlertConfig;
      this.syncAlertUI();
    } catch {
      // Ignore
    }
  }

  private async saveAlerts(patch: Partial<AwayAlertConfig>): Promise<void> {
    this.alertCfg = { ...this.alertCfg, ...patch };
    this.syncAlertUI();
    try {
      const res = await fetch('api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.alertCfg),
      });
      if (res.ok) {
        this.alertCfg = (await res.json()) as AwayAlertConfig;
        this.syncAlertUI();
      }
    } catch {
      // Ignore
    }
  }

  private syncAlertUI(): void {
    const on = this.alertCfg.awayMode;
    this.awaySwitch.setAttribute('aria-checked', String(on));
    this.awayChip.textContent = on ? 'Armed' : 'Off';
    this.awayChip.className = `state-chip ${on ? 'is-running' : 'is-idle'}`;
    if (document.activeElement !== this.ntfyInput) {
      this.ntfyInput.value = this.alertCfg.ntfyTopic;
    }
    this.ntfyLink.href = `https://ntfy.sh/${encodeURIComponent(this.alertCfg.ntfyTopic)}`;
  }

  private async poll(): Promise<void> {
    try {
      const res = await fetch('api/state');
      if (!res.ok) return;
      const data = (await res.json()) as SidecarState;
      this.latestWorkspace = data.workspaceName || 'Voibcode';
      this.render(data);
    } catch {
      // Ignore
    }
  }

  private render(data: SidecarState): void {
    const sim = Date.now() < this.simUntil;
    const list: WorkspaceAgentStatus[] =
      Array.isArray(data.workspaces) && data.workspaces.length > 0
        ? data.workspaces.map((w) => ({ ...w }))
        : [
            {
              name: data.workspaceName || 'Voibcode',
              state: data.state || 'IDLE',
              startedAt: data.startedAt,
              lastActivityAt: data.lastActivityAt,
              elapsedMs: data.elapsedMs || 0,
              lastToolCategory: 'other',
              lastEventLabel: data.state === 'RUNNING' ? 'Working' : 'Standby',
              toolCalls: data.totalToolCalls || 0,
              stalls: data.stallsCaught || 0,
              errors: data.errorCount || 0,
              consecutiveErrors: 0,
              loopWarning: false,
              flowMs: data.totalFlowMs || 0,
            },
          ];

    if (sim && list[0]) {
      list[0] = {
        ...list[0],
        state: 'STALLED',
        elapsedMs: 14_000,
        lastEventLabel: 'Waiting on permission',
      };
    }

    for (const ws of list) {
      const prev = this.lastWsState.get(ws.name);
      if (prev && prev !== ws.state && this.voiceEnabled) {
        if (ws.state === 'STALLED') void this.audio.triggerStallChime(ws.name);
        else if (ws.state === 'ERROR') void this.audio.speakCallout('error', ws.name);
        else if (ws.state === 'IDLE' && (prev === 'RUNNING' || prev === 'STALLED')) {
          void this.audio.speakCallout('complete', ws.name);
        }
      }
      this.lastWsState.set(ws.name, ws.state);
    }

    const stalled = list.find((w) => w.state === 'STALLED');
    const errored = list.find((w) => w.state === 'ERROR' || w.loopWarning);
    const running = list.find((w) => w.state === 'RUNNING');
    const primary = stalled || errored || running || list[0];

    this.shader.setStalled(Boolean(stalled || errored));
    this.skyCanvas.classList.toggle('is-stalled', Boolean(stalled || errored));

    if (stalled) {
      this.brandDot.className = 'status-dot is-stalled';
      this.heroChip.className = 'state-chip is-stalled';
      this.heroChip.textContent = 'Needs input';
      this.heroTitle.textContent = `${stalled.name} stalled`;
      this.heroSub.textContent = stalled.lastEventLabel;
      this.heroTimer.textContent = formatClock(stalled.elapsedMs);
    } else if (errored) {
      this.brandDot.className = 'status-dot is-error';
      this.heroChip.className = 'state-chip is-error';
      this.heroChip.textContent = errored.loopWarning ? 'Loop warning' : 'Error';
      this.heroTitle.textContent = `${errored.name} error`;
      this.heroSub.textContent = errored.lastEventLabel;
      this.heroTimer.textContent = formatClock(errored.elapsedMs);
    } else if (running) {
      this.brandDot.className = 'status-dot is-running';
      this.heroChip.className = 'state-chip is-running';
      this.heroChip.textContent = 'Running';
      this.heroTitle.textContent = `Working in ${running.name}`;
      this.heroSub.textContent = running.lastEventLabel;
      this.heroTimer.textContent = formatClock(
        running.startedAt ? Math.max(0, data.now - running.startedAt) : running.elapsedMs
      );
    } else {
      this.brandDot.className = 'status-dot is-idle';
      this.heroChip.className = 'state-chip is-idle';
      this.heroChip.textContent = 'Standing by';
      this.heroTitle.textContent = 'All agents quiet';
      this.heroSub.textContent = `${data.totalToolCalls} steps across ${list.length} workspace${list.length === 1 ? '' : 's'}.`;
      this.heroTimer.textContent = formatFlow(data.totalFlowMs);
    }

    this.wsCount.textContent = `${list.length} workspace${list.length === 1 ? '' : 's'}`;
    this.wsList.innerHTML = '';
    for (const ws of list.slice(0, 5)) {
      const cls =
        ws.state === 'STALLED'
          ? 'is-stalled'
          : ws.state === 'ERROR' || ws.loopWarning
            ? 'is-error'
            : ws.state === 'RUNNING'
              ? 'is-running'
              : 'is-idle';
      const label = ws.loopWarning
        ? `Loop ×${ws.consecutiveErrors}`
        : ws.state === 'STALLED'
          ? `Stalled ${formatAgo(ws.elapsedMs)}`
          : ws.state === 'RUNNING'
            ? `${formatAgo(ws.elapsedMs)}`
            : ws.state === 'ERROR'
              ? 'Error'
              : 'Idle';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ws-row ${cls}`;
      btn.innerHTML = `
        <div class="ws-left">
          <span class="status-dot ${cls}"></span>
          <div>
            <div class="ws-name">${esc(ws.name)}</div>
            <div class="ws-sub">${esc(ws.lastEventLabel)}</div>
          </div>
        </div>
        <span class="state-chip ${cls}">${esc(label)}</span>
      `;
      btn.addEventListener('click', () => {
        if (this.voiceEnabled) {
          void this.audio.speakCallout(ws.state === 'STALLED' ? 'stall' : 'working', ws.name);
        }
      });
      this.wsList.appendChild(btn);
    }

    const liveFlow =
      data.state === 'RUNNING'
        ? data.totalFlowMs + Math.min(data.elapsedMs, 300_000)
        : data.totalFlowMs;
    this.mFlow.textContent = formatFlow(liveFlow);
    this.mSteps.textContent = String(data.totalToolCalls);
    this.mStalls.textContent = String(data.stallsCaught);
    const totalOps = Math.max(1, data.totalToolCalls);
    const green = Math.max(0, Math.min(100, ((totalOps - data.errorCount) / totalOps) * 100));
    this.mGreen.textContent = `${green.toFixed(0)}%`;
    this.streakText.textContent = `Best streak: ${data.bestStreak}`;
    void primary;
  }

  private bindEvents(): void {
    this.simStallBtn.addEventListener('click', () => {
      this.simUntil = Date.now() + 4200;
      if (this.voiceEnabled) {
        void this.audio.triggerStallChime(this.latestWorkspace);
      }
      void this.poll();
    });

    this.voiceBtn.addEventListener('click', () => {
      this.voiceEnabled = !this.voiceEnabled;
      this.audio.setVoiceEnabled(this.voiceEnabled);
      this.voiceBtn.classList.toggle('is-on', this.voiceEnabled);
      if (this.voiceEnabled) {
        void this.audio.speakCallout('start', this.latestWorkspace);
      }
    });

    this.audioBtn.addEventListener('click', () => {
      const next = this.audio.getMode() === 'OFF' ? 'SYNTH' : 'OFF';
      this.audio.setWorkspaceName(this.latestWorkspace);
      this.audio.setMode(next, 'start');
      this.audioBtn.classList.toggle('is-on', next === 'SYNTH');
    });

    this.cartridgeSelect.addEventListener('change', () => {
      this.audio.setCartridge(
        this.cartridgeSelect.value as VoibeCartridgeId,
        this.audio.getMode() === 'SYNTH'
      );
    });

    this.awaySwitch.addEventListener('click', () => {
      void this.saveAlerts({ awayMode: !this.alertCfg.awayMode });
    });

    this.ntfyInput.addEventListener('change', () => {
      const clean = this.ntfyInput.value.trim().replace(/[^a-zA-Z0-9_-]/g, '');
      if (clean.length >= 4) void this.saveAlerts({ ntfyTopic: clean });
    });

    this.testPingBtn.addEventListener('click', async () => {
      this.pingStatus.textContent = 'Sending…';
      try {
        const res = await fetch('api/alerts/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: 'ntfy',
            ntfyTopic: this.ntfyInput.value.trim() || this.alertCfg.ntfyTopic,
            workspace: this.latestWorkspace,
          }),
        });
        const out = (await res.json()) as { ok: boolean; latencyMs: number; error?: string };
        this.pingStatus.textContent = out.ok
          ? `Sent (${out.latencyMs}ms) ✓`
          : out.error || 'Failed';
      } catch {
        this.pingStatus.textContent = 'Offline';
      }
    });
  }
}

new VoibeSidecarRadar();
