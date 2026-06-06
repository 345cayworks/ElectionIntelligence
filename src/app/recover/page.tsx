import crypto from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit/log";
import { Button } from "@/components/ui/Button";
import { Input, Label, Field } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

// Browser-friendly recovery flow. Same trust model as the
// /api/admin/recover-superadmin JSON endpoint - anyone with the master
// key can reset the SuperAdmin password. This page just removes the
// "you must know how to curl" usability footgun.

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

export default async function RecoverPage({
  searchParams,
}: {
  searchParams?: { error?: string; notice?: string };
}) {
  const defaultEmail = (process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const recoveryAvailable = ((process.env.SUPERADMIN_MASTER_KEY ?? "").trim()).length >= 16;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-base font-semibold text-gray-900">{env.appName}</h1>
        <p className="mt-1 text-sm text-gray-500">SuperAdmin password recovery.</p>

        {searchParams?.notice ? (
          <div className="mt-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
            {searchParams.notice}
          </div>
        ) : null}
        {searchParams?.error ? (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {decodeURIComponent(searchParams.error)}
          </div>
        ) : null}

        {!recoveryAvailable ? (
          <div className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Recovery is unavailable because <code>SUPERADMIN_MASTER_KEY</code> is
            not set on this deployment (or is shorter than 16 chars). Configure
            it in Netlify env vars and redeploy first.
          </div>
        ) : (
          <form action={recover} className="mt-5 space-y-3">
            <Field label={<Label>SuperAdmin email</Label>}>
              <Input
                type="email"
                name="email"
                required
                autoComplete="email"
                defaultValue={defaultEmail}
              />
            </Field>
            <Field
              label={<Label>Master key</Label>}
              hint="The value currently stored in SUPERADMIN_MASTER_KEY on Netlify."
            >
              <PasswordInput
                name="masterKey"
                required
                autoComplete="off"
              />
            </Field>
            <Button type="submit" className="w-full">
              Reset SuperAdmin password
            </Button>
          </form>
        )}

        <div className="mt-4 text-xs text-gray-500">
          Once you sign in, rotate the password from <em>SuperAdmin Settings</em>.
          Every attempt on this page is recorded in the audit log at CRITICAL
          severity.
        </div>
      </div>
    </main>
  );
}

async function recover(formData: FormData) {
  "use server";

  const configured = (process.env.SUPERADMIN_MASTER_KEY ?? "").trim();
  if (configured.length < 16) {
    redirect(
      `/recover?error=${encodeURIComponent("Recovery is unavailable: SUPERADMIN_MASTER_KEY is not configured.")}`,
    );
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const masterKey = String(formData.get("masterKey") ?? "");

  if (!email || !masterKey) {
    redirect(`/recover?error=${encodeURIComponent("Email and master key are required.")}`);
  }
  if (!safeEqual(masterKey, configured)) {
    await recordAudit({
      action: "superadmin.recover.failed",
      metadata: { email, reason: "master_key_mismatch", source: "recover_page" },
      severity: "CRITICAL",
    }).catch(() => {});
    redirect(
      `/recover?error=${encodeURIComponent("Master key does not match SUPERADMIN_MASTER_KEY.")}`,
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await recordAudit({
      action: "superadmin.recover.failed",
      metadata: { email, reason: "user_not_found", source: "recover_page" },
      severity: "CRITICAL",
    }).catch(() => {});
    redirect(
      `/recover?error=${encodeURIComponent(`No user found with email ${email}. Visit the home page once to trigger the bootstrap, then retry.`)}`,
    );
  }
  if (user.role !== "SUPER_ADMIN") {
    await recordAudit({
      actorUserId: user.id,
      action: "superadmin.recover.failed",
      metadata: { email, reason: "not_a_superadmin", source: "recover_page" },
      severity: "CRITICAL",
    }).catch(() => {});
    redirect(
      `/recover?error=${encodeURIComponent("That user exists but is not a SuperAdmin.")}`,
    );
  }

  const passwordHash = await hashPassword(masterKey);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      status: "ACTIVE",
      forcePasswordReset: true,
      lastLoginAt: null,
    },
  });
  await recordAudit({
    actorUserId: user.id,
    action: "superadmin.recover.success",
    entityType: "User",
    entityId: user.id,
    metadata: { email, source: "recover_page" },
    severity: "CRITICAL",
  }).catch(() => {});

  redirect(
    `/recover?notice=${encodeURIComponent(`Password reset for ${email}. Go to /login and sign in with this email and the master key. Then rotate the password from SuperAdmin Settings.`)}`,
  );
}
