import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const DIST_DIR = resolve(process.env.VOIBECODE_DIST_DIR || join(__dirname, '..', 'web', 'dist'));
const DATA_DIR = resolve(process.env.VOIBECODE_DATA_DIR || join(__dirname, '.data'));
const VOICE_CACHE_DIR = join(DATA_DIR, 'voice-cache');
const LICENSE_DB_PATH = join(DATA_DIR, 'licenses.json');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.vsix': 'application/vsix',
  '.zip': 'application/zip',
  '.sh': 'text/plain; charset=utf-8',
  '.ps1': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const PLANS = {
  pro_lifetime: {
    amount: 3900,
    name: 'VoibeCode Pro — Early Founder Lifetime',
    description:
      'Unlimited Phone/Slack/Discord Away Alerts, runaway loop guardrails, all 4 focus soundscapes, and lifetime updates.',
    mode: 'payment',
  },
  pro_monthly: {
    amount: 900,
    name: 'VoibeCode Pro — Monthly',
    description:
      'Unlimited Phone/Slack/Discord Away Alerts, runaway loop guardrails, and all 4 focus soundscapes.',
    mode: 'subscription',
  },
  team: {
    amount: 1900,
    name: 'VoibeCode Team — Per Seat',
    description:
      'Org-wide AI velocity & stall analytics, automated Slack daily ship digests, zero source code.',
    mode: 'subscription',
  },
};

function sanitizeHttpsUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function loadLicenseDb() {
  try {
    return JSON.parse(readFileSync(LICENSE_DB_PATH, 'utf8'));
  } catch {
    return { licenses: {}, sessions: {} };
  }
}

function saveLicenseDb(db) {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${LICENSE_DB_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  renameSync(tmp, LICENSE_DB_PATH);
}

function generateLicenseKey(tier) {
  const bytes = randomBytes(8);
  const p1 = Array.from(bytes.subarray(0, 4))
    .map((b) => KEY_ALPHABET[b % KEY_ALPHABET.length])
    .join('');
  const p2 = Array.from(bytes.subarray(4, 8))
    .map((b) => KEY_ALPHABET[b % KEY_ALPHABET.length])
    .join('');
  if (tier === 'team') return `VC-TEAM-${p1}-${p2}`;
  return `VC-PRO-${p1}-${p2}`;
}

function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = sigHeader.split(',').map((p) => p.trim());
  let timestamp = '';
  const sigs = [];
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx);
    const v = part.slice(idx + 1);
    if (k === 't') timestamp = v;
    if (k === 'v1' && v) sigs.push(v);
  }
  if (!timestamp || sigs.length === 0) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  return sigs.some((s) => {
    const buf = Buffer.from(s, 'utf8');
    return buf.length === expectedBuf.length && timingSafeEqual(buf, expectedBuf);
  });
}

function readRawBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        req.destroy();
        rejectBody(new Error('Body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rejectBody);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

const DEFAULT_PAYMENT_LINKS = {
  pro_lifetime: 'https://buy.stripe.com/eVq00jcua9Gd11g46w4Ja00',
  pro_monthly: 'https://buy.stripe.com/00w6oH51I2dLfWa9qQ4Ja01',
  team: 'https://buy.stripe.com/8x2aEX65M9GdeS6cD24Ja02',
};

function getPaymentLink(tier) {
  if (tier === 'pro_lifetime') {
    return sanitizeHttpsUrl(process.env.STRIPE_LINK_PRO_LIFETIME) || DEFAULT_PAYMENT_LINKS.pro_lifetime;
  }
  if (tier === 'pro_monthly') {
    return (
      sanitizeHttpsUrl(process.env.STRIPE_LINK_PRO_MONTHLY) ||
      DEFAULT_PAYMENT_LINKS.pro_monthly
    );
  }
  if (tier === 'team') {
    return sanitizeHttpsUrl(process.env.STRIPE_LINK_TEAM) || DEFAULT_PAYMENT_LINKS.team;
  }
  return null;
}

function serveStaticFile(res, pathname) {
  let cleanPath = pathname;
  if (cleanPath === '/' || cleanPath === '') cleanPath = '/index.html';
  else if (cleanPath === '/studio' || cleanPath === '/studio/') cleanPath = '/studio.html';
  else if (cleanPath === '/objects' || cleanPath === '/objects/') cleanPath = '/objects.html';

  const normalized = normalize(cleanPath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = resolve(DIST_DIR, normalized.replace(/^[/\\]+/, ''));

  if (!fullPath.startsWith(DIST_DIR) || !existsSync(fullPath) || !statSync(fullPath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const ext = extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const isImmutable = cleanPath.startsWith('/assets/');
  const headers = {
    'Content-Type': contentType,
    'Cache-Control': isImmutable
      ? 'public, max-age=31536000, immutable'
      : ext === '.html'
        ? 'public, max-age=60'
        : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  };
  if (ext === '.vsix' || ext === '.zip') {
    headers['Content-Disposition'] = `attachment; filename="${cleanPath.split('/').pop()}"`;
  }
  res.writeHead(200, headers);
  res.end(readFileSync(fullPath));
}

const server = createServer(async (req, res) => {
  const method = req.method || 'GET';
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;

  try {
    if (method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, service: 'voibecode-server' });
    }

    if (method === 'GET' && pathname === '/api/config') {
      const hasStripeApi = Boolean(process.env.STRIPE_SECRET_KEY);
      const links = {
        pro_lifetime: Boolean(getPaymentLink('pro_lifetime')),
        pro_monthly: Boolean(getPaymentLink('pro_monthly')),
        team: Boolean(getPaymentLink('team')),
      };
      return sendJson(res, 200, {
        stripeConfigured: hasStripeApi || links.pro_lifetime || links.pro_monthly || links.team,
        mode: hasStripeApi
          ? 'checkout_api'
          : links.pro_lifetime || links.team
            ? 'payment_links'
            : 'unconfigured',
        links,
      });
    }

    if (method === 'POST' && pathname === '/api/checkout') {
      const raw = await readRawBody(req);
      let body = {};
      try {
        body = JSON.parse(raw);
      } catch {
        return sendJson(res, 400, { error: 'Malformed JSON body' });
      }
      const tier =
        body.tier === 'pro_monthly' || body.tier === 'team' ? body.tier : 'pro_lifetime';

      if (!process.env.STRIPE_SECRET_KEY) {
        const link = getPaymentLink(tier);
        if (link) return sendJson(res, 200, { url: link, mode: 'payment_link' });
        return sendJson(res, 501, {
          configured: false,
          error:
            'Configure STRIPE_SECRET_KEY (or STRIPE_LINK_PRO_LIFETIME / STRIPE_LINK_TEAM) on the server to enable live checkout.',
        });
      }

      const plan = PLANS[tier];
      const origin =
        sanitizeHttpsUrl(body.origin) ||
        process.env.PUBLIC_ORIGIN ||
        `https://${req.headers.host || 'voibecode.com'}`;

      const params = new URLSearchParams();
      params.set('mode', plan.mode);
      params.set(
        'success_url',
        `${origin.replace(/\/$/, '')}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`
      );
      params.set('cancel_url', `${origin.replace(/\/$/, '')}/?cancelled=1`);
      params.set('client_reference_id', tier);
      params.set('line_items[0][price_data][currency]', 'usd');
      params.set('line_items[0][price_data][unit_amount]', String(plan.amount));
      params.set('line_items[0][price_data][product_data][name]', plan.name);
      params.set('line_items[0][price_data][product_data][description]', plan.description);
      if (plan.mode === 'subscription') {
        params.set('line_items[0][price_data][recurring][interval]', 'month');
      }
      params.set('line_items[0][quantity]', '1');
      params.set('metadata[tier]', tier);

      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const data = await stripeRes.json();
      if (!stripeRes.ok || !data.url) {
        return sendJson(res, 502, {
          error: data.error?.message || 'Failed to create Stripe checkout session',
        });
      }
      return sendJson(res, 200, { url: data.url, mode: 'checkout_api' });
    }

    if (method === 'POST' && pathname === '/api/webhook/stripe') {
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!secret) return sendJson(res, 500, { error: 'STRIPE_WEBHOOK_SECRET not configured' });
      const rawBody = await readRawBody(req);
      const sig = req.headers['stripe-signature'];
      if (!verifyStripeSignature(rawBody, typeof sig === 'string' ? sig : '', secret)) {
        return sendJson(res, 401, { error: 'Invalid Stripe signature' });
      }
      const event = JSON.parse(rawBody);
      if (event.type !== 'checkout.session.completed' || !event.data?.object) {
        return sendJson(res, 200, { received: true });
      }
      const session = event.data.object;
      const sessionId = session.id || event.id;
      const db = loadLicenseDb();
      if (db.sessions[sessionId]) {
        return sendJson(res, 200, { received: true, idempotent: true, ...db.sessions[sessionId] });
      }
      const tier = session.metadata?.tier || 'pro_lifetime';
      const key = generateLicenseKey(tier);
      const record = {
        valid: true,
        key,
        tier,
        unlocked_all: true,
        created_at: new Date().toISOString(),
      };
      db.licenses[key] = record;
      db.sessions[sessionId] = { key, tier };
      saveLicenseDb(db);
      return sendJson(res, 200, { received: true, key, tier });
    }

    if (method === 'GET' && pathname === '/api/checkout/status') {
      const sessionId = url.searchParams.get('session_id')?.trim();
      if (!sessionId) return sendJson(res, 400, { error: 'Missing session_id' });
      const db = loadLicenseDb();
      const summary = db.sessions[sessionId];
      if (!summary) return sendJson(res, 404, { pending: true });
      return sendJson(res, 200, summary);
    }

    if (method === 'GET' && pathname.startsWith('/api/license/')) {
      const key = decodeURIComponent(pathname.slice('/api/license/'.length)).trim().toUpperCase();
      if (!/^VC-(?:(?:PRO|TEAM)-)?[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
        return sendJson(res, 400, { valid: false, error: 'Malformed license key' });
      }
      const db = loadLicenseDb();
      const rec = db.licenses[key];
      if (!rec) return sendJson(res, 404, { valid: false, error: 'License key not found' });
      return sendJson(res, 200, rec);
    }

    if (method === 'POST' && pathname === '/api/alerts/test') {
      const raw = await readRawBody(req);
      let body = {};
      try {
        body = JSON.parse(raw);
      } catch {
        return sendJson(res, 400, { ok: false, error: 'Invalid JSON' });
      }
      const channel = body.channel || 'ntfy';
      const ws = String(body.workspace || 'Voibcode').slice(0, 32);
      const start = Date.now();

      if (channel === 'ntfy') {
        const topic = String(body.ntfyTopic || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
        if (topic.length < 4) return sendJson(res, 400, { ok: false, error: 'Topic too short' });
        const pushRes = await fetch(`https://ntfy.sh/${topic}`, {
          method: 'POST',
          headers: { Title: 'VoibeCode test ping', Priority: 'default', Tags: 'white_check_mark' },
          body: `Away Alerts are live for ${ws}. You will be pinged the second an AI agent stalls, loops, or finishes.`,
        });
        if (!pushRes.ok) {
          return sendJson(res, 502, { ok: false, latencyMs: Date.now() - start, error: `ntfy HTTP ${pushRes.status}` });
        }
        return sendJson(res, 200, { ok: true, latencyMs: Date.now() - start, destination: `ntfy.sh/${topic}` });
      }

      const webhookUrl = sanitizeHttpsUrl(body.webhookUrl);
      if (!webhookUrl) return sendJson(res, 400, { ok: false, error: 'Enter a valid https:// webhook URL' });
      const host = new URL(webhookUrl).hostname.toLowerCase();
      const isSlack = host === 'hooks.slack.com';
      const isDiscord = host === 'discord.com' || host === 'discordapp.com';
      if (!isSlack && !isDiscord) {
        return sendJson(res, 400, {
          ok: false,
          error: 'Hosted demo allows ntfy.sh, hooks.slack.com, or discord.com webhooks.',
        });
      }
      const payload = isDiscord
        ? { content: `**VoibeCode test ping**\nAway Alerts are live for ${ws}.` }
        : { text: `*VoibeCode test ping* — Away Alerts are live for ${ws}.` };
      const pushRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!pushRes.ok) {
        return sendJson(res, 502, { ok: false, latencyMs: Date.now() - start, error: `HTTP ${pushRes.status}` });
      }
      return sendJson(res, 200, { ok: true, latencyMs: Date.now() - start, destination: host });
    }

    if (method === 'GET' && pathname === '/api/voice') {
      const text = (url.searchParams.get('q') || 'Time to Voibe code.').slice(0, 180);
      const fallback = (url.searchParams.get('fallback') || 'time-to-voibecode').replace(/[^a-z0-9-]/gi, '');
      const hash = createHash('sha1').update(text).digest('hex');
      const cached = join(VOICE_CACHE_DIR, `${hash}.mp3`);
      if (existsSync(cached)) {
        res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' });
        res.end(readFileSync(cached));
        return;
      }
      try {
        const ttsUrl =
          'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=en-AU&q=' +
          encodeURIComponent(text);
        const ttsRes = await fetch(ttsUrl);
        if (ttsRes.ok) {
          const buf = Buffer.from(await ttsRes.arrayBuffer());
          if (buf.byteLength > 256) {
            mkdirSync(VOICE_CACHE_DIR, { recursive: true });
            writeFileSync(cached, buf);
            res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' });
            res.end(buf);
            return;
          }
        }
      } catch {
        // Fall through to bundled static mp3
      }
      const staticMp3 = join(DIST_DIR, 'voice', `${fallback}.mp3`);
      if (existsSync(staticMp3)) {
        res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' });
        res.end(readFileSync(staticMp3));
        return;
      }
      res.writeHead(404);
      res.end('Voice unavailable');
      return;
    }

    if (pathname.startsWith('/api/')) {
      return sendJson(res, 404, { error: 'Not Found' });
    }

    serveStaticFile(res, pathname);
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : 'Internal server error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`VoibeCode server listening on http://${HOST}:${PORT} (dist: ${DIST_DIR})`);
});
