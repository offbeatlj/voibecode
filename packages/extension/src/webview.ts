import type {
  ExtensionRuntimeConfig,
  LicenseClientState,
  QuoteChannel,
  VoibeManifest,
  WatcherState,
} from '@voibecode/shared';

export interface WebviewInitPayload {
  state: WatcherState;
  exitCode?: number;
  workspaceName?: string;
  selectedHex: string;
  channel: QuoteChannel;
  config: ExtensionRuntimeConfig;
  manifest: VoibeManifest;
  license: LicenseClientState;
}

function escapeJsonForHtml(json: string): string {
  return json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function getWebviewHtml(
  nonce: string,
  initPayload: WebviewInitPayload,
  clientScriptSource: string
): string {
  const serializedBootstrap = escapeJsonForHtml(JSON.stringify(initPayload));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src https://voibecode.com;"
  />
  <title>VoibeCode</title>
  <style>
    :root {
      --fg: rgba(246, 243, 240, 0.92);
      --fg-muted: rgba(246, 243, 240, 0.62);
      --mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
    }
    * { box-sizing: border-box; border-radius: 0; box-shadow: none; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #101524;
      color: var(--fg);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.08em;
      user-select: none;
    }
    #sky-canvas {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      z-index: 0;
      opacity: 0;
      transition: opacity 150ms linear;
      pointer-events: none;
    }
    #sky-canvas.is-ready { opacity: 1; }
    .shell {
      position: relative;
      z-index: 1;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 20px 26px;
    }
    .hairline {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px 20px;
      text-transform: uppercase;
    }
    .group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
    }
    .hl-btn {
      appearance: none;
      background: transparent;
      border: none;
      padding: 2px 0;
      margin: 0;
      color: var(--fg-muted);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .hl-btn:hover, .hl-btn:focus-visible, .hl-btn.is-active {
      color: var(--fg);
      outline: none;
    }
    .hl-btn[hidden] { display: none; }
    .center {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 28px;
      text-align: center;
      padding: 0 24px;
    }
    #quote-band {
      max-width: 680px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    #quote-text {
      margin: 0;
      font-size: 14px;
      line-height: 1.65;
      letter-spacing: 0.03em;
      color: var(--fg);
    }
    #quote-author {
      margin: 0;
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--fg-muted);
    }
    #swatches-wrap[hidden] { display: none; }
    #swatches-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    #swatches-grid {
      display: grid;
      grid-template-columns: repeat(16, 1fr);
      gap: 2px;
      width: min(64vw, 340px);
    }
    .swatch-cell {
      position: relative;
      width: 100%;
      aspect-ratio: 1 / 1;
      border: 1px solid rgba(255,255,255,0.08);
      padding: 0;
      margin: 0;
      cursor: pointer;
      appearance: none;
    }
    .swatch-cell:hover {
      border-color: var(--fg);
      transform: scale(1.15);
      z-index: 2;
    }
    .swatch-cell.is-selected {
      border-color: var(--fg);
      outline: 1px solid var(--fg);
    }
    .pip-claimed {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 2px;
      height: 2px;
      background: rgba(255,255,255,0.95);
    }
    #swatch-readout {
      font-size: 10px;
      color: var(--fg-muted);
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
  </style>
</head>
<body>
  <canvas id="sky-canvas" aria-hidden="true"></canvas>

  <div class="shell">
    <header class="hairline">
      <div id="top-status">VOIBECODE // WAIT-STATE</div>
      <div class="group">
        <button id="btn-swatches" class="hl-btn" type="button">[ S: SWATCHES ]</button>
        <button id="btn-channel" class="hl-btn" type="button">[ C: CHANNEL ]</button>
        <button id="btn-audio" class="hl-btn" type="button">[ M: AUDIO OFF ]</button>
        <button id="btn-upgrade" class="hl-btn is-active" type="button">[ UPGRADE PRO ]</button>
        <button id="btn-license" class="hl-btn" type="button">[ ENTER KEY ]</button>
      </div>
    </header>

    <main class="center">
      <section id="quote-band">
        <p id="quote-text"></p>
        <p id="quote-author"></p>
      </section>

      <section id="swatches-wrap" hidden>
        <div id="swatches-grid"></div>
        <div id="swatch-readout">ACTIVE #FF7B6B</div>
      </section>
    </main>

    <footer class="hairline">
      <div id="bottom-line" class="group"></div>
      <div class="group" style="color: var(--fg-muted); font-size: 10px;">
        ANY KEY / ESC: RETURN TO EDITOR
      </div>
    </footer>
  </div>

  <script id="voibecode-bootstrap" type="application/json" nonce="${nonce}">${serializedBootstrap}</script>
  <script nonce="${nonce}">${clientScriptSource}</script>
</body>
</html>`;
}
