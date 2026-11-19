import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIDECAR_DIR = join(__dirname, 'sidecars', 'voibecode');
const STATE_PATH = join(homedir(), '.gemini', 'voibecode-state.json');
const ALERTS_PATH = join(homedir(), '.gemini', 'voibecode-alerts.json');
const VOICE_CACHE_DIR = join(homedir(), '.gemini', 'voibecode-voice-cache');

const PORT = Number(process.env.VOIBECODE_PORT || 4731);
const HOST = '127.0.0.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Private-Network': 'true',
};

const lastDispatchByKey = new Map();

function loadAlertsConfig() {
  try {
    const parsed = JSON.parse(readFileSync(ALERTS_PATH, 'utf-8'));
    return {
      awayMode: Boolean(parsed.awayMode),
      channel:
        parsed.channel === 'slack' ||
        parsed.channel === 'discord' ||
        parsed.channel === 'webhook'
          ? parsed.channel
          : 'ntfy',
      ntfyTopic:
        typeof parsed.ntfyTopic === 'string' && parsed.ntfyTopic.trim().length >= 4
          ? parsed.ntfyTopic.trim().slice(0, 64)
          : `voibecode-${randomBytes(4).toString('hex')}`,
      webhookUrl: typeof parsed.webhookUrl === 'string' ? parsed.webhookUrl.trim().slice(0, 512) : '',
      notifyOnStall: parsed.notifyOnStall !== false,
      notifyOnComplete: parsed.notifyOnComplete !== false,
      notifyOnLoop: parsed.notifyOnLoop !== false,
      stallThresholdSec:
        typeof parsed.stallThresholdSec === 'number' && parsed.stallThresholdSec >= 5
          ? Math.min(300, Math.round(parsed.stallThresholdSec))
          : 10,
      lastAlertSentAt: parsed.lastAlertSentAt,
      lastAlertSummary: parsed.lastAlertSummary,
    };
  } catch {
    const fresh = {
      awayMode: false,
      channel: 'ntfy',
      ntfyTopic: `voibecode-${randomBytes(4).toString('hex')}`,
      webhookUrl: '',
      notifyOnStall: true,
      notifyOnComplete: true,
      notifyOnLoop: true,
      stallThresholdSec: 10,
    };
    saveAlertsConfig(fresh);
    return fresh;
  }
}

function saveAlertsConfig(cfg) {
  try {
    mkdirSync(dirname(ALERTS_PATH), { recursive: true });
    const tmp = `${ALERTS_PATH}.bridge.tmp`;
    writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf-8');
    renameSync(tmp, ALERTS_PATH);
  } catch {
    // Ignore write failure
  }
}

async function dispatchExternalAlert(cfg, opts) {
  const start = Date.now();
  try {
    if (cfg.channel === 'ntfy') {
      const topic = String(cfg.ntfyTopic || '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (!topic) return { ok: false, latencyMs: 0, destination: 'ntfy.sh', error: 'Missing topic' };
      const url = `https://ntfy.sh/${topic}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Title: opts.title, Priority: opts.priority, Tags: opts.tags },
        body: opts.body,
      });
      if (!res.ok) return { ok: false, latencyMs: Date.now() - start, destination: url, error: `HTTP ${res.status}` };
      cfg.lastAlertSentAt = Date.now();
      cfg.lastAlertSummary = `${opts.title} · ntfy`;
      saveAlertsConfig(cfg);
      return { ok: true, latencyMs: Date.now() - start, destination: url };
    }

    const url = String(cfg.webhookUrl || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return { ok: false, latencyMs: 0, destination: cfg.channel, error: 'Enter a valid https:// webhook URL' };
    }

    let payload;
    if (cfg.channel === 'discord' || url.includes('discord.com/api/webhooks')) {
      payload = { content: `**${opts.title}**\n${opts.body}` };
    } else if (cfg.channel === 'slack' || url.includes('hooks.slack.com')) {
      payload = { text: `*${opts.title}* — ${opts.body}` };
    } else {
      payload = {
        source: 'voibecode',
        event: opts.event,
        workspace: opts.workspace,
        title: opts.title,
        message: opts.body,
        timestamp: new Date().toISOString(),
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, latencyMs: Date.now() - start, destination: cfg.channel, error: `HTTP ${res.status}` };
    cfg.lastAlertSentAt = Date.now();
    cfg.lastAlertSummary = `${opts.title} · ${cfg.channel}`;
    saveAlertsConfig(cfg);
    return { ok: true, latencyMs: Date.now() - start, destination: cfg.channel };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, destination: cfg.channel, error: String(err?.message || err) };
  }
}

function getDefaultStats() {
  const now = Date.now();
  return {
    workspaceName: 'workspace',
    workspacesTouched: ['workspace'],
    workspaces: [],
    state: 'IDLE',
    startedAt: null,
    lastActivityAt: now,
    sessionStartedAt: now,
    totalFlowMs: 0,
    invocations: 0,
    totalToolCalls: 0,
    toolBreakdown: { command: 0, edit: 0, read: 0, subagent: 0, other: 0 },
    stallsCaught: 0,
    totalStallMs: 0,
    unblockCount: 0,
    avgUnblockMs: 0,
    errorCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastStepDurationMs: 0,
    avgStepDurationMs: 0,
    longestStepMs: 0,
    voiceCalloutsCount: 0,
    hourlyActivity: new Array(24).fill(0),
    recentEvents: [],
    hadError: false,
    updatedAt: now,
  };
}

function getLiveState() {
  const cfg = loadAlertsConfig();
  const thresholdMs = (cfg.stallThresholdSec || 10) * 1000;
  try {
    const raw = JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    const now = Date.now();
    const lastActivityAt = Number(raw.lastActivityAt) || now;
    const elapsedMs = Math.max(0, now - lastActivityAt);
    let state = raw.state || 'IDLE';

    if (state === 'RUNNING' && elapsedMs >= 600_000) {
      state = 'IDLE';
    } else if (state === 'RUNNING' && elapsedMs >= thresholdMs) {
      state = 'STALLED';
      if (!raw.stallCountedForCurrentStep) {
        raw.stallsCaught = (Number(raw.stallsCaught) || 0) + 1;
        raw.stallCountedForCurrentStep = true;
        raw.voiceCalloutsCount = (Number(raw.voiceCalloutsCount) || 0) + 1;
        const events = Array.isArray(raw.recentEvents) ? raw.recentEvents : [];
        events.unshift({
          ts: now,
          kind: 'STALL',
          label: `Stalled >${cfg.stallThresholdSec}s`,
          workspace: raw.workspaceName || 'workspace',
          durationMs: elapsedMs,
        });
        raw.recentEvents = events.slice(0, 12);
        try {
          const tmp = `${STATE_PATH}.bridge.tmp`;
          writeFileSync(tmp, JSON.stringify(raw), 'utf-8');
          renameSync(tmp, STATE_PATH);
        } catch {
          // Ignore write race
        }
      }
    }

    const rawMap = raw.workspacesMap && typeof raw.workspacesMap === 'object' ? raw.workspacesMap : {};
    const touched = Array.isArray(raw.workspacesTouched)
      ? raw.workspacesTouched
      : [raw.workspaceName || 'workspace'];
    const merged = new Map(Object.entries(rawMap));
    for (const name of touched) {
      if (!name || merged.has(name)) continue;
      const isPrimary = name === raw.workspaceName;
      merged.set(name, {
        name,
        state: isPrimary ? raw.state || 'IDLE' : 'IDLE',
        startedAt: isPrimary ? raw.startedAt ?? null : null,
        lastActivityAt: isPrimary ? lastActivityAt : Number(raw.sessionStartedAt) || now - 600_000,
        lastToolCategory: 'other',
        lastEventLabel: isPrimary ? 'Active workspace' : 'Recently active',
        toolCalls: isPrimary ? Number(raw.totalToolCalls) || 0 : 0,
        stalls: isPrimary ? Number(raw.stallsCaught) || 0 : 0,
        errors: isPrimary ? Number(raw.errorCount) || 0 : 0,
        consecutiveErrors: 0,
        flowMs: isPrimary ? Number(raw.totalFlowMs) || 0 : 0,
      });
    }

    const workspaces = Array.from(merged.values()).map((w) => {
      const wsLast = Number(w.lastActivityAt) || now;
      const wsElapsed = Math.max(0, now - wsLast);
      const wRawState = w.state || 'IDLE';
      let wsState = wRawState;
      if (wRawState === 'RUNNING' && wsElapsed >= 600_000) wsState = 'IDLE';
      else if (wRawState === 'RUNNING' && wsElapsed >= thresholdMs) wsState = 'STALLED';
      const consecutiveErrors = Number(w.consecutiveErrors) || 0;
      const loopWarning = consecutiveErrors >= 3;
      const wsName = String(w.name || 'Workspace');

      if (cfg.awayMode) {
        if (wsState === 'STALLED' && cfg.notifyOnStall) {
          const key = `stall:${wsName}:${wsLast}`;
          if (!lastDispatchByKey.has(key)) {
            lastDispatchByKey.set(key, now);
            void dispatchExternalAlert(cfg, {
              title: `${wsName} needs your input`,
              body: `Agent stalled for ${Math.round(wsElapsed / 1000)}s — waiting on permission or prompt.`,
              priority: 'high',
              tags: 'rotating_light',
              workspace: wsName,
              event: 'stall',
            });
          }
        } else if (loopWarning && cfg.notifyOnLoop) {
          const key = `loop:${wsName}:${consecutiveErrors}`;
          if (!lastDispatchByKey.has(key)) {
            lastDispatchByKey.set(key, now);
            void dispatchExternalAlert(cfg, {
              title: `Loop warning in ${wsName}`,
              body: `Agent hit ${consecutiveErrors} consecutive errors.`,
              priority: 'high',
              tags: 'warning',
              workspace: wsName,
              event: 'loop',
            });
          }
        }
      }

      return {
        name: wsName,
        state: wsState,
        startedAt: typeof w.startedAt === 'number' ? w.startedAt : null,
        lastActivityAt: wsLast,
        elapsedMs: wsElapsed,
        lastToolCategory: String(w.lastToolCategory || 'other'),
        lastEventLabel: String(w.lastEventLabel || 'Standby'),
        toolCalls: Number(w.toolCalls) || 0,
        stalls: Number(w.stalls) || 0,
        errors: Number(w.errors) || 0,
        consecutiveErrors,
        loopWarning,
        flowMs: Number(w.flowMs) || 0,
      };
    });

    const rank = { STALLED: 0, ERROR: 1, RUNNING: 2, IDLE: 3 };
    workspaces.sort((a, b) => {
      const rA = a.loopWarning ? -1 : rank[a.state] ?? 4;
      const rB = b.loopWarning ? -1 : rank[b.state] ?? 4;
      if (rA !== rB) return rA - rB;
      return b.lastActivityAt - a.lastActivityAt;
    });

    return {
      ...getDefaultStats(),
      ...raw,
      state,
      elapsedMs,
      workspaces,
      now,
    };
  } catch {
    return {
      ...getDefaultStats(),
      elapsedMs: 0,
      now: Date.now(),
    };
  }
}

function readJsonBody(req) {
  return new Promise((resolveBody) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 1_000_000) {
        req.destroy();
        resolveBody({});
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
      } catch {
        resolveBody({});
      }
    });
    req.on('error', () => resolveBody({}));
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...CORS_HEADERS,
  });
  res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  const method = req.method || 'GET';
  if (method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const { pathname } = url;

  try {
    if (method === 'GET' && pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS });
      res.end(readFileSync(join(SIDECAR_DIR, 'index.html'), 'utf-8'));
      return;
    }

    if (method === 'GET' && pathname === '/styles.css') {
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', ...CORS_HEADERS });
      res.end(readFileSync(join(SIDECAR_DIR, 'styles.css'), 'utf-8'));
      return;
    }

    if (method === 'GET' && pathname === '/app.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', ...CORS_HEADERS });
      res.end(readFileSync(join(SIDECAR_DIR, 'app.js'), 'utf-8'));
      return;
    }

    if (method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, mode: 'local-bridge', port: PORT });
    }

    if (method === 'GET' && pathname === '/api/state') {
      return sendJson(res, 200, getLiveState());
    }

    if (method === 'GET' && pathname === '/api/alerts') {
      return sendJson(res, 200, loadAlertsConfig());
    }

    if (method === 'POST' && pathname === '/api/alerts') {
      const body = await readJsonBody(req);
      const current = loadAlertsConfig();
      const updated = {
        ...current,
        ...(typeof body?.awayMode === 'boolean' ? { awayMode: body.awayMode } : {}),
        ...(body?.channel === 'ntfy' ||
        body?.channel === 'slack' ||
        body?.channel === 'discord' ||
        body?.channel === 'webhook'
          ? { channel: body.channel }
          : {}),
        ...(typeof body?.ntfyTopic === 'string' && body.ntfyTopic.trim().length >= 4
          ? { ntfyTopic: body.ntfyTopic.trim().slice(0, 64) }
          : {}),
        ...(typeof body?.webhookUrl === 'string' ? { webhookUrl: body.webhookUrl.trim().slice(0, 512) } : {}),
        ...(typeof body?.notifyOnStall === 'boolean' ? { notifyOnStall: body.notifyOnStall } : {}),
        ...(typeof body?.notifyOnComplete === 'boolean' ? { notifyOnComplete: body.notifyOnComplete } : {}),
        ...(typeof body?.notifyOnLoop === 'boolean' ? { notifyOnLoop: body.notifyOnLoop } : {}),
        ...(typeof body?.stallThresholdSec === 'number' && body.stallThresholdSec >= 5
          ? { stallThresholdSec: Math.min(300, Math.round(body.stallThresholdSec)) }
          : {}),
      };
      saveAlertsConfig(updated);
      return sendJson(res, 200, updated);
    }

    if (method === 'POST' && pathname === '/api/alerts/test') {
      const body = await readJsonBody(req);
      const current = loadAlertsConfig();
      const merged = {
        ...current,
        ...(typeof body?.channel === 'string' ? { channel: body.channel } : {}),
        ...(typeof body?.ntfyTopic === 'string' && body.ntfyTopic.trim() ? { ntfyTopic: body.ntfyTopic.trim() } : {}),
        ...(typeof body?.webhookUrl === 'string' ? { webhookUrl: body.webhookUrl.trim() } : {}),
      };
      saveAlertsConfig(merged);
      const result = await dispatchExternalAlert(merged, {
        title: 'VoibeCode test ping',
        body: 'Away Alerts are live. You will be pinged when an AI agent stalls, loops, or finishes.',
        priority: 'default',
        tags: 'white_check_mark',
        workspace: String(body?.workspace || 'workspace'),
        event: 'test',
      });
      return sendJson(res, result.ok ? 200 : 502, result);
    }

    if (method === 'GET' && pathname === '/api/voice') {
      const text = (url.searchParams.get('q') || 'Time to Voibe code.').slice(0, 180);
      const hash = createHash('sha1').update(text).digest('hex');
      const cachedFile = join(VOICE_CACHE_DIR, `${hash}.mp3`);
      if (existsSync(cachedFile)) {
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400',
          ...CORS_HEADERS,
        });
        res.end(readFileSync(cachedFile));
        return;
      }
      try {
        mkdirSync(VOICE_CACHE_DIR, { recursive: true });
        const ttsUrl =
          'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=en-AU&q=' +
          encodeURIComponent(text);
        const ttsRes = await fetch(ttsUrl);
        if (ttsRes.ok) {
          const buf = Buffer.from(await ttsRes.arrayBuffer());
          if (buf.byteLength > 256) {
            writeFileSync(cachedFile, buf);
            res.writeHead(200, {
              'Content-Type': 'audio/mpeg',
              'Cache-Control': 'public, max-age=86400',
              ...CORS_HEADERS,
            });
            res.end(buf);
            return;
          }
        }
      } catch {
        // Fallback below
      }
      res.writeHead(404, CORS_HEADERS);
      res.end('tts unavailable');
      return;
    }

    sendJson(res, 404, { error: 'Not Found' });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : 'Internal error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`VoibeCode Local Bridge listening at http://${HOST}:${PORT}`);
});
