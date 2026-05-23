import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCampaignManager } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit/log";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Field, Select } from "@/components/ui/Input";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

const CandidateSchema = z.object({
  electionCycleId: z.string().min(1),
  constituencyId: z.string().min(1),
  name: z.string().min(2).max(120),
  shorthandCode: z.string().min(1).max(20),
  party: z.string().max(80).optional(),
  isPrimary: z.preprocess((v) => v === "on" || v === "true", z.boolean()).optional(),
});

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams?: { notice?: string; error?: string };
}) {
  await requireCampaignManager();

  const [candidates, cycles, constituencies] = await Promise.all([
    prisma.candidate.findMany({
      orderBy: { name: "asc" },
      include: { constituency: true, electionCycle: true },
    }),
    prisma.electionCycle.findMany({ orderBy: { electionDate: "desc" } }),
    prisma.constituency.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Candidates"
        description="Configure candidates and their shorthand codes for each constituency."
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
            <CardHeader title="All candidates" />
            <CardBody>
              {candidates.length === 0 ? (
                <EmptyState title="No candidates yet" />
              ) : (
                <Table>
                  <THead>
                    <TH>Name</TH>
                    <TH>Code</TH>
                    <TH>Party</TH>
                    <TH>Constituency</TH>
                    <TH>Cycle</TH>
                    <TH>Primary</TH>
                  </THead>
                  <TBody>
                    {candidates.map((c) => (
                      <TR key={c.id}>
                        <TD>{c.name}</TD>
                        <TD>
                          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
                            {c.shorthandCode}
                          </code>
                        </TD>
                        <TD>{c.party ?? "—"}</TD>
                        <TD>{c.constituency.name}</TD>
                        <TD>{c.electionCycle.name}</TD>
                        <TD>
                          {c.isPrimaryCampaignCandidate ? (
                            <Badge tone="green">Yes</Badge>
                          ) : (
                            <Badge tone="gray">No</Badge>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader title="New candidate" />
          <CardBody>
            {cycles.length === 0 || constituencies.length === 0 ? (
              <div className="text-xs text-gray-500">
                Create at least one election cycle and constituency first.
              </div>
            ) : (
              <form action={createCandidate} className="space-y-3">
                <Field label={<Label>Election cycle</Label>}>
                  <Select name="electionCycleId" required>
                    {cycles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={<Label>Constituency</Label>}>
                  <Select name="constituencyId" required>
                    {constituencies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={<Label>Name</Label>}>
                  <Input name="name" required placeholder="First Last" />
                </Field>
                <Field
                  label={<Label>Shorthand code</Label>}
                  hint="e.g. DT, PPM, NMW (configurable, not hardcoded)"
                >
                  <Input name="shorthandCode" required maxLength={20} />
                </Field>
                <Field label={<Label>Party</Label>}>
                  <Input name="party" placeholder="Optional" />
                </Field>
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" name="isPrimary" />
                  Primary campaign candidate
                </label>
                <Button type="submit">Create candidate</Button>
              </form>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

async function createCandidate(formData: FormData) {
  "use server";
  const actor = await requireCampaignManager();
  const parsed = CandidateSchema.safeParse({
    electionCycleId: formData.get("electionCycleId"),
    constituencyId: formData.get("constituencyId"),
    name: formData.get("name"),
    shorthandCode: formData.get("shorthandCode"),
    party: formData.get("party") || undefined,
    isPrimary: formData.get("isPrimary") === "on",
  });
  if (!parsed.success) {
    const msg = encodeURIComponent(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
    redirect(`/admin/candidates?error=${msg}`);
  }
  try {
    const created = await prisma.candidate.create({
      data: {
        electionCycleId: parsed.data.electionCycleId,
        constituencyId: parsed.data.constituencyId,
        name: parsed.data.name,
        shorthandCode: parsed.data.shorthandCode,
        party: parsed.data.party ?? null,
        isPrimaryCampaignCandidate: !!parsed.data.isPrimary,
      },
    });
    await recordAudit({
      actorUserId: actor.id,
      action: "candidate.create",
      entityType: "Candidate",
      entityId: created.id,
      metadata: {
        name: created.name,
        code: created.shorthandCode,
      },
    });
  } catch {
    redirect(
      `/admin/candidates?error=${encodeURIComponent("Code must be unique within a cycle + constituency")}`,
    );
  }
  revalidatePath("/admin/candidates");
  redirect("/admin/candidates?notice=Candidate+created");
}
