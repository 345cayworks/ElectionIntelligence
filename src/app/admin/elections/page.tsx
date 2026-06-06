import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCampaignManager } from "@/lib/auth/guards";
import { isSuperAdmin } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit/log";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Field, Select, Textarea } from "@/components/ui/Input";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { ELECTION_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { importCycle, type ImportCycle } from "@/lib/elections-import";
import data2025Raw from "../../../../data/2025-general-election.json";
import historyRaw from "../../../../data/elections-history.json";

interface Data2025 {
  cycle: {
    name: string;
    electionDate: string;
    status?: string;
    notes?: string | null;
  };
  constituencies: ImportCycle["constituencies"];
}
const data2025 = data2025Raw as unknown as Data2025;
const data2025Cycle: ImportCycle = {
  id: "ge-2025",
  name: data2025.cycle.name,
  electionDate: data2025.cycle.electionDate,
  status: data2025.cycle.status,
  notes: data2025.cycle.notes,
  constituencies: data2025.constituencies,
};

interface HistoryFile {
  cycles: ImportCycle[];
}
const history = historyRaw as unknown as HistoryFile;

function totalCandidates(c: ImportCycle): number {
  return c.constituencies.reduce(
    (acc, x) => acc + (x.candidates?.length ?? 0),
    0,
  );
}

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
  const actor = await requireCampaignManager();
  const showImportButton = isSuperAdmin(actor);

  const cycles = await prisma.electionCycle.findMany({
    orderBy: { electionDate: "desc" },
    include: { _count: { select: { candidates: true, importBatches: true } } },
  });

  const totalCandidatesIn2025 = totalCandidates(data2025Cycle);
  const totalCandidatesInHistory = history.cycles.reduce(
    (acc, c) => acc + totalCandidates(c),
    0,
  );

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

        <div className="space-y-6">
          {showImportButton ? (
            <>
              <Card>
                <CardHeader title="Import 2025 General Election" />
                <CardBody>
                  <p className="text-xs text-gray-600">
                    Idempotent. Re-running updates existing rows by (cycle +
                    constituency + shorthandCode). JSON template currently
                    has <strong>{totalCandidatesIn2025} candidate(s)</strong>.
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    Edit{" "}
                    <code className="rounded bg-gray-100 px-1 py-0.5">
                      data/2025-general-election.json
                    </code>{" "}
                    to add the rest of the 80 candidates.
                  </p>
                  <form action={runImport2025} className="mt-3">
                    <Button type="submit" variant="outline">
                      Import 2025 data now
                    </Button>
                  </form>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Import historical cycles (2021 + 2017)" />
                <CardBody>
                  <p className="text-xs text-gray-600">
                    Creates {history.cycles.length} prior cycles with the same
                    19-constituency framework. Currently{" "}
                    <strong>{totalCandidatesInHistory} candidate(s)</strong>{" "}
                    filled in - add more by editing{" "}
                    <code className="rounded bg-gray-100 px-1 py-0.5">
                      data/elections-history.json
                    </code>
                    .
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    Useful for incumbent / margin / turnout analysis once
                    candidate data is filled in.
                  </p>
                  <form action={runImportHistory} className="mt-3">
                    <Button type="submit" variant="outline">
                      Import historical cycles
                    </Button>
                  </form>
                </CardBody>
              </Card>
            </>
          ) : null}

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
    </div>
  );
}

function summaryToBanner(
  s: {
    cycleName: string;
    candidatesInserted: number;
    candidatesUpdated: number;
    resultsRecorded: number;
    skippedConstituencyCodes: string[];
  },
): string {
  const parts = [
    `"${s.cycleName}":`,
    `${s.candidatesInserted} candidate(s) created`,
    `${s.candidatesUpdated} updated`,
    `${s.resultsRecorded} result(s) recorded`,
  ];
  if (s.skippedConstituencyCodes.length > 0) {
    parts.push(`skipped: ${s.skippedConstituencyCodes.join(", ")}`);
  }
  return parts.join(", ");
}

async function runImport2025(): Promise<void> {
  "use server";
  const actor = await requireCampaignManager();
  if (!isSuperAdmin(actor)) {
    redirect(`/admin/elections?error=${encodeURIComponent("SuperAdmin only.")}`);
  }
  try {
    const summary = await importCycle(data2025Cycle, "admin_button_2025");
    await recordAudit({
      actorUserId: actor.id,
      action: "election_cycle.import",
      entityType: "ElectionCycle",
      entityId: summary.cycleId,
      metadata: { ...summary, source: "button_2025" },
      severity: "WARN",
    });
    revalidatePath("/admin/elections");
    revalidatePath("/admin/candidates");
    redirect(
      `/admin/elections?notice=${encodeURIComponent("Imported " + summaryToBanner(summary))}`,
    );
  } catch (err) {
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
    const msg = err instanceof Error ? err.message : "Import failed";
    redirect(`/admin/elections?error=${encodeURIComponent(`Import failed: ${msg}`)}`);
  }
}

async function runImportHistory(): Promise<void> {
  "use server";
  const actor = await requireCampaignManager();
  if (!isSuperAdmin(actor)) {
    redirect(`/admin/elections?error=${encodeURIComponent("SuperAdmin only.")}`);
  }
  try {
    const summaries: string[] = [];
    for (const c of history.cycles) {
      const summary = await importCycle(c, "admin_button_history");
      await recordAudit({
        actorUserId: actor.id,
        action: "election_cycle.import",
        entityType: "ElectionCycle",
        entityId: summary.cycleId,
        metadata: { ...summary, source: "button_history" },
        severity: "WARN",
      });
      summaries.push(summaryToBanner(summary));
    }
    revalidatePath("/admin/elections");
    revalidatePath("/admin/candidates");
    redirect(
      `/admin/elections?notice=${encodeURIComponent("Imported " + summaries.join(" | "))}`,
    );
  } catch (err) {
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
    const msg = err instanceof Error ? err.message : "Import failed";
    redirect(`/admin/elections?error=${encodeURIComponent(`Import failed: ${msg}`)}`);
  }
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
