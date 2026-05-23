import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeApi } from "@/lib/auth/api-guards";
import { canImportElectors } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit/log";
import { parseWorkbook } from "@/lib/import/parse";
import { computeDiff } from "@/lib/import/diff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(canImportElectors);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.redirect(
      new URL("/admin/imports/new?error=Invalid+upload", req.url),
      { status: 303 },
    );
  }

  const electionCycleId = (form.get("electionCycleId") as string) || null;
  const constituencyId = (form.get("constituencyId") as string) || null;
  const sourceType = (form.get("sourceType") as string) || "OFFICIAL_REGISTER";
  const file = form.get("file") as File | null;

  if (!file || file.size === 0) {
    return NextResponse.redirect(
      new URL("/admin/imports/new?error=Pick+a+file+to+upload", req.url),
      { status: 303 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = parseWorkbook(buffer);
  } catch (e) {
    return NextResponse.redirect(
      new URL(
        `/admin/imports/new?error=${encodeURIComponent(`Parse failed: ${(e as Error).message}`)}`,
        req.url,
      ),
      { status: 303 },
    );
  }

  const diff = await computeDiff(parsed.rows, constituencyId);
  const warnings = [...parsed.warnings, ...diff.warnings];

  const batch = await prisma.importBatch.create({
    data: {
      electionCycleId: electionCycleId || null,
      constituencyId: constituencyId || null,
      fileName: file.name,
      fileSize: file.size,
      importedByUserId: user.id,
      sourceType,
      status: "PENDING",
      rowCount: diff.summary.rowCount,
      newCount: diff.summary.newCount,
      movedInCount: diff.summary.movedInCount,
      movedOutCount: diff.summary.movedOutCount,
      removedCount: diff.summary.removedCount,
      updatedAddressCount: diff.summary.updatedAddressCount,
      duplicateCount: diff.summary.duplicateCount,
      warnings: warnings.length ? JSON.stringify(warnings) : null,
      rawSummary: JSON.stringify({ sheets: parsed.sheets, totalParsed: parsed.rows.length }),
      diffPreview: JSON.stringify({
        records: diff.records.slice(0, 200),
        truncated: diff.records.length > 200,
        totalRecords: diff.records.length,
      }),
    },
  });

  await recordAudit({
    actorUserId: user.id,
    action: "import.upload",
    entityType: "ImportBatch",
    entityId: batch.id,
    severity: "SENSITIVE",
    metadata: {
      fileName: file.name,
      fileSize: file.size,
      sourceType,
      summary: diff.summary,
    },
  });

  return NextResponse.redirect(new URL(`/admin/imports/${batch.id}/review`, req.url), {
    status: 303,
  });
}
