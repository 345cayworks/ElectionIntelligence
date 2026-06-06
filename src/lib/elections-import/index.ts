import "server-only";
import { prisma } from "@/lib/db";

// Shared cycle / candidate / result importer used by both
// /admin/elections (manual button) and scripts/import-2025.ts (CLI).
// Idempotent: re-running upserts existing rows by canonical keys.

export interface ImportCandidate {
  name: string;
  shorthandCode: string;
  partyCode: string | null;
  partyName?: string | null;
  votes?: number | null;
  votesPercent?: number | null;
  rank?: number | null;
  isWinner?: boolean;
  notes?: string;
}

export interface ImportConstituencyEntry {
  code: string;
  totalValidVotes?: number | null;
  totalRegistered?: number | null;
  turnoutPercent?: number | null;
  candidates?: ImportCandidate[];
}

export interface ImportCycle {
  id: string;
  name: string;
  electionDate: string;
  status?: string;
  notes?: string | null;
  constituencies: ImportConstituencyEntry[];
}

export interface CycleImportSummary {
  cycleId: string;
  cycleName: string;
  candidatesInserted: number;
  candidatesUpdated: number;
  resultsRecorded: number;
  skippedConstituencyCodes: string[];
}

export async function importCycle(
  raw: ImportCycle,
  source: string,
): Promise<CycleImportSummary> {
  const cycle = await prisma.electionCycle.upsert({
    where: { id: raw.id },
    update: {
      name: raw.name,
      electionDate: new Date(raw.electionDate),
      status: raw.status ?? "COMPLETED",
      notes: raw.notes ?? null,
    },
    create: {
      id: raw.id,
      name: raw.name,
      electionDate: new Date(raw.electionDate),
      status: raw.status ?? "COMPLETED",
      notes: raw.notes ?? null,
    },
  });

  const constituencies = await prisma.constituency.findMany();
  const byCode = new Map(constituencies.map((c) => [c.code, c]));
  const parties = await prisma.party.findMany();
  const partyByCode = new Map(parties.map((p) => [p.code, p]));

  let candidatesInserted = 0;
  let candidatesUpdated = 0;
  let resultsRecorded = 0;
  const skippedConstituencyCodes: string[] = [];

  for (const entry of raw.constituencies) {
    const constituency = byCode.get(entry.code);
    if (!constituency) {
      skippedConstituencyCodes.push(entry.code);
      continue;
    }
    for (const candidateInput of entry.candidates ?? []) {
      const partyId = candidateInput.partyCode
        ? partyByCode.get(candidateInput.partyCode)?.id ?? null
        : null;

      const key = {
        electionCycleId: cycle.id,
        constituencyId: constituency.id,
        shorthandCode: candidateInput.shorthandCode,
      };
      const existing = await prisma.candidate.findUnique({
        where: { electionCycleId_constituencyId_shorthandCode: key },
      });
      const candidate = existing
        ? await prisma.candidate.update({
            where: { id: existing.id },
            data: {
              name: candidateInput.name,
              partyId,
              partyName:
                !partyId && candidateInput.partyCode
                  ? candidateInput.partyCode
                  : candidateInput.partyName ?? null,
              notes: candidateInput.notes ?? null,
            },
          })
        : await prisma.candidate.create({
            data: {
              ...key,
              name: candidateInput.name,
              partyId,
              partyName:
                !partyId && candidateInput.partyCode
                  ? candidateInput.partyCode
                  : candidateInput.partyName ?? null,
              notes: candidateInput.notes ?? null,
            },
          });

      if (existing) candidatesUpdated += 1;
      else candidatesInserted += 1;

      if (candidateInput.votes !== null && candidateInput.votes !== undefined) {
        await prisma.electionResult.upsert({
          where: {
            electionCycleId_candidateId: {
              electionCycleId: cycle.id,
              candidateId: candidate.id,
            },
          },
          update: {
            votesReceived: candidateInput.votes,
            votesPercent: candidateInput.votesPercent ?? null,
            rank: candidateInput.rank ?? null,
            isWinner: candidateInput.isWinner ?? false,
            totalValidVotes: entry.totalValidVotes ?? null,
            totalRegistered: entry.totalRegistered ?? null,
            turnoutPercent: entry.turnoutPercent ?? null,
            source,
          },
          create: {
            electionCycleId: cycle.id,
            constituencyId: constituency.id,
            candidateId: candidate.id,
            votesReceived: candidateInput.votes,
            votesPercent: candidateInput.votesPercent ?? null,
            rank: candidateInput.rank ?? null,
            isWinner: candidateInput.isWinner ?? false,
            totalValidVotes: entry.totalValidVotes ?? null,
            totalRegistered: entry.totalRegistered ?? null,
            turnoutPercent: entry.turnoutPercent ?? null,
            source,
          },
        });
        resultsRecorded += 1;
      }
    }
  }

  return {
    cycleId: cycle.id,
    cycleName: cycle.name,
    candidatesInserted,
    candidatesUpdated,
    resultsRecorded,
    skippedConstituencyCodes,
  };
}

export interface ImportPollingStation {
  constituencyCode: string;
  name: string;
  code?: string | null;
  address?: string | null;
  city?: string | null;
  notes?: string | null;
}

export interface PollingStationImportSummary {
  inserted: number;
  updated: number;
  skipped: number;
  skippedCodes: string[];
}

export async function importPollingStations(
  stations: ImportPollingStation[],
): Promise<PollingStationImportSummary> {
  const constituencies = await prisma.constituency.findMany();
  const byCode = new Map(constituencies.map((c) => [c.code, c]));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const skippedCodes: string[] = [];

  for (const s of stations) {
    const constituency = byCode.get(s.constituencyCode);
    if (!constituency) {
      skipped += 1;
      if (!skippedCodes.includes(s.constituencyCode)) {
        skippedCodes.push(s.constituencyCode);
      }
      continue;
    }
    // Match on (constituencyId, name) since the portal doesn't publish a
    // stable code for every station. Code is captured when present.
    const existing = await prisma.pollingStation.findFirst({
      where: { constituencyId: constituency.id, name: s.name },
    });
    if (existing) {
      await prisma.pollingStation.update({
        where: { id: existing.id },
        data: {
          code: s.code ?? existing.code,
          address: s.address ?? existing.address,
          city: s.city ?? existing.city,
          notes: s.notes ?? existing.notes,
          active: true,
        },
      });
      updated += 1;
    } else {
      await prisma.pollingStation.create({
        data: {
          constituencyId: constituency.id,
          name: s.name,
          code: s.code ?? null,
          address: s.address ?? null,
          city: s.city ?? null,
          notes: s.notes ?? null,
        },
      });
      inserted += 1;
    }
  }

  return { inserted, updated, skipped, skippedCodes };
}
