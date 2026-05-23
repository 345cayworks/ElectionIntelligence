import crypto from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit/log";

// Ensures a SuperAdmin user exists, seeded from SUPER_ADMIN_EMAIL.
// Called lazily from server contexts; safe to call repeatedly.

let bootstrapPromise: Promise<void> | null = null;

export function ensureSuperAdminBootstrap(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = run().catch((err) => {
      // Reset so a future request can retry.
      bootstrapPromise = null;
      throw err;
    });
  }
  return bootstrapPromise;
}

async function run(): Promise<void> {
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
