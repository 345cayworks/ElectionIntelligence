import crypto from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit/log";
import {
  DEFAULT_ISSUE_TAGS,
  CAYMAN_CONSTITUENCIES,
  CAYMAN_PARTIES,
} from "@/lib/constants";

// Ensures a SuperAdmin user exists and reference data is seeded.
// Called lazily from server contexts; safe to call repeatedly.

let bootstrapPromise: Promise<void> | null = null;

export function ensureSuperAdminBootstrap(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = run().catch((err) => {
      // Reset so a future request can retry.
      bootstrapPromise = null;
      // Never surface this error to the caller. If the DB isn't ready
      // (e.g. `prisma db push` hasn't been run yet), we want callers to
      // continue rendering and let other database calls fail gracefully
      // through their own paths.
      // eslint-disable-next-line no-console
      console.warn(
        "[bootstrap] deferred:",
        (err as Error).message,
      );
    });
  }
  return bootstrapPromise;
}

async function run(): Promise<void> {
  await seedSuperAdmin();
  await seedIssueTags();
  await seedConstituencies();
  await seedParties();
}

async function seedSuperAdmin(): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return;

  // Use SUPER_ADMIN_SEED_PASSWORD if explicitly provided; otherwise
  // fall back to SUPERADMIN_MASTER_KEY (operator choice - the master
  // key is already a high-trust server-only secret, so reusing it as
  // the initial password avoids juggling a second env var). Rotate from
  // /admin/settings after first sign-in.
  const seedPassword = (
    process.env.SUPER_ADMIN_SEED_PASSWORD ??
    process.env.SUPERADMIN_MASTER_KEY ??
    ""
  ).trim();
  const operatorProvidedPassword = seedPassword.length >= 10;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "SUPER_ADMIN" || existing.status !== "ACTIVE") {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "SUPER_ADMIN", status: "ACTIVE" },
      });
      await recordAudit({
        actorUserId: null,
        action: "superadmin.bootstrap.promoted",
        entityType: "User",
        entityId: existing.id,
        metadata: { email },
        severity: "CRITICAL",
      });
    }

    // Reset password from the env var when the user has never signed in
    // successfully. `lastLoginAt` (not `forcePasswordReset`) is the gate
    // because the latter is a UX flag that can be cleared in many places
    // and would silently disable recovery; `lastLoginAt == null` is the
    // strict invariant for "this account has never been used."
    //
    // Once the operator has signed in once, the bootstrap will never
    // overwrite the password again, even if the env var is still set.
    if (operatorProvidedPassword && existing.lastLoginAt === null) {
      const passwordHash = await hashPassword(seedPassword);
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, forcePasswordReset: true },
      });
      await recordAudit({
        actorUserId: null,
        action: "superadmin.bootstrap.password_reset_from_env",
        entityType: "User",
        entityId: existing.id,
        metadata: { email },
        severity: "CRITICAL",
      });
      // eslint-disable-next-line no-console
      console.warn(
        `[bootstrap] SuperAdmin password reset from env (SUPER_ADMIN_SEED_PASSWORD or SUPERADMIN_MASTER_KEY). Sign in, then remove or rotate the env var.`,
      );
    } else if (operatorProvidedPassword) {
      // eslint-disable-next-line no-console
      console.log(
        `[bootstrap] SuperAdmin already has a lastLoginAt - skipping env-based password reset. Use /api/admin/recover-superadmin to recover.`,
      );
    }
    return;
  }

  // First-time bootstrap. Use SUPER_ADMIN_SEED_PASSWORD if it's set (the
  // operator's preferred password) and meets the minimum length; otherwise
  // fall back to a random temp password printed to the server log.
  const tempPassword = operatorProvidedPassword
    ? seedPassword
    : crypto.randomBytes(18).toString("base64url");
  const operatorChosen = operatorProvidedPassword;
  const passwordHash = await hashPassword(tempPassword);
  const created = await prisma.user.create({
    data: {
      email,
      name: "SuperAdmin",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      passwordHash,
      forcePasswordReset: true,
    },
  });

  await recordAudit({
    actorUserId: null,
    action: "superadmin.bootstrap.created",
    entityType: "User",
    entityId: created.id,
    metadata: { email, source: operatorChosen ? "env_seed_password" : "random" },
    severity: "CRITICAL",
  });

  if (operatorChosen) {
    // eslint-disable-next-line no-console
    console.warn(
      `[bootstrap] SuperAdmin created: ${email}. Using password from SUPER_ADMIN_SEED_PASSWORD. Rotate it via /admin/settings after first login, then remove the env var.`,
    );
  } else {
    // Surface the temporary password only via server logs.
    // eslint-disable-next-line no-console
    console.warn(
      `[bootstrap] SuperAdmin created: ${email}. Temporary password: ${tempPassword}`,
    );
  }
}

// Lazily seed the registered political parties. Idempotent: skips
// parties whose `code` already exists, so operator edits to colour,
// leader, or activation state survive subsequent boots.
async function seedParties(): Promise<void> {
  const existing = await prisma.party.findMany({ select: { code: true } });
  const existingCodes = new Set(existing.map((p) => p.code));

  let inserted = 0;
  for (const p of CAYMAN_PARTIES) {
    if (existingCodes.has(p.code)) continue;
    await prisma.party
      .create({
        data: {
          code: p.code,
          name: p.name,
          shortName: p.shortName,
          color: p.color,
          leaderName: p.leaderName ?? null,
        },
      })
      .then(() => {
        inserted += 1;
      })
      .catch(() => {
        /* race or unique-violation - safe to ignore */
      });
  }
  if (inserted > 0) {
    // eslint-disable-next-line no-console
    console.log(`[bootstrap] seeded ${inserted} political part(ies)`);
  }
}

// Lazily seed the 19 Cayman Islands constituencies (post-2021 boundary
// redistribution). Two responsibilities:
//
//   1. Insert any missing constituency by canonical `code`.
//   2. Migrate older slug-coded rows (e.g. "west-bay-north") to the
//      official short codes ("WBN") in place, by matching on `name`.
//      This keeps existing foreign keys (electors, candidates,
//      assignments) intact - we update the code rather than delete and
//      re-insert.
//
// Idempotent: rows already at the target code are skipped, and an
// operator who deliberately renamed or removed one is not undone.
async function seedConstituencies(): Promise<void> {
  const existing = await prisma.constituency.findMany({
    select: { id: true, name: true, code: true },
  });
  const byCode = new Map(existing.map((c) => [c.code, c]));
  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));

  let inserted = 0;
  let renamed = 0;

  for (const c of CAYMAN_CONSTITUENCIES) {
    if (byCode.has(c.code)) continue;

    // Look for an existing row with the same name but a stale code.
    const stale = byName.get(c.name.toLowerCase());
    if (stale && stale.code !== c.code) {
      try {
        await prisma.constituency.update({
          where: { id: stale.id },
          data: { code: c.code, island: c.island },
        });
        renamed += 1;
      } catch {
        /* unique violation if both the target code AND a same-named row
         * already exist in some weird state - skip to avoid clobbering */
      }
      continue;
    }

    await prisma.constituency
      .create({
        data: { name: c.name, code: c.code, island: c.island },
      })
      .then(() => {
        inserted += 1;
      })
      .catch(() => {
        /* race with another bootstrap request or unique-violation - safe to ignore */
      });
  }

  if (inserted > 0 || renamed > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[bootstrap] constituencies: inserted ${inserted}, renamed ${renamed}`,
    );
  }
}

// Lazily seed the canonical issue tags used by the field canvasser UI
// (Cost of living, Traffic, Healthcare, etc.). Idempotent: only inserts
// tags that don't already exist by key.
async function seedIssueTags(): Promise<void> {
  const existing = await prisma.issueTag.findMany({
    select: { key: true },
  });
  const existingKeys = new Set(existing.map((t) => t.key));

  let inserted = 0;
  for (let i = 0; i < DEFAULT_ISSUE_TAGS.length; i++) {
    const tag = DEFAULT_ISSUE_TAGS[i];
    if (existingKeys.has(tag.key)) continue;
    await prisma.issueTag
      .create({
        data: { key: tag.key, label: tag.label, sortOrder: i, active: true },
      })
      .then(() => {
        inserted += 1;
      })
      .catch(() => {
        /* race with another bootstrap request - non-critical */
      });
  }
  if (inserted > 0) {
    // eslint-disable-next-line no-console
    console.log(`[bootstrap] seeded ${inserted} issue tag(s)`);
  }
}
