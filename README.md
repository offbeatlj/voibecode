# VoibeCode — Air Traffic Control for AI Coding Agents

Watch every AI coding agent across **Antigravity 2.0**, **Claude Code**, **Cursor**, and **VS Code** on one calm radar. Get instant Australian voice alerts at your desk, real phone/Slack/Discord push pings the moment an agent stalls or enters an error loop, and exportable `1200×675` **AI Ship Receipts**.

**Live Site:** [https://voibecode.com](https://voibecode.com)

---

## 10-Second Quick Install (Free)

### macOS / Linux
```sh
curl -fsSL https://voibecode.com/install.sh | sh
```

### Windows (PowerShell)
```powershell
irm https://voibecode.com/install.ps1 | iex
```

Start the local radar bridge anytime (auto-connects `https://voibecode.com` to live local mode and serves a standalone radar at `http://127.0.0.1:4731`):
```sh
node ~/.gemini/config/plugins/voibecode/bridge.mjs
```

---

## Supported Clients

- **Antigravity 2.0:** Native plugin + Auxiliary Side Pane installed directly into `~/.gemini/config/plugins/voibecode`.
- **Claude Code CLI:** Automatically merges lightweight `PostToolUse` & `Stop` lifecycle hooks into `~/.claude/settings.json` when installed.
- **VS Code · Cursor · Windsurf:** Live on **[Open VSX Registry](https://open-vsx.org/extension/voibecode/voibecode)** (`voibecode.voibecode`, `<40 KB` `.vsix` extension with zero bundled audio bloat).

---

## Privacy Architecture — 100% Local Metadata Only

Senior developers shouldn't have to take anyone's word on trust. Audit our hook script directly:

- **[packages/antigravity-plugin/hooks/watcher-hook.mjs](packages/antigravity-plugin/hooks/watcher-hook.mjs)**

What VoibeCode reads & stores locally (`~/.gemini/voibecode-state.json`):
- Workspace folder **basename** (e.g. `voibcode`, never full filesystem paths)
- Event timestamps, durations, tool categories (`command`, `edit`, `read`, `subagent`), and error/streak counters

What VoibeCode **never** inspects, stores, or transmits:
- Source code, diffs, prompts, chat messages, terminal `stdout`/`stderr`, CLI arguments, environment variables, or file contents.

---

## Repository Structure

```text
packages/
  shared/               # Shared types, OKLCH palette math, WebGL twilight shader, Web Audio synth/voice engine
  web/                  # Ambient Radar web command center, ship receipt generator & 1-line installers
  server/               # Zero-dependency Node 22 production server (Docker / Cloud Run)
  worker/               # Optional Cloudflare Worker + KV backend
  extension/            # <26 KB VS Code / Cursor / Windsurf .vsix extension
  antigravity-plugin/   # Native Antigravity 2.0 plugin, metadata hook & standalone local bridge
scripts/
  package-antigravity.mjs
```

---

## Local Development

```bash
npm install
npm run typecheck
npm run build
npm run package:all
npm run dev:web
```

See [DEPLOY.md](DEPLOY.md) for Cloud Run / Docker and Cloudflare Pages + Worker deployment instructions.
