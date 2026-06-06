# Deployment Notes

The platform is built for Netlify, but any Next.js-compatible host
(Vercel, Fly, Render) works the same way. Database and Ads Engine
configuration is environment-driven.

## 1. Database

**The platform requires PostgreSQL.** SQLite is not supported on
serverless platforms (Netlify, Vercel) because the runtime filesystem
is read-only — any write (e.g. creating a session row at sign-in) would
crash. The first symptom is usually a generic "Application error" page
the moment a user tries to sign in.

Recommended providers:
- **Neon** (https://neon.tech) — has a free tier, works out of the box
- **Netlify Database** (Powered by Neon) — provision from the Netlify UI
- **Supabase** Postgres
- Any other managed Postgres (RDS, Render, Railway, Fly Postgres)

Set `DATABASE_URL` to the provider's connection string. Most providers
require `?sslmode=require`. For Neon/Netlify Database via PgBouncer, add
`&pgbouncer=true&connect_timeout=15` for serverless connection pooling.

After setting `DATABASE_URL`, apply the schema:

```bash
npx prisma migrate deploy
# OR for fresh setups without prior migrations:
npx prisma db push
```

Then optionally seed:

```bash
SUPER_ADMIN_EMAIL=you@example.com npm run db:seed
```

### Local development against Postgres

Pick one:
1. **Free Neon DB** — fastest. Sign up, create a project, paste the
   connection string into `.env`. Run `npx prisma db push`.
2. **Local Postgres via Docker:**
   ```bash
   docker run --name ei-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
   echo 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"' > .env
   npx prisma db push
   ```
3. **System Postgres** — set `DATABASE_URL` to your local instance.

The schema uses string fields with TypeScript const-array validation
instead of native Postgres enums. This keeps migrations cheap if you
ever need to add a new status value.

## 2. Netlify configuration

`netlify.toml` declares the `@netlify/plugin-nextjs` runtime. Prisma's
client is generated with the Netlify-compatible binary targets:
`rhel-openssl-3.0.x`, `linux-musl-openssl-3.0.x`, and
`debian-openssl-3.0.x` (see `prisma/schema.prisma`). Don't remove these
or the Functions runtime will fail to start with a missing engine
binary error.

Add the following environment variables in the Netlify UI:

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `DATABASE_URL` | yes | Production database connection string |
| `SUPER_ADMIN_EMAIL` | yes | Seeds the initial SuperAdmin on first boot |
| `SUPERADMIN_MASTER_KEY` | yes | Server-only. Min 16 chars. Never expose. |
| `SCHEDULED_SYNC_TOKEN` | optional | Server-only. Min 16 chars. Required if you want to call `/api/scheduled/sync-portal` from outside an authenticated session (Netlify scheduled functions, GitHub Actions cron, etc.). |
| `AD_ENGINE_KEY` | optional | Server-only Cayworks Ads Engine key |
| `AD_ENGINE_BASE_URL` | optional | Defaults to `https://ads.cayworks.com` |
| `AD_ENGINE_PLATFORM` | optional | Slug registered with the Ads Engine |
| `NEXT_PUBLIC_ENABLE_TRACKING` | optional | `true` to turn on tracking |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | optional | Google Analytics 4 ID |
| `NEXT_PUBLIC_GOOGLE_TAG_ID` | optional | Google Tag Manager container |
| `NEXT_PUBLIC_META_PIXEL_ID` | optional | Meta/Facebook Pixel ID |
| `NEXT_PUBLIC_ENABLE_ADS` | optional | `true` to fetch ads on render |

**Hard rules:**

- Do **not** create `NEXT_PUBLIC_AD_ENGINE_KEY`. The Ads Engine key
  must stay server-side.
- Do **not** put `SUPERADMIN_MASTER_KEY` behind a `NEXT_PUBLIC_*`
  alias.
- Do **not** commit `.env` to the repo.

## 3. Build pipeline

The default `npm run build` runs:

```
prisma generate && next build
```

`prisma generate` is also pinned to `postinstall`, so the client is
present before Next.js typechecks.

## 4. First-launch checklist

1. Provision a Postgres database (Neon is fastest).
2. Set required env vars in Netlify, **including `DATABASE_URL`**.
3. From your laptop (one-time), with the same `DATABASE_URL`, run:
   ```bash
   npx prisma db push
   SUPER_ADMIN_EMAIL=you@example.com npm run db:seed
   ```
   This applies the schema and creates the SuperAdmin row.
4. Trigger a deploy.
5. Sign in to your SuperAdmin email. Use the temporary password
   surfaced in server logs on first boot (see
   `src/lib/auth/superadmin-bootstrap.ts`).
6. Rotate your password immediately.
7. Add at least one additional SuperAdmin from `/admin/settings` so
   the final-SuperAdmin protection cannot lock you out.
8. Verify Ads Engine status from `/admin/ads-test` if you configured
   `AD_ENGINE_KEY`. A 404 on `diagnose` is WARN, not FAIL.

### Troubleshooting sign-in

If sign-in shows "Database tables are missing", you skipped step 3 —
run `npx prisma db push` against the production `DATABASE_URL`.

If it shows "Cannot reach the database", check that `DATABASE_URL` is
set on Netlify, that the database accepts external connections, and
that `?sslmode=require` is included.

If it shows the generic Next.js "Application error" page with a digest,
check your Netlify Function logs — the digest will be in the log line
prefixed with `[global-error]` or the Prisma stack trace.

## 5. Secrets verification

Before each deploy, confirm no Ads Engine key fragment was committed.
Replace `<PREFIX>` with the literal prefix used by your Cayworks Ads
Engine keys (commonly the same prefix shown when the key was issued):

```bash
grep -R --exclude-dir=node_modules --exclude-dir=.next "<PREFIX>" . | wc -l
# expected: 0
```

## 6. Ingesting Cayman Islands election data

### Election cycle, candidates, results — `npm run import:2025`

A reproducible importer reads `data/2025-general-election.json` and
upserts a single `ElectionCycle` (`id: "ge-2025"`), one `Candidate` per
constituency entry, and an `ElectionResult` row for each candidate that
has a `votes` value. Idempotent — re-running updates existing rows by
`(electionCycleId, constituencyId, shorthandCode)`.

```bash
# from your laptop, against the production DB (read-only operations
# happen against this connection, no harm if you abort)
DATABASE_URL="postgresql://..." npm run import:2025
```

The JSON file ships with a small set of known winners (East End,
Cayman Brac East, etc.) — fill in the rest from the official
Declaration of Results PDF or news outlets before re-running.

### Portal scraper — `POST /api/scheduled/sync-portal`

Best-effort ingest of `portal.elections.ky` candidate and polling
station pages. The portal sits behind Cloudflare bot protection and
frequently returns 403 to non-browser User-Agents — when that happens
the endpoint records a WARN audit entry and returns a 200 with a
diagnostic summary. Run it again later or fall back to manual entry
via `/admin/polling-stations`.

**Manual trigger** — from any signed-in SuperAdmin session:

```bash
curl -X POST https://caymanelectionintell.cayworks.com/api/scheduled/sync-portal \
  -H "Cookie: cw_session=YOUR_SESSION_COOKIE"
```

**Automated trigger** — set `SCHEDULED_SYNC_TOKEN` (≥16 chars) on
Netlify, then have an external cron (GitHub Actions, EasyCron, Better
Uptime) POST hourly/daily:

```bash
curl -X POST https://caymanelectionintell.cayworks.com/api/scheduled/sync-portal \
  -H "X-Sync-Token: $SCHEDULED_SYNC_TOKEN"
```

The response shape:

```json
{
  "startedAt": "2025-06-06T...",
  "candidatesFetched": { "ok": true, "status": 200, "parsed": 80 },
  "pollingStationsFetched": { "ok": false, "status": 403, "parsed": null, "reason": "http_403" },
  "candidatesUpserted": 0,
  "pollingStationsUpserted": 0,
  "warnings": ["polling stations: fetch failed (http_403)"]
}
```

`candidatesUpserted` is intentionally 0 — scraped candidate names
don't carry the canonical `shorthandCode`, so a snapshot is stored in
`PlatformSetting` (`portal:candidates:lastScrape`) for human review
and the JSON importer is the authoritative writer.

## 7. Backup and retention

`/admin/data-retention` configures retention windows for audit logs
and canvass visits. The page also exposes a manual "Run visit
archive" action. For automated retention, schedule a daily Netlify
Function or Postgres job that respects the configured policy.
