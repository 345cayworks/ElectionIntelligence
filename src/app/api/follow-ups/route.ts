import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authorizeApi } from "@/lib/auth/api-guards";
import { canCanvass } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit/log";
import { FOLLOWUP_STATUSES, PRIORITIES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const Schema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(500).optional(),
  electorId: z.string().nullable().optional(),
  householdId: z.string().nullable().optional(),
  assignedToUserId: z.string().nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: z.string().nullable().optional(),
  electionCycleId: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(canCanvass);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const payload = await req.json().catch(() => null);
  const parsed = Schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const task = await prisma.followUpTask.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      electorId: data.electorId ?? null,
      householdId: data.householdId ?? null,
      assignedToUserId: data.assignedToUserId ?? user.id,
      createdByUserId: user.id,
      priority: data.priority ?? "NORMAL",
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      electionCycleId: data.electionCycleId ?? null,
    },
  });

  await recordAudit({
    actorUserId: user.id,
    action: "followup.create",
    entityType: "FollowUpTask",
    entityId: task.id,
  });

  return NextResponse.json({ id: task.id });
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(FOLLOWUP_STATUSES),
});

export async function PATCH(req: NextRequest) {
  const auth = await authorizeApi(canCanvass);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const payload = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.followUpTask.update({
    where: { id: parsed.data.id },
    data: {
      status: parsed.data.status,
      completedAt: parsed.data.status === "DONE" ? new Date() : null,
    },
  });
  await recordAudit({
    actorUserId: user.id,
    action: "followup.update_status",
    entityType: "FollowUpTask",
    entityId: parsed.data.id,
    metadata: { status: parsed.data.status },
  });

  return NextResponse.json({ ok: true });
}
