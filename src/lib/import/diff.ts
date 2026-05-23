import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ParsedElectorRow } from "./parse";
import { normalizeAddressKey } from "./normalize";

export type DiffStatus =
  | "NEW"
  | "MOVED_IN"
  | "MOVED_OUT"
  | "REMOVED"
  | "ADDRESS_UPDATED"
  | "ACTIVE"
  | "DUPLICATE_SUSPECT"
  | "MISSING_SERIAL";

export interface DiffRecord {
  parsed: ParsedElectorRow;
  matchedElectorId: string | null;
  status: DiffStatus;
  reason?: string;
}

export interface ImportDiff {
  records: DiffRecord[];
  summary: {
    rowCount: number;
    newCount: number;
    movedInCount: number;
    movedOutCount: number;
    removedCount: number;
    updatedAddressCount: number;
    duplicateCount: number;
    missingSerialCount: number;
  };
  warnings: string[];
}

export async function computeDiff(
  rows: ParsedElectorRow[],
  constituencyId: string | null,
): Promise<ImportDiff> {
  // Load existing electors (and households) for matching against current import.
  const where: Prisma.ElectorWhereInput = constituencyId
    ? { constituencyId }
    : {};
  const existing = await prisma.elector.findMany({
    where,
    include: { currentHousehold: true },
  });

  const bySerial = new Map<string, (typeof existing)[number]>();
  const byNameAndAddress = new Map<string, (typeof existing)[number]>();
  for (const e of existing) {
    if (e.officialSerialNo) bySerial.set(e.officialSerialNo, e);
    const addr = e.currentHousehold?.normalizedAddress ?? "";
    byNameAndAddress.set(`${e.fullName.toLowerCase()}|${addr}`, e);
  }

  const records: DiffRecord[] = [];
  const seenKeys = new Set<string>();
  const warnings: string[] = [];
  let duplicateCount = 0;
  let missingSerialCount = 0;

  for (const row of rows) {
    const key =
      (row.serial ? `serial:${row.serial}` : null) ??
      `name:${row.fullName.toLowerCase()}|addr:${row.normalizedAddress}`;
    if (seenKeys.has(key)) {
      duplicateCount += 1;
      records.push({
        parsed: row,
        matchedElectorId: null,
        status: "DUPLICATE_SUSPECT",
        reason: "Repeated in upload",
      });
      continue;
    }
    seenKeys.add(key);

    if (!row.serial) missingSerialCount += 1;

    let match: (typeof existing)[number] | undefined;
    if (row.serial) match = bySerial.get(row.serial);
    if (!match) {
      const nameKey = `${row.fullName.toLowerCase()}|${row.normalizedAddress}`;
      match = byNameAndAddress.get(nameKey);
    }

    if (!match) {
      records.push({
        parsed: row,
        matchedElectorId: null,
        status: "NEW",
        reason: "No existing elector matched",
      });
      continue;
    }

    // Compare addresses for moved-in / address-updated.
    const prevAddr = match.currentHousehold?.normalizedAddress ?? "";
    const currAddr = row.normalizedAddress;
    if (prevAddr && prevAddr !== currAddr) {
      // Could be a strict "MOVED_IN" within the constituency or an address update.
      const sameStreet =
        normalizeAddressKey({
          streetName: row.streetName,
          streetType: row.streetType,
        }) ===
        normalizeAddressKey({
          streetName: match.currentHousehold?.streetName ?? null,
          streetType: match.currentHousehold?.streetType ?? null,
        });
      records.push({
        parsed: row,
        matchedElectorId: match.id,
        status: sameStreet ? "ADDRESS_UPDATED" : "MOVED_IN",
        reason: `Previous: ${prevAddr || "(none)"} -> ${currAddr}`,
      });
      continue;
    }

    records.push({
      parsed: row,
      matchedElectorId: match.id,
      status: "ACTIVE",
    });
  }

  // Determine removed/moved out: previously-known electors not present in this upload.
  const matchedIds = new Set(
    records.map((r) => r.matchedElectorId).filter((id): id is string => !!id),
  );
  for (const e of existing) {
    if (matchedIds.has(e.id)) continue;
    records.push({
      parsed: {
        source: "FULL_LIST",
        rawIndex: -1,
        serial: e.officialSerialNo,
        fullName: e.fullName,
        occupation: e.occupation,
        streetNumber: e.currentHousehold?.streetNumber ?? null,
        streetName: e.currentHousehold?.streetName ?? null,
        streetType: e.currentHousehold?.streetType ?? null,
        combinedAddress: null,
        normalizedAddress: e.currentHousehold?.normalizedAddress ?? "",
        pollingDivision: e.pollingDivision,
        voterIntent: null,
        remarks: null,
        phone: null,
        email: null,
        notes: null,
      },
      matchedElectorId: e.id,
      status: "REMOVED",
      reason: "Not present in upload",
    });
  }

  const summary = {
    rowCount: rows.length,
    newCount: records.filter((r) => r.status === "NEW").length,
    movedInCount: records.filter((r) => r.status === "MOVED_IN").length,
    movedOutCount: 0, // moved-out is currently inferred from MOVED_IN at the other constituency or REMOVED
    removedCount: records.filter((r) => r.status === "REMOVED").length,
    updatedAddressCount: records.filter((r) => r.status === "ADDRESS_UPDATED").length,
    duplicateCount,
    missingSerialCount,
  };

  if (summary.missingSerialCount > 0) {
    warnings.push(`${summary.missingSerialCount} rows are missing official serial numbers.`);
  }
  if (summary.duplicateCount > 0) {
    warnings.push(`${summary.duplicateCount} duplicate rows detected within the upload.`);
  }
  if (existing.length > 0 && summary.removedCount > existing.length * 0.5) {
    warnings.push(
      "More than 50% of existing electors are missing from this upload - double-check the file before committing.",
    );
  }

  return { records, summary, warnings };
}
