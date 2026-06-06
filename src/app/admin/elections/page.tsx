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
import importDataRaw from "../../../../data/2025-general-election.json";

interface ImportCandidate {
  name: string;
  shorthandCode: string;
  partyCode: string | null;
  votes: number | null;
  votesPercent?: number | null;
  rank?: number | null;
  isWinner?: boolean;
}
interface ImportConstituency {
  code: string;
  candidates?: ImportCandidate[];
}
interface ImportFile {
  cycle: { name: string; electionDate: string; status?: string; notes?: string | null };
  constituencies: ImportConstituency[];
}
const importData = importDataRaw as unknown as ImportFile;

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

  const totalCandidatesIn2025 = importData.constituencies.reduce(
    (acc, c) => acc + (c.candidates?.length ?? 0),
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
            <Card>
              <CardHeader title="Import 2025 General Election" />
              <CardBody>
                <p className="text-xs text-gray-600">
                  Idempotent. Re-running updates existing rows by (cycle +
                  constituency + shorthandCode). Currently the JSON template
                  has <strong>{totalCandidatesIn2025} candidate(s)</strong> across{" "}
                  <strong>{importData.constituencies.length} constituency entries</strong>.
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Edit{" "}
                  <code className="rounded bg-gray-100 px-1 py-0.5">
                    data/2025-general-election.json
                  </code>{" "}
                  in the repo to add the rest of the 80 candidates before
                  running again.
                </p>
                <form action={runImport2025} className="mt-3">
                  <Button type="submit" variant="outline">
                    Import 2025 data now
                  </Button>
                </form>
              </CardBody>
            </Card>
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

const IMPORT_CYCLE_ID = "ge-2025";

async function runImport2025(): Promise<void> {
  "use server";
  const actor = await requireCampaignManager();
  if (!isSuperAdmin(actor)) {
    redirect(`/admin/elections?error=${encodeURIComponent("SuperAdmin only.")}`);
  }

  try {
    const cycle = await prisma.electionCycle.upsert({
      where: { id: IMPORT_CYCLE_ID },
      update: {
        name: importData.cycle.name,
        electionDate: new Date(importData.cycle.electionDate),
        status: importData.cycle.status ?? "COMPLETED",
        notes: importData.cycle.notes ?? null,
      },
      create: {
        id: IMPORT_CYCLE_ID,
        name: importData.cycle.name,
        electionDate: new Date(importData.cycle.electionDate),
        status: importData.cycle.status ?? "COMPLETED",
        notes: importData.cycle.notes ?? null,
      },
    });

    const constituencies = await prisma.constituency.findMany();
    const byCode = new Map(constituencies.map((c) => [c.code, c]));
    const parties = await prisma.party.findMany();
    const partyByCode = new Map(parties.map((p) => [p.code, p]));

    let candidatesInserted = 0;
    let candidatesUpdated = 0;
    let resultsRecorded = 0;
    const skipped: string[] = [];

    for (const entry of importData.constituencies) {
      const constituency = byCode.get(entry.code);
      if (!constituency) {
        skipped.push(entry.code);
        continue;
      }
      for (const candidateInput of entry.candidates ?? []) {
        const partyId = candidateInput.partyCode
          ? partyByCode.get(candidateInput.partyCode)?.id ?? null
          : null;

        const key = {
          electionCycleId: cycle.id,
          constituencyId: constituency.id,
          shorthandCode: candidateInput.shorthandCode,
        };
        const existing = await prisma.candidate.findUnique({
          where: { electionCycleId_constituencyId_shorthandCode: key },
        });
        const candidate = existing
          ? await prisma.candidate.update({
              where: { id: existing.id },
              data: {
                name: candidateInput.name,
                partyId,
                partyName:
                  !partyId && candidateInput.partyCode
                    ? candidateInput.partyCode
                    : null,
              },
            })
          : await prisma.candidate.create({
              data: {
                ...key,
                name: candidateInput.name,
                partyId,
                partyName:
                  !partyId && candidateInput.partyCode
                    ? candidateInput.partyCode
                    : null,
              },
            });

        if (existing) candidatesUpdated += 1;
        else candidatesInserted += 1;

        if (candidateInput.votes !== null && candidateInput.votes !== undefined) {
          await prisma.electionResult.upsert({
            where: {
              electionCycleId_candidateId: {
                electionCycleId: cycle.id,
                candidateId: candidate.id,
              },
            },
            update: {
              votesReceived: candidateInput.votes,
              votesPercent: candidateInput.votesPercent ?? null,
              isWinner: candidateInput.isWinner ?? false,
              source: "admin_button_2025",
            },
            create: {
              electionCycleId: cycle.id,
              constituencyId: constituency.id,
              candidateId: candidate.id,
              votesReceived: candidateInput.votes,
              votesPercent: candidateInput.votesPercent ?? null,
              isWinner: candidateInput.isWinner ?? false,
              source: "admin_button_2025",
            },
          });
          resultsRecorded += 1;
        }
      }
    }

    await recordAudit({
      actorUserId: actor.id,
      action: "election_cycle.import_2025",
      entityType: "ElectionCycle",
      entityId: cycle.id,
      metadata: {
        candidatesInserted,
        candidatesUpdated,
        resultsRecorded,
        skippedConstituencies: skipped,
      },
      severity: "WARN",
    });

    revalidatePath("/admin/elections");
    revalidatePath("/admin/candidates");

    const parts = [
      `Imported "${cycle.name}".`,
      `${candidatesInserted} candidate(s) created`,
      `${candidatesUpdated} updated`,
      `${resultsRecorded} result(s) recorded`,
    ];
    if (skipped.length > 0) {
      parts.push(`skipped constituency codes: ${skipped.join(", ")}`);
    }
    redirect(`/admin/elections?notice=${encodeURIComponent(parts.join(". "))}`);
  } catch (err) {
    // redirect() throws internally; let it propagate.
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
