import crypto from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit/log";
import { DEFAULT_ISSUE_TAGS } from "@/lib/constants";

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
}

async function seedSuperAdmin(): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return;

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
    return;
  }

  // First-time bootstrap: create the SuperAdmin with a random temporary password.
  const tempPassword = crypto.randomBytes(18).toString("base64url");
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
    metadata: { email },
    severity: "CRITICAL",
  });

  // Surface the temporary password only via server logs - never returned to clients.
  // eslint-disable-next-line no-console
  console.warn(
    `[bootstrap] SuperAdmin created: ${email}. Temporary password: ${tempPassword}`,
  );
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
