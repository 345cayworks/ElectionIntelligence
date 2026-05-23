# Database setup

Two SQL files, applied in order:

| File         | Purpose                                                |
| ------------ | ------------------------------------------------------ |
| `setup.sql`  | Creates every table, index, and foreign key.           |
| `seed.sql`   | Inserts reference data (issue tags, ad placements, demo cycle, SuperAdmin). Idempotent. |

## Option A — Apply via Prisma (recommended for local dev)

```bash
# 1. Set DATABASE_URL in .env (PostgreSQL connection string)
# 2. Apply the schema directly. No migration history is required.
npx prisma db push

# 3. Seed reference data using the TypeScript seed script
#    (uses bcrypt to hash the SuperAdmin password)
SUPER_ADMIN_EMAIL=you@example.com \
SUPER_ADMIN_SEED_PASSWORD='ChooseAStrongOne!' \
npm run db:seed
```

## Option B — Apply the SQL files directly (Neon SQL Editor, psql, etc.)

```bash
# Using psql with your production DATABASE_URL:
psql "$DATABASE_URL" -f prisma/migrations/setup.sql
psql "$DATABASE_URL" -f prisma/migrations/seed.sql
```

Or paste the contents of each file into the Neon / Supabase / Netlify
Database SQL editor.

After `seed.sql` runs you'll have a SuperAdmin row for
`info@cayworks.com` with no password. The platform will set a random
temporary password on first boot — look in your Netlify Function log
for a line beginning `[bootstrap] SuperAdmin created:`. Sign in once
with that password, then rotate it.

If you'd rather pick the password yourself, skip step in `seed.sql`
that creates the user and run the npm seed (Option A step 3) instead.

## Reset

```bash
# Drop everything and reapply
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql "$DATABASE_URL" -f prisma/migrations/setup.sql
psql "$DATABASE_URL" -f prisma/migrations/seed.sql
```

## What the tables look like

20 tables in three groups:

- **Foundation:** `User`, `Session`, `AuditLog`, `PlatformSetting`,
  `AdPlacement`
- **Election setup:** `ElectionCycle`, `Constituency`, `Candidate`
- **Operations:** `ImportBatch`, `Household`, `Elector`,
  `ElectorContact`, `CanvassVisit`, `ElectorPoliticalStatus`,
  `IssueTag`, `ElectorIssue`, `FollowUpTask`, `CanvassAssignment`

Status / role values are stored as `TEXT` rather than native Postgres
enums so introducing a new value (e.g. a new visit result) doesn't
require a destructive enum migration. Validation lives in
`src/lib/constants.ts` and the Zod schemas in `src/app/api/*/route.ts`.
