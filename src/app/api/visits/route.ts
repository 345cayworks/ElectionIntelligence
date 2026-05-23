import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authorizeApi } from "@/lib/auth/api-guards";
import { canCanvass } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit/log";
import { VISIT_METHODS, VISIT_RESULTS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const VisitSchema = z.object({
  householdId: z.string().optional(),
  electorId: z.string().nullable().optional(),
  visitMethod: z.enum(VISIT_METHODS).default("DOOR"),
  result: z.enum(VISIT_RESULTS),
  notes: z.string().max(1000).optional(),
  followUpRequired: z.boolean().optional(),
  followUpDate: z.string().nullable().optional(),
  issueTagIds: z.array(z.string()).optional(),
  electionCycleId: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(canCanvass);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const payload = await req.json().catch(() => null);
  const parsed = VisitSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!parsed.data.householdId && !parsed.data.electorId) {
    return NextResponse.json(
      { error: "Provide householdId or electorId" },
      { status: 400 },
    );
  }

  // Resolve household + constituency for the audit trail.
  let household = null;
  if (parsed.data.householdId) {
    household = await prisma.household.findUnique({
      where: { id: parsed.data.householdId },
    });
  }

  const visit = await prisma.canvassVisit.create({
    data: {
      householdId: parsed.data.householdId ?? null,
      electorId: parsed.data.electorId ?? null,
      canvasserId: user.id,
      visitMethod: parsed.data.visitMethod,
      result: parsed.data.result,
      notes: parsed.data.notes ?? null,
      followUpRequired: !!parsed.data.followUpRequired,
      followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : null,
      constituencyId: household?.constituencyId ?? null,
      electionCycleId: parsed.data.electionCycleId ?? null,
    },
  });

  if (parsed.data.issueTagIds?.length && parsed.data.electorId) {
    for (const tagId of parsed.data.issueTagIds) {
      await prisma.electorIssue
        .upsert({
          where: {
            electorId_issueTagId: {
              electorId: parsed.data.electorId,
              issueTagId: tagId,
            },
          },
          update: { capturedByUserId: user.id },
          create: {
            electorId: parsed.data.electorId,
            issueTagId: tagId,
            capturedByUserId: user.id,
          },
        })
        .catch(() => {
          /* ignore - non-critical */
        });
    }
  }

  if (parsed.data.followUpRequired) {
    await prisma.followUpTask.create({
      data: {
        title: "Follow up on visit",
        description: parsed.data.notes ?? null,
        electorId: parsed.data.electorId ?? null,
        householdId: parsed.data.householdId ?? null,
        assignedToUserId: user.id,
        createdByUserId: user.id,
        priority: "NORMAL",
        electionCycleId: parsed.data.electionCycleId ?? null,
      },
    });
  }

  await recordAudit({
    actorUserId: user.id,
    action: "canvass.visit.create",
    entityType: "CanvassVisit",
    entityId: visit.id,
    metadata: {
      result: parsed.data.result,
      householdId: parsed.data.householdId ?? null,
      electorId: parsed.data.electorId ?? null,
    },
  });

  return NextResponse.json({ id: visit.id });
}
