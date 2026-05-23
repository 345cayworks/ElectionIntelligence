import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authorizeApi } from "@/lib/auth/api-guards";
import { canAssignCanvassers } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit/log";
import { ASSIGNMENT_STATUSES, PRIORITIES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  householdIds: z.array(z.string()).optional(),
  streetName: z.string().optional(),
  electionCycleId: z.string().nullable().optional(),
  constituencyId: z.string().nullable().optional(),
  assignedToUserId: z.string(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(canAssignCanvassers);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const payload = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  let householdIds: string[] = data.householdIds ?? [];
  if (data.streetName && householdIds.length === 0) {
    const matching = await prisma.household.findMany({
      where: {
        streetName: { contains: data.streetName },
        ...(data.constituencyId ? { constituencyId: data.constituencyId } : {}),
      },
      select: { id: true },
    });
    householdIds = matching.map((h) => h.id);
  }

  if (householdIds.length === 0) {
    return NextResponse.json({ error: "No households selected" }, { status: 400 });
  }

  const created: string[] = [];
  for (const householdId of householdIds) {
    const existing = await prisma.canvassAssignment.findFirst({
      where: { householdId, assignedToUserId: data.assignedToUserId },
    });
    if (existing) continue;
    const assignment = await prisma.canvassAssignment.create({
      data: {
        householdId,
        assignedToUserId: data.assignedToUserId,
        assignedByUserId: user.id,
        electionCycleId: data.electionCycleId ?? null,
        constituencyId: data.constituencyId ?? null,
        status: "ASSIGNED",
        priority: data.priority ?? "NORMAL",
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes ?? null,
      },
    });
    created.push(assignment.id);
  }

  await recordAudit({
    actorUserId: user.id,
    action: "assignment.create",
    entityType: "CanvassAssignment",
    metadata: {
      assignedToUserId: data.assignedToUserId,
      count: created.length,
      streetName: data.streetName ?? null,
    },
  });

  return NextResponse.json({ count: created.length, ids: created });
}

const UpdateSchema = z.object({
  id: z.string(),
  status: z.enum(ASSIGNMENT_STATUSES),
});

export async function PATCH(req: NextRequest) {
  const auth = await authorizeApi(canAssignCanvassers);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const payload = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  await prisma.canvassAssignment.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  });
  await recordAudit({
    actorUserId: user.id,
    action: "assignment.update_status",
    entityType: "CanvassAssignment",
    entityId: parsed.data.id,
    metadata: { status: parsed.data.status },
  });
  return NextResponse.json({ ok: true });
}
