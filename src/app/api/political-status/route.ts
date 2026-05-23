import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authorizeApi } from "@/lib/auth/api-guards";
import { canEditSensitivePoliticalData } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit/log";
import {
  POLITICAL_POSITIONS,
  VOTING_METHOD_FLAGS,
  CONFIDENCE_LEVELS,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

const Schema = z
  .object({
    electorId: z.string().min(1),
    declaredPosition: z.enum(POLITICAL_POSITIONS).optional(),
    declaredCandidateId: z.string().nullable().optional(),
    votingMethodFlag: z.enum(VOTING_METHOD_FLAGS).optional(),
    confidenceLevel: z.enum(CONFIDENCE_LEVELS).optional(),
    electionCycleId: z.string().nullable().optional(),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (data) =>
      data.declaredPosition !== undefined || data.votingMethodFlag !== undefined,
    { message: "Provide declaredPosition or votingMethodFlag" },
  );

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(canEditSensitivePoliticalData);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const payload = await req.json().catch(() => null);
  const parsed = Schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // Mark previous current status entries as not current.
  await prisma.electorPoliticalStatus.updateMany({
    where: { electorId: data.electorId, isCurrent: true },
    data: { isCurrent: false },
  });

  const status = await prisma.electorPoliticalStatus.create({
    data: {
      electorId: data.electorId,
      electionCycleId: data.electionCycleId ?? null,
      declaredPosition: data.declaredPosition ?? "UNKNOWN",
      declaredCandidateId: data.declaredCandidateId ?? null,
      votingMethodFlag: data.votingMethodFlag ?? "UNKNOWN",
      confidenceLevel: data.confidenceLevel ?? "UNKNOWN",
      notes: data.notes ?? null,
      capturedByUserId: user.id,
      isCurrent: true,
    },
  });

  await recordAudit({
    actorUserId: user.id,
    action: "political_status.update",
    entityType: "ElectorPoliticalStatus",
    entityId: status.id,
    severity: "SENSITIVE",
    metadata: {
      electorId: data.electorId,
      declaredPosition: data.declaredPosition ?? null,
      votingMethodFlag: data.votingMethodFlag ?? null,
    },
  });

  return NextResponse.json({ id: status.id });
}
