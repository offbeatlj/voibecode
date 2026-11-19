import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  AudioMode,
  ExtensionRuntimeConfig,
  ExtensionToWebviewMessage,
  FLAGSHIP_HEX,
  LicenseClientState,
  LicenseRecord,
  PRO_LIFETIME_CHECKOUT_URL,
  PurchaseTier,
  QuoteChannel,
  VOIBECODE_ORIGIN,
  VoibeManifest,
  WatcherState,
  WebviewToExtensionMessage,
  createDefaultManifest,
  normalizeHex,
} from '@voibecode/shared';
import { getWebviewHtml } from './webview.js';

const SECRET_LICENSE_KEY = 'voibecode.licenseKey';
const STATE_MANIFEST_CACHE = 'voibecode.manifestCache';
const STATE_LICENSE_CACHE = 'voibecode.licenseCache';
const STATE_SELECTED_SWATCH = 'voibecode.selectedSwatch';
const STATE_CHANNEL = 'voibecode.channel';
const SHARED_LICENSE_PATH = path.join(os.homedir(), '.gemini', 'voibecode-license.json');

interface SharedLicenseRecord {
  active?: boolean;
  key?: string;
  tier?: string;
  founder?: boolean;
  unlockedAll?: boolean;
  verifiedAt?: string;
}

interface ActiveExecutionTracker {
  id: number;
  terminal: vscode.Terminal;
  execution: vscode.TerminalShellExecution;
  stalled: boolean;
  dismissed: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

class VoibeCodeController implements vscode.Disposable {
  private readonly context: vscode.ExtensionContext;
  private readonly disposables: vscode.Disposable[] = [];

  private panel: vscode.WebviewPanel | null = null;
  private readonly statusBarItem: vscode.StatusBarItem;
  private state: WatcherState = 'IDLE';
  private lastExitCode: number | undefined;
  private audioMode: AudioMode = 'OFF';
  private clientScriptCache: string | null = null;

  private nextExecId = 1;
  private readonly executions = new Map<number, ActiveExecutionTracker>();
  private readonly activeTasks = new Set<vscode.TaskExecution>();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingCompleteTimer: ReturnType<typeof setTimeout> | null = null;
  private manifestFetchedAt = 0;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'voibecode.openMenu';
    this.disposables.push(this.statusBarItem);
    this.updateStatusBar();
    this.statusBarItem.show();
    this.registerHooks();
    this.resetIdleTimer();
    void this.refreshManifestInBackground();
  }

  public dispose(): void {
    this.clearAllTimers();
    this.disposePanelNow();
    for (const d of this.disposables) {
      d.dispose();
    }
  }

  public openManually(): void {
    this.clearIdleTimer();
    this.state = 'RUNNING';
    this.lastExitCode = undefined;
    this.ensureWebviewOpen();
    this.postMessage({ type: 'STATE_CHANGE', state: 'RUNNING' });
  }

  public upgradeToPro(): void {
    void vscode.env.openExternal(vscode.Uri.parse(PRO_LIFETIME_CHECKOUT_URL));
  }

  public async openQuickMenu(): Promise<void> {
    const lic = this.getCachedLicense();
    const cfg = this.getConfig();
    const items: Array<vscode.QuickPickItem & { action: string }> = [
      { label: 'Open Wait-State Sky', description: 'Preview twilight shader & audio engine', action: 'open' },
      ...(!lic.fullDropper
        ? [
            {
              label: 'Upgrade to Pro ($39 Lifetime)',
              description: 'Unlock all 256 skies, quotes & Away Alerts',
              action: 'upgrade',
            },
          ]
        : []),
      {
        label: 'Enter License Key (VC-...)',
        description: lic.founder ? 'Active: Founder' : lic.fullDropper ? 'Active: Pro' : 'Activate your VC- key',
        action: 'license',
      },
      { label: 'Open VoibeCode Web Radar (voibecode.com)', description: 'Multi-workspace radar & Away Alerts', action: 'web' },
      {
        label: 'Toggle Stall Watcher On/Off',
        description: cfg.enabled ? 'Currently Enabled' : 'Currently Paused',
        action: 'toggle',
      },
    ];

    const picked = await vscode.window.showQuickPick(items, {
      title: lic.founder ? 'VoibeCode (Founder)' : lic.fullDropper ? 'VoibeCode (Pro)' : 'VoibeCode (Free)',
      placeHolder: 'Choose a VoibeCode action',
    });
    if (!picked) return;
    if (picked.action === 'open') this.openManually();
    else if (picked.action === 'upgrade') this.upgradeToPro();
    else if (picked.action === 'license') await this.promptForLicenseKey();
    else if (picked.action === 'web') void vscode.env.openExternal(vscode.Uri.parse(VOIBECODE_ORIGIN));
    else if (picked.action === 'toggle') await this.toggleEnabledSetting();
  }

  public async promptForLicenseKey(): Promise<void> {
    const raw = await vscode.window.showInputBox({
      title: 'VoibeCode License Key',
      prompt: 'Enter your VC-XXXX-XXXX or VC-PRO-XXXX-XXXX license key to unlock swatches and quote archives.',
      placeHolder: 'VC-XXXX-XXXX',
      ignoreFocusOut: true,
    });

    if (!raw) return;
    const clean = raw.trim().toUpperCase();
    if (!/^VC-(?:(?:PRO|TEAM)-)?[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(clean)) {
      void vscode.window.showErrorMessage(
        'VoibeCode: Expected license key format VC-XXXX-XXXX or VC-PRO-XXXX-XXXX.'
      );
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(
        `${VOIBECODE_ORIGIN}/api/license/${encodeURIComponent(clean)}`,
        { signal: controller.signal }
      );
      const data = (await res.json()) as LicenseRecord;
      if (!res.ok || !data.valid) {
        void vscode.window.showErrorMessage(
          `VoibeCode: License key ${clean} could not be verified.`
        );
        return;
      }

      await this.context.secrets.store(SECRET_LICENSE_KEY, clean);

      const prev = this.getCachedLicense();
      const unlockedSet = new Set(prev.unlockedHexes);
      if (data.swatch_hex) {
        unlockedSet.add(normalizeHex(data.swatch_hex));
      }

      const nextLicense: LicenseClientState = {
        licenseKey: clean,
        tier: data.tier,
        unlockedHexes: Array.from(unlockedSet),
        fullDropper: prev.fullDropper || data.unlocked_all,
        founder: Boolean(data.founder || prev.founder),
        fourthwallPromo: data.fourthwall_promo ?? prev.fourthwallPromo,
      };

      await this.context.globalState.update(STATE_LICENSE_CACHE, nextLicense);
      if (data.unlocked_all) {
        this.writeSharedLicenseFile({
          active: true,
          key: clean,
          tier: data.tier,
          founder: Boolean(data.founder),
          unlockedAll: true,
          verifiedAt: new Date().toISOString(),
        });
      }
      if (data.swatch_hex) {
        await this.context.globalState.update(
          STATE_SELECTED_SWATCH,
          normalizeHex(data.swatch_hex)
        );
      }

      this.updateStatusBar();
      this.postMessage({ type: 'LICENSE', license: nextLicense });
      if (data.swatch_hex) {
        this.postMessage({
          type: 'SELECT_SWATCH',
          hex: normalizeHex(data.swatch_hex),
        });
      }

      const label = nextLicense.founder ? 'FOUNDER' : data.tier.toUpperCase();
      void vscode.window.showInformationMessage(
        `VoibeCode: Activated ${label} entitlement (${clean}).`
      );
    } catch {
      void vscode.window.showWarningMessage(
        'VoibeCode: Unable to reach voibecode.com within 4s to verify key.'
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  public async toggleEnabledSetting(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('voibecode');
    const next = !cfg.get<boolean>('enabled', true);
    await cfg.update('enabled', next, vscode.ConfigurationTarget.Global);
    if (!next) {
      this.dismissImmediate();
    }
    this.updateStatusBar();
    void vscode.window.setStatusBarMessage(
      `VoibeCode ${next ? 'enabled' : 'paused'}`,
      2500
    );
  }

  private getConfig(): ExtensionRuntimeConfig {
    const cfg = vscode.workspace.getConfiguration('voibecode');
    return {
      enabled: cfg.get<boolean>('enabled', true),
      stallThresholdSeconds: cfg.get<number>('stallThresholdSeconds', 10),
      idleTimeoutSeconds: cfg.get<number>('idleTimeoutSeconds', 180),
      allowStallChimeWhenMuted: cfg.get<boolean>('allowStallChimeWhenMuted', true),
      shufflePatronSkies: cfg.get<boolean>('shufflePatronSkies', false),
      showPatronCredits: cfg.get<boolean>('showPatronCredits', true),
    };
  }

  private getCachedManifest(): VoibeManifest {
    const cached = this.context.globalState.get<VoibeManifest>(STATE_MANIFEST_CACHE);
    if (cached && Array.isArray(cached.swatches)) {
      return cached;
    }
    return createDefaultManifest();
  }

  private readSharedLicenseFile(): SharedLicenseRecord | null {
    try {
      const parsed = JSON.parse(fs.readFileSync(SHARED_LICENSE_PATH, 'utf8')) as SharedLicenseRecord;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  private writeSharedLicenseFile(rec: SharedLicenseRecord): void {
    try {
      fs.mkdirSync(path.dirname(SHARED_LICENSE_PATH), { recursive: true });
      const tmp = `${SHARED_LICENSE_PATH}.ext.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(rec, null, 2), 'utf8');
      fs.renameSync(tmp, SHARED_LICENSE_PATH);
    } catch {
      // Ignore write failures
    }
  }

  private updateStatusBar(): void {
    const lic = this.getCachedLicense();
    if (lic.founder) {
      this.statusBarItem.text = '$(pulse) VoibeCode · Founder';
      this.statusBarItem.tooltip = 'VoibeCode Founder Edition active — click for menu & radar';
    } else if (lic.fullDropper) {
      this.statusBarItem.text = '$(pulse) VoibeCode · Pro';
      this.statusBarItem.tooltip = 'VoibeCode Pro active — click for menu & radar';
    } else {
      this.statusBarItem.text = '$(pulse) VoibeCode';
      this.statusBarItem.tooltip = 'VoibeCode Free — click to open menu, enter key, or upgrade';
    }
  }

  private getCachedLicense(): LicenseClientState {
    const cached =
      this.context.globalState.get<LicenseClientState>(STATE_LICENSE_CACHE);
    const base: LicenseClientState = cached ?? {
      unlockedHexes: [],
      fullDropper: false,
    };
    const shared = this.readSharedLicenseFile();
    if (shared?.active && shared.unlockedAll) {
      return {
        ...base,
        licenseKey: shared.key ?? base.licenseKey,
        tier: (shared.tier as PurchaseTier) ?? base.tier ?? 'pro_lifetime',
        fullDropper: true,
        founder: Boolean(shared.founder || base.founder),
      };
    }
    return base;
  }

  private resolveOpeningSwatchHex(): string {
    const cfg = this.getConfig();
    const manifest = this.getCachedManifest();
    if (cfg.shufflePatronSkies && manifest.swatches.length > 0) {
      const pool = [
        FLAGSHIP_HEX,
        ...manifest.swatches.map((s) => normalizeHex(s.hex)),
      ];
      return pool[Math.floor(Math.random() * pool.length)];
    }
    const stored = this.context.globalState.get<string>(STATE_SELECTED_SWATCH);
    return stored ? normalizeHex(stored) : FLAGSHIP_HEX;
  }

  private registerHooks(): void {
    // 1. Shell execution lifecycle (metadata-only byte arrival watchdog)
    if (typeof vscode.window.onDidStartTerminalShellExecution === 'function') {
      this.disposables.push(
        vscode.window.onDidStartTerminalShellExecution((event) => {
          this.handleShellStart(event);
        })
      );
    }

    if (typeof vscode.window.onDidEndTerminalShellExecution === 'function') {
      this.disposables.push(
        vscode.window.onDidEndTerminalShellExecution((event) => {
          this.handleShellEnd(event);
        })
      );
    }

    // 2. Always clean up timers if a terminal is closed or killed abruptly
    this.disposables.push(
      vscode.window.onDidCloseTerminal((closedTerminal) => {
        for (const [id, tracker] of this.executions.entries()) {
          if (tracker.terminal === closedTerminal) {
            if (tracker.timer) clearTimeout(tracker.timer);
            this.executions.delete(id);
          }
        }
        this.reconcileCompletionOrState();
      })
    );

    // 3. VS Code / agent Tasks API
    this.disposables.push(
      vscode.tasks.onDidStartTask((e) => {
        this.activeTasks.add(e.execution);
        if (this.getConfig().enabled) {
          this.clearIdleTimer();
          this.state = 'RUNNING';
          this.lastExitCode = undefined;
          this.ensureWebviewOpen();
          this.postMessage({ type: 'STATE_CHANGE', state: 'RUNNING' });
        }
      }),
      vscode.tasks.onDidEndTask((e) => {
        this.activeTasks.delete(e.execution);
        this.reconcileCompletionOrState();
      }),
      vscode.tasks.onDidEndTaskProcess((e) => {
        this.activeTasks.delete(e.execution);
        if (typeof e.exitCode === 'number' && e.exitCode !== 0 && this.panel) {
          this.state = 'ERROR';
          this.lastExitCode = e.exitCode;
          this.postMessage({
            type: 'STATE_CHANGE',
            state: 'ERROR',
            exitCode: e.exitCode,
          });
          return;
        }
        this.reconcileCompletionOrState();
      })
    );

    // 4. Editor activity & idle screensaver detection
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.scheme === 'file' && e.contentChanges.length > 0) {
          this.onUserActivityInEditor(true);
        }
      }),
      vscode.window.onDidChangeTextEditorSelection(() => {
        if (this.state === 'SCREENSAVER') {
          this.dismissImmediate();
        }
        this.resetIdleTimer();
      }),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && this.panel && !this.panel.active) {
          // User switched back to coding inside an editor group -> dismiss wait view cleanly
          if (this.state === 'SCREENSAVER') {
            this.dismissImmediate();
          }
        }
        this.resetIdleTimer();
      }),
      vscode.window.onDidChangeWindowState((windowState) => {
        if (windowState.focused) {
          this.resetIdleTimer();
        } else {
          this.clearIdleTimer();
        }
      }),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('voibecode')) {
          this.postMessage({ type: 'CONFIG', config: this.getConfig() });
          this.resetIdleTimer();
        }
      })
    );
  }

  private handleShellStart(
    event: vscode.TerminalShellExecutionStartEvent
  ): void {
    if (!this.getConfig().enabled) return;

    this.clearIdleTimer();
    const id = this.nextExecId++;
    const tracker: ActiveExecutionTracker = {
      id,
      terminal: event.terminal,
      execution: event.execution,
      stalled: false,
      dismissed: false,
      timer: null,
    };
    this.executions.set(id, tracker);

    const armStallTimer = () => {
      const current = this.executions.get(id);
      if (!current) return;
      if (current.stalled) {
        current.stalled = false;
        this.reconcileCompletionOrState();
      }
      if (current.timer) clearTimeout(current.timer);
      const stallMs = Math.max(3, this.getConfig().stallThresholdSeconds) * 1000;
      current.timer = setTimeout(() => {
        const entry = this.executions.get(id);
        if (!entry) return;
        entry.stalled = true;
        this.state = 'STALLED';
        if (!entry.dismissed) {
          this.ensureWebviewOpen();
        }
        this.postMessage({ type: 'STATE_CHANGE', state: 'STALLED' });
      }, stallMs);
    };

    armStallTimer();
    this.state = 'RUNNING';
    this.lastExitCode = undefined;
    this.ensureWebviewOpen();
    this.postMessage({ type: 'STATE_CHANGE', state: 'RUNNING' });

    // Metadata-only stream consumption: NEVER read, parse, store, or transmit string chunks.
    void (async () => {
      try {
        const stream = event.execution.read();
        for await (const chunk of stream) {
          if (chunk.length > 0) {
            armStallTimer();
          }
        }
      } catch {
        // Execution stream terminated
      }
    })();
  }

  private handleShellEnd(event: vscode.TerminalShellExecutionEndEvent): void {
    let matchedId: number | null = null;
    for (const [id, tracker] of this.executions.entries()) {
      if (tracker.execution === event.execution) {
        matchedId = id;
        break;
      }
    }
    if (matchedId === null) {
      for (const [id, tracker] of this.executions.entries()) {
        if (tracker.terminal === event.terminal) {
          matchedId = id;
          break;
        }
      }
    }
    if (matchedId !== null) {
      const tracker = this.executions.get(matchedId);
      if (tracker?.timer) clearTimeout(tracker.timer);
      this.executions.delete(matchedId);
    }

    if (typeof event.exitCode === 'number' && event.exitCode !== 0 && this.panel) {
      this.state = 'ERROR';
      this.lastExitCode = event.exitCode;
      this.postMessage({
        type: 'STATE_CHANGE',
        state: 'ERROR',
        exitCode: event.exitCode,
      });
      return;
    }

    this.reconcileCompletionOrState();
  }

  private reconcileCompletionOrState(): void {
    const anyStalled = Array.from(this.executions.values()).some(
      (e) => e.stalled
    );
    if (anyStalled) {
      this.state = 'STALLED';
      this.postMessage({ type: 'STATE_CHANGE', state: 'STALLED' });
      return;
    }

    if (this.executions.size > 0 || this.activeTasks.size > 0) {
      if (this.state !== 'RUNNING') {
        this.state = 'RUNNING';
        this.postMessage({ type: 'STATE_CHANGE', state: 'RUNNING' });
      }
      return;
    }

    // All terminal/task work completed cleanly
    if (this.state === 'ERROR' || this.state === 'SCREENSAVER' || this.state === 'IDLE') {
      return;
    }

    this.state = 'COMPLETE';
    if (!this.panel) {
      this.state = 'IDLE';
      this.resetIdleTimer();
      return;
    }

    if (this.audioMode === 'SYNTH') {
      this.postMessage({ type: 'STATE_CHANGE', state: 'COMPLETE' });
      void vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
      this.pendingCompleteTimer = setTimeout(() => {
        this.disposePanelNow();
        this.state = 'IDLE';
        this.resetIdleTimer();
      }, 70);
    } else {
      this.dismissImmediate();
    }
  }

  private onUserActivityInEditor(isTyping: boolean): void {
    if (isTyping && this.panel) {
      for (const tracker of this.executions.values()) {
        tracker.dismissed = true;
      }
      this.dismissImmediate();
    }
    this.resetIdleTimer();
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    const cfg = this.getConfig();
    if (!cfg.enabled || cfg.idleTimeoutSeconds <= 0) return;
    if (!vscode.window.state.focused) return;
    if (this.executions.size > 0 || this.activeTasks.size > 0) return;
    if (this.panel) return;

    const ms = cfg.idleTimeoutSeconds * 1000;
    this.idleTimer = setTimeout(() => {
      if (!vscode.window.state.focused) return;
      if (this.executions.size > 0 || this.activeTasks.size > 0) return;
      if (!this.getConfig().enabled) return;

      this.state = 'SCREENSAVER';
      this.lastExitCode = undefined;
      this.ensureWebviewOpen();
      this.postMessage({ type: 'STATE_CHANGE', state: 'SCREENSAVER' });
    }, ms);
  }

  private loadClientScript(): string {
    if (this.clientScriptCache !== null) {
      return this.clientScriptCache;
    }
    const candidate = path.join(__dirname, 'webview-client.js');
    this.clientScriptCache = fs.readFileSync(candidate, 'utf8');
    return this.clientScriptCache;
  }

  private ensureWebviewOpen(): void {
    if (this.pendingCompleteTimer !== null) {
      clearTimeout(this.pendingCompleteTimer);
      this.pendingCompleteTimer = null;
    }

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active, false);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'voibecode.waitState',
      'VoibeCode',
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
      {
        enableScripts: true,
        retainContextWhenHidden: false,
      }
    );

    this.panel = panel;
    const nonce = crypto.randomBytes(16).toString('base64');
    const selectedHex = this.resolveOpeningSwatchHex();
    const channel =
      this.context.globalState.get<QuoteChannel>(STATE_CHANNEL) ?? 'systems';
    const workspaceName =
      vscode.workspace.workspaceFolders?.[0]?.name ?? 'VoibeCode';

    panel.webview.html = getWebviewHtml(
      nonce,
      {
        state: this.state,
        exitCode: this.lastExitCode,
        workspaceName,
        selectedHex,
        channel,
        config: this.getConfig(),
        manifest: this.getCachedManifest(),
        license: this.getCachedLicense(),
      },
      this.loadClientScript()
    );

    panel.webview.onDidReceiveMessage(
      (msg: WebviewToExtensionMessage) => {
        this.handleWebviewMessage(msg);
      },
      undefined,
      this.disposables
    );

    panel.onDidDispose(
      () => {
        if (this.panel === panel) {
          this.panel = null;
          this.audioMode = 'OFF';
          if (this.state === 'ERROR' || this.state === 'SCREENSAVER' || this.state === 'COMPLETE') {
            this.state = 'IDLE';
          }
          this.resetIdleTimer();
        }
      },
      undefined,
      this.disposables
    );

    // Refresh manifest silently if stale (> 60s)
    if (Date.now() - this.manifestFetchedAt > 60_000) {
      void this.refreshManifestInBackground();
    }
  }

  private handleWebviewMessage(msg: WebviewToExtensionMessage): void {
    if (msg.type === 'READY') {
      this.postMessage({ type: 'STATE_CHANGE', state: this.state, exitCode: this.lastExitCode });
    } else if (msg.type === 'DISMISS') {
      for (const tracker of this.executions.values()) {
        tracker.dismissed = true;
      }
      this.dismissImmediate();
    } else if (msg.type === 'AUDIO_FADED') {
      if (this.state === 'COMPLETE') {
        this.disposePanelNow();
        this.state = 'IDLE';
        this.resetIdleTimer();
      }
    } else if (msg.type === 'TOGGLE_AUDIO') {
      this.audioMode = msg.mode;
    } else if (msg.type === 'SET_CHANNEL') {
      void this.context.globalState.update(STATE_CHANNEL, msg.channel);
    } else if (msg.type === 'SELECT_SWATCH') {
      void this.context.globalState.update(
        STATE_SELECTED_SWATCH,
        normalizeHex(msg.hex)
      );
    } else if (msg.type === 'PROMPT_LICENSE') {
      void this.promptForLicenseKey();
    } else if (msg.type === 'OPEN_URL') {
      try {
        const parsed = new URL(msg.url);
        if (parsed.protocol === 'https:') {
          void vscode.env.openExternal(vscode.Uri.parse(parsed.toString()));
        }
      } catch {
        // Ignore invalid external URLs
      }
    }
  }

  private dismissImmediate(): void {
    this.disposePanelNow();
    this.state = 'IDLE';
    this.lastExitCode = undefined;
    void vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
    this.resetIdleTimer();
  }

  private disposePanelNow(): void {
    if (this.pendingCompleteTimer !== null) {
      clearTimeout(this.pendingCompleteTimer);
      this.pendingCompleteTimer = null;
    }
    if (this.panel) {
      const toClose = this.panel;
      this.panel = null;
      this.audioMode = 'OFF';
      toClose.dispose();
    }
  }

  private postMessage(msg: ExtensionToWebviewMessage): void {
    if (!this.panel) return;
    void this.panel.webview.postMessage(msg);
  }

  private async refreshManifestInBackground(): Promise<void> {
    this.manifestFetchedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(`${VOIBECODE_ORIGIN}/api/manifest.json`, {
        signal: controller.signal,
      });
      if (!res.ok) return;
      const manifest = (await res.json()) as VoibeManifest;
      if (!manifest || !Array.isArray(manifest.swatches)) return;

      await this.context.globalState.update(STATE_MANIFEST_CACHE, manifest);
      this.postMessage({ type: 'MANIFEST', manifest });
    } catch {
      // Network timeout/offline falls back cleanly to cached or bundled manifest
    } finally {
      clearTimeout(timeout);
    }
  }

  private clearAllTimers(): void {
    this.clearIdleTimer();
    if (this.pendingCompleteTimer !== null) {
      clearTimeout(this.pendingCompleteTimer);
      this.pendingCompleteTimer = null;
    }
    for (const tracker of this.executions.values()) {
      if (tracker.timer) clearTimeout(tracker.timer);
    }
    this.executions.clear();
    this.activeTasks.clear();
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const controller = new VoibeCodeController(context);
  context.subscriptions.push(controller);

  context.subscriptions.push(
    vscode.commands.registerCommand('voibecode.openMenu', () => {
      void controller.openQuickMenu();
    }),
    vscode.commands.registerCommand('voibecode.openWaitState', () => {
      controller.openManually();
    }),
    vscode.commands.registerCommand('voibecode.upgradePro', () => {
      controller.upgradeToPro();
    }),
    vscode.commands.registerCommand('voibecode.enterLicenseKey', () => {
      void controller.promptForLicenseKey();
    }),
    vscode.commands.registerCommand('voibecode.toggleEnabled', () => {
      void controller.toggleEnabledSetting();
    })
  );
}

export function deactivate(): void {
  // Handled cleanly via context.subscriptions disposal
}
