import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { ensureSuperAdminBootstrap } from "@/lib/auth/superadmin-bootstrap";
import { recordAudit } from "@/lib/audit/log";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await ensureSuperAdminBootstrap();

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.redirect(new URL("/login?error=invalid", req.url), { status: 303 });
  }

  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!email || !password) {
    return NextResponse.redirect(new URL("/login?error=invalid", req.url), { status: 303 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    await recordAudit({
      action: "auth.login.failed",
      metadata: { email, reason: "no_user" },
      severity: "WARN",
    });
    return NextResponse.redirect(new URL("/login?error=invalid", req.url), { status: 303 });
  }

  if (user.status !== "ACTIVE") {
    await recordAudit({
      actorUserId: user.id,
      action: "auth.login.failed",
      metadata: { reason: "disabled" },
      severity: "WARN",
    });
    return NextResponse.redirect(new URL("/login?error=disabled", req.url), { status: 303 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await recordAudit({
      actorUserId: user.id,
      action: "auth.login.failed",
      metadata: { reason: "bad_password" },
      severity: "WARN",
    });
    return NextResponse.redirect(new URL("/login?error=invalid", req.url), { status: 303 });
  }

  await createSession(user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await recordAudit({
    actorUserId: user.id,
    action: "auth.login.success",
    severity: "INFO",
  });

  return NextResponse.redirect(new URL("/app/dashboard", req.url), { status: 303 });
}
