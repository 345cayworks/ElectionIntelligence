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

export async function commitImport({ batchId, diff, actorUserId, constituencyId }: CommitParams) {
  // Create households and electors in batches. Campaign-side history is never overwritten.
  let createdHouseholds = 0;
  let createdElectors = 0;
  let updatedElectors = 0;
  let markedRemoved = 0;

  for (const record of diff.records) {
    if (record.status === "DUPLICATE_SUSPECT") continue;
    const r = record.parsed;
    const addrKey =
      r.normalizedAddress || normalizeAddressKey({
        streetNumber: r.streetNumber,
        streetName: r.streetName,
        streetType: r.streetType,
      });

    let householdId: string | null = null;
    if (addrKey) {
      const household = await prisma.household.upsert({
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
      await prisma.elector.update({
        where: { id: record.matchedElectorId },
        data: { officialStatus: "REMOVED" },
      });
      markedRemoved += 1;
      continue;
    }

    if (record.matchedElectorId) {
      await prisma.elector.update({
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
      await prisma.elector.create({
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

  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      status: "COMMITTED",
      committedAt: new Date(),
    },
  });

  await recordAudit({
    actorUserId,
    action: "import.commit",
    entityType: "ImportBatch",
    entityId: batchId,
    severity: "SENSITIVE",
    metadata: {
      createdHouseholds,
      createdElectors,
      updatedElectors,
      markedRemoved,
    },
  });

  return { createdHouseholds, createdElectors, updatedElectors, markedRemoved };
}
