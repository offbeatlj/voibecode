# VoibeCode — AI Agent Stall Watcher & Radar

**Air traffic control for AI coding agents.** Watch terminal tasks across your IDE, hear a gentle harmonic chime (`528Hz → 792Hz`) the moment an agent stalls for `>10s`, and dismiss the twilight wait screen in **`<1ms`** with any keystroke.

Pairs seamlessly with the **[VoibeCode Ambient Radar](https://voibecode.com)** for multi-workspace tracking, **Australian voice triage**, **Phone / Slack / Discord Away Alerts**, and `1200×675` **AI Ship Receipts**.

---

## Features

- **Zero-Chrome Volumetric Twilight Shader:** 6-octave domain-warped fBm dusk sky with Ignored Gradient Noise (IGN) dithering — no modals, borders, or visual noise.
- **Metadata-Only Stall Watcher:** Monitors `window.onDidStartTerminalShellExecution`, `execution.read()`, `onDidEndTerminalShellExecution`, and `onDidCloseTerminal` byte-arrival timestamps to catch silent stalls (`[y/N]`, `Allow`, `429` rate limits).
- **`<1ms` Instant Dismissal:** Any keystroke or `Escape` disposes the wait screen immediately and restores editor focus.
- **Procedural `OFF / SYNTH` Web Audio:** Pure Web Audio synthesis (`180Hz` brown noise + `110Hz / 164.81Hz` fifth drone) + `528Hz → 792Hz` stall ping with zero bundled `.mp3`/`.opus` files (`<35 KB` VSIX total).
- **Idle Screensaver Mode:** Automatically dims into the twilight sky after `voibecode.idleTimeoutSeconds` (default `180s`).

---

## Strict Zero-Telemetry Privacy

VoibeCode **never** inspects, parses, stores, or transmits source code, file paths, clipboard contents, environment variables, or terminal `stdout`/`stderr` text. It tracks only execution lifecycle state transitions and byte-arrival timestamps locally in memory.

---

## Extension Settings

| Setting | Default | Description |
| :--- | :--- | :--- |
| `voibecode.enabled` | `true` | Enable the zero-chrome twilight wait screen on terminal execution and stalls. |
| `voibecode.stallThresholdSeconds` | `10` | Seconds with zero terminal stdout bytes before transitioning to `STALLED` and sounding the `528Hz → 792Hz` chime. |
| `voibecode.idleTimeoutSeconds` | `180` | Seconds of focused editor inactivity before launching screensaver mode (`0` to disable). |
| `voibecode.allowStallChimeWhenMuted` | `true` | Play the stall alert chime even when ambient synth audio is `OFF`. |
| `voibecode.shufflePatronSkies` | `false` | Rotate across unlocked/claimed OKLCH skies automatically when wait state launches. |
| `voibecode.showPatronCredits` | `true` | Display bottom hairline credit on patron/maker skies. |

---

## Multi-IDE Ecosystem (`voibecode.com`)

Want multi-workspace radar across **Antigravity 2.0**, **Claude Code CLI**, and **Cursor** with live phone push notifications (`ntfy.sh`, Slack, Discord)?

Visit **[https://voibecode.com](https://voibecode.com)** or run the 1-line installer:

```sh
# macOS / Linux
curl -fsSL https://voibecode.com/install.sh | sh
```

```powershell
# Windows (PowerShell)
irm https://voibecode.com/install.ps1 | iex
```
