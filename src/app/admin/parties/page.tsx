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
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

const PartySchema = z.object({
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, "Code must be uppercase letters / digits / _ -"),
  name: z.string().min(2).max(120),
  shortName: z.string().max(40).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a #RRGGBB hex code")
    .optional(),
  leaderName: z.string().max(120).optional(),
});

export default async function PartiesPage({
  searchParams,
}: {
  searchParams?: { notice?: string; error?: string };
}) {
  await requireCampaignManager();

  const parties = await prisma.party.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { candidates: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Political parties"
        description="Registered parties (from portal.elections.ky). Independent candidates have no party row — leave the dropdown on 'Independent' when adding them."
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
            <CardHeader title="All parties" />
            <CardBody>
              {parties.length === 0 ? (
                <EmptyState title="No parties yet — the lazy seed should populate PPM/TCCP/CINP on first request." />
              ) : (
                <Table>
                  <THead>
                    <TH>Code</TH>
                    <TH>Name</TH>
                    <TH>Leader</TH>
                    <TH>Color</TH>
                    <TH>Candidates</TH>
                    <TH>Active</TH>
                  </THead>
                  <TBody>
                    {parties.map((p) => (
                      <TR key={p.id}>
                        <TD>
                          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
                            {p.code}
                          </code>
                        </TD>
                        <TD>{p.name}</TD>
                        <TD>{p.leaderName ?? "—"}</TD>
                        <TD>
                          {p.color ? (
                            <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                              <span
                                className="inline-block h-3 w-3 rounded"
                                style={{ backgroundColor: p.color }}
                              />
                              {p.color}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TD>
                        <TD>{p._count.candidates}</TD>
                        <TD>
                          {p.active ? (
                            <Badge tone="green">Active</Badge>
                          ) : (
                            <Badge tone="gray">Inactive</Badge>
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
          <CardHeader title="New party" />
          <CardBody>
            <form action={createParty} className="space-y-3">
              <Field label={<Label>Code</Label>} hint="Short uppercase ID, e.g. PPM">
                <Input name="code" required placeholder="PPM" maxLength={20} />
              </Field>
              <Field label={<Label>Name</Label>}>
                <Input name="name" required placeholder="People's Progressive Movement" />
              </Field>
              <Field label={<Label>Short name</Label>}>
                <Input name="shortName" placeholder="PPM" maxLength={40} />
              </Field>
              <Field
                label={<Label>Brand color</Label>}
                hint="#RRGGBB hex (used in candidate listings)"
              >
                <Input name="color" placeholder="#0F4C8A" />
              </Field>
              <Field label={<Label>Leader</Label>}>
                <Input name="leaderName" placeholder="Optional" />
              </Field>
              <Field label={<Label>Notes</Label>}>
                <Textarea name="notes" rows={2} />
              </Field>
              <Button type="submit">Create</Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

async function createParty(formData: FormData) {
  "use server";
  const actor = await requireCampaignManager();
  const parsed = PartySchema.safeParse({
    code: (formData.get("code") as string | null)?.toUpperCase(),
    name: formData.get("name"),
    shortName: formData.get("shortName") || undefined,
    color: formData.get("color") || undefined,
    leaderName: formData.get("leaderName") || undefined,
  });
  if (!parsed.success) {
    const msg = encodeURIComponent(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
    redirect(`/admin/parties?error=${msg}`);
  }
  try {
    const created = await prisma.party.create({
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        shortName: parsed.data.shortName ?? null,
        color: parsed.data.color ?? null,
        leaderName: parsed.data.leaderName ?? null,
        notes: (formData.get("notes") as string | null) || null,
      },
    });
    await recordAudit({
      actorUserId: actor.id,
      action: "party.create",
      entityType: "Party",
      entityId: created.id,
      metadata: { code: created.code, name: created.name },
    });
  } catch {
    redirect(`/admin/parties?error=${encodeURIComponent("Code must be unique")}`);
  }
  revalidatePath("/admin/parties");
  redirect("/admin/parties?notice=Party+created");
}
