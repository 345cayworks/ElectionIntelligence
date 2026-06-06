import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit/log";

export const dynamic = "force-dynamic";

// Out-of-band SuperAdmin password recovery. POST with the email of a
// SuperAdmin and the value currently stored in SUPERADMIN_MASTER_KEY.
// If the master key matches (constant-time), the user's password is
// reset to the master key value and forcePasswordReset is set so the
// operator is reminded to rotate it on next sign-in.
//
// This is the last-resort recovery path when the bootstrap's automatic
// reset didn't fire (e.g. lastLoginAt was non-null) or the operator
// rotated their password and then forgot it. The master key remains the
// trust anchor: anyone who has it can recover, but they could also just
// read it from Netlify env vars - no new attack surface vs. the existing
// admin capability.

interface RecoverRequest {
  email?: unknown;
  masterKey?: unknown;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const configured = (process.env.SUPERADMIN_MASTER_KEY ?? "").trim();
  if (configured.length < 16) {
    return NextResponse.json(
      { error: "recovery_unavailable", reason: "master_key_not_configured" },
      { status: 503 },
    );
  }

  let body: RecoverRequest;
  try {
    body = (await req.json()) as RecoverRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const masterKey = typeof body.masterKey === "string" ? body.masterKey : "";

  if (!email || !masterKey) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!safeEqual(masterKey, configured)) {
    // Audit-log every failed attempt - this endpoint is a recovery path,
    // not a login form, so any failure deserves a record.
    await recordAudit({
      action: "superadmin.recover.failed",
      metadata: { email, reason: "master_key_mismatch" },
      severity: "CRITICAL",
    }).catch(() => {});
    return NextResponse.json({ error: "master_key_mismatch" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await recordAudit({
      action: "superadmin.recover.failed",
      metadata: { email, reason: "user_not_found" },
      severity: "CRITICAL",
    }).catch(() => {});
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  if (user.role !== "SUPER_ADMIN") {
    await recordAudit({
      actorUserId: user.id,
      action: "superadmin.recover.failed",
      metadata: { email, reason: "not_a_superadmin" },
      severity: "CRITICAL",
    }).catch(() => {});
    return NextResponse.json({ error: "not_a_superadmin" }, { status: 403 });
  }

  const passwordHash = await hashPassword(masterKey);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      status: "ACTIVE",
      forcePasswordReset: true,
      // Reset lastLoginAt so the bootstrap can recover us again if we
      // get into another stuck state without manual intervention.
      lastLoginAt: null,
    },
  });
  await recordAudit({
    actorUserId: user.id,
    action: "superadmin.recover.success",
    entityType: "User",
    entityId: user.id,
    metadata: { email },
    severity: "CRITICAL",
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    message:
      "SuperAdmin password reset to SUPERADMIN_MASTER_KEY value. Sign in at /login and rotate the password from the SuperAdmin Settings page.",
  });
}
