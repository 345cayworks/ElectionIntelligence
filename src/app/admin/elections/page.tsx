import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCampaignManager } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit/log";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Field, Select, Textarea } from "@/components/ui/Input";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { ELECTION_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const ElectionCycleSchema = z.object({
  name: z.string().min(2).max(120),
  electionDate: z.string().refine((v) => !isNaN(new Date(v).getTime()), "Invalid date"),
  status: z.enum(ELECTION_STATUSES),
  notes: z.string().max(500).optional(),
});

export default async function ElectionsPage({
  searchParams,
}: {
  searchParams?: { notice?: string; error?: string };
}) {
  await requireCampaignManager();

  const cycles = await prisma.electionCycle.findMany({
    orderBy: { electionDate: "desc" },
    include: { _count: { select: { candidates: true, importBatches: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Election cycles"
        description="Configure the elections this platform supports."
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="All cycles" />
            <CardBody>
              {cycles.length === 0 ? (
                <EmptyState
                  title="No election cycles yet"
                  description="Create your first cycle to start configuring the platform."
                />
              ) : (
                <Table>
                  <THead>
                    <TH>Name</TH>
                    <TH>Date</TH>
                    <TH>Status</TH>
                    <TH>Candidates</TH>
                    <TH>Imports</TH>
                  </THead>
                  <TBody>
                    {cycles.map((c) => (
                      <TR key={c.id}>
                        <TD>{c.name}</TD>
                        <TD>{formatDate(c.electionDate)}</TD>
                        <TD>
                          <StatusBadge status={c.status} />
                        </TD>
                        <TD>{c._count.candidates}</TD>
                        <TD>{c._count.importBatches}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="New election cycle" />
          <CardBody>
            <form action={createElectionCycle} className="space-y-3">
              <Field label={<Label>Name</Label>}>
                <Input name="name" required placeholder="2025 General Election" />
              </Field>
              <Field label={<Label>Election date</Label>}>
                <Input name="electionDate" type="date" required />
              </Field>
              <Field label={<Label>Status</Label>}>
                <Select name="status" defaultValue="PLANNING">
                  {ELECTION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={<Label>Notes</Label>}>
                <Textarea name="notes" rows={3} placeholder="Optional" />
              </Field>
              <Button type="submit">Create cycle</Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

async function createElectionCycle(formData: FormData) {
  "use server";
  const actor = await requireCampaignManager();
  const parsed = ElectionCycleSchema.safeParse({
    name: formData.get("name"),
    electionDate: formData.get("electionDate"),
    status: formData.get("status"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    const msg = encodeURIComponent(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
    redirect(`/admin/elections?error=${msg}`);
  }
  const created = await prisma.electionCycle.create({
    data: {
      name: parsed.data.name,
      electionDate: new Date(parsed.data.electionDate),
      status: parsed.data.status,
      notes: parsed.data.notes ?? null,
    },
  });
  await recordAudit({
    actorUserId: actor.id,
    action: "election_cycle.create",
    entityType: "ElectionCycle",
    entityId: created.id,
    metadata: { name: created.name },
  });
  revalidatePath("/admin/elections");
  redirect("/admin/elections?notice=Election+cycle+created");
}
