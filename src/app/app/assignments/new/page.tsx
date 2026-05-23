import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { canAssignCanvassers } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit/log";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/Input";
import { PRIORITIES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const Schema = z.object({
  streetName: z.string().min(1),
  assignedToUserId: z.string().min(1),
  constituencyId: z.string().nullable().optional(),
  electionCycleId: z.string().nullable().optional(),
  priority: z.enum(PRIORITIES),
  dueDate: z.string().nullable().optional(),
  notes: z.string().max(300).optional(),
});

export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams?: { notice?: string; error?: string };
}) {
  const user = await requireUser();
  if (!canAssignCanvassers(user)) {
    redirect("/app/assignments?error=forbidden");
  }

  const [users, constituencies, cycles] = await Promise.all([
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: { in: ["CANVASSER", "FIELD_COORDINATOR", "CAMPAIGN_ADMIN"] },
      },
      orderBy: { email: "asc" },
    }),
    prisma.constituency.findMany({ orderBy: { name: "asc" } }),
    prisma.electionCycle.findMany({ orderBy: { electionDate: "desc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="New assignment"
        description="Assign all households on a street to a canvasser."
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
        <CardHeader title="Assign by street" />
        <CardBody>
          <form action={createAssignment} className="space-y-3">
            <Field label={<Label>Street name (or part of it)</Label>}>
              <Input name="streetName" required placeholder="e.g. Selkirk" />
            </Field>
            <Field label={<Label>Canvasser</Label>}>
              <Select name="assignedToUserId" required defaultValue="">
                <option value="" disabled>
                  Select canvasser
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email} ({u.role.replace(/_/g, " ")})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={<Label>Constituency</Label>}>
              <Select name="constituencyId" defaultValue="">
                <option value="">— Any —</option>
                {constituencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={<Label>Election cycle</Label>}>
              <Select name="electionCycleId" defaultValue="">
                <option value="">— None —</option>
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={<Label>Priority</Label>}>
              <Select name="priority" defaultValue="NORMAL">
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={<Label>Due date</Label>}>
              <Input name="dueDate" type="date" />
            </Field>
            <Field label={<Label>Notes</Label>}>
              <Textarea name="notes" rows={3} />
            </Field>
            <Button type="submit">Create assignments</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

async function createAssignment(formData: FormData) {
  "use server";
  const user = await requireUser();
  if (!canAssignCanvassers(user)) redirect("/app/assignments?error=forbidden");

  const parsed = Schema.safeParse({
    streetName: formData.get("streetName"),
    assignedToUserId: formData.get("assignedToUserId"),
    constituencyId: formData.get("constituencyId") || null,
    electionCycleId: formData.get("electionCycleId") || null,
    priority: formData.get("priority") ?? "NORMAL",
    dueDate: formData.get("dueDate") || null,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    const msg = encodeURIComponent(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
    redirect(`/app/assignments/new?error=${msg}`);
  }

  const matching = await prisma.household.findMany({
    where: {
      streetName: { contains: parsed.data.streetName },
      ...(parsed.data.constituencyId
        ? { constituencyId: parsed.data.constituencyId }
        : {}),
    },
    select: { id: true },
  });
  if (matching.length === 0) {
    redirect(`/app/assignments/new?error=${encodeURIComponent("No households matched")}`);
  }

  let created = 0;
  for (const h of matching) {
    const existing = await prisma.canvassAssignment.findFirst({
      where: { householdId: h.id, assignedToUserId: parsed.data.assignedToUserId },
    });
    if (existing) continue;
    await prisma.canvassAssignment.create({
      data: {
        householdId: h.id,
        assignedToUserId: parsed.data.assignedToUserId,
        assignedByUserId: user.id,
        constituencyId: parsed.data.constituencyId ?? null,
        electionCycleId: parsed.data.electionCycleId ?? null,
        priority: parsed.data.priority,
        status: "ASSIGNED",
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        notes: parsed.data.notes ?? null,
        streetName: parsed.data.streetName,
      },
    });
    created += 1;
  }

  await recordAudit({
    actorUserId: user.id,
    action: "assignment.create.batch",
    entityType: "CanvassAssignment",
    metadata: {
      streetName: parsed.data.streetName,
      assignedToUserId: parsed.data.assignedToUserId,
      created,
    },
  });

  revalidatePath("/app/assignments");
  redirect(`/app/assignments?notice=${encodeURIComponent(`${created} households assigned`)}`);
}
