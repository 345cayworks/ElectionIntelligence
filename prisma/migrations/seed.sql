-- Election Intelligence - reference seed data.
-- Apply AFTER setup.sql. Idempotent (safe to re-run).
-- Adjust SUPER_ADMIN_EMAIL below if you don't want info@cayworks.com.

-- ---------------------------------------------------------------------
-- Issue tags used by the canvassing field UI.
-- ---------------------------------------------------------------------
INSERT INTO "IssueTag" ("id", "key", "label", "sortOrder", "active") VALUES
  ('iss_cost',     'cost_of_living',   'Cost of living',  0,  true),
  ('iss_pensions', 'pensions',         'Pensions',        1,  true),
  ('iss_traffic',  'traffic',          'Traffic',         2,  true),
  ('iss_housing',  'housing',          'Housing',         3,  true),
  ('iss_health',   'healthcare',       'Healthcare',      4,  true),
  ('iss_youth',    'youth',            'Youth',           5,  true),
  ('iss_jobs',     'jobs',             'Jobs',            6,  true),
  ('iss_immig',    'immigration',      'Immigration',     7,  true),
  ('iss_safety',   'community_safety', 'Community safety',8,  true),
  ('iss_infra',    'infrastructure',   'Infrastructure',  9,  true),
  ('iss_edu',      'education',        'Education',      10,  true)
ON CONFLICT ("key") DO NOTHING;

-- ---------------------------------------------------------------------
-- Ad placement registry. Only these keys are exposed through the
-- internal ads proxy.
-- ---------------------------------------------------------------------
INSERT INTO "AdPlacement" ("id", "key", "description", "enabled", "updatedAt") VALUES
  ('plc_dash_top',     'dashboard_top',           'Top banner on campaign dashboard',  true, now()),
  ('plc_dash_side',    'dashboard_sidebar',       'Sidebar slot on campaign dashboard',true, now()),
  ('plc_field_top',    'field_top',               'Top banner on field canvasser dashboard', true, now()),
  ('plc_elector_side', 'elector_profile_sidebar', 'Sidebar slot on elector profile',   true, now())
ON CONFLICT ("key") DO NOTHING;

-- ---------------------------------------------------------------------
-- Demo election cycle, constituency, and candidate codes from the
-- original Red Bay workbook. Safe to delete after first import.
-- ---------------------------------------------------------------------
INSERT INTO "ElectionCycle" ("id", "name", "electionDate", "status", "notes", "updatedAt")
VALUES (
  'demo-cycle',
  '2025 General Election (Demo)',
  '2025-04-30T00:00:00.000Z',
  'PLANNING',
  'Seed data for development.',
  now()
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Constituency" ("id", "name", "code", "island", "updatedAt")
VALUES ('red-bay', 'Red Bay', 'red-bay', 'Grand Cayman', now())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Candidate" ("id", "electionCycleId", "constituencyId", "name", "shorthandCode", "isPrimaryCampaignCandidate", "updatedAt") VALUES
  ('cand_dt',  'demo-cycle', 'red-bay', 'Candidate DT', 'DT',  true,  now()),
  ('cand_ppm', 'demo-cycle', 'red-bay', 'PPM Slate',    'PPM', false, now()),
  ('cand_nmw', 'demo-cycle', 'red-bay', 'NMW Candidate','NMW', false, now()),
  ('cand_pe',  'demo-cycle', 'red-bay', 'PE Candidate', 'PE',  false, now()),
  ('cand_lg',  'demo-cycle', 'red-bay', 'LG Candidate', 'LG',  false, now())
ON CONFLICT ("electionCycleId", "constituencyId", "shorthandCode") DO NOTHING;

-- ---------------------------------------------------------------------
-- SuperAdmin bootstrap row.
--
-- This creates the user row only. The platform will set the
-- password hash on first boot when SUPER_ADMIN_EMAIL is set on the
-- deployment; the temporary password is logged once to the server
-- output (look for "[bootstrap] SuperAdmin created: ..." in your
-- Netlify Function log).
--
-- If you want to skip the boot-time bootstrap and set a password
-- manually, run the platform's seed script instead:
--     SUPER_ADMIN_EMAIL=you@example.com \
--     SUPER_ADMIN_SEED_PASSWORD='ChooseAStrongOne!' \
--     npm run db:seed
-- which uses bcrypt to hash the password before insert.
-- ---------------------------------------------------------------------
INSERT INTO "User" ("id", "email", "name", "role", "status", "forcePasswordReset", "updatedAt")
VALUES (
  'usr_superadmin',
  'info@cayworks.com',
  'SuperAdmin',
  'SUPER_ADMIN',
  'ACTIVE',
  true,
  now()
)
ON CONFLICT ("email") DO NOTHING;
