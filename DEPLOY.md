# Deploying VoibeCode to `voibecode.com`

VoibeCode ships with **two production deployment targets** (both included in this repo) and **two Stripe checkout modes** so you can go live immediately and start accepting payments in under 5 minutes.

---

## 1. Stripe Setup (Choose Either Mode)

### Option A — Dynamic Stripe Checkout API (Recommended: Auto-Generates `VC-PRO-` Keys)
Set these environment variables on your host:
- `STRIPE_SECRET_KEY` — Your Stripe secret key (`sk_live_...` or `sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` — From Stripe Dashboard → Developers → Webhooks → endpoint `https://voibecode.com/api/webhook/stripe` listening for `checkout.session.completed`

Supported tiers automatically created via `POST /api/checkout`:
- `pro_lifetime` — **$39 one-time** (`VoibeCode Pro — Early Founder Lifetime`)
- `pro_monthly` — **$9/mo** (`VoibeCode Pro — Monthly`)
- `team` — **$19/seat/mo** (`VoibeCode Team — Per Seat`)

On successful payment, Stripe redirects to `https://voibecode.com/?checkout=success&session_id={CHECKOUT_SESSION_ID}`, and VoibeCode automatically unlocks Pro and displays the buyer's copyable `VC-PRO-XXXX-XXXX` license key.

### Option B — Stripe Payment Links (Fastest: Zero Webhooks Needed)
Create 2–3 Payment Links in Stripe Dashboard and set these env vars (no `STRIPE_SECRET_KEY` required):
- `STRIPE_LINK_PRO_LIFETIME` — e.g. `https://buy.stripe.com/...` ($39 one-time)
- `STRIPE_LINK_PRO_MONTHLY` — e.g. `https://buy.stripe.com/...` ($9/mo)
- `STRIPE_LINK_TEAM` — e.g. `https://buy.stripe.com/...` ($19/seat/mo)

---

## 2. Deploy Target A — Docker (Google Cloud Run / Railway / Render / Fly.io)

Matches your previous `Dockerfile` production setup (`Node 22`, port `3000`, zero extra runtime dependencies). The container builds the frontend, packages both `voibecode-1.0.0.vsix` and `voibecode-antigravity-plugin.zip`, and serves static assets + all `/api/*` routes from `packages/server/server.mjs`.

### Google Cloud Run
```bash
gcloud run deploy voibecode \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "PUBLIC_ORIGIN=https://voibecode.com,STRIPE_SECRET_KEY=sk_live_...,STRIPE_WEBHOOK_SECRET=whsec_..."
```

### Railway / Render
1. Push this repo to GitHub (`git remote add origin <your-repo-url> && git push -u origin main`).
2. Create a new **Docker** service pointing to the repo root (`Dockerfile`).
3. Add `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (or `STRIPE_LINK_*`) in Environment Variables and attach your `voibecode.com` custom domain.

---

## 3. Deploy Target B — Cloudflare Pages + Worker (`$0/mo` Fixed Cost)

### 3.1 Deploy the API Worker (`packages/worker`)
```bash
cd packages/worker
npx wrangler kv namespace create VOIBECODE_KV
# Paste the returned namespace ID into packages/worker/wrangler.toml

npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
# (Or set STRIPE_LINK_PRO_LIFETIME / STRIPE_LINK_PRO_MONTHLY / STRIPE_LINK_TEAM)

npx wrangler deploy
```
Route `voibecode.com/api/*` to the `voibecode-worker` Worker in Cloudflare Dashboard.

### 3.2 Deploy the Frontend (`packages/web`)
Build command:
```bash
npm ci && npm run build:shared && npm run build --workspace=packages/antigravity-plugin && npm run package:all && npm run build --workspace=packages/web
```
Build output directory: `packages/web/dist`

---

## 4. Downloadable Artifacts Built Automatically
Every production build publishes both free IDE packages directly at root:
- `https://voibecode.com/voibecode-antigravity-plugin.zip` — Native Antigravity 2.0 plugin + live sidecar
- `https://voibecode.com/voibecode-1.0.0.vsix` — VS Code / Cursor / Windsurf extension (`<26 KB`)
