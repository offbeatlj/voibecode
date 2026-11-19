import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';

const STATE_PATH = join(homedir(), '.gemini', 'voibecode-state.json');
const ALERTS_PATH = join(homedir(), '.gemini', 'voibecode-alerts.json');
const VOICE_CACHE_DIR = join(homedir(), '.gemini', 'voibecode-voice-cache');

interface StoredAlertConfig {
  awayMode: boolean;
  channel: 'ntfy' | 'slack' | 'discord' | 'webhook';
  ntfyTopic: string;
  webhookUrl: string;
  notifyOnStall: boolean;
  notifyOnComplete: boolean;
  notifyOnLoop: boolean;
  stallThresholdSec: number;
  lastAlertSentAt?: number;
  lastAlertSummary?: string;
}

const lastDispatchByKey = new Map<string, number>();

function loadAlertsConfig(): StoredAlertConfig {
  try {
    const parsed = JSON.parse(readFileSync(ALERTS_PATH, 'utf-8')) as Partial<StoredAlertConfig>;
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
    const fresh: StoredAlertConfig = {
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

function saveAlertsConfig(cfg: StoredAlertConfig): void {
  try {
    mkdirSync(dirname(ALERTS_PATH), { recursive: true });
    const tmp = `${ALERTS_PATH}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf-8');
    renameSync(tmp, ALERTS_PATH);
  } catch {
    // Ignore write failure
  }
}

async function dispatchExternalAlert(
  cfg: StoredAlertConfig,
  opts: { title: string; body: string; priority: 'default' | 'high'; tags: string; workspace: string; event: string }
): Promise<{ ok: boolean; latencyMs: number; destination: string; error?: string }> {
  const start = Date.now();
  try {
    if (cfg.channel === 'ntfy') {
      const topic = cfg.ntfyTopic.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!topic) return { ok: false, latencyMs: 0, destination: 'ntfy.sh', error: 'Missing topic' };
      const url = `https://ntfy.sh/${topic}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Title: opts.title,
          Priority: opts.priority,
          Tags: opts.tags,
        },
        body: opts.body,
      });
      if (!res.ok) {
        return { ok: false, latencyMs: Date.now() - start, destination: url, error: `HTTP ${res.status}` };
      }
      cfg.lastAlertSentAt = Date.now();
      cfg.lastAlertSummary = `${opts.title} · ntfy`;
      saveAlertsConfig(cfg);
      return { ok: true, latencyMs: Date.now() - start, destination: url };
    }

    const url = cfg.webhookUrl.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return { ok: false, latencyMs: 0, destination: cfg.channel, error: 'Enter a valid https:// webhook URL' };
    }

    let payload: Record<string, unknown>;
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
    if (!res.ok) {
      return { ok: false, latencyMs: Date.now() - start, destination: cfg.channel, error: `HTTP ${res.status}` };
    }
    cfg.lastAlertSentAt = Date.now();
    cfg.lastAlertSummary = `${opts.title} · ${cfg.channel}`;
    saveAlertsConfig(cfg);
    return { ok: true, latencyMs: Date.now() - start, destination: cfg.channel };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      destination: cfg.channel,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolveBody) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf-8')) as Record<string, unknown>);
      } catch {
        resolveBody({});
      }
    });
    req.on('error', () => resolveBody({}));
  });
}

function buildEnrichedState(raw: Record<string, unknown>, cfg: StoredAlertConfig) {
  const now = Date.now();
  const thresholdMs = (cfg.stallThresholdSec || 10) * 1000;
  const lastActivityAt = Number(raw.lastActivityAt) || now;
  const elapsedMs = Math.max(0, now - lastActivityAt);
  const rawState = typeof raw.state === 'string' ? raw.state : 'IDLE';
  let topState = rawState;
  if (rawState === 'RUNNING' && elapsedMs >= 600_000) {
    topState = 'IDLE';
  } else if (rawState === 'RUNNING' && elapsedMs >= thresholdMs) {
    topState = 'STALLED';
  }

  const rawMap =
    raw.workspacesMap && typeof raw.workspacesMap === 'object'
      ? (raw.workspacesMap as Record<string, Record<string, unknown>>)
      : {};
  const touched = Array.isArray(raw.workspacesTouched)
    ? (raw.workspacesTouched as string[])
    : [String(raw.workspaceName || 'Voibcode')];

  const merged = new Map<string, Record<string, unknown>>();
  for (const [k, v] of Object.entries(rawMap)) {
    merged.set(k, v);
  }
  for (const name of touched) {
    if (!name || merged.has(name)) continue;
    const isPrimary = name === raw.workspaceName;
    merged.set(name, {
      name,
      state: isPrimary ? rawState : 'IDLE',
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
    const wRawState = typeof w.state === 'string' ? w.state : 'IDLE';
    let wsState = wRawState;
    if (wRawState === 'RUNNING' && wsElapsed >= 600_000) {
      wsState = 'IDLE';
    } else if (wRawState === 'RUNNING' && wsElapsed >= thresholdMs) {
      wsState = 'STALLED';
    }
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
            body: `Agent hit ${consecutiveErrors} consecutive errors — check before burning more quota.`,
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

  const priorityRank: Record<string, number> = {
    STALLED: 0,
    ERROR: 1,
    RUNNING: 2,
    IDLE: 3,
  };
  workspaces.sort((a, b) => {
    const rA = a.loopWarning ? -1 : priorityRank[a.state] ?? 4;
    const rB = b.loopWarning ? -1 : priorityRank[b.state] ?? 4;
    if (rA !== rB) return rA - rB;
    return b.lastActivityAt - a.lastActivityAt;
  });

  return {
    ...raw,
    state: topState,
    elapsedMs,
    workspaces,
    now,
  };
}

function voibecodeLocalBridge(): Plugin {
  const attachMiddleware = (middlewares: {
    use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void;
  }) => {
    middlewares.use((req, res, next) => {
      const rawUrl = req.url ?? '/';

      if (rawUrl === '/objects' || rawUrl === '/objects/') {
        req.url = '/objects.html';
        next();
        return;
      }
      if (rawUrl === '/studio' || rawUrl === '/studio/') {
        req.url = '/studio.html';
        next();
        return;
      }

      if (rawUrl.startsWith('/api/alerts/test') && req.method === 'POST') {
        void readJsonBody(req).then(async (body) => {
          const current = loadAlertsConfig();
          const merged: StoredAlertConfig = {
            ...current,
            ...(typeof body.channel === 'string' ? { channel: body.channel as StoredAlertConfig['channel'] } : {}),
            ...(typeof body.ntfyTopic === 'string' && body.ntfyTopic.trim() ? { ntfyTopic: body.ntfyTopic.trim() } : {}),
            ...(typeof body.webhookUrl === 'string' ? { webhookUrl: body.webhookUrl.trim() } : {}),
          };
          saveAlertsConfig(merged);
          const result = await dispatchExternalAlert(merged, {
            title: 'VoibeCode test ping',
            body: 'Away Alerts are live. You will be pinged the moment an AI agent stalls, loops, or finishes.',
            priority: 'default',
            tags: 'white_check_mark',
            workspace: String(body.workspace || 'Voibcode'),
            event: 'test',
          });
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(result));
        });
        return;
      }

      if (rawUrl.startsWith('/api/alerts')) {
        if (req.method === 'POST') {
          void readJsonBody(req).then((body) => {
            const current = loadAlertsConfig();
            const updated: StoredAlertConfig = {
              ...current,
              ...(typeof body.awayMode === 'boolean' ? { awayMode: body.awayMode } : {}),
              ...(body.channel === 'ntfy' ||
              body.channel === 'slack' ||
              body.channel === 'discord' ||
              body.channel === 'webhook'
                ? { channel: body.channel }
                : {}),
              ...(typeof body.ntfyTopic === 'string' && body.ntfyTopic.trim().length >= 4
                ? { ntfyTopic: body.ntfyTopic.trim().slice(0, 64) }
                : {}),
              ...(typeof body.webhookUrl === 'string' ? { webhookUrl: body.webhookUrl.trim().slice(0, 512) } : {}),
              ...(typeof body.notifyOnStall === 'boolean' ? { notifyOnStall: body.notifyOnStall } : {}),
              ...(typeof body.notifyOnComplete === 'boolean' ? { notifyOnComplete: body.notifyOnComplete } : {}),
              ...(typeof body.notifyOnLoop === 'boolean' ? { notifyOnLoop: body.notifyOnLoop } : {}),
              ...(typeof body.stallThresholdSec === 'number' && body.stallThresholdSec >= 5
                ? { stallThresholdSec: Math.min(300, Math.round(body.stallThresholdSec)) }
                : {}),
            };
            saveAlertsConfig(updated);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(updated));
          });
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(loadAlertsConfig()));
        return;
      }

      if (rawUrl.startsWith('/api/state')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        const cfg = loadAlertsConfig();
        try {
          const parsed = JSON.parse(readFileSync(STATE_PATH, 'utf-8')) as Record<string, unknown>;
          res.end(JSON.stringify(buildEnrichedState(parsed, cfg)));
          return;
        } catch {
          const now = Date.now();
          res.end(
            JSON.stringify(
              buildEnrichedState(
                {
                  workspaceName: 'Voibcode',
                  workspacesTouched: ['Voibcode'],
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
                },
                cfg
              )
            )
          );
          return;
        }
      }

      if (rawUrl.startsWith('/api/voice')) {
        const u = new URL(rawUrl, 'http://127.0.0.1');
        const text = (u.searchParams.get('q') || 'Time to Voibe code.').slice(0, 180);
        const fallback = u.searchParams.get('fallback') || 'time-to-voibecode';
        const hash = createHash('sha1').update(text).digest('hex');
        const cachedPath = join(VOICE_CACHE_DIR, `${hash}.mp3`);

        if (existsSync(cachedPath)) {
          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.end(readFileSync(cachedPath));
          return;
        }

        const ttsUrl =
          'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=en-AU&q=' +
          encodeURIComponent(text);

        fetch(ttsUrl)
          .then(async (ttsRes) => {
            if (!ttsRes.ok) throw new Error('tts failed');
            const buf = Buffer.from(await ttsRes.arrayBuffer());
            if (buf.byteLength > 256) {
              mkdirSync(VOICE_CACHE_DIR, { recursive: true });
              writeFileSync(cachedPath, buf);
              res.setHeader('Content-Type', 'audio/mpeg');
              res.setHeader('Cache-Control', 'public, max-age=86400');
              res.end(buf);
              return;
            }
            throw new Error('empty');
          })
          .catch(() => {
            const staticFallback = resolve(__dirname, 'public', 'voice', `${fallback}.mp3`);
            if (existsSync(staticFallback)) {
              res.setHeader('Content-Type', 'audio/mpeg');
              res.end(readFileSync(staticFallback));
            } else {
              res.statusCode = 404;
              res.end('Not found');
            }
          });
        return;
      }

      next();
    });
  };

  return {
    name: 'voibecode-local-bridge',
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [voibecodeLocalBridge()],
  server: {
    port: 5173,
    proxy: {
      '/api/manifest.json': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/api/license': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/api/checkout': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        objects: resolve(__dirname, 'objects.html'),
        studio: resolve(__dirname, 'studio.html'),
      },
    },
  },
});
