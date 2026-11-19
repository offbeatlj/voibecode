#!/usr/bin/env sh
set -eu

PLUGIN_URL="https://voibecode.com/voibecode-antigravity-plugin.zip"
PLUGINS_DIR="$HOME/.gemini/config/plugins"
DEST_DIR="$PLUGINS_DIR/voibecode"
TMP_ZIP="$(mktemp /tmp/voibecode-XXXXXX.zip)"

cleanup() {
  rm -f "$TMP_ZIP"
}
trap cleanup EXIT

echo "-> Installing VoibeCode local radar & hooks..."
curl -fsSL "$PLUGIN_URL" -o "$TMP_ZIP"
mkdir -p "$PLUGINS_DIR"

if command -v unzip >/dev/null 2>&1; then
  unzip -oq "$TMP_ZIP" -d "$PLUGINS_DIR"
elif command -v python3 >/dev/null 2>&1; then
  python3 -m zipfile -e "$TMP_ZIP" "$PLUGINS_DIR"
else
  echo "Error: Neither 'unzip' nor 'python3' was found to extract $TMP_ZIP." >&2
  exit 1
fi

echo "✓ Installed VoibeCode plugin to $DEST_DIR"

if command -v node >/dev/null 2>&1 && [ -d "$HOME/.claude" ]; then
  CLAUDE_SETTINGS="$HOME/.claude/settings.json"
  HOOK_SCRIPT="$DEST_DIR/hooks/watcher-hook.mjs"
  node -e '
    const fs = require("node:fs");
    const settingsPath = process.argv[1];
    const hookScript = process.argv[2];
    let cfg = {};
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, "utf8").trim();
      if (raw) {
        try {
          cfg = JSON.parse(raw);
        } catch {
          console.log("! Skipped ~/.claude/settings.json (invalid JSON).");
          process.exit(0);
        }
      }
    }
    cfg.hooks = cfg.hooks && typeof cfg.hooks === "object" ? cfg.hooks : {};
    for (const [ev, arg] of [["PostToolUse", "tool"], ["Stop", "stop"]]) {
      const arr = Array.isArray(cfg.hooks[ev]) ? cfg.hooks[ev] : [];
      const exists = JSON.stringify(arr).includes("watcher-hook.mjs");
      if (!exists) {
        arr.push({
          matcher: "*",
          hooks: [{ type: "command", command: `node "${hookScript}" ${arg}` }],
        });
      }
      cfg.hooks[ev] = arr;
    }
    fs.writeFileSync(settingsPath, JSON.stringify(cfg, null, 2) + "\n", "utf8");
    console.log("✓ Wired Claude Code hooks in " + settingsPath);
  ' "$CLAUDE_SETTINGS" "$HOOK_SCRIPT"
fi

echo ""
echo "Ready! Start the local VoibeCode radar bridge anytime with:"
echo "  node \"$DEST_DIR/bridge.mjs\""
echo ""
echo "Then open http://127.0.0.1:4731 (or https://voibecode.com — auto-connects live)."
