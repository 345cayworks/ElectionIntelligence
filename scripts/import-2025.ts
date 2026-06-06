// One-shot importer for the 2025 General Election. Run with:
//
//   DATABASE_URL="postgresql://..." npm run import:2025
//
// Reads data/2025-general-election.json (template included in the repo)
// and upserts:
//   - ElectionCycle (by canonical id "ge-2025")
//   - Candidates (by electionCycle + constituency + shorthandCode)
//   - ElectionResults (by electionCycle + candidate)
//
// Idempotent: re-running updates existing rows in place. Skips
// constituencies whose `code` doesn't exist (warn).
//
// Requires the parties seed to have run (PPM, TCCP, CINP). Run
// `npm run db:seed` first or hit the live site once to trigger the
// lazy bootstrap if you're targeting a fresh database.

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface CandidateInput {
  name: string;
  shorthandCode: string;
  partyCode: string | null;
  partyName?: string | null;
  votes: number | null;
  votesPercent?: number | null;
  rank?: number | null;
  isWinner?: boolean;
  notes?: string;
}

interface ConstituencyInput {
  code: string;
  totalValidVotes?: number | null;
  totalRegistered?: number | null;
  turnoutPercent?: number | null;
  candidates: CandidateInput[];
}

interface ImportFile {
  cycle: {
    name: string;
    electionDate: string;
    status?: string;
    notes?: string | null;
  };
  constituencies: ConstituencyInput[];
}

const CYCLE_ID = "ge-2025";
const RESULT_SOURCE = "import:2025";

async function main(): Promise<void> {
  const file = path.join(process.cwd(), "data", "2025-general-election.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as ImportFile;

  console.log(`[import-2025] reading ${file}`);

  const cycle = await prisma.electionCycle.upsert({
    where: { id: CYCLE_ID },
    update: {
      name: raw.cycle.name,
      electionDate: new Date(raw.cycle.electionDate),
      status: raw.cycle.status ?? "COMPLETED",
      notes: raw.cycle.notes ?? null,
    },
    create: {
      id: CYCLE_ID,
      name: raw.cycle.name,
      electionDate: new Date(raw.cycle.electionDate),
      status: raw.cycle.status ?? "COMPLETED",
      notes: raw.cycle.notes ?? null,
    },
  });
  console.log(`[import-2025] cycle: ${cycle.name} (${cycle.id})`);

  const constituencies = await prisma.constituency.findMany();
  const constituencyByCode = new Map(constituencies.map((c) => [c.code, c]));

  const parties = await prisma.party.findMany();
  const partyByCode = new Map(parties.map((p) => [p.code, p]));

  let candidatesInserted = 0;
  let candidatesUpdated = 0;
  let resultsRecorded = 0;
  const missingConstituencies: string[] = [];

  for (const constituencyInput of raw.constituencies) {
    const constituency = constituencyByCode.get(constituencyInput.code);
    if (!constituency) {
      missingConstituencies.push(constituencyInput.code);
      continue;
    }

    for (const candidateInput of constituencyInput.candidates) {
      const partyId = candidateInput.partyCode
        ? partyByCode.get(candidateInput.partyCode)?.id ?? null
        : null;
      if (candidateInput.partyCode && !partyId) {
        console.warn(
          `[import-2025] candidate ${candidateInput.name}: party code "${candidateInput.partyCode}" not found - storing as partyName fallback`,
        );
      }

      const candidateKey = {
        electionCycleId: cycle.id,
        constituencyId: constituency.id,
        shorthandCode: candidateInput.shorthandCode,
      };

      const existing = await prisma.candidate.findUnique({
        where: { electionCycleId_constituencyId_shorthandCode: candidateKey },
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
              ...candidateKey,
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
            totalValidVotes: constituencyInput.totalValidVotes ?? null,
            totalRegistered: constituencyInput.totalRegistered ?? null,
            turnoutPercent: constituencyInput.turnoutPercent ?? null,
            source: RESULT_SOURCE,
          },
          create: {
            electionCycleId: cycle.id,
            constituencyId: constituency.id,
            candidateId: candidate.id,
            votesReceived: candidateInput.votes,
            votesPercent: candidateInput.votesPercent ?? null,
            rank: candidateInput.rank ?? null,
            isWinner: candidateInput.isWinner ?? false,
            totalValidVotes: constituencyInput.totalValidVotes ?? null,
            totalRegistered: constituencyInput.totalRegistered ?? null,
            turnoutPercent: constituencyInput.turnoutPercent ?? null,
            source: RESULT_SOURCE,
          },
        });
        resultsRecorded += 1;
      }
    }
  }

  console.log(
    `[import-2025] done. candidates: ${candidatesInserted} created, ${candidatesUpdated} updated. results: ${resultsRecorded}`,
  );
  if (missingConstituencies.length > 0) {
    console.warn(
      `[import-2025] skipped ${missingConstituencies.length} constituency code(s) not in DB: ${missingConstituencies.join(", ")}. Run the bootstrap (hit any page on the live site) to populate constituencies first.`,
    );
  }
}

main()
  .catch((err) => {
    console.error("[import-2025] failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
