import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { ensureSuperAdminBootstrap } from "@/lib/auth/superadmin-bootstrap";
import { recordAudit } from "@/lib/audit/log";

export const dynamic = "force-dynamic";

// Translate Prisma connection / schema errors into a redirect with a clear
// error code so users see actionable feedback instead of the platform's
// generic crash page.
function dbErrorRedirect(req: NextRequest, err: unknown): NextResponse {
  const code = (err as { code?: string }).code;
  const reason =
    code === "P2021"
      ? "db_not_initialized"
      : code === "P1001" || code === "P1003"
        ? "db_unreachable"
        : code === "P1000"
          ? "db_auth"
          : "db_error";
  // eslint-disable-next-line no-console
  console.error("[auth] login database error", { code, message: (err as Error).message });
  return NextResponse.redirect(
    new URL(`/login?error=db&reason=${reason}`, req.url),
    { status: 303 },
  );
}

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

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      await recordAudit({
        action: "auth.login.failed",
        metadata: { email, reason: "no_user" },
        severity: "WARN",
      }).catch(() => {
        /* audit failure must not block sign-in error response */
      });
      return NextResponse.redirect(new URL("/login?error=invalid", req.url), { status: 303 });
    }

    if (user.status !== "ACTIVE") {
      await recordAudit({
        actorUserId: user.id,
        action: "auth.login.failed",
        metadata: { reason: "disabled" },
        severity: "WARN",
      }).catch(() => {
        /* ignore */
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
      }).catch(() => {
        /* ignore */
      });
      return NextResponse.redirect(new URL("/login?error=invalid", req.url), { status: 303 });
    }

    await createSession(user.id);
    await prisma.user
      .update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })
      .catch(() => {
        /* lastLoginAt is non-critical */
      });
    await recordAudit({
      actorUserId: user.id,
      action: "auth.login.success",
      severity: "INFO",
    }).catch(() => {
      /* ignore */
    });

    return NextResponse.redirect(new URL("/app/dashboard", req.url), { status: 303 });
  } catch (err) {
    return dbErrorRedirect(req, err);
  }
}
