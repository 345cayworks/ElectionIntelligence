import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit/log";
import type { ImportDiff } from "./diff";
import { normalizeAddressKey } from "./normalize";

export interface CommitParams {
  batchId: string;
  diff: ImportDiff;
  actorUserId: string;
  constituencyId: string | null;
}

export async function commitImport({
  batchId,
  diff,
  actorUserId,
  constituencyId,
}: CommitParams) {
  // Apply the entire diff inside a single transaction. If any row fails the
  // commit rolls back and the batch stays PENDING so the importer can retry.
  const TX_TIMEOUT_MS = 5 * 60 * 1000; // up to 5 minutes for large registers

  const result = await prisma.$transaction(
    async (tx) => {
      let createdHouseholds = 0;
      let createdElectors = 0;
      let updatedElectors = 0;
      let markedRemoved = 0;

      for (const record of diff.records) {
        if (record.status === "DUPLICATE_SUSPECT") continue;
        const r = record.parsed;
        const addrKey =
          r.normalizedAddress ||
          normalizeAddressKey({
            streetNumber: r.streetNumber,
            streetName: r.streetName,
            streetType: r.streetType,
          });

        let householdId: string | null = null;
        if (addrKey) {
          const household = await tx.household.upsert({
            where: { normalizedAddress: addrKey },
            update: {
              streetNumber: r.streetNumber ?? undefined,
              streetName: r.streetName ?? undefined,
              streetType: r.streetType ?? undefined,
              constituencyId: constituencyId ?? undefined,
            },
            create: {
              normalizedAddress: addrKey,
              streetNumber: r.streetNumber,
              streetName: r.streetName,
              streetType: r.streetType,
              constituencyId,
            },
          });
          householdId = household.id;
          if (household.createdAt.getTime() === household.updatedAt.getTime()) {
            createdHouseholds += 1;
          }
        }

        if (record.status === "REMOVED" && record.matchedElectorId) {
          await tx.elector.update({
            where: { id: record.matchedElectorId },
            data: { officialStatus: "REMOVED" },
          });
          markedRemoved += 1;
          continue;
        }

        if (record.matchedElectorId) {
          await tx.elector.update({
            where: { id: record.matchedElectorId },
            data: {
              fullName: r.fullName,
              occupation: r.occupation,
              pollingDivision: r.pollingDivision,
              currentHouseholdId: householdId,
              officialStatus:
                record.status === "NEW"
                  ? "NEW"
                  : record.status === "MOVED_IN"
                    ? "MOVED_IN"
                    : record.status === "ADDRESS_UPDATED"
                      ? "ADDRESS_UPDATED"
                      : "ACTIVE",
              constituencyId: constituencyId ?? undefined,
              sourceImportBatchId: batchId,
            },
          });
          updatedElectors += 1;
        } else if (record.status === "NEW" || record.status === "MOVED_IN") {
          await tx.elector.create({
            data: {
              fullName: r.fullName,
              officialSerialNo: r.serial,
              occupation: r.occupation,
              pollingDivision: r.pollingDivision,
              currentHouseholdId: householdId,
              officialStatus: record.status,
              constituencyId,
              sourceImportBatchId: batchId,
            },
          });
          createdElectors += 1;
        }
      }

      await tx.importBatch.update({
        where: { id: batchId },
        data: { status: "COMMITTED", committedAt: new Date() },
      });

      return { createdHouseholds, createdElectors, updatedElectors, markedRemoved };
    },
    { timeout: TX_TIMEOUT_MS, maxWait: 10_000 },
  );

  await recordAudit({
    actorUserId,
    action: "import.commit",
    entityType: "ImportBatch",
    entityId: batchId,
    severity: "SENSITIVE",
    metadata: result,
  });

  return result;
}
