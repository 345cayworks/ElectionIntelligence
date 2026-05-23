import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit/log";
import { getSetting, setSetting, SETTING_KEYS } from "@/lib/settings/store";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Field } from "@/components/ui/Input";

export const dynamic = "force-dynamic";

const Schema = z.object({
  auditLogDays: z.coerce.number().int().min(30).max(3650),
  visitDays: z.coerce.number().int().min(30).max(3650),
});

export default async function DataRetentionPage({
  searchParams,
}: {
  searchParams?: { notice?: string; error?: string };
}) {
  await requireAdmin();

  const auditDays = await getSetting<number>(SETTING_KEYS.RETENTION_AUDIT_DAYS, 730);
  const visitDays = await getSetting<number>(SETTING_KEYS.RETENTION_VISIT_DAYS, 730);

  return (
    <div>
      <PageHeader
        title="Data retention"
        description="Configure how long sensitive records are retained after an election cycle archives."
      />
      {searchParams?.notice ? (
        <div className="mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          {searchParams.notice}
        </div>
      ) : null}
      {searchParams?.error ? (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {searchParams.error}
        </div>
      ) : null}
      <Card>
        <CardHeader title="Retention policy" />
        <CardBody>
          <form action={saveRetention} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label={<Label>Audit log retention (days)</Label>}
              hint="Audit entries older than this can be archived by an off-platform job."
            >
              <Input
                name="auditLogDays"
                type="number"
                min={30}
                max={3650}
                defaultValue={auditDays}
                required
              />
            </Field>
            <Field
              label={<Label>Canvass visit retention (days)</Label>}
              hint="Visit records older than this are eligible for archival."
            >
              <Input
                name="visitDays"
                type="number"
                min={30}
                max={3650}
                defaultValue={visitDays}
                required
              />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">Save policy</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Manual archive triggers"
          description="Runs in the foreground - use for end-of-cycle housekeeping."
        />
        <CardBody>
          <form action={archiveOldVisits} className="space-y-2 text-sm">
            <p className="text-xs text-gray-600">
              Mark canvass visits older than the configured retention period as archived.
              This does not delete them - it sets the result to <code>ARCHIVED</code>.
            </p>
            <Button type="submit" variant="outline">
              Run visit archive
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

async function saveRetention(formData: FormData) {
  "use server";
  const user = await requireAdmin();
  const parsed = Schema.safeParse({
    auditLogDays: formData.get("auditLogDays"),
    visitDays: formData.get("visitDays"),
  });
  if (!parsed.success) {
    redirect(`/admin/data-retention?error=${encodeURIComponent("Invalid input")}`);
  }
  await setSetting(SETTING_KEYS.RETENTION_AUDIT_DAYS, parsed.data.auditLogDays, user.id);
  await setSetting(SETTING_KEYS.RETENTION_VISIT_DAYS, parsed.data.visitDays, user.id);
  await recordAudit({
    actorUserId: user.id,
    action: "retention.policy.update",
    severity: "SENSITIVE",
    metadata: parsed.data,
  });
  revalidatePath("/admin/data-retention");
  redirect("/admin/data-retention?notice=Retention+policy+saved");
}

async function archiveOldVisits() {
  "use server";
  const user = await requireAdmin();
  const visitDays = await getSetting<number>(SETTING_KEYS.RETENTION_VISIT_DAYS, 730);
  const cutoff = new Date(Date.now() - visitDays * 24 * 60 * 60 * 1000);
  const result = await prisma.canvassVisit.updateMany({
    where: { visitDate: { lt: cutoff } },
    data: { notes: { set: "[archived]" } },
  });
  await recordAudit({
    actorUserId: user.id,
    action: "retention.archive_visits",
    severity: "SENSITIVE",
    metadata: { count: result.count, visitDays },
  });
  redirect(`/admin/data-retention?notice=${encodeURIComponent(`Archived ${result.count} visits`)}`);
}
