import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCampaignManager } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit/log";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Field, Textarea } from "@/components/ui/Input";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";

export const dynamic = "force-dynamic";

const ConstituencySchema = z.object({
  name: z.string().min(2).max(120),
  code: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/, "Code may include letters, numbers, _ and -"),
  island: z.string().min(2).max(80).default("Grand Cayman"),
  notes: z.string().max(500).optional(),
});

export default async function ConstituenciesPage({
  searchParams,
}: {
  searchParams?: { notice?: string; error?: string };
}) {
  await requireCampaignManager();

  const constituencies = await prisma.constituency.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { electors: true, households: true, candidates: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Constituencies"
        description="Manage Cayman Islands constituencies tracked by this campaign."
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
            <CardHeader title="All constituencies" />
            <CardBody>
              {constituencies.length === 0 ? (
                <EmptyState title="No constituencies yet" />
              ) : (
                <Table>
                  <THead>
                    <TH>Name</TH>
                    <TH>Code</TH>
                    <TH>Island</TH>
                    <TH>Electors</TH>
                    <TH>Households</TH>
                    <TH>Candidates</TH>
                  </THead>
                  <TBody>
                    {constituencies.map((c) => (
                      <TR key={c.id}>
                        <TD>{c.name}</TD>
                        <TD>
                          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">{c.code}</code>
                        </TD>
                        <TD>{c.island}</TD>
                        <TD>{c._count.electors}</TD>
                        <TD>{c._count.households}</TD>
                        <TD>{c._count.candidates}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader title="New constituency" />
          <CardBody>
            <form action={createConstituency} className="space-y-3">
              <Field label={<Label>Name</Label>}>
                <Input name="name" required placeholder="Red Bay" />
              </Field>
              <Field label={<Label>Code</Label>}>
                <Input name="code" required placeholder="red-bay" />
              </Field>
              <Field label={<Label>Island</Label>}>
                <Input name="island" defaultValue="Grand Cayman" />
              </Field>
              <Field label={<Label>Notes</Label>}>
                <Textarea name="notes" rows={3} />
              </Field>
              <Button type="submit">Create</Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

async function createConstituency(formData: FormData) {
  "use server";
  const actor = await requireCampaignManager();
  const parsed = ConstituencySchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    island: formData.get("island") || "Grand Cayman",
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    const msg = encodeURIComponent(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
    redirect(`/admin/constituencies?error=${msg}`);
  }
  try {
    const created = await prisma.constituency.create({
      data: {
        name: parsed.data.name,
        code: parsed.data.code,
        island: parsed.data.island,
        notes: parsed.data.notes ?? null,
      },
    });
    await recordAudit({
      actorUserId: actor.id,
      action: "constituency.create",
      entityType: "Constituency",
      entityId: created.id,
      metadata: { name: created.name },
    });
  } catch {
    redirect(`/admin/constituencies?error=${encodeURIComponent("Code must be unique")}`);
  }
  revalidatePath("/admin/constituencies");
  redirect("/admin/constituencies?notice=Constituency+created");
}
