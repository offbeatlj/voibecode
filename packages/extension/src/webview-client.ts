import {
  ExtensionRuntimeConfig,
  ExtensionToWebviewMessage,
  FLAGSHIP_HEX,
  LicenseClientState,
  MatrixCell,
  PRO_LIFETIME_CHECKOUT_URL,
  QuoteChannel,
  SwatchEntry,
  TwilightAudioEngine,
  TwilightShaderController,
  VOIBECODE_ORIGIN,
  VoibeManifest,
  WatcherState,
  WebviewToExtensionMessage,
  createDefaultManifest,
  generate256Matrix,
  normalizeHex,
} from '@voibecode/shared';

interface VsCodeApi {
  postMessage: (msg: WebviewToExtensionMessage) => void;
}

declare function acquireVsCodeApi(): VsCodeApi;

interface InitialPayload {
  state: WatcherState;
  exitCode?: number;
  workspaceName?: string;
  selectedHex: string;
  channel: QuoteChannel;
  config: ExtensionRuntimeConfig;
  manifest: VoibeManifest;
  license: LicenseClientState;
}

const vscode = acquireVsCodeApi();
const bootstrapRaw =
  document.getElementById('voibecode-bootstrap')?.textContent ?? '{}';
const initial = JSON.parse(bootstrapRaw) as InitialPayload;

const canvas = document.getElementById('sky-canvas') as HTMLCanvasElement;
const topStatusEl = document.getElementById('top-status') as HTMLElement;
const btnSwatches = document.getElementById('btn-swatches') as HTMLButtonElement;
const btnChannel = document.getElementById('btn-channel') as HTMLButtonElement;
const btnAudio = document.getElementById('btn-audio') as HTMLButtonElement;
const btnUpgrade = document.getElementById('btn-upgrade') as HTMLButtonElement;
const btnLicense = document.getElementById('btn-license') as HTMLButtonElement;
const quoteBand = document.getElementById('quote-band') as HTMLElement;
const quoteTextEl = document.getElementById('quote-text') as HTMLElement;
const quoteAuthorEl = document.getElementById('quote-author') as HTMLElement;
const swatchesWrap = document.getElementById('swatches-wrap') as HTMLElement;
const swatchesGrid = document.getElementById('swatches-grid') as HTMLElement;
const swatchReadout = document.getElementById('swatch-readout') as HTMLElement;
const bottomLine = document.getElementById('bottom-line') as HTMLElement;

const matrix: MatrixCell[] = generate256Matrix();
const audio = new TwilightAudioEngine();
if (initial.workspaceName) {
  audio.setWorkspaceName(initial.workspaceName);
}
const shader = new TwilightShaderController(
  canvas,
  initial.selectedHex || FLAGSHIP_HEX
);

let currentState: WatcherState = initial.state ?? 'RUNNING';
let currentExitCode: number | undefined = initial.exitCode;
let currentWorkspaceName: string = initial.workspaceName || 'VoibeCode';
let currentHex: string = normalizeHex(initial.selectedHex || FLAGSHIP_HEX);
let previewHex: string = currentHex;
let currentChannel: QuoteChannel = initial.channel ?? 'systems';
let config: ExtensionRuntimeConfig = initial.config;
let manifest: VoibeManifest = initial.manifest ?? createDefaultManifest();
let license: LicenseClientState = initial.license ?? {
  unlockedHexes: [],
  fullDropper: false,
};
let quoteIndex = 0;
let swatchesOpen = false;
let dismissing = false;
let hasStallChimedForRun = false;

requestAnimationFrame(() => canvas.classList.add('is-ready'));

function isPersonalUnlocked(hex: string): boolean {
  const norm = normalizeHex(hex);
  if (norm === FLAGSHIP_HEX) return true;
  if (license.fullDropper) return true;
  return license.unlockedHexes.some((h) => normalizeHex(h) === norm);
}

function getClaimForCell(cell: MatrixCell): SwatchEntry | undefined {
  return manifest.swatches.find(
    (s) =>
      (s.row === cell.row && s.col === cell.col) ||
      normalizeHex(s.hex) === normalizeHex(cell.hex)
  );
}

function getClaimByHex(hex: string): SwatchEntry | undefined {
  const norm = normalizeHex(hex);
  return manifest.swatches.find((s) => normalizeHex(s.hex) === norm);
}

function renderStatusHeader(): void {
  const ws = currentWorkspaceName.toUpperCase();
  if (currentState === 'STALLED') {
    topStatusEl.textContent = `VOIBECODE // ${ws} // AGENT STALLED`;
  } else if (currentState === 'ERROR') {
    const codeLabel =
      typeof currentExitCode === 'number' ? String(currentExitCode) : 'NON-ZERO';
    topStatusEl.textContent = `VOIBECODE // ${ws} // EXIT ${codeLabel} — PRESS ANY KEY`;
  } else if (currentState === 'SCREENSAVER') {
    topStatusEl.textContent = `VOIBECODE // ${ws} // IDLE SKY`;
  } else {
    topStatusEl.textContent = `VOIBECODE // ${ws} // WAIT-STATE`;
  }
}

function renderLicenseControls(): void {
  if (license.founder) {
    btnUpgrade.hidden = true;
    btnLicense.textContent = '[ FOUNDER ]';
    btnLicense.classList.add('is-active');
  } else if (license.fullDropper) {
    btnUpgrade.hidden = true;
    btnLicense.textContent = '[ PRO ]';
    btnLicense.classList.add('is-active');
  } else {
    btnUpgrade.hidden = false;
    btnLicense.textContent = '[ ENTER KEY ]';
    btnLicense.classList.remove('is-active');
  }
}

function renderChannelControlsAndQuote(): void {
  const labelMap: Record<QuoteChannel, string> = {
    pure: '[ C: PURE SKY ]',
    systems: '[ C: SYSTEMS MAXIMS ]',
    legends: '[ C: TECH LEGENDS ]',
  };
  btnChannel.textContent = labelMap[currentChannel] ?? '[ C: CHANNEL ]';

  if (currentChannel === 'pure') {
    quoteBand.style.visibility = 'hidden';
    return;
  }

  quoteBand.style.visibility = 'visible';
  const rawList =
    currentChannel === 'systems'
      ? manifest.quotes.systems
      : manifest.quotes.legends;
  const available = license.fullDropper ? rawList : rawList.slice(0, 6);
  if (available.length === 0) return;

  const item = available[quoteIndex % available.length];
  quoteTextEl.textContent = item.text;
  quoteAuthorEl.textContent = `— ${item.author}`;
}

function renderBottomAttribution(hex: string): void {
  const normHex = normalizeHex(hex);
  bottomLine.innerHTML = '';

  if (normHex === FLAGSHIP_HEX) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hl-btn is-active';
    btn.textContent = 'VOIBECODE // EXPLORE 256 OKLCH SKIES ↗';
    btn.addEventListener('click', () => {
      vscode.postMessage({
        type: 'OPEN_URL',
        url: `${VOIBECODE_ORIGIN}/?swatch=${encodeURIComponent(normHex)}`,
      });
    });
    bottomLine.appendChild(btn);
    return;
  }

  const claim = getClaimByHex(normHex);
  const personalOwnedDirectly = license.unlockedHexes.some(
    (h) => normalizeHex(h) === normHex
  );

  // Owned directly by user -> Blank (pure sky)
  if (personalOwnedDirectly && !claim) {
    return;
  }

  if (claim && config.showPatronCredits && !personalOwnedDirectly) {
    const prefix = claim.tier === 'patron' ? 'PATRON' : 'MAKER';
    const linkBtn = document.createElement('button');
    linkBtn.type = 'button';
    linkBtn.className = 'hl-btn is-active';
    linkBtn.textContent = `${prefix} // ${claim.brand} — ${claim.tagline} ↗`;
    linkBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'OPEN_URL', url: claim.url });
    });
    bottomLine.appendChild(linkBtn);
    return;
  }

  if (isPersonalUnlocked(normHex)) {
    // Blank (pure sky)
    return;
  }

  // Locked swatch inside extension -> clean unlock action
  const unlockBtn = document.createElement('button');
  unlockBtn.type = 'button';
  unlockBtn.className = 'hl-btn is-active';
  unlockBtn.textContent = `[ LOCKED ${normHex} // CLAIM AT VOIBECODE.COM ↗ ]`;
  unlockBtn.addEventListener('click', () => {
    vscode.postMessage({
      type: 'OPEN_URL',
      url: `${VOIBECODE_ORIGIN}/?swatch=${encodeURIComponent(normHex)}`,
    });
  });
  bottomLine.appendChild(unlockBtn);

  const keyBtn = document.createElement('button');
  keyBtn.type = 'button';
  keyBtn.className = 'hl-btn';
  keyBtn.textContent = '[ ENTER VC- KEY ]';
  keyBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'PROMPT_LICENSE' });
  });
  bottomLine.appendChild(keyBtn);
}

function renderSwatches(): void {
  const frag = document.createDocumentFragment();

  for (const cell of matrix) {
    const claim = getClaimForCell(cell);
    const hex = claim ? normalizeHex(claim.hex) : cell.hex;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch-cell';
    btn.dataset.hex = hex;
    btn.style.backgroundColor = hex;

    if (normalizeHex(currentHex) === hex) {
      btn.classList.add('is-selected');
    }
    if (claim) {
      const pip = document.createElement('span');
      pip.className = 'pip-claimed';
      btn.appendChild(pip);
    }

    btn.addEventListener('mouseenter', () => {
      previewHex = hex;
      shader.setPalette(hex, 400);
      swatchReadout.textContent = claim
        ? `${hex} · ${claim.brand}`
        : isPersonalUnlocked(hex)
          ? `${hex} · UNLOCKED`
          : `${hex} · LOCKED`;
      renderBottomAttribution(hex);
    });

    btn.addEventListener('click', () => {
      const canActivate =
        hex === FLAGSHIP_HEX || Boolean(claim) || isPersonalUnlocked(hex);
      if (!canActivate) {
        swatchReadout.textContent = `${hex} · LOCKED (UNLOCK WITH VC- KEY OR VOIBECODE.COM)`;
        renderBottomAttribution(hex);
        return;
      }
      currentHex = hex;
      previewHex = hex;
      shader.setPalette(hex, 400);
      vscode.postMessage({ type: 'SELECT_SWATCH', hex });
      renderSwatches();
      renderBottomAttribution(hex);
    });

    frag.appendChild(btn);
  }

  swatchesGrid.innerHTML = '';
  swatchesGrid.appendChild(frag);
}

function toggleSwatches(): void {
  swatchesOpen = !swatchesOpen;
  swatchesWrap.hidden = !swatchesOpen;
  btnSwatches.classList.toggle('is-active', swatchesOpen);
  if (swatchesOpen) {
    renderSwatches();
  }
}

function cycleChannel(): void {
  const order: QuoteChannel[] = ['systems', 'legends', 'pure'];
  currentChannel = order[(order.indexOf(currentChannel) + 1) % order.length];
  quoteIndex = 0;
  renderChannelControlsAndQuote();
  vscode.postMessage({ type: 'SET_CHANNEL', channel: currentChannel });
}

async function toggleAudio(): Promise<void> {
  const mode = await audio.toggleMode();
  btnAudio.textContent = `[ M: AUDIO ${mode} ]`;
  btnAudio.classList.toggle('is-active', mode === 'SYNTH');
  vscode.postMessage({ type: 'TOGGLE_AUDIO', mode });
}

function dismissImmediately(trigger: string): void {
  if (dismissing) return;
  dismissing = true;
  if (audio.getMode() === 'SYNTH') {
    void audio.fadeOutAndStop();
  }
  shader.dispose();
  vscode.postMessage({ type: 'DISMISS', trigger });
}

btnSwatches.addEventListener('click', toggleSwatches);
btnChannel.addEventListener('click', cycleChannel);
btnAudio.addEventListener('click', () => void toggleAudio());
btnUpgrade.addEventListener('click', () => {
  vscode.postMessage({ type: 'OPEN_URL', url: PRO_LIFETIME_CHECKOUT_URL });
});
btnLicense.addEventListener('click', () => {
  vscode.postMessage({ type: 'PROMPT_LICENSE' });
});

swatchesGrid.addEventListener('mouseleave', () => {
  if (previewHex !== currentHex) {
    previewHex = currentHex;
    shader.setPalette(currentHex, 400);
    swatchReadout.textContent = `ACTIVE ${currentHex}`;
    renderBottomAttribution(currentHex);
  }
});

window.addEventListener('keydown', (e) => {
  const modifierOnly =
    e.key === 'Shift' ||
    e.key === 'Control' ||
    e.key === 'Alt' ||
    e.key === 'Meta' ||
    e.key === 'CapsLock';
  if (modifierOnly) return;

  if (e.code === 'Space') {
    e.preventDefault();
    quoteIndex++;
    renderChannelControlsAndQuote();
    return;
  }

  if (e.key === 's' || e.key === 'S') {
    e.preventDefault();
    toggleSwatches();
    return;
  }

  if (e.key === 'c' || e.key === 'C') {
    e.preventDefault();
    cycleChannel();
    return;
  }

  if (e.key === 'm' || e.key === 'M') {
    e.preventDefault();
    void toggleAudio();
    return;
  }

  // Any typing keystroke or Escape immediately dismisses Wait-State in <1ms
  e.preventDefault();
  dismissImmediately(e.key);
});

window.addEventListener('message', (event: MessageEvent<ExtensionToWebviewMessage>) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === 'STATE_CHANGE') {
    currentState = msg.state;
    currentExitCode = msg.exitCode;
    renderStatusHeader();

    if (msg.state === 'STALLED') {
      shader.setStalled(true);
      if (
        !hasStallChimedForRun &&
        (audio.getMode() === 'SYNTH' || config.allowStallChimeWhenMuted)
      ) {
        hasStallChimedForRun = true;
        void audio.triggerStallChime();
      }
    } else if (msg.state === 'RUNNING') {
      hasStallChimedForRun = false;
      shader.setStalled(false);
    } else if (msg.state === 'ERROR') {
      shader.setStalled(false);
      if (audio.getMode() === 'SYNTH') {
        void audio.fadeOutAndStop();
        btnAudio.textContent = '[ M: AUDIO OFF ]';
        btnAudio.classList.remove('is-active');
      }
    } else if (msg.state === 'COMPLETE') {
      if (audio.getMode() === 'SYNTH') {
        void audio.fadeOutAndStop().then(() => {
          vscode.postMessage({ type: 'AUDIO_FADED' });
        });
      } else {
        vscode.postMessage({ type: 'AUDIO_FADED' });
      }
    } else {
      shader.setStalled(false);
    }
  } else if (msg.type === 'MANIFEST') {
    manifest = msg.manifest;
    renderChannelControlsAndQuote();
    renderBottomAttribution(previewHex);
    if (swatchesOpen) renderSwatches();
  } else if (msg.type === 'CONFIG') {
    config = msg.config;
    renderBottomAttribution(previewHex);
  } else if (msg.type === 'LICENSE') {
    license = msg.license;
    renderLicenseControls();
    renderChannelControlsAndQuote();
    renderBottomAttribution(previewHex);
    if (swatchesOpen) renderSwatches();
  } else if (msg.type === 'SELECT_SWATCH') {
    currentHex = normalizeHex(msg.hex);
    previewHex = currentHex;
    shader.setPalette(currentHex, 400);
    renderBottomAttribution(currentHex);
  }
});

renderStatusHeader();
renderLicenseControls();
renderChannelControlsAndQuote();
renderBottomAttribution(currentHex);
vscode.postMessage({ type: 'READY' });
