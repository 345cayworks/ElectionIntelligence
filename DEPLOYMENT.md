# Deployment Notes

The platform is built for Netlify, but any Next.js-compatible host
(Vercel, Fly, Render) works the same way. Database and Ads Engine
configuration is environment-driven.

## 1. Database

Local development uses SQLite via `DATABASE_URL=file:./dev.db`. For
production, point `DATABASE_URL` at Postgres (Neon / Netlify
Database / RDS) and update `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then run:

```bash
npx prisma migrate deploy
```

The schema currently uses string fields where Postgres would use
native enums. This keeps SQLite and Postgres in sync. If you prefer
Postgres enums, convert each `String` column referenced in
`src/lib/constants.ts` to a proper enum and regenerate.

## 2. Netlify configuration

`netlify.toml` is intentionally minimal. Use the Next.js runtime
plugin offered by Netlify (auto-detected). Add the following
environment variables in the Netlify UI:

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `DATABASE_URL` | yes | Production database connection string |
| `SUPER_ADMIN_EMAIL` | yes | Seeds the initial SuperAdmin on first boot |
| `SUPERADMIN_MASTER_KEY` | yes | Server-only. Min 16 chars. Never expose. |
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

1. Set required env vars (above).
2. Trigger a deploy.
3. Sign in to your SuperAdmin email. Use the temporary password
   surfaced in server logs on first boot (see
   `src/lib/auth/superadmin-bootstrap.ts`).
4. Rotate your password immediately.
5. Add at least one additional SuperAdmin from `/admin/settings` so
   the final-SuperAdmin protection cannot lock you out.
6. Verify Ads Engine status from `/admin/ads-test` if you configured
   `AD_ENGINE_KEY`. A 404 on `diagnose` is WARN, not FAIL.

## 5. Secrets verification

Before each deploy, confirm no Ads Engine key fragment was committed.
Replace `<PREFIX>` with the literal prefix used by your Cayworks Ads
Engine keys (commonly the same prefix shown when the key was issued):

```bash
grep -R --exclude-dir=node_modules --exclude-dir=.next "<PREFIX>" . | wc -l
# expected: 0
```

## 6. Backup and retention

`/admin/data-retention` configures retention windows for audit logs
and canvass visits. The page also exposes a manual "Run visit
archive" action. For automated retention, schedule a daily Netlify
Function or Postgres job that respects the configured policy.
