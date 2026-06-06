import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit/log";
import { hashPassword } from "@/lib/auth/password";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Field, Select } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/SidebarLayout";
import {
  env,
  isAdEngineBaseUrlConfigured,
  isAdEngineKeyConfigured,
  isAdEnginePlatformConfigured,
  isSuperAdminEmailConfigured,
  isSuperAdminMasterKeyConfigured,
} from "@/lib/env";
import { isMasterKeyConfigured, verifyMasterKey } from "@/lib/auth/superadmin-key";
import { listPlacements } from "@/lib/ads/placements";

export const dynamic = "force-dynamic";

interface SettingsSearchParams {
  notice?: string;
  error?: string;
  tab?: string;
}

export default async function SuperAdminSettingsPage({
  searchParams,
}: {
  searchParams?: SettingsSearchParams;
}) {
  const user = await requireSuperAdmin();

  const [superAdmins, placements] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SUPER_ADMIN" },
      orderBy: { email: "asc" },
    }),
    listPlacements(),
  ]);

  const adminUsers = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "CAMPAIGN_ADMIN"] } },
    orderBy: { email: "asc" },
  });

  const trackingOk =
    env.tracking.enabled &&
    (env.tracking.gaMeasurementId.length > 0 ||
      env.tracking.googleTagId.length > 0 ||
      env.tracking.metaPixelId.length > 0);

  const adsKeyConfigured = isAdEngineKeyConfigured();
  const adsBaseConfigured = isAdEngineBaseUrlConfigured();
  const adsPlatformConfigured = isAdEnginePlatformConfigured();

  return (
    <div>
      <PageHeader
        title="SuperAdmin Settings"
        description="Manage tracking, SuperAdmin access, Cayworks Ads Engine, and environment status."
      />

      {searchParams?.notice ? (
        <div className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          {searchParams.notice}
        </div>
      ) : null}
      {searchParams?.error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {searchParams.error}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Tracking"
          value={trackingOk ? "Active" : "Off"}
          accent={trackingOk ? "green" : "gray"}
          hint={env.tracking.enabled ? "Enabled in env" : "Disabled in env"}
        />
        <StatCard
          label="Ads Engine"
          value={adsKeyConfigured ? "Connected" : "Not configured"}
          accent={adsKeyConfigured ? "green" : "gray"}
          hint={adsKeyConfigured ? "Key present" : "Set AD_ENGINE_KEY"}
        />
        <StatCard
          label="SuperAdmins"
          value={superAdmins.length}
          accent={superAdmins.length > 1 ? "green" : "yellow"}
          hint="Maintain at least 2 SuperAdmins"
        />
        <StatCard
          label="Master Key"
          value={isSuperAdminMasterKeyConfigured() ? "Set" : "Missing"}
          accent={isSuperAdminMasterKeyConfigured() ? "green" : "red"}
          hint="SUPERADMIN_MASTER_KEY status only"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* A. Tracking & Analytics */}
        <Card>
          <CardHeader
            title="Tracking & Analytics"
            description="Google and Meta integration"
          />
          <CardBody>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <Row
                label="NEXT_PUBLIC_ENABLE_TRACKING"
                value={env.tracking.enabled ? "true" : "false"}
                tone={env.tracking.enabled ? "green" : "gray"}
              />
              <Row
                label="NEXT_PUBLIC_GA_MEASUREMENT_ID"
                value={env.tracking.gaMeasurementId ? "configured" : "missing"}
                tone={env.tracking.gaMeasurementId ? "green" : "gray"}
              />
              <Row
                label="NEXT_PUBLIC_GOOGLE_TAG_ID"
                value={env.tracking.googleTagId ? "configured" : "missing"}
                tone={env.tracking.googleTagId ? "green" : "gray"}
              />
              <Row
                label="NEXT_PUBLIC_META_PIXEL_ID"
                value={env.tracking.metaPixelId ? "configured" : "missing"}
                tone={env.tracking.metaPixelId ? "green" : "gray"}
              />
            </div>
            <div className="mt-3 rounded bg-gray-50 p-3 text-xs text-gray-600">
              Tracking IDs are configured via environment variables on the host
              (Netlify, Vercel, etc). Update your hosting provider and redeploy
              to change them. No tracking is sent when disabled.
            </div>
          </CardBody>
        </Card>

        {/* B. SuperAdmin Access */}
        <Card>
          <CardHeader
            title="SuperAdmin Access"
            description="Manage who can administer the platform"
          />
          <CardBody>
            <ul className="mb-3 divide-y divide-gray-100 rounded border border-gray-200">
              {superAdmins.map((sa) => (
                <li
                  key={sa.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {sa.name ?? sa.email}
                    </div>
                    <div className="text-xs text-gray-500">{sa.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={sa.status === "ACTIVE" ? "green" : "gray"}>
                      {sa.status}
                    </Badge>
                    {superAdmins.length > 1 && sa.id !== user.id ? (
                      <form action={demoteSuperAdmin}>
                        <input type="hidden" name="userId" value={sa.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                        >
                          Demote
                        </Button>
                      </form>
                    ) : (
                      <Badge tone="gray">protected</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <form action={addSuperAdmin} className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label={<Label>Email</Label>}>
                <Input name="email" type="email" required placeholder="new@example.com" />
              </Field>
              <Field label={<Label>Temporary password</Label>}>
                <PasswordInput
                  name="password"
                  required
                  minLength={10}
                  placeholder="Min 10 characters"
                />
              </Field>
              <div className="sm:col-span-2">
                <Button type="submit">Add SuperAdmin</Button>
              </div>
            </form>

            <Card className="bg-gray-50">
              <CardBody>
                <div className="text-sm font-semibold text-gray-800">
                  Force password reset
                </div>
                <p className="mb-2 text-xs text-gray-500">
                  Marks the account so the user must reset password on next login.
                </p>
                <form action={forcePasswordReset} className="flex gap-2">
                  <Select name="userId" defaultValue="">
                    <option value="" disabled>
                      Select user
                    </option>
                    {adminUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.email} ({u.role.replace(/_/g, " ")})
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" variant="outline">
                    Mark
                  </Button>
                </form>
              </CardBody>
            </Card>

            <div className="mt-4 rounded border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-900">
              <div className="font-semibold">SUPERADMIN_MASTER_KEY</div>
              <div className="mt-1">
                Status:{" "}
                <Badge tone={isMasterKeyConfigured() ? "green" : "red"}>
                  {isMasterKeyConfigured() ? "configured" : "missing"}
                </Badge>{" "}
                — never displayed. To rotate, update the host secret and redeploy.
              </div>
              <form action={rotateMasterKey} className="mt-2 flex flex-col gap-2 sm:flex-row">
                <PasswordInput
                  name="currentKey"
                  placeholder="Enter current master key to confirm"
                  required
                />
                <Button type="submit" variant="outline" size="sm">
                  Audit rotation intent
                </Button>
              </form>
            </div>
          </CardBody>
        </Card>

        {/* C. Cayworks Ads Engine */}
        <Card>
          <CardHeader
            title="Cayworks Ads Engine"
            description="Integration with ads.cayworks.com"
          />
          <CardBody>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <Row
                label="NEXT_PUBLIC_ENABLE_ADS"
                value={env.ads.publicEnabled ? "true" : "false"}
                tone={env.ads.publicEnabled ? "green" : "gray"}
              />
              <Row label="AD_ENGINE_BASE_URL" value={env.ads.baseUrl} tone="gray" />
              <Row label="AD_ENGINE_PLATFORM" value={env.ads.platform} tone="gray" />
              <Row
                label="AD_ENGINE_KEY"
                value={adsKeyConfigured ? "configured" : "missing"}
                tone={adsKeyConfigured ? "green" : "red"}
              />
            </div>

            <div className="mt-4">
              <div className="mb-1 text-xs font-semibold text-gray-700">
                Registered placements
              </div>
              <ul className="rounded border border-gray-200 text-xs">
                {placements.map((p) => (
                  <li
                    key={p.key}
                    className="flex items-center justify-between border-b border-gray-100 px-3 py-2 last:border-b-0"
                  >
                    <div>
                      <div className="font-mono">{p.key}</div>
                      {p.description ? (
                        <div className="text-gray-500">{p.description}</div>
                      ) : null}
                    </div>
                    <form action={togglePlacement} className="inline-flex items-center gap-2">
                      <input type="hidden" name="key" value={p.key} />
                      <input
                        type="hidden"
                        name="enable"
                        value={p.enabled ? "false" : "true"}
                      />
                      <Badge tone={p.enabled ? "green" : "gray"}>
                        {p.enabled ? "enabled" : "disabled"}
                      </Badge>
                      <Button type="submit" variant="ghost" size="sm">
                        {p.enabled ? "Disable" : "Enable"}
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="/admin/ads-test"
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Open ads tester
              </a>
            </div>
          </CardBody>
        </Card>

        {/* D. Security & Environment Status */}
        <Card>
          <CardHeader
            title="Security & Environment Status"
            description="Safe indicators only - no secrets displayed"
          />
          <CardBody>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <Row
                label="SUPER_ADMIN_EMAIL"
                value={isSuperAdminEmailConfigured() ? "configured" : "missing"}
                tone={isSuperAdminEmailConfigured() ? "green" : "red"}
              />
              <Row
                label="SUPERADMIN_MASTER_KEY"
                value={isSuperAdminMasterKeyConfigured() ? "configured" : "missing"}
                tone={isSuperAdminMasterKeyConfigured() ? "green" : "red"}
              />
              <Row
                label="AD_ENGINE_KEY"
                value={adsKeyConfigured ? "configured" : "missing"}
                tone={adsKeyConfigured ? "green" : "red"}
              />
              <Row
                label="AD_ENGINE_BASE_URL"
                value={adsBaseConfigured ? "configured" : "default"}
                tone={adsBaseConfigured ? "green" : "yellow"}
              />
              <Row
                label="AD_ENGINE_PLATFORM"
                value={adsPlatformConfigured ? "configured" : "default"}
                tone={adsPlatformConfigured ? "green" : "yellow"}
              />
              <Row
                label="Tracking IDs"
                value={
                  env.tracking.gaMeasurementId ||
                  env.tracking.googleTagId ||
                  env.tracking.metaPixelId
                    ? "configured"
                    : "missing"
                }
                tone={
                  env.tracking.gaMeasurementId ||
                  env.tracking.googleTagId ||
                  env.tracking.metaPixelId
                    ? "green"
                    : "gray"
                }
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "gray" | "yellow" | "red";
}) {
  return (
    <div className="flex items-center justify-between rounded bg-gray-50 px-2 py-1.5">
      <span className="font-mono text-gray-700">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}

// ---------------------- Server Actions ----------------------

async function addSuperAdmin(formData: FormData) {
  "use server";
  const actor = await requireSuperAdmin();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || password.length < 10) {
    redirect("/admin/settings?error=Provide+valid+email+and+10%2B+char+password");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && (existing.role === "SUPER_ADMIN" || existing.role === "CAMPAIGN_ADMIN")) {
    if (existing.role !== "SUPER_ADMIN") {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "SUPER_ADMIN", status: "ACTIVE" },
      });
    }
    await recordAudit({
      actorUserId: actor.id,
      action: "superadmin.promote",
      entityType: "User",
      entityId: existing.id,
      metadata: { email },
      severity: "CRITICAL",
    });
    revalidatePath("/admin/settings");
    redirect("/admin/settings?notice=Existing+user+promoted+to+SuperAdmin");
  }

  const passwordHash = await hashPassword(password);
  const created = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { role: "SUPER_ADMIN", status: "ACTIVE", passwordHash, forcePasswordReset: true },
      })
    : await prisma.user.create({
        data: {
          email,
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          passwordHash,
          forcePasswordReset: true,
        },
      });

  await recordAudit({
    actorUserId: actor.id,
    action: "superadmin.create",
    entityType: "User",
    entityId: created.id,
    metadata: { email },
    severity: "CRITICAL",
  });

  revalidatePath("/admin/settings");
  redirect("/admin/settings?notice=SuperAdmin+added");
}

async function demoteSuperAdmin(formData: FormData) {
  "use server";
  const actor = await requireSuperAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) redirect("/admin/settings?error=Missing+user");

  if (userId === actor.id) {
    redirect("/admin/settings?error=You+cannot+demote+yourself");
  }

  const remainingCount = await prisma.user.count({
    where: { role: "SUPER_ADMIN", id: { not: userId } },
  });
  if (remainingCount < 1) {
    redirect("/admin/settings?error=Cannot+remove+the+final+SuperAdmin");
  }

  const target = await prisma.user.update({
    where: { id: userId },
    data: { role: "CAMPAIGN_ADMIN" },
  });

  await recordAudit({
    actorUserId: actor.id,
    action: "superadmin.demote",
    entityType: "User",
    entityId: target.id,
    metadata: { email: target.email },
    severity: "CRITICAL",
  });

  revalidatePath("/admin/settings");
  redirect("/admin/settings?notice=SuperAdmin+demoted+to+Campaign+Admin");
}

async function forcePasswordReset(formData: FormData) {
  "use server";
  const actor = await requireSuperAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) redirect("/admin/settings?error=Missing+user");

  await prisma.user.update({
    where: { id: userId },
    data: { forcePasswordReset: true },
  });
  await recordAudit({
    actorUserId: actor.id,
    action: "superadmin.force_password_reset",
    entityType: "User",
    entityId: userId,
    severity: "SENSITIVE",
  });
  revalidatePath("/admin/settings");
  redirect("/admin/settings?notice=Password+reset+required+on+next+login");
}

async function togglePlacement(formData: FormData) {
  "use server";
  const actor = await requireSuperAdmin();
  const key = String(formData.get("key") ?? "");
  const enable = String(formData.get("enable") ?? "") === "true";
  if (!key) redirect("/admin/settings?error=Missing+key");

  await prisma.adPlacement.update({
    where: { key },
    data: { enabled: enable },
  });
  await recordAudit({
    actorUserId: actor.id,
    action: "ads.placement.toggle",
    entityType: "AdPlacement",
    entityId: key,
    metadata: { enabled: enable },
    severity: "SENSITIVE",
  });
  // invalidate cache so the new state is reflected immediately
  const { invalidatePlacementCache } = await import("@/lib/ads/placements");
  invalidatePlacementCache();
  revalidatePath("/admin/settings");
  redirect("/admin/settings?notice=Placement+updated");
}

async function rotateMasterKey(formData: FormData) {
  "use server";
  const actor = await requireSuperAdmin();
  const currentKey = String(formData.get("currentKey") ?? "");
  if (!verifyMasterKey(currentKey)) {
    redirect("/admin/settings?error=Master+key+verification+failed");
  }
  await recordAudit({
    actorUserId: actor.id,
    action: "superadmin.master_key.rotation_intent",
    severity: "CRITICAL",
    metadata: { note: "Actual rotation requires updating the hosting env var" },
  });
  redirect("/admin/settings?notice=Audit+entry+recorded.+Rotate+key+in+host+env+and+redeploy.");
}
