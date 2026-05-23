# Election Intelligence

Cayman Islands campaign intelligence and canvassing CRM. Replaces
spreadsheet-based elector tracking with a secure, role-gated platform
for managing official elector data and campaign-entered intelligence
separately.

## Stack

- Next.js 14 (App Router) + TypeScript
- Prisma ORM + **PostgreSQL** (Neon / Netlify Database / Supabase / RDS).
  SQLite is not supported because serverless runtimes don't have a
  writable filesystem - sign-in would crash on the first session insert.
- Tailwind CSS
- Server actions and `/api/*` routes
- Cayworks platform foundation (tracking, SuperAdmin bootstrap, Ads
  Engine integration)

## Getting started

```bash
# 1. install
npm install

# 2. configure
cp .env.example .env
# - Set DATABASE_URL to a PostgreSQL connection string. Free options:
#     Neon (https://neon.tech) - one-click, copy the URL.
#     Or local docker:
#       docker run --name ei-pg -e POSTGRES_PASSWORD=postgres \
#         -p 5432:5432 -d postgres:16
#       DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
# - Set SUPER_ADMIN_EMAIL=you@example.com so the platform seeds your
#   SuperAdmin on first boot.
# - Leave SUPERADMIN_MASTER_KEY and AD_ENGINE_KEY blank if you do not
#   need them yet. The app does not crash when they are missing.

# 3. apply the schema to your database
npx prisma db push

# 4. (optional) seed demo data
npm run db:seed

# 5. run the app
npm run dev
```

On first boot the home page lazily seeds the SuperAdmin from
`SUPER_ADMIN_EMAIL`. The temporary password is **printed to server
output only**, never to the browser. Sign in once and immediately
rotate the password.

## Key roles

| Role | Purpose |
| ---- | ------- |
| `SUPER_ADMIN` | Platform owner; manages SuperAdmins, Ads Engine config, tracking IDs |
| `CAMPAIGN_ADMIN` | Campaign lead; manages elections, candidates, imports |
| `DATA_MANAGER` | Imports and exports elector data |
| `FIELD_COORDINATOR` | Assigns work to canvassers; views sensitive data |
| `CANVASSER` | Logs visits in the field |
| `CANDIDATE` | Read-only access to campaign intelligence for their constituency |
| `OBSERVER_READONLY` | Limited read access for reporting |

## Security rules enforced by the codebase

- `SUPERADMIN_MASTER_KEY` and `AD_ENGINE_KEY` are read only in
  server-only modules (`src/lib/auth/superadmin-key.ts`,
  `src/lib/ads/server-client.ts`). They are never returned to the
  browser, logged, or echoed back in responses.
- `NEXT_PUBLIC_*` env vars are reserved for non-secret toggles.
- Ads load only through `/api/internal/ads/*` proxy routes, which add
  the engine key from the server before talking to ads.cayworks.com.
- Final SuperAdmin cannot be demoted. Demotion / promotion / forced
  password reset / master-key rotation intent are all logged as
  `CRITICAL` audit entries.
- Political declaration data (`ElectorPoliticalStatus`) lives in a
  table separate from official elector data and is read-gated by
  `canViewSensitivePoliticalData` and write-gated by
  `canEditSensitivePoliticalData`.
- Importing a fresh elector list updates `Elector` rows but never
  deletes or rewrites canvass history (`CanvassVisit`,
  `ElectorPoliticalStatus`, `FollowUpTask`).
- All write APIs require a session and a permission predicate.

## Platform map

### Cayworks foundation
- `/admin/settings` - SuperAdmin Settings (tracking, SuperAdmin
  roster, Ads Engine, environment status). No secrets displayed.
- `/admin/ads-test` - protected ads tester: server env check, serve
  endpoint check, diagnose endpoint check (404 = WARN, not FAIL),
  and a live `AdBanner` preview.

### Election platform
- `/admin/elections` - election cycles
- `/admin/constituencies` - constituencies (Red Bay is in the seed)
- `/admin/candidates` - candidates and shorthand codes (configurable;
  not hardcoded)
- `/admin/imports` - upload XLSX/CSV; review diff; commit
- `/admin/compliance` - privacy posture, role distribution
- `/admin/audit-logs` - searchable audit trail
- `/admin/data-retention` - retention policy + manual archive
- `/app/dashboard` - leadership campaign dashboard with live metrics
- `/app/electors`, `/app/electors/[id]` - elector list + profile
- `/app/households`, `/app/households/[id]` - household list + profile
- `/app/reports` - unvisited, not-home, undecided, postal/mobile,
  street completion, data quality
- `/app/assignments`, `/app/assignments/new` - assignment workflow
- `/app/streets`, `/app/streets/[streetKey]` - street view + route list
- `/field` - mobile-first field dashboard
- `/field/streets`, `/field/follow-ups` - field views
- `/field/households/[id]` - household visit screen with quick action
  buttons and issue tagging
- `/election-day/*` - day-of operational module (compliance review
  required before live use)

## Ad Engine contract

The internal proxy talks to ads.cayworks.com with these calls (all
authenticated with `X-Ad-Engine-Key`):

- `GET /api/ads/serve?platform=<slug>&placement=<key>&userRole=<role>`
- `POST /api/ads/impression`
- `POST /api/ads/click`

`AdSlot` (and its `AdBanner`, `SponsoredCard`, `NativeAd` wrappers)
fetches through `/api/internal/ads/serve`, records impressions when
the slot is >=50% visible, and opens `destinationUrl` in a new tab on
click. If no ad is returned the slot collapses to height 0.

## Working with the importer

1. Visit `/admin/imports/new` and select an XLSX or CSV file.
2. The parser recognizes sheets named after `CANVASSING LIST`,
   `UPDATE LIST`, or `full list` and merges rows preferring the most
   authoritative source.
3. The diff engine compares the upload against the current register
   and tags every row as `NEW`, `MOVED_IN`, `ADDRESS_UPDATED`,
   `REMOVED`, `DUPLICATE_SUSPECT`, or `ACTIVE`.
4. Review at `/admin/imports/[id]/review`, then commit. The commit
   step creates households (deduplicated by normalized address) and
   inserts/updates electors, leaving canvass history untouched.

## Verifying secrets do not ship to the browser

Run the Cayworks Ads Engine key-prefix check (replace `<PREFIX>` with the
literal prefix used by your Ads Engine keys, typically the same prefix
you find on key issuance):

```bash
grep -R --exclude-dir=node_modules --exclude-dir=.next "<PREFIX>" . | wc -l
# Should print 0.
```

## Deployment notes

See `DEPLOYMENT.md` for Netlify deploy guidance, including required
environment variables and SuperAdmin bootstrap.
