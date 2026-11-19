import {
  DEFAULT_SYSTEMS_MAXIMS,
  DEFAULT_TECH_LEGENDS,
  FLAGSHIP_HEX,
  LicenseRecord,
  PurchaseTier,
  SwatchEntry,
  VOIBE_PLANS,
  VoibeManifest,
  buildSeedMakerSwatches,
  findNearestMatrixCell,
  findNearestUnclaimedCell,
  generate256Matrix,
  isValidHex,
  normalizeHex,
} from '@voibecode/shared';

export interface Env {
  VOIBECODE_KV: KVNamespace;
  STRIPE_WEBHOOK_SECRET?: string;
  ADMIN_BEARER_TOKEN?: string;
  FOURTHWALL_PROMO_CODE?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_LINK_PRO_LIFETIME?: string;
  STRIPE_LINK_PRO_MONTHLY?: string;
  STRIPE_LINK_TEAM?: string;
  ENVIRONMENT?: string;
}

interface StoredLiveManifest {
  version: string;
  updatedAt: string;
  swatches: SwatchEntry[];
}

interface PendingPatronSubmission {
  hex: string;
  brand: string;
  tagline: string;
  url: string;
  license_key: string;
  session_id: string;
  submitted_at: string;
}

const MANIFEST_KV_KEY = 'manifest:live';
const DEFAULT_FOURTHWALL_PROMO = 'VOIBE10OFF';
const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Stripe-Signature',
};

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyStripeSignature(
  payload: string,
  sigHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!sigHeader || !secret) return false;

  const parts = sigHeader.split(',').map((p) => p.trim());
  let timestamp = '';
  const signatures: string[] = [];

  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx);
    const val = part.slice(eqIdx + 1);
    if (key === 't') timestamp = val;
    if (key === 'v1' && val) signatures.push(val);
  }

  if (!timestamp || signatures.length === 0) return false;

  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return false;
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - tsNum);
  if (ageSeconds > 300) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signedPayload = `${timestamp}.${payload}`;
  const macBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signedPayload)
  );
  const expectedHex = bytesToHex(new Uint8Array(macBuffer));

  return signatures.some((sig) => timingSafeEqualString(expectedHex, sig));
}

function generateLicenseKey(tier: PurchaseTier = 'full'): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const part1 = Array.from(bytes.slice(0, 4))
    .map((b) => KEY_ALPHABET[b % KEY_ALPHABET.length])
    .join('');
  const part2 = Array.from(bytes.slice(4, 8))
    .map((b) => KEY_ALPHABET[b % KEY_ALPHABET.length])
    .join('');
  if (tier === 'pro_lifetime' || tier === 'pro_monthly') {
    return `VC-PRO-${part1}-${part2}`;
  }
  if (tier === 'team') {
    return `VC-TEAM-${part1}-${part2}`;
  }
  return `VC-${part1}-${part2}`;
}

function sanitizeHttpsUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function sanitizeTier(
  rawTier: string | undefined,
  amountTotal?: number
): PurchaseTier {
  const norm = (rawTier ?? '').trim().toLowerCase();
  if (norm === 'pro_lifetime' || norm === 'pro-lifetime' || norm === 'lifetime' || norm === '39' || norm === '3900') {
    return 'pro_lifetime';
  }
  if (norm === 'pro_monthly' || norm === 'pro-monthly' || norm === 'monthly') {
    return 'pro_monthly';
  }
  if (norm === 'team' || norm === '19' || norm === '1900') {
    return 'team';
  }
  if (norm === 'patron' || norm === '29' || norm === '2900') return 'patron';
  if (norm === 'full' || norm === 'dropper' || norm === '9' || norm === '900') return 'full';
  if (norm === 'personal' || norm === 'single' || norm === '299') return 'personal';
  if (typeof amountTotal === 'number') {
    if (amountTotal >= 3900) return 'pro_lifetime';
    if (amountTotal >= 2900) return 'patron';
    if (amountTotal >= 1900) return 'team';
    if (amountTotal >= 900) return 'full';
  }
  return 'personal';
}

function getPaymentLinkForTier(tier: PurchaseTier, env: Env): string | null {
  if (tier === 'pro_lifetime' || tier === 'full') {
    return sanitizeHttpsUrl(env.STRIPE_LINK_PRO_LIFETIME);
  }
  if (tier === 'pro_monthly') {
    return sanitizeHttpsUrl(env.STRIPE_LINK_PRO_MONTHLY) ?? sanitizeHttpsUrl(env.STRIPE_LINK_PRO_LIFETIME);
  }
  if (tier === 'team' || tier === 'patron') {
    return sanitizeHttpsUrl(env.STRIPE_LINK_TEAM);
  }
  return null;
}

async function getOrSeedLiveManifest(
  kv: KVNamespace
): Promise<StoredLiveManifest> {
  const existing = await kv.get<StoredLiveManifest>(MANIFEST_KV_KEY, 'json');
  if (existing && Array.isArray(existing.swatches)) {
    return existing;
  }

  const seeded: StoredLiveManifest = {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    swatches: buildSeedMakerSwatches(),
  };
  await kv.put(MANIFEST_KV_KEY, JSON.stringify(seeded));
  return seeded;
}

async function handleGetManifest(env: Env): Promise<Response> {
  const live = await getOrSeedLiveManifest(env.VOIBECODE_KV);
  const payload: VoibeManifest = {
    version: live.version,
    updatedAt: live.updatedAt,
    flagshipHex: FLAGSHIP_HEX,
    swatches: live.swatches,
    quotes: {
      systems: DEFAULT_SYSTEMS_MAXIMS,
      legends: DEFAULT_TECH_LEGENDS,
    },
  };

  return jsonResponse(payload, 200, {
    'Cache-Control': 'public, max-age=60',
  });
}

function handleGetConfig(env: Env): Response {
  const hasStripeApi = Boolean(env.STRIPE_SECRET_KEY);
  const links = {
    pro_lifetime: Boolean(sanitizeHttpsUrl(env.STRIPE_LINK_PRO_LIFETIME)),
    pro_monthly: Boolean(sanitizeHttpsUrl(env.STRIPE_LINK_PRO_MONTHLY)),
    team: Boolean(sanitizeHttpsUrl(env.STRIPE_LINK_TEAM)),
  };
  return jsonResponse({
    stripeConfigured: hasStripeApi || links.pro_lifetime || links.pro_monthly || links.team,
    mode: hasStripeApi ? 'checkout_api' : links.pro_lifetime || links.team ? 'payment_links' : 'unconfigured',
    links,
    plans: VOIBE_PLANS,
  });
}

async function handleStripeWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return jsonResponse(
      { error: 'STRIPE_WEBHOOK_SECRET is not configured' },
      500
    );
  }

  const rawBody = await request.text();
  const sigHeader = request.headers.get('Stripe-Signature');
  const verified = await verifyStripeSignature(
    rawBody,
    sigHeader,
    env.STRIPE_WEBHOOK_SECRET
  );

  if (!verified) {
    return jsonResponse({ error: 'Invalid Stripe signature' }, 401);
  }

  let event: {
    id?: string;
    type?: string;
    data?: {
      object?: {
        id?: string;
        amount_total?: number;
        client_reference_id?: string;
        metadata?: Record<string, string | undefined>;
      };
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'Malformed JSON body' }, 400);
  }

  if (event.type !== 'checkout.session.completed' || !event.data?.object) {
    return jsonResponse({ received: true, ignored: event.type ?? 'unknown' });
  }

  const session = event.data.object;
  const sessionId = session.id ?? event.id ?? crypto.randomUUID();

  const existingSession = await env.VOIBECODE_KV.get<{
    key: string;
    tier: PurchaseTier;
    swatch_hex?: string;
    fourthwall_promo?: string;
  }>(`session:${sessionId}`, 'json');

  if (existingSession) {
    return jsonResponse({
      received: true,
      idempotent: true,
      ...existingSession,
    });
  }

  const metadata = session.metadata ?? {};
  const tier = sanitizeTier(metadata.tier, session.amount_total);
  const rawHex = metadata.swatch_hex ?? session.client_reference_id ?? '';
  const swatchHex = isValidHex(rawHex) ? normalizeHex(rawHex) : undefined;

  const key = generateLicenseKey(tier);
  const isAllUnlocked =
    tier === 'full' ||
    tier === 'pro_lifetime' ||
    tier === 'pro_monthly' ||
    tier === 'team';
  const fourthwallPromo =
    isAllUnlocked || tier === 'patron'
      ? env.FOURTHWALL_PROMO_CODE || DEFAULT_FOURTHWALL_PROMO
      : undefined;

  const licenseRecord: LicenseRecord = {
    valid: true,
    key,
    tier,
    swatch_hex: swatchHex,
    unlocked_all: isAllUnlocked,
    fourthwall_promo: fourthwallPromo,
    created_at: new Date().toISOString(),
  };

  await env.VOIBECODE_KV.put(`license:${key}`, JSON.stringify(licenseRecord));

  const sessionSummary = {
    key,
    tier,
    swatch_hex: swatchHex,
    fourthwall_promo: fourthwallPromo,
  };
  await env.VOIBECODE_KV.put(
    `session:${sessionId}`,
    JSON.stringify(sessionSummary),
    { expirationTtl: 60 * 60 * 24 * 30 }
  );

  if (tier === 'patron' && swatchHex) {
    const brand = (metadata.brand ?? 'PATRON').trim().slice(0, 32) || 'PATRON';
    const tagline = (metadata.tagline ?? 'VoibeCode Swatch Patron')
      .trim()
      .slice(0, 60);
    const url = sanitizeHttpsUrl(metadata.url) ?? 'https://voibecode.com';

    const pendingRecord: PendingPatronSubmission = {
      hex: swatchHex,
      brand,
      tagline,
      url,
      license_key: key,
      session_id: sessionId,
      submitted_at: new Date().toISOString(),
    };

    await env.VOIBECODE_KV.put(
      `pending:${swatchHex}`,
      JSON.stringify(pendingRecord)
    );
  }

  return jsonResponse({
    received: true,
    ...sessionSummary,
    pending_moderation: tier === 'patron' && Boolean(swatchHex),
  });
}

async function handleAdminApprove(
  request: Request,
  env: Env
): Promise<Response> {
  if (!env.ADMIN_BEARER_TOKEN) {
    return jsonResponse(
      { error: 'ADMIN_BEARER_TOKEN is not configured' },
      500
    );
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';
  if (!token || !timingSafeEqualString(token, env.ADMIN_BEARER_TOKEN)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let body: {
    swatch_hex?: string;
    brand?: string;
    tagline?: string;
    url?: string;
  };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Malformed JSON body' }, 400);
  }

  if (!body.swatch_hex || !isValidHex(body.swatch_hex)) {
    return jsonResponse({ error: 'Valid swatch_hex is required' }, 400);
  }

  const targetHex = normalizeHex(body.swatch_hex);
  if (targetHex === FLAGSHIP_HEX) {
    return jsonResponse(
      { error: 'Flagship swatch cannot be claimed exclusively' },
      400
    );
  }

  const pending = await env.VOIBECODE_KV.get<PendingPatronSubmission>(
    `pending:${targetHex}`,
    'json'
  );

  const brand = (body.brand ?? pending?.brand ?? '').trim().slice(0, 32);
  const tagline = (body.tagline ?? pending?.tagline ?? '').trim().slice(0, 60);
  const url = sanitizeHttpsUrl(body.url ?? pending?.url);

  if (!brand || !tagline || !url) {
    return jsonResponse(
      {
        error:
          'Approved swatch requires non-empty brand, <=60 char tagline, and valid https:// url',
      },
      400
    );
  }

  const matrix = generate256Matrix();
  const exactCell = matrix.find((c) => normalizeHex(c.hex) === targetHex);
  const targetCell = exactCell ?? findNearestMatrixCell(targetHex, matrix);

  const live = await getOrSeedLiveManifest(env.VOIBECODE_KV);

  const exclusiveCollision = live.swatches.find(
    (s) =>
      !s.reclaimable &&
      (normalizeHex(s.hex) === targetHex ||
        (s.row === targetCell.row && s.col === targetCell.col))
  );

  if (exclusiveCollision) {
    return jsonResponse(
      {
        error: `Swatch ${targetHex} is already exclusively claimed by ${exclusiveCollision.brand}`,
      },
      409
    );
  }

  const displacedMakers: SwatchEntry[] = [];
  const retainedSwatches: SwatchEntry[] = [];

  for (const entry of live.swatches) {
    const sameHex = normalizeHex(entry.hex) === targetHex;
    const sameCoord =
      entry.row === targetCell.row && entry.col === targetCell.col;
    if (entry.reclaimable && (sameHex || sameCoord)) {
      displacedMakers.push(entry);
    } else {
      retainedSwatches.push(entry);
    }
  }

  const newPatron: SwatchEntry = {
    hex: targetHex,
    row: targetCell.row,
    col: targetCell.col,
    tier: 'patron',
    reclaimable: false,
    brand,
    tagline,
    url,
    claimedAt: new Date().toISOString(),
  };

  retainedSwatches.push(newPatron);

  const relocatedMakers: SwatchEntry[] = [];
  for (const displaced of displacedMakers) {
    const nextCell = findNearestUnclaimedCell(
      displaced.row,
      displaced.col,
      retainedSwatches,
      matrix
    );
    if (nextCell) {
      const relocated: SwatchEntry = {
        ...displaced,
        hex: nextCell.hex,
        row: nextCell.row,
        col: nextCell.col,
      };
      retainedSwatches.push(relocated);
      relocatedMakers.push(relocated);
    }
  }

  const updated: StoredLiveManifest = {
    version: live.version,
    updatedAt: new Date().toISOString(),
    swatches: retainedSwatches,
  };

  await env.VOIBECODE_KV.put(MANIFEST_KV_KEY, JSON.stringify(updated));
  await env.VOIBECODE_KV.delete(`pending:${targetHex}`);

  return jsonResponse({
    approved: newPatron,
    relocated: relocatedMakers,
    updatedAt: updated.updatedAt,
  });
}

async function handleGetLicense(
  keyParam: string,
  env: Env
): Promise<Response> {
  const cleanKey = decodeURIComponent(keyParam).trim().toUpperCase();
  if (!/^VC-(?:(?:PRO|TEAM)-)?[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleanKey)) {
    return jsonResponse({ valid: false, error: 'Malformed license key' }, 400);
  }

  const record = await env.VOIBECODE_KV.get<LicenseRecord>(
    `license:${cleanKey}`,
    'json'
  );

  if (!record) {
    return jsonResponse({ valid: false, error: 'License key not found' }, 404);
  }

  return jsonResponse({ ...record, valid: true }, 200);
}

async function handleCheckoutStatus(
  url: URL,
  env: Env
): Promise<Response> {
  const sessionId = url.searchParams.get('session_id')?.trim();
  if (!sessionId) {
    return jsonResponse({ error: 'Missing session_id' }, 400);
  }

  const summary = await env.VOIBECODE_KV.get(
    `session:${sessionId}`,
    'json'
  );
  if (!summary) {
    return jsonResponse({ pending: true }, 404);
  }

  return jsonResponse(summary, 200);
}

async function handleCreateCheckout(
  request: Request,
  env: Env
): Promise<Response> {
  let body: {
    tier?: PurchaseTier;
    swatch_hex?: string;
    brand?: string;
    tagline?: string;
    url?: string;
    origin?: string;
  };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Malformed JSON body' }, 400);
  }

  const tier = sanitizeTier(body.tier);

  // Path 1: Dynamic Stripe Checkout API (preferred — auto-generates VC- keys via webhook)
  if (!env.STRIPE_SECRET_KEY) {
    // Path 2: Zero-backend Stripe Payment Links fallback
    const paymentLink = getPaymentLinkForTier(tier, env);
    if (paymentLink) {
      return jsonResponse({ url: paymentLink, mode: 'payment_link' });
    }
    return jsonResponse(
      {
        configured: false,
        error:
          'Configure STRIPE_SECRET_KEY (or STRIPE_LINK_PRO_LIFETIME / STRIPE_LINK_TEAM) to activate live checkout.',
      },
      501
    );
  }

  const hex =
    body.swatch_hex && isValidHex(body.swatch_hex)
      ? normalizeHex(body.swatch_hex)
      : FLAGSHIP_HEX;
  const origin = sanitizeHttpsUrl(body.origin) ?? 'https://voibecode.com';

  const planMap: Record<
    PurchaseTier,
    { amount: number; name: string; description: string; mode: 'payment' | 'subscription' }
  > = {
    pro_lifetime: {
      amount: 3900,
      name: 'VoibeCode Pro — Early Founder Lifetime',
      description: 'Unlimited Phone/Slack/Discord Away Alerts, loop guardrails, all 4 focus soundscapes.',
      mode: 'payment',
    },
    pro_monthly: {
      amount: 900,
      name: 'VoibeCode Pro — Monthly',
      description: 'Unlimited Phone/Slack/Discord Away Alerts, loop guardrails, all 4 focus soundscapes.',
      mode: 'subscription',
    },
    team: {
      amount: 1900,
      name: 'VoibeCode Team — Per Seat',
      description: 'Org-wide AI velocity & stall analytics, automated Slack ship digests, zero source code.',
      mode: 'subscription',
    },
    patron: {
      amount: 2900,
      name: `VoibeCode Swatch Patron (${hex})`,
      description: 'Exclusive 1-to-1 swatch sponsorship + personal unlock.',
      mode: 'payment',
    },
    full: {
      amount: 900,
      name: 'VoibeCode Full Dropper Pass',
      description: 'All 256 OKLCH skies + $10 OFF merch.',
      mode: 'payment',
    },
    personal: {
      amount: 299,
      name: `VoibeCode Personal Swatch Unlock (${hex})`,
      description: 'Personal sky unlock via VC- license key.',
      mode: 'payment',
    },
  };

  const chosen = planMap[tier];
  const params = new URLSearchParams();
  params.set('mode', chosen.mode);
  params.set(
    'success_url',
    `${origin.replace(/\/$/, '')}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`
  );
  params.set('cancel_url', `${origin.replace(/\/$/, '')}/?cancelled=1`);
  params.set('client_reference_id', tier === 'personal' || tier === 'patron' ? hex : tier);
  params.set('line_items[0][price_data][currency]', 'usd');
  params.set('line_items[0][price_data][unit_amount]', String(chosen.amount));
  params.set('line_items[0][price_data][product_data][name]', chosen.name);
  params.set('line_items[0][price_data][product_data][description]', chosen.description);
  if (chosen.mode === 'subscription') {
    params.set('line_items[0][price_data][recurring][interval]', 'month');
  }
  params.set('line_items[0][quantity]', '1');
  params.set('metadata[tier]', tier);
  params.set('metadata[swatch_hex]', hex);

  if (tier === 'patron') {
    if (body.brand) params.set('metadata[brand]', body.brand.trim().slice(0, 32));
    if (body.tagline) params.set('metadata[tagline]', body.tagline.trim().slice(0, 60));
    const patronUrl = sanitizeHttpsUrl(body.url);
    if (patronUrl) params.set('metadata[url]', patronUrl);
  }

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = (await stripeRes.json()) as {
    url?: string;
    error?: { message?: string };
  };
  if (!stripeRes.ok || !data.url) {
    return jsonResponse(
      { error: data.error?.message ?? 'Failed to initialize Stripe session' },
      502
    );
  }

  return jsonResponse({ url: data.url, mode: 'checkout_api' });
}

async function handlePublicTestAlert(request: Request): Promise<Response> {
  let body: {
    channel?: string;
    ntfyTopic?: string;
    webhookUrl?: string;
    workspace?: string;
  };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const channel = body.channel || 'ntfy';
  const ws = String(body.workspace || 'Voibcode').slice(0, 32);
  const start = Date.now();

  try {
    if (channel === 'ntfy') {
      const topic = String(body.ntfyTopic || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      if (topic.length < 4) {
        return jsonResponse({ ok: false, latencyMs: 0, error: 'Topic must be >= 4 characters' }, 400);
      }
      const res = await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        headers: {
          Title: 'VoibeCode test ping',
          Priority: 'default',
          Tags: 'white_check_mark',
        },
        body: `Away Alerts are live for ${ws}. You will be pinged the moment an AI agent stalls, loops, or finishes.`,
      });
      if (!res.ok) {
        return jsonResponse({ ok: false, latencyMs: Date.now() - start, error: `ntfy HTTP ${res.status}` }, 502);
      }
      return jsonResponse({ ok: true, latencyMs: Date.now() - start, destination: `ntfy.sh/${topic}` });
    }

    // Strict SSRF allowlist for hosted webhook test pings (Slack & Discord official webhook origins)
    const rawUrl = String(body.webhookUrl || '').trim();
    const parsed = sanitizeHttpsUrl(rawUrl);
    if (!parsed) {
      return jsonResponse({ ok: false, latencyMs: 0, error: 'Enter a valid https:// webhook URL' }, 400);
    }
    const host = new URL(parsed).hostname.toLowerCase();
    const isSlack = host === 'hooks.slack.com';
    const isDiscord = host === 'discord.com' || host === 'discordapp.com';
    if (!isSlack && !isDiscord) {
      return jsonResponse(
        {
          ok: false,
          latencyMs: 0,
          error: 'Hosted demo allows ntfy.sh, hooks.slack.com, or discord.com webhooks. Custom URLs run locally via the IDE plugin.',
        },
        400
      );
    }

    const payload = isDiscord
      ? { content: `**VoibeCode test ping**\nAway Alerts are live for ${ws}.` }
      : { text: `*VoibeCode test ping* — Away Alerts are live for ${ws}.` };

    const res = await fetch(parsed, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return jsonResponse({ ok: false, latencyMs: Date.now() - start, error: `HTTP ${res.status}` }, 502);
    }
    return jsonResponse({ ok: true, latencyMs: Date.now() - start, destination: host });
  } catch (err) {
    return jsonResponse(
      { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : 'Network error' },
      502
    );
  }
}

async function handleVoiceProxy(url: URL): Promise<Response> {
  const text = (url.searchParams.get('q') || 'Time to Voibe code.').slice(0, 180);
  try {
    const ttsUrl =
      'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=en-AU&q=' +
      encodeURIComponent(text);
    const res = await fetch(ttsUrl);
    if (res.ok) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 256) {
        return new Response(buf, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'public, max-age=86400',
            ...CORS_HEADERS,
          },
        });
      }
    }
  } catch {
    // Fallback to client-side static MP3 / SpeechSynthesis
  }
  return new Response('Voice unavailable', { status: 404, headers: CORS_HEADERS });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'GET' && pathname === '/api/manifest.json') {
      return handleGetManifest(env);
    }

    if (request.method === 'GET' && pathname === '/api/config') {
      return handleGetConfig(env);
    }

    if (request.method === 'POST' && pathname === '/api/webhook/stripe') {
      return handleStripeWebhook(request, env);
    }

    if (request.method === 'POST' && pathname === '/api/admin/approve') {
      return handleAdminApprove(request, env);
    }

    if (request.method === 'GET' && pathname.startsWith('/api/license/')) {
      const keyParam = pathname.slice('/api/license/'.length);
      return handleGetLicense(keyParam, env);
    }

    if (request.method === 'GET' && pathname === '/api/checkout/status') {
      return handleCheckoutStatus(url, env);
    }

    if (request.method === 'POST' && pathname === '/api/checkout') {
      return handleCreateCheckout(request, env);
    }

    if (request.method === 'POST' && pathname === '/api/alerts/test') {
      return handlePublicTestAlert(request);
    }

    if (request.method === 'GET' && pathname === '/api/voice') {
      return handleVoiceProxy(url);
    }

    if (request.method === 'GET' && pathname === '/api/health') {
      return jsonResponse({ ok: true, service: 'voibecode-worker' });
    }

    return jsonResponse({ error: 'Not Found' }, 404);
  },
};
