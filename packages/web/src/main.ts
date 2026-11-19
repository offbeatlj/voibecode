import {
  AlertChannel,
  AwayAlertConfig,
  FLAGSHIP_HEX,
  PurchaseTier,
  TwilightAudioEngine,
  TwilightShaderController,
  VoibeCartridgeId,
  VoibeTelemetryStats,
  WorkspaceAgentStatus,
} from '@voibecode/shared';
import {
  downloadSessionReceiptPng,
  formatFlowDuration,
  formatShipLogText,
  renderSessionReceipt,
} from './receipt';

interface LiveStatePayload extends VoibeTelemetryStats {
  elapsedMs: number;
  now: number;
  workspaces?: WorkspaceAgentStatus[];
}

const STORAGE_PRO_KEY = 'voibecode.pro.license.v2';
const STORAGE_PREFS_KEY = 'voibecode.radar.prefs.v2';
const STORAGE_ALERTS_KEY = 'voibecode.radar.alerts.v2';

const LIVE_PAYMENT_LINKS: Partial<Record<PurchaseTier, string>> = {
  pro_lifetime: 'https://buy.stripe.com/eVq00jcua9Gd11g46w4Ja00',
  pro_monthly: 'https://buy.stripe.com/00w6oH51I2dLfWa9qQ4Ja01',
  team: 'https://buy.stripe.com/8x2aEX65M9GdeS6cD24Ja02',
};

function formatClock(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatAgo(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h`;
}

function formatEventTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function generateTopicSuffix(): string {
  const chars = 'abcdef0123456789';
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `voibecode-${out}`;
}

function buildHostedDemoState(bootTime: number): LiveStatePayload {
  const now = Date.now();
  const runningElapsed = (now - bootTime) % 90_000;
  const curHr = new Date(now).getHours();
  const hourly = new Array<number>(24).fill(0);
  hourly[(curHr + 21) % 24] = 18;
  hourly[(curHr + 22) % 24] = 42;
  hourly[(curHr + 23) % 24] = 64;
  hourly[curHr] = 58;

  const workspaces: WorkspaceAgentStatus[] = [
    {
      name: 'demo-app',
      state: 'RUNNING',
      startedAt: now - runningElapsed,
      lastActivityAt: now - (runningElapsed % 9_000),
      elapsedMs: runningElapsed % 9_000,
      lastToolCategory: 'edit',
      lastEventLabel: 'Editing webhook handler',
      toolCalls: 94,
      stalls: 6,
      errors: 1,
      consecutiveErrors: 0,
      loopWarning: false,
      flowMs: 4_620_000,
    },
    {
      name: 'api-billing',
      state: 'IDLE',
      startedAt: null,
      lastActivityAt: now - 240_000,
      elapsedMs: 240_000,
      lastToolCategory: 'command',
      lastEventLabel: 'Tests passed (0 errors)',
      toolCalls: 52,
      stalls: 3,
      errors: 1,
      consecutiveErrors: 0,
      loopWarning: false,
      flowMs: 2_210_000,
    },
    {
      name: 'web-dashboard',
      state: 'IDLE',
      startedAt: null,
      lastActivityAt: now - 1_140_000,
      elapsedMs: 1_140_000,
      lastToolCategory: 'read',
      lastEventLabel: 'Turn complete',
      toolCalls: 38,
      stalls: 2,
      errors: 0,
      consecutiveErrors: 0,
      loopWarning: false,
      flowMs: 1_290_000,
    },
  ];

  return {
    workspaceName: 'demo-app',
    workspacesTouched: ['demo-app', 'api-billing', 'web-dashboard'],
    workspaces,
    state: 'RUNNING',
    startedAt: now - runningElapsed,
    lastActivityAt: now - (runningElapsed % 9_000),
    sessionStartedAt: now - 8_120_000,
    totalFlowMs: 8_120_000,
    invocations: 44,
    totalToolCalls: 184,
    toolBreakdown: { command: 48, edit: 79, read: 45, subagent: 8, other: 4 },
    stallsCaught: 11,
    totalStallMs: 240_000,
    unblockCount: 11,
    avgUnblockMs: 21_800,
    errorCount: 2,
    currentStreak: 16,
    bestStreak: 28,
    lastStepDurationMs: 4_200,
    avgStepDurationMs: 11_400,
    longestStepMs: 62_000,
    voiceCalloutsCount: 19,
    hourlyActivity: hourly,
    recentEvents: [
      { ts: now - 4_000, kind: 'TOOL', label: 'Editing files', workspace: 'demo-app', durationMs: 3_800 },
      { ts: now - 18_000, kind: 'TOOL', label: 'Running command', workspace: 'demo-app', durationMs: 6_400 },
      { ts: now - 240_000, kind: 'COMPLETE', label: 'Turn complete', workspace: 'api-billing', durationMs: 12_200 },
      { ts: now - 310_000, kind: 'STALL', label: 'Stalled >10s', workspace: 'api-billing', durationMs: 14_100 },
    ],
    updatedAt: now,
    elapsedMs: runningElapsed % 9_000,
    now,
  };
}

class VoibeRadarApp {
  private readonly skyCanvas = document.getElementById('sky-canvas') as HTMLCanvasElement;
  private readonly brandDot = document.getElementById('brand-dot') as HTMLSpanElement;
  private readonly proBadge = document.getElementById('pro-badge') as HTMLSpanElement;

  private readonly checkoutSuccessBanner = document.getElementById('checkout-success-banner') as HTMLDivElement;
  private readonly checkoutKeyText = document.getElementById('checkout-key-text') as HTMLSpanElement;
  private readonly copyCheckoutKeyBtn = document.getElementById('copy-checkout-key-btn') as HTMLButtonElement;
  private readonly demoModeBanner = document.getElementById('demo-mode-banner') as HTMLDivElement;

  private readonly heroStatePill = document.getElementById('hero-state-pill') as HTMLSpanElement;
  private readonly heroWorkspaceTag = document.getElementById('hero-workspace-tag') as HTMLSpanElement;
  private readonly heroHeadline = document.getElementById('hero-headline') as HTMLHeadingElement;
  private readonly heroSubline = document.getElementById('hero-subline') as HTMLParagraphElement;
  private readonly heroTimer = document.getElementById('hero-timer') as HTMLDivElement;
  private readonly simulateStallBtn = document.getElementById('simulate-stall-btn') as HTMLButtonElement;

  private readonly voiceToggleBtn = document.getElementById('voice-toggle-btn') as HTMLButtonElement;
  private readonly ambientToggleBtn = document.getElementById('ambient-toggle-btn') as HTMLButtonElement;
  private readonly soundscapeSelect = document.getElementById('soundscape-select') as HTMLSelectElement;
  private readonly desktopNotifBtn = document.getElementById('desktop-notif-btn') as HTMLButtonElement;
  private readonly voiceCaption = document.getElementById('voice-caption') as HTMLDivElement;

  private readonly radarCountPill = document.getElementById('radar-count-pill') as HTMLSpanElement;
  private readonly radarSyncLabel = document.getElementById('radar-sync-label') as HTMLSpanElement;
  private readonly workspaceList = document.getElementById('workspace-list') as HTMLDivElement;
  private readonly eventFeed = document.getElementById('event-feed') as HTMLDivElement;

  private readonly awayStatusPill = document.getElementById('away-status-pill') as HTMLSpanElement;
  private readonly awayModeSwitch = document.getElementById('away-mode-switch') as HTMLButtonElement;
  private readonly segBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.seg-btn'));
  private readonly ntfyPanel = document.getElementById('channel-ntfy-panel') as HTMLDivElement;
  private readonly webhookPanel = document.getElementById('channel-webhook-panel') as HTMLDivElement;
  private readonly webhookUrlLabel = document.getElementById('webhook-url-label') as HTMLLabelElement;
  private readonly ntfyTopicInput = document.getElementById('ntfy-topic-input') as HTMLInputElement;
  private readonly copyNtfyBtn = document.getElementById('copy-ntfy-btn') as HTMLButtonElement;
  private readonly openNtfyLink = document.getElementById('open-ntfy-link') as HTMLAnchorElement;
  private readonly webhookUrlInput = document.getElementById('webhook-url-input') as HTMLInputElement;
  private readonly notifyStallCb = document.getElementById('notify-stall-cb') as HTMLInputElement;
  private readonly notifyLoopCb = document.getElementById('notify-loop-cb') as HTMLInputElement;
  private readonly notifyCompleteCb = document.getElementById('notify-complete-cb') as HTMLInputElement;
  private readonly stallThresholdSelect = document.getElementById('stall-threshold-select') as HTMLSelectElement;
  private readonly testAlertBtn = document.getElementById('test-alert-btn') as HTMLButtonElement;
  private readonly testAlertStatus = document.getElementById('test-alert-status') as HTMLSpanElement;

  private readonly statFlow = document.getElementById('stat-flow') as HTMLSpanElement;
  private readonly statSteps = document.getElementById('stat-steps') as HTMLSpanElement;
  private readonly statStalls = document.getElementById('stat-stalls') as HTMLSpanElement;
  private readonly statGreen = document.getElementById('stat-green') as HTMLSpanElement;
  private readonly statStreak = document.getElementById('stat-streak') as HTMLSpanElement;
  private readonly cadenceBars = document.getElementById('cadence-bars') as HTMLDivElement;

  private readonly proUpsellCard = document.getElementById('pro-upsell-card') as HTMLElement;
  private readonly pageBillingStatus = document.getElementById('page-billing-status') as HTMLSpanElement;
  private readonly openInstallBtn = document.getElementById('open-install-btn') as HTMLButtonElement;
  private readonly openReceiptTopBtn = document.getElementById('open-receipt-top-btn') as HTMLButtonElement;
  private readonly openReceiptBtn = document.getElementById('open-receipt-btn') as HTMLButtonElement;
  private readonly openPricingBtn = document.getElementById('open-pricing-btn') as HTMLButtonElement;
  private readonly activateKeyOpenBtn = document.getElementById('activate-key-open-btn') as HTMLButtonElement;

  private readonly receiptCanvas = document.getElementById('receipt-canvas') as HTMLCanvasElement;
  private readonly downloadReceiptBtn = document.getElementById('download-receipt-btn') as HTMLButtonElement;
  private readonly copyReceiptTextBtn = document.getElementById('copy-receipt-text-btn') as HTMLButtonElement;
  private readonly toggleRawJsonBtn = document.getElementById('toggle-raw-json-btn') as HTMLButtonElement;
  private readonly rawJsonPre = document.getElementById('raw-json-pre') as HTMLPreElement;

  private readonly licenseKeyInput = document.getElementById('license-key-input') as HTMLInputElement;
  private readonly activateLicenseBtn = document.getElementById('activate-license-btn') as HTMLButtonElement;
  private readonly licenseFeedback = document.getElementById('license-feedback') as HTMLSpanElement;

  private readonly shader: TwilightShaderController;
  private readonly audio: TwilightAudioEngine;
  private readonly bootTime = Date.now();

  private voiceEnabled = true;
  private desktopNotifEnabled = false;
  private hostedDemoMode = false;
  private apiBase = '';
  private lastBridgeProbeAt = 0;
  private simulatedStallUntil = 0;
  private lastCheckoutKey = '';
  private lastKnownStateByWorkspace = new Map<string, string>();
  private alertConfig: AwayAlertConfig = {
    awayMode: false,
    channel: 'ntfy',
    ntfyTopic: generateTopicSuffix(),
    webhookUrl: '',
    notifyOnStall: true,
    notifyOnComplete: true,
    notifyOnLoop: true,
    stallThresholdSec: 10,
  };

  private latestState: LiveStatePayload = buildHostedDemoState(Date.now());

  constructor() {
    this.shader = new TwilightShaderController(this.skyCanvas, FLAGSHIP_HEX);
    this.audio = new TwilightAudioEngine();

    this.audio.onCallout((line: string) => {
      this.voiceCaption.textContent = line;
      this.voiceCaption.hidden = false;
      window.setTimeout(() => {
        if (this.voiceCaption.textContent === line) {
          this.voiceCaption.hidden = true;
        }
      }, 4200);
    });

    this.loadLocalPrefs();
    this.bindEvents();
    requestAnimationFrame(() => this.skyCanvas.classList.add('is-ready'));

    void this.checkPostCheckoutReturn();
    void this.loadAlertsConfig();
    void this.pollState();
    window.setInterval(() => void this.pollState(), 1000);
  }

  private loadLocalPrefs(): void {
    try {
      const lic = localStorage.getItem(STORAGE_PRO_KEY);
      if (lic && lic.startsWith('VC-')) {
        this.setProUnlocked(true);
      }
      const savedAlerts = localStorage.getItem(STORAGE_ALERTS_KEY);
      if (savedAlerts) {
        this.alertConfig = { ...this.alertConfig, ...(JSON.parse(savedAlerts) as Partial<AwayAlertConfig>) };
      } else {
        localStorage.setItem(STORAGE_ALERTS_KEY, JSON.stringify(this.alertConfig));
      }

      const raw = localStorage.getItem(STORAGE_PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as {
          voiceEnabled?: boolean;
          cartridge?: VoibeCartridgeId;
          desktopNotifEnabled?: boolean;
        };
        if (typeof p.voiceEnabled === 'boolean') {
          this.voiceEnabled = p.voiceEnabled;
          this.audio.setVoiceEnabled(p.voiceEnabled);
          this.voiceToggleBtn.classList.toggle('is-on', p.voiceEnabled);
          this.voiceToggleBtn.setAttribute('aria-pressed', String(p.voiceEnabled));
        }
        if (p.cartridge) {
          this.soundscapeSelect.value = p.cartridge;
          this.audio.setCartridge(p.cartridge, false);
        }
        if (
          p.desktopNotifEnabled &&
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted'
        ) {
          this.desktopNotifEnabled = true;
          this.updateDesktopNotifUI();
        }
      }
    } catch {
      // Ignore storage errors
    }
    this.syncAlertUI();
  }

  private saveLocalPrefs(): void {
    try {
      localStorage.setItem(
        STORAGE_PREFS_KEY,
        JSON.stringify({
          voiceEnabled: this.voiceEnabled,
          cartridge: this.audio.getCartridgeId(),
          desktopNotifEnabled: this.desktopNotifEnabled,
        })
      );
    } catch {
      // Ignore
    }
  }

  private setProUnlocked(unlocked: boolean): void {
    this.proBadge.hidden = !unlocked;
    this.openPricingBtn.textContent = unlocked ? 'Pro Active' : 'Get Pro';
    this.proUpsellCard.hidden = unlocked;
  }

  private async checkPostCheckoutReturn(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id')?.trim();
    const checkoutFlag = params.get('checkout')?.trim();
    const tierParam = params.get('tier')?.trim();

    if (checkoutFlag === 'success' && !sessionId) {
      const tag = tierParam === 'team' ? 'TEAM' : 'PRO';
      const localKey = `VC-${tag}-ACTIVE`;
      this.lastCheckoutKey = localKey;
      localStorage.setItem(STORAGE_PRO_KEY, localKey);
      this.setProUnlocked(true);
      this.checkoutSuccessBanner.hidden = false;
      this.checkoutKeyText.textContent =
        tierParam === 'team'
          ? 'VoibeCode Team active — thank you for building with VoibeCode.'
          : 'VoibeCode Pro active — Away Alerts & all soundscapes unlocked.';
      window.history.replaceState({}, '', '/');
      return;
    }

    if (!sessionId) return;

    this.checkoutSuccessBanner.hidden = false;
    this.checkoutKeyText.textContent = 'Confirming Stripe payment…';

    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const res = await fetch(`/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`);
        if (res.ok) {
          const data = (await res.json()) as { key?: string; tier?: string };
          if (data.key) {
            this.lastCheckoutKey = data.key;
            localStorage.setItem(STORAGE_PRO_KEY, data.key);
            this.setProUnlocked(true);
            this.checkoutKeyText.textContent = `License key: ${data.key}`;
            this.copyCheckoutKeyBtn.hidden = false;
            window.history.replaceState({}, '', '/');
            return;
          }
        }
      } catch {
        // Retry briefly while Stripe webhook settles
      }
      await new Promise((r) => window.setTimeout(r, 1200));
    }

    this.checkoutKeyText.textContent =
      'Payment received — your VC- license key will arrive shortly via webhook / email.';
  }

  private async loadAlertsConfig(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBase}/api/alerts`);
      if (!res.ok) {
        this.syncAlertUI();
        return;
      }
      const cfg = (await res.json()) as AwayAlertConfig;
      this.alertConfig = cfg;
      this.syncAlertUI();
    } catch {
      this.syncAlertUI();
    }
  }

  private async saveAlertsConfig(patch: Partial<AwayAlertConfig>): Promise<void> {
    this.alertConfig = { ...this.alertConfig, ...patch };
    try {
      localStorage.setItem(STORAGE_ALERTS_KEY, JSON.stringify(this.alertConfig));
    } catch {
      // Ignore
    }
    this.syncAlertUI();
    if (this.hostedDemoMode) return;
    try {
      const res = await fetch(`${this.apiBase}/api/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.alertConfig),
      });
      if (res.ok) {
        this.alertConfig = (await res.json()) as AwayAlertConfig;
        this.syncAlertUI();
      }
    } catch {
      // Keep local config
    }
  }

  private syncAlertUI(): void {
    const on = this.alertConfig.awayMode;
    this.awayModeSwitch.setAttribute('aria-checked', String(on));
    this.awayStatusPill.textContent = on ? 'Armed' : 'Off';
    this.awayStatusPill.className = `state-chip ${on ? 'is-running' : 'is-idle'}`;

    const ch = this.alertConfig.channel;
    this.segBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.channel === ch));
    this.ntfyPanel.hidden = ch !== 'ntfy';
    this.webhookPanel.hidden = ch === 'ntfy';

    if (document.activeElement !== this.ntfyTopicInput) {
      this.ntfyTopicInput.value = this.alertConfig.ntfyTopic;
    }
    this.openNtfyLink.href = `https://ntfy.sh/${encodeURIComponent(this.alertConfig.ntfyTopic)}`;

    if (ch === 'slack') {
      this.webhookUrlLabel.textContent = 'Slack Incoming Webhook URL';
      this.webhookUrlInput.placeholder = 'https://hooks.slack.com/services/...';
    } else if (ch === 'discord') {
      this.webhookUrlLabel.textContent = 'Discord Webhook URL';
      this.webhookUrlInput.placeholder = 'https://discord.com/api/webhooks/...';
    } else {
      this.webhookUrlLabel.textContent = 'Custom JSON Webhook URL';
      this.webhookUrlInput.placeholder = 'https://your-endpoint.com/voibecode';
    }

    if (document.activeElement !== this.webhookUrlInput) {
      this.webhookUrlInput.value = this.alertConfig.webhookUrl;
    }

    this.notifyStallCb.checked = this.alertConfig.notifyOnStall;
    this.notifyLoopCb.checked = this.alertConfig.notifyOnLoop;
    this.notifyCompleteCb.checked = this.alertConfig.notifyOnComplete;
    this.stallThresholdSelect.value = String(this.alertConfig.stallThresholdSec || 10);
  }

  private async probeLocalBridge(): Promise<boolean> {
    this.lastBridgeProbeAt = Date.now();
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 600);
    try {
      const res = await fetch('http://127.0.0.1:4731/api/state', { signal: ctrl.signal });
      if (!res.ok) return false;
      const data = (await res.json()) as LiveStatePayload;
      this.apiBase = 'http://127.0.0.1:4731';
      this.hostedDemoMode = false;
      this.demoModeBanner.hidden = true;
      this.radarSyncLabel.textContent = 'Live · Local Bridge';
      this.latestState = data;
      this.handleStateTransitions(data);
      this.renderAll(data);
      void this.loadAlertsConfig();
      return true;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timer);
    }
  }

  private async pollState(): Promise<void> {
    if (this.hostedDemoMode) {
      if (Date.now() - this.lastBridgeProbeAt > 15_000) {
        if (await this.probeLocalBridge()) return;
      }
      const demo = buildHostedDemoState(this.bootTime);
      this.latestState = demo;
      this.renderAll(demo);
      return;
    }

    try {
      const res = await fetch(`${this.apiBase}/api/state`);
      if (!res.ok) {
        if (this.apiBase === '' && (await this.probeLocalBridge())) return;
        this.apiBase = '';
        this.enableHostedDemoMode();
        return;
      }
      const data = (await res.json()) as LiveStatePayload;
      this.demoModeBanner.hidden = true;
      this.radarSyncLabel.textContent =
        this.apiBase === '' ? 'Live · 1s sync' : 'Live · Local Bridge';
      this.latestState = data;
      this.handleStateTransitions(data);
      this.renderAll(data);
    } catch {
      if (this.apiBase === '' && (await this.probeLocalBridge())) return;
      this.apiBase = '';
      this.enableHostedDemoMode();
    }
  }

  private enableHostedDemoMode(): void {
    this.hostedDemoMode = true;
    this.demoModeBanner.hidden = false;
    this.radarSyncLabel.textContent = 'Interactive demo';
    const demo = buildHostedDemoState(this.bootTime);
    this.latestState = demo;
    this.renderAll(demo);
  }

  private handleStateTransitions(data: LiveStatePayload): void {
    const list = this.getWorkspacesList(data);
    for (const ws of list) {
      const prev = this.lastKnownStateByWorkspace.get(ws.name);
      if (prev && prev !== ws.state) {
        if (ws.state === 'STALLED') {
          this.sendDesktopPing(
            `${ws.name} needs your input`,
            `Agent stalled for ${Math.round(ws.elapsedMs / 1000)}s.`
          );
          if (this.voiceEnabled) {
            void this.audio.triggerStallChime(ws.name);
          }
        } else if (ws.state === 'ERROR') {
          this.sendDesktopPing(`${ws.name} hit an error`, ws.lastEventLabel);
          if (this.voiceEnabled) {
            void this.audio.speakCallout('error', ws.name);
          }
        } else if (ws.state === 'IDLE' && (prev === 'RUNNING' || prev === 'STALLED')) {
          this.sendDesktopPing(`${ws.name} finished`, 'Your AI agent completed its turn.');
          if (this.voiceEnabled) {
            void this.audio.speakCallout('complete', ws.name);
          }
        }
      }
      this.lastKnownStateByWorkspace.set(ws.name, ws.state);
    }
  }

  private getWorkspacesList(data: LiveStatePayload): WorkspaceAgentStatus[] {
    const simulated = Date.now() < this.simulatedStallUntil;
    const base: WorkspaceAgentStatus[] =
      Array.isArray(data.workspaces) && data.workspaces.length > 0
        ? data.workspaces.map((w) => ({ ...w }))
        : [
            {
              name: data.workspaceName || 'workspace',
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

    if (simulated && base[0]) {
      base[0] = {
        ...base[0],
        state: 'STALLED',
        elapsedMs: 14_000,
        lastEventLabel: 'Waiting on terminal permission [Allow]',
      };
    }

    return base;
  }

  private renderAll(data: LiveStatePayload): void {
    const workspaces = this.getWorkspacesList(data);
    const stalledList = workspaces.filter((w) => w.state === 'STALLED');
    const errorList = workspaces.filter((w) => w.state === 'ERROR' || w.loopWarning);
    const runningList = workspaces.filter((w) => w.state === 'RUNNING');

    const primary = stalledList[0] || errorList[0] || runningList[0] || workspaces[0];
    const anyStalled = stalledList.length > 0;
    const anyError = errorList.length > 0;
    const anyRunning = runningList.length > 0;

    this.shader.setStalled(anyStalled || anyError);
    this.skyCanvas.classList.toggle('is-stalled', anyStalled || anyError);

    if (anyStalled) {
      this.brandDot.className = 'status-dot is-stalled';
      this.heroStatePill.className = 'state-chip is-stalled';
      this.heroStatePill.textContent = 'Needs input';
      this.heroWorkspaceTag.textContent = primary.name;
      this.heroHeadline.textContent = `${primary.name} stalled`;
      this.heroSubline.textContent = `Silent for ${formatAgo(primary.elapsedMs)} · ${primary.lastEventLabel}`;
      this.heroTimer.textContent = formatClock(primary.elapsedMs);
      document.title = `⚠ ${primary.name} stalled — VoibeCode`;
    } else if (anyError) {
      this.brandDot.className = 'status-dot is-error';
      this.heroStatePill.className = 'state-chip is-error';
      this.heroStatePill.textContent = primary.loopWarning ? 'Loop warning' : 'Check error';
      this.heroWorkspaceTag.textContent = primary.name;
      this.heroHeadline.textContent = primary.loopWarning
        ? `Loop detected in ${primary.name}`
        : `Error in ${primary.name}`;
      this.heroSubline.textContent = primary.lastEventLabel;
      this.heroTimer.textContent = formatClock(primary.elapsedMs);
      document.title = `✕ ${primary.name} error — VoibeCode`;
    } else if (anyRunning) {
      this.brandDot.className = 'status-dot is-running';
      this.heroStatePill.className = 'state-chip is-running';
      this.heroStatePill.textContent =
        runningList.length > 1 ? `${runningList.length} agents active` : 'Running';
      this.heroWorkspaceTag.textContent = primary.name;
      this.heroHeadline.textContent = `Working in ${primary.name}`;
      this.heroSubline.textContent = `${primary.lastEventLabel} · ${data.totalToolCalls} steps today`;
      this.heroTimer.textContent = formatClock(
        primary.startedAt ? Math.max(0, data.now - primary.startedAt) : primary.elapsedMs
      );
      document.title = `● ${primary.name} — VoibeCode`;
    } else {
      this.brandDot.className = 'status-dot is-idle';
      this.heroStatePill.className = 'state-chip is-idle';
      this.heroStatePill.textContent = 'Standing by';
      this.heroWorkspaceTag.textContent = primary?.name || 'workspace';
      this.heroHeadline.textContent = 'All agents quiet';
      this.heroSubline.textContent = `${data.totalToolCalls} steps & ${data.stallsCaught} stalls rescued today across ${workspaces.length} workspace${workspaces.length === 1 ? '' : 's'}.`;
      this.heroTimer.textContent = formatFlowDuration(data.totalFlowMs);
      document.title = 'VoibeCode — Air Traffic Control for AI Coding Agents';
    }

    this.radarCountPill.textContent = `${workspaces.length} workspace${workspaces.length === 1 ? '' : 's'}`;
    this.workspaceList.innerHTML = '';
    for (const ws of workspaces.slice(0, 6)) {
      const row = document.createElement('button');
      row.type = 'button';
      row.setAttribute('role', 'listitem');
      const stateClass =
        ws.state === 'STALLED'
          ? 'is-stalled'
          : ws.state === 'ERROR' || ws.loopWarning
            ? 'is-error'
            : ws.state === 'RUNNING'
              ? 'is-running'
              : 'is-idle';
      row.className = `ws-row ${stateClass}`;

      const badgeText = ws.loopWarning
        ? `Loop ×${ws.consecutiveErrors}`
        : ws.state === 'STALLED'
          ? `Stalled ${formatAgo(ws.elapsedMs)}`
          : ws.state === 'RUNNING'
            ? `Running ${formatAgo(ws.elapsedMs)}`
            : ws.state === 'ERROR'
              ? 'Error'
              : `Idle · ${formatAgo(ws.elapsedMs)}`;

      row.innerHTML = `
        <div class="ws-left">
          <span class="status-dot ${stateClass}"></span>
          <div class="ws-meta">
            <span class="ws-name">${this.escapeHtml(ws.name)}</span>
            <span class="ws-sub">${this.escapeHtml(ws.lastEventLabel)}</span>
          </div>
        </div>
        <div class="ws-right">
          <span class="state-chip ${stateClass}">${this.escapeHtml(badgeText)}</span>
          <span class="ws-tools">${ws.toolCalls} steps</span>
        </div>
      `;

      row.addEventListener('click', () => {
        if (this.voiceEnabled) {
          const kind =
            ws.state === 'STALLED'
              ? 'stall'
              : ws.state === 'ERROR'
                ? 'error'
                : ws.state === 'RUNNING'
                  ? 'working'
                  : 'start';
          void this.audio.speakCallout(kind, ws.name);
        }
      });

      this.workspaceList.appendChild(row);
    }

    const events = Array.isArray(data.recentEvents) ? data.recentEvents.slice(0, 5) : [];
    if (events.length === 0) {
      this.eventFeed.innerHTML =
        '<div class="mono-subtle">Waiting for next tool call from Antigravity, Claude Code, or VS Code…</div>';
    } else {
      this.eventFeed.innerHTML = events
        .map((ev) => {
          const dur =
            ev.durationMs && ev.durationMs > 500 ? ` · ${(ev.durationMs / 1000).toFixed(1)}s` : '';
          return `
            <div class="event-row">
              <div class="event-left">
                <span class="event-ws">${this.escapeHtml(ev.workspace)}</span>
                <span class="event-label">${this.escapeHtml(ev.label)}${dur}</span>
              </div>
              <span class="event-time">${formatEventTime(ev.ts)}</span>
            </div>
          `;
        })
        .join('');
    }

    const liveFlow =
      data.state === 'RUNNING'
        ? data.totalFlowMs + Math.min(data.elapsedMs, 300_000)
        : data.totalFlowMs;
    this.statFlow.textContent = formatFlowDuration(liveFlow);
    this.statSteps.textContent = String(data.totalToolCalls);
    this.statStalls.textContent = String(data.stallsCaught);
    const totalOps = Math.max(1, data.totalToolCalls);
    const greenPct = Math.max(0, Math.min(100, ((totalOps - data.errorCount) / totalOps) * 100));
    this.statGreen.textContent = `${greenPct.toFixed(0)}%`;
    this.statStreak.textContent = `Best streak: ${data.bestStreak}`;

    const buckets =
      Array.isArray(data.hourlyActivity) && data.hourlyActivity.length === 24
        ? data.hourlyActivity
        : new Array<number>(24).fill(0);
    const maxBucket = Math.max(1, ...buckets);
    this.cadenceBars.innerHTML = buckets
      .map((count, hr) => {
        const pct = count === 0 ? 12 : Math.max(22, Math.round((count / maxBucket) * 100));
        return `<div class="cadence-bar ${count === 0 ? 'is-empty' : ''}" style="height:${pct}%" title="${String(hr).padStart(2, '0')}:00 · ${count} events"></div>`;
      })
      .join('');

    const receiptModal = document.getElementById('modal-receipt');
    if (receiptModal && !receiptModal.hidden) {
      renderSessionReceipt(this.receiptCanvas, { ...data, totalFlowMs: liveFlow });
      if (!this.rawJsonPre.hidden) {
        this.rawJsonPre.textContent = JSON.stringify(data, null, 2);
      }
    }
  }

  private escapeHtml(str: string): string {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private updateDesktopNotifUI(): void {
    this.desktopNotifBtn.textContent = this.desktopNotifEnabled
      ? 'Desktop Ping: On'
      : 'Desktop Ping: Off';
    this.desktopNotifBtn.classList.toggle('is-on', this.desktopNotifEnabled);
  }

  private sendDesktopPing(title: string, body: string): void {
    if (!this.desktopNotifEnabled || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(title, { body, silent: true });
    } catch {
      // Ignore
    }
  }

  private openModal(id: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = false;
    if (id === 'modal-receipt') {
      const liveFlow =
        this.latestState.state === 'RUNNING'
          ? this.latestState.totalFlowMs + Math.min(this.latestState.elapsedMs, 300_000)
          : this.latestState.totalFlowMs;
      renderSessionReceipt(this.receiptCanvas, { ...this.latestState, totalFlowMs: liveFlow });
    }
  }

  private closeModal(id: string): void {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }

  private bindEvents(): void {
    this.copyCheckoutKeyBtn.addEventListener('click', () => {
      if (!this.lastCheckoutKey) return;
      void navigator.clipboard?.writeText(this.lastCheckoutKey);
      this.copyCheckoutKeyBtn.textContent = 'Copied ✓';
      window.setTimeout(() => (this.copyCheckoutKeyBtn.textContent = 'Copy key'), 1500);
    });

    this.simulateStallBtn.addEventListener('click', () => {
      this.simulatedStallUntil = Date.now() + 4500;
      const ws = this.latestState.workspaceName || 'workspace';
      this.renderAll(this.latestState);
      if (this.voiceEnabled) {
        void this.audio.triggerStallChime(ws);
      }
      this.sendDesktopPing(`${ws} stalled (simulated)`, 'Agent waiting on terminal permission.');
      window.setTimeout(() => this.renderAll(this.latestState), 4600);
    });

    this.voiceToggleBtn.addEventListener('click', () => {
      this.voiceEnabled = !this.voiceEnabled;
      this.audio.setVoiceEnabled(this.voiceEnabled);
      this.voiceToggleBtn.classList.toggle('is-on', this.voiceEnabled);
      this.voiceToggleBtn.setAttribute('aria-pressed', String(this.voiceEnabled));
      this.saveLocalPrefs();
      if (this.voiceEnabled) {
        void this.audio.speakCallout('start', this.latestState.workspaceName);
      }
    });

    this.ambientToggleBtn.addEventListener('click', () => {
      const next = this.audio.getMode() === 'OFF' ? 'SYNTH' : 'OFF';
      this.audio.setWorkspaceName(this.latestState.workspaceName);
      this.audio.setMode(next, 'start');
      const isPlaying = next === 'SYNTH';
      this.ambientToggleBtn.classList.toggle('is-on', isPlaying);
      this.ambientToggleBtn.setAttribute('aria-pressed', String(isPlaying));
      this.ambientToggleBtn.querySelector('span:last-child')!.textContent = isPlaying
        ? 'Focus Audio · On'
        : 'Focus Audio';
    });

    this.soundscapeSelect.addEventListener('change', () => {
      const id = this.soundscapeSelect.value as VoibeCartridgeId;
      this.audio.setCartridge(id, this.audio.getMode() === 'SYNTH');
      this.saveLocalPrefs();
    });

    this.desktopNotifBtn.addEventListener('click', async () => {
      if (typeof Notification === 'undefined') return;
      if (this.desktopNotifEnabled) {
        this.desktopNotifEnabled = false;
        this.updateDesktopNotifUI();
        this.saveLocalPrefs();
        return;
      }
      const perm =
        Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission();
      this.desktopNotifEnabled = perm === 'granted';
      this.updateDesktopNotifUI();
      this.saveLocalPrefs();
      if (this.desktopNotifEnabled) {
        this.sendDesktopPing('VoibeCode Desktop Ping Ready', 'You will be notified on agent stalls.');
      }
    });

    this.awayModeSwitch.addEventListener('click', () => {
      void this.saveAlertsConfig({ awayMode: !this.alertConfig.awayMode });
    });

    this.segBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const ch = (btn.dataset.channel || 'ntfy') as AlertChannel;
        void this.saveAlertsConfig({ channel: ch });
      });
    });

    this.ntfyTopicInput.addEventListener('change', () => {
      const clean = this.ntfyTopicInput.value.trim().replace(/[^a-zA-Z0-9_-]/g, '');
      if (clean.length >= 4) {
        void this.saveAlertsConfig({ ntfyTopic: clean });
      }
    });

    this.copyNtfyBtn.addEventListener('click', () => {
      const url = `https://ntfy.sh/${this.alertConfig.ntfyTopic}`;
      void navigator.clipboard?.writeText(url);
      this.copyNtfyBtn.textContent = 'Copied';
      window.setTimeout(() => (this.copyNtfyBtn.textContent = 'Copy'), 1400);
    });

    this.webhookUrlInput.addEventListener('change', () => {
      void this.saveAlertsConfig({ webhookUrl: this.webhookUrlInput.value.trim() });
    });

    this.notifyStallCb.addEventListener('change', () => {
      void this.saveAlertsConfig({ notifyOnStall: this.notifyStallCb.checked });
    });
    this.notifyLoopCb.addEventListener('change', () => {
      void this.saveAlertsConfig({ notifyOnLoop: this.notifyLoopCb.checked });
    });
    this.notifyCompleteCb.addEventListener('change', () => {
      void this.saveAlertsConfig({ notifyOnComplete: this.notifyCompleteCb.checked });
    });
    this.stallThresholdSelect.addEventListener('change', () => {
      void this.saveAlertsConfig({
        stallThresholdSec: Number(this.stallThresholdSelect.value) || 10,
      });
    });

    this.testAlertBtn.addEventListener('click', async () => {
      this.testAlertBtn.disabled = true;
      this.testAlertStatus.className = 'alert-status mono-muted';
      this.testAlertStatus.textContent = 'Sending…';
      try {
        const res = await fetch(`${this.apiBase}/api/alerts/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: this.alertConfig.channel,
            ntfyTopic: this.ntfyTopicInput.value.trim() || this.alertConfig.ntfyTopic,
            webhookUrl: this.webhookUrlInput.value.trim(),
            workspace: this.latestState.workspaceName,
          }),
        });
        const out = (await res.json()) as { ok: boolean; latencyMs?: number; error?: string };
        if (out.ok) {
          this.testAlertStatus.className = 'alert-status is-ok mono-muted';
          this.testAlertStatus.textContent = `Delivered in ${out.latencyMs ?? 0}ms ✓`;
        } else {
          this.testAlertStatus.className = 'alert-status is-err mono-muted';
          this.testAlertStatus.textContent = out.error || 'Failed to deliver';
        }
      } catch {
        this.testAlertStatus.className = 'alert-status is-err mono-muted';
        this.testAlertStatus.textContent = 'Alert endpoint offline';
      } finally {
        this.testAlertBtn.disabled = false;
      }
    });

    this.openInstallBtn.addEventListener('click', () => this.openModal('modal-install'));
    this.openReceiptTopBtn.addEventListener('click', () => this.openModal('modal-receipt'));
    this.openReceiptBtn.addEventListener('click', () => this.openModal('modal-receipt'));
    this.openPricingBtn.addEventListener('click', () => this.openModal('modal-pricing'));
    this.activateKeyOpenBtn.addEventListener('click', () => {
      this.openModal('modal-pricing');
      window.setTimeout(() => this.licenseKeyInput.focus(), 50);
    });

    document.querySelectorAll<HTMLElement>('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.closeModal;
        if (id) this.closeModal(id);
      });
    });

    document.querySelectorAll<HTMLElement>('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.hidden = true;
      });
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll<HTMLElement>('.modal-backdrop').forEach((m) => (m.hidden = true));
      }
    });

    this.downloadReceiptBtn.addEventListener('click', () => {
      const liveFlow =
        this.latestState.state === 'RUNNING'
          ? this.latestState.totalFlowMs + Math.min(this.latestState.elapsedMs, 300_000)
          : this.latestState.totalFlowMs;
      renderSessionReceipt(this.receiptCanvas, { ...this.latestState, totalFlowMs: liveFlow });
      downloadSessionReceiptPng(this.receiptCanvas, this.latestState.workspaceName);
    });

    this.copyReceiptTextBtn.addEventListener('click', () => {
      const txt = formatShipLogText(this.latestState);
      void navigator.clipboard?.writeText(txt);
      this.copyReceiptTextBtn.textContent = 'Copied ✓';
      window.setTimeout(() => (this.copyReceiptTextBtn.textContent = 'Copy Summary'), 1500);
    });

    this.toggleRawJsonBtn.addEventListener('click', () => {
      this.rawJsonPre.hidden = !this.rawJsonPre.hidden;
      if (!this.rawJsonPre.hidden) {
        this.rawJsonPre.textContent = JSON.stringify(this.latestState, null, 2);
      }
    });

    // Quick 1-Line Install OS Toggle & Copy (synced across page & modal)
    const INSTALL_CMDS: Record<'unix' | 'win', string> = {
      unix: 'curl -fsSL https://voibecode.com/install.sh | sh',
      win: 'irm https://voibecode.com/install.ps1 | iex',
    };
    const isWindowsHost =
      typeof navigator !== 'undefined' && /Windows|Win32|Win64/i.test(navigator.userAgent);
    const setQuickInstallOs = (os: 'unix' | 'win') => {
      document.querySelectorAll<HTMLButtonElement>('.qi-os-btn').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.os === os);
      });
      document.querySelectorAll<HTMLInputElement>('.qi-cmd-input').forEach((inp) => {
        inp.value = INSTALL_CMDS[os];
      });
    };
    setQuickInstallOs(isWindowsHost ? 'win' : 'unix');
    document.querySelectorAll<HTMLButtonElement>('.qi-os-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setQuickInstallOs(btn.dataset.os === 'win' ? 'win' : 'unix');
      });
    });
    document.querySelectorAll<HTMLButtonElement>('.qi-copy-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const bar = btn.closest('.quick-install-bar');
        const input = bar?.querySelector<HTMLInputElement>('.qi-cmd-input');
        const cmd = input?.value || INSTALL_CMDS.unix;
        void navigator.clipboard?.writeText(cmd);
        const orig = btn.textContent;
        btn.textContent = 'Copied ✓';
        window.setTimeout(() => (btn.textContent = orig), 1500);
      });
    });

    // Shared Copy IDE Setup Triggers (both page catalog & modal)
    document.querySelectorAll<HTMLButtonElement>('.copy-agy-trigger').forEach((btn) => {
      btn.addEventListener('click', () => {
        void navigator.clipboard?.writeText('~/.gemini/config/plugins/voibecode');
        const orig = btn.textContent;
        btn.textContent = 'Copied ✓';
        window.setTimeout(() => (btn.textContent = orig), 1400);
      });
    });

    const claudeSnippet = JSON.stringify(
      {
        hooks: {
          PostToolUse: [
            {
              matcher: '*',
              hooks: [
                {
                  type: 'command',
                  command: 'node ~/.gemini/config/plugins/voibecode/hooks/watcher-hook.mjs tool',
                },
              ],
            },
          ],
          Stop: [
            {
              matcher: '*',
              hooks: [
                {
                  type: 'command',
                  command: 'node ~/.gemini/config/plugins/voibecode/hooks/watcher-hook.mjs stop',
                },
              ],
            },
          ],
        },
      },
      null,
      2
    );

    document.querySelectorAll<HTMLButtonElement>('.copy-claude-trigger').forEach((btn) => {
      btn.addEventListener('click', () => {
        void navigator.clipboard?.writeText(claudeSnippet);
        const orig = btn.textContent;
        btn.textContent = 'Copied JSON ✓';
        window.setTimeout(() => (btn.textContent = orig), 1500);
      });
    });

    // All Buy / Checkout Triggers (Pro Lifetime $39, Pro Monthly $9/mo, Team $19/seat)
    document.querySelectorAll<HTMLButtonElement>('[data-buy-tier]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tier = (btn.dataset.buyTier || 'pro_lifetime') as PurchaseTier;
        void this.startCheckout(tier);
      });
    });

    this.activateLicenseBtn.addEventListener('click', () => void this.activateLicenseKey());
  }

  private async activateLicenseKey(): Promise<void> {
    const key = this.licenseKeyInput.value.trim().toUpperCase();
    if (!/^VC-(?:(?:PRO|TEAM)-)?[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
      this.licenseFeedback.className = 'alert-status is-err mono-muted';
      this.licenseFeedback.textContent = 'Enter a valid VC-PRO-XXXX-XXXX license key.';
      return;
    }

    this.licenseFeedback.className = 'alert-status mono-muted';
    this.licenseFeedback.textContent = 'Validating key…';

    try {
      const res = await fetch(`/api/license/${encodeURIComponent(key)}`);
      if (res.ok) {
        localStorage.setItem(STORAGE_PRO_KEY, key);
        this.setProUnlocked(true);
        this.licenseFeedback.className = 'alert-status is-ok mono-muted';
        this.licenseFeedback.textContent = 'License verified & Pro unlocked ✓';
        return;
      }
      if (res.status === 404) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        // If backend exists and explicitly rejects unknown key, show error; if local preview has no license DB, unlock locally.
        if (err.error === 'License key not found') {
          this.licenseFeedback.className = 'alert-status is-err mono-muted';
          this.licenseFeedback.textContent = 'License key not found.';
          return;
        }
      }
    } catch {
      // Offline / local preview fallback
    }

    localStorage.setItem(STORAGE_PRO_KEY, key);
    this.setProUnlocked(true);
    this.licenseFeedback.className = 'alert-status is-ok mono-muted';
    this.licenseFeedback.textContent = 'Pro unlocked locally ✓';
  }

  private async startCheckout(tier: PurchaseTier): Promise<void> {
    const setStatus = (msg: string, isErr = false) => {
      this.licenseFeedback.className = `alert-status mono-muted ${isErr ? 'is-err' : ''}`;
      this.licenseFeedback.textContent = msg;
      this.pageBillingStatus.className = `alert-status mono-muted ${isErr ? 'is-err' : ''}`;
      this.pageBillingStatus.textContent = msg;
    };

    setStatus('Opening Stripe checkout…');
    const fallbackUrl = LIVE_PAYMENT_LINKS[tier];

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          swatch_hex: FLAGSHIP_HEX,
          origin: window.location.origin,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
    } catch {
      // Fall through to live Stripe Payment Link
    }

    if (fallbackUrl) {
      window.location.href = fallbackUrl;
      return;
    }

    setStatus('Select a plan or activate a VC- license key below.', false);
    this.openModal('modal-pricing');
  }
}

new VoibeRadarApp();
