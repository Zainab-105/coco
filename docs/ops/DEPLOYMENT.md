# Environments, deployment and media storage

## Environments

| | Local | Staging | Production |
|---|---|---|---|
| URL | http://localhost:3000 | https://staging.coco.pk | https://coco.pk |
| Database | Embedded Postgres 17 (`npm run db:dev`, port 5433) or Docker (`npm run db:up`, port 5432) | Postgres 17 on the VPS (separate database) | Postgres 17 on the VPS or managed (Neon) |
| Schema changes | Auto "push" in dev | Committed migrations, applied on boot | Committed migrations, applied on boot |
| Media | Local `media/` folder | R2 bucket `coco-staging` | R2 bucket `coco-media` |
| Payments | Sandbox | Sandbox | Live merchant accounts |
| Data | `npm run seed:sample` | Sample catalogue for client review (UAT) | Real catalogue only |

## Local development

```bash
npm install
npm run db:dev            # terminal 1: embedded Postgres (creates coco + coco_test)
npm run dev               # terminal 2: http://localhost:3000, admin at /admin
npm run seed:sample       # categories, fragrances, sample products, banners, coupons, 40 demo orders
npm run db:reset          # wipe the local dev database (refuses to touch non-local hosts)
```

Integration tests use `TEST_DATABASE_URL` and refuse to run against any database whose name does not end in `_test`.

## Schema changes and migrations

Development uses Payload's schema push, so collections can change freely. Before merging a change that touches
collections or fields:

```bash
npx payload migrate:create <short-name>   # e.g. add-gift-note
git add src/migrations
```

CI fails if the schema changed without a migration. Staging and production run pending migrations automatically when
the server boots (`prodMigrations` in `src/payload.config.ts`).

Never point `npm run dev` at the staging or production database: dev push mode would alter its schema directly.

## Hosting (recommended: VPS + Coolify)

1. Create a VPS (Hetzner CX22/CPX21 or DigitalOcean 2 vCPU / 4 GB), Ubuntu 24.04, in the client's account.
2. Install [Coolify](https://coolify.io) and add the GitHub repository (client's organisation).
3. Create a PostgreSQL 17 resource in Coolify with daily backups to R2 (see Backups).
4. Create the application from the repo using the **Dockerfile** build pack.
   - Build arguments: `DATABASE_URL`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_MEDIA_URL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`,
     `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `GOOGLE_SITE_VERIFICATION`. Security headers are also fixed at build
     time, so changing the server or media URL needs a rebuild.
   - Runtime environment: everything in `.env.example` that applies.
   - Health check path: `/api/health` (returns 503 if the database is unreachable).
5. Point DNS (Cloudflare) `coco.pk` and `staging.coco.pk` at the VPS; Coolify issues TLS certificates.
6. Staging deploys on every push to `main`; production deploys from a release tag after client sign-off.

Alternative (fully managed): Vercel for the app + Neon for Postgres. Same code; set the same environment variables.

## Media storage on Cloudflare R2

1. Cloudflare dashboard > R2 > Create bucket `coco-media` (and `coco-staging`).
2. Bucket > Settings > Public access > connect a custom domain, e.g. `media.coco.pk`.
3. R2 > Manage API tokens > create a token with *Object Read & Write* on the bucket.
4. Set:

```
S3_BUCKET=coco-media
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
NEXT_PUBLIC_MEDIA_URL=https://media.coco.pk
```

With `NEXT_PUBLIC_MEDIA_URL` set, images and videos are served directly from Cloudflare's CDN rather than through the
app. Files are stored under the `media/` prefix. Leave `S3_BUCKET` empty locally to keep files on disk.

Customer review and support files use the `customer-uploads/` prefix and are served through the app so that unapproved ones
stay private. The public domain exposes the whole bucket, so these rely on their random filenames there; for a stricter setup,
keep them in a second, private bucket.

**SMTP is required in production for customer sign-in.** Without it, sign-in codes (and other emails) go to the server log
and customers cannot sign in.

## Email

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM_ADDRESS` and `EMAIL_FROM_NAME` (Resend, Brevo or
Zoho SMTP). Add the provider's SPF and DKIM records to the coco.pk DNS. Without `SMTP_HOST`, emails are written to the
server log instead of being sent. Emails sent: order confirmation (after the order is saved), shipped (with tracking
number) and delivered.

## Payment gateways (JazzCash / Easypaisa)

A gateway appears at checkout only when it is switched on in **Store Settings > Shipping & Payments** *and* its
credentials are set in the environment. Payment rules:

- **JazzCash:** marked paid only when the signed callback verifies (HMAC-SHA256 with the integrity salt), the response
  code is `000`, and the amount equals the order total. Forged or altered callbacks are rejected and logged.
- **Easypaisa:** the redirect back from Easypay is never trusted alone. The order is marked paid only when the
  server-side Inquire Transaction API confirms it (`EASYPAISA_ACCOUNT_NUM`, `EASYPAISA_API_USERNAME`,
  `EASYPAISA_API_PASSWORD`). Without those, Easypaisa orders stay "Awaiting verification" for staff to confirm.
- **Manual transfer:** offered when Store Settings has transfer instructions. The customer enters the transaction ID;
  staff confirm it in the merchant app before marking the order paid.

Go-live checklist per gateway:

- [ ] Merchant account approved; credentials stored only in the hosting environment
- [ ] Return URLs registered with the gateway: `https://coco.pk/api/payments/jazzcash/return`,
      `https://coco.pk/api/payments/easypaisa/return`
- [ ] Sandbox: successful, failed and cancelled payments tested end to end; the order page shows the right state
- [ ] Field names and response codes compared with the merchant integration guide supplied with the account
      (the adapters follow the published v1.1 / Easypay specs and need this confirmation)
- [ ] `*_ENV=live` set only after sandbox sign-off

## Backups, restore and security operations

See [`RUNBOOK.md`](RUNBOOK.md): nightly backups, restore drill, recovery, two-factor, rotating secrets, incident checklist.

## Cloudflare and third-party setup

- **Proxy all traffic through Cloudflare** and allow only Cloudflare's addresses to reach the server's ports 80/443. Rate limits
  trust the `CF-Connecting-IP` header, which a visitor could fake if they could reach the server directly.
- **Turnstile:** create a widget (Managed), then set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (build) and `TURNSTILE_SECRET_KEY` (runtime). Set both or
  neither. If visitors cannot complete the check they cannot submit forms, so test checkout on real phones.
- **Google Analytics:** create a GA4 property, set `NEXT_PUBLIC_GA_MEASUREMENT_ID`. In the data stream, under Enhanced Measurement, turn off
  **Page changes based on browser history events**: the site reports pages itself with order numbers and private tokens removed.
- **Search Console:** add `coco.pk`, verify with the DNS record or `GOOGLE_SITE_VERIFICATION`, then submit `https://coco.pk/sitemap.xml`.

## Production checklist

- [ ] `PAYLOAD_SECRET` is a fresh 32+ byte random value (never reuse the dev one)
- [ ] Dev owner account (`owner@coco.local`) does not exist in production
- [ ] `public/mock/` removed and real product media uploaded
- [ ] R2 bucket, custom domain and API token in the client's Cloudflare account
- [ ] Backups running and one restore drill passed and logged in `RESTORE-LOG.md`
- [ ] Owner and managers have turned on two-factor authentication and saved recovery codes
- [ ] Server only reachable through Cloudflare
- [ ] Turnstile, GA4 and Search Console set up; checkout tested on real phones with Turnstile on
- [ ] `npm run audit:media` shows no problems with the real catalogue
- [ ] Privacy policy mentions analytics cookies and the abandoned-checkout capture
- [ ] Uptime monitor on `/api/health`
