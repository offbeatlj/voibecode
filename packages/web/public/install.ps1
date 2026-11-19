$ErrorActionPreference = 'Stop'

$PluginUrl = 'https://voibecode.com/voibecode-antigravity-plugin.zip'
$PluginsDir = Join-Path $env:USERPROFILE '.gemini\config\plugins'
$DestDir = Join-Path $PluginsDir 'voibecode'
$TempZip = Join-Path $env:TEMP "voibecode-antigravity-$([System.Guid]::NewGuid().ToString('N')).zip"

try {
  Write-Host '-> Installing VoibeCode local radar & hooks...'
  Invoke-WebRequest -Uri $PluginUrl -OutFile $TempZip -UseBasicParsing
  New-Item -ItemType Directory -Force -Path $PluginsDir | Out-Null
  Expand-Archive -Path $TempZip -DestinationPath $PluginsDir -Force
  Write-Host "Installed VoibeCode plugin to $DestDir"
}
finally {
  if (Test-Path $TempZip) {
    Remove-Item $TempZip -Force -ErrorAction SilentlyContinue
  }
}

$ClaudeDir = Join-Path $env:USERPROFILE '.claude'
$HookScript = Join-Path $DestDir 'hooks\watcher-hook.mjs'
if ((Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path $ClaudeDir)) {
  $ClaudeSettings = Join-Path $ClaudeDir 'settings.json'
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
    console.log("Wired Claude Code hooks in " + settingsPath);
  ' $ClaudeSettings $HookScript
}

Write-Host ''
Write-Host 'Ready! Start the local VoibeCode radar bridge anytime with:'
Write-Host "  node `"$DestDir\bridge.mjs`""
Write-Host ''
Write-Host 'Then open http://127.0.0.1:4731 (or https://voibecode.com - auto-connects live).'
