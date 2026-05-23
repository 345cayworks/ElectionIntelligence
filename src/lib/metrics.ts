import { prisma } from "@/lib/db";

interface MetricsParams {
  electionCycleId?: string | null;
  constituencyId?: string | null;
}

export async function getCampaignMetrics(params: MetricsParams = {}) {
  const visitsWhere: Record<string, unknown> = {};
  if (params.electionCycleId) visitsWhere.electionCycleId = params.electionCycleId;
  if (params.constituencyId) visitsWhere.constituencyId = params.constituencyId;

  const electorWhere: Record<string, unknown> = {};
  if (params.constituencyId) electorWhere.constituencyId = params.constituencyId;

  const householdWhere: Record<string, unknown> = {};
  if (params.constituencyId) householdWhere.constituencyId = params.constituencyId;

  const [
    totalElectors,
    totalHouseholds,
    newElectors,
    movedIn,
    movedOut,
    addressUpdated,
    removed,
    visits,
    spokeCount,
    notHomeCount,
    refusedCount,
    movedResult,
    followUpsDue,
    supportsUs,
    supportsOpp,
    undecided,
    notVoting,
    unknown,
    postal,
    mobile,
  ] = await Promise.all([
    prisma.elector.count({ where: electorWhere }),
    prisma.household.count({ where: householdWhere }),
    prisma.elector.count({ where: { ...electorWhere, officialStatus: "NEW" } }),
    prisma.elector.count({ where: { ...electorWhere, officialStatus: "MOVED_IN" } }),
    prisma.elector.count({ where: { ...electorWhere, officialStatus: "MOVED_OUT" } }),
    prisma.elector.count({
      where: { ...electorWhere, officialStatus: "ADDRESS_UPDATED" },
    }),
    prisma.elector.count({ where: { ...electorWhere, officialStatus: "REMOVED" } }),
    prisma.canvassVisit.count({ where: visitsWhere }),
    prisma.canvassVisit.count({ where: { ...visitsWhere, result: "SPOKE" } }),
    prisma.canvassVisit.count({ where: { ...visitsWhere, result: "NOT_HOME" } }),
    prisma.canvassVisit.count({ where: { ...visitsWhere, result: "REFUSED" } }),
    prisma.canvassVisit.count({ where: { ...visitsWhere, result: "MOVED" } }),
    prisma.followUpTask.count({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        ...(params.electionCycleId ? { electionCycleId: params.electionCycleId } : {}),
      },
    }),
    prisma.electorPoliticalStatus.count({
      where: {
        declaredPosition: "SUPPORTS_US",
        isCurrent: true,
        ...(params.electionCycleId ? { electionCycleId: params.electionCycleId } : {}),
      },
    }),
    prisma.electorPoliticalStatus.count({
      where: {
        declaredPosition: "SUPPORTS_OPPONENT",
        isCurrent: true,
        ...(params.electionCycleId ? { electionCycleId: params.electionCycleId } : {}),
      },
    }),
    prisma.electorPoliticalStatus.count({
      where: {
        declaredPosition: "UNDECIDED",
        isCurrent: true,
        ...(params.electionCycleId ? { electionCycleId: params.electionCycleId } : {}),
      },
    }),
    prisma.electorPoliticalStatus.count({
      where: {
        declaredPosition: "NOT_VOTING",
        isCurrent: true,
        ...(params.electionCycleId ? { electionCycleId: params.electionCycleId } : {}),
      },
    }),
    prisma.electorPoliticalStatus.count({
      where: {
        declaredPosition: { in: ["UNKNOWN", "REFUSED"] },
        isCurrent: true,
        ...(params.electionCycleId ? { electionCycleId: params.electionCycleId } : {}),
      },
    }),
    prisma.electorPoliticalStatus.count({
      where: {
        votingMethodFlag: "POSTAL",
        isCurrent: true,
        ...(params.electionCycleId ? { electionCycleId: params.electionCycleId } : {}),
      },
    }),
    prisma.electorPoliticalStatus.count({
      where: {
        votingMethodFlag: "MOBILE",
        isCurrent: true,
        ...(params.electionCycleId ? { electionCycleId: params.electionCycleId } : {}),
      },
    }),
  ]);

  // Households visited = distinct households with at least one visit.
  const visitedHouseholds = await prisma.canvassVisit.findMany({
    where: { ...visitsWhere, householdId: { not: null } },
    distinct: ["householdId"],
    select: { householdId: true },
  });
  const householdsVisitedCount = visitedHouseholds.length;
  const unvisitedHouseholdsCount = Math.max(totalHouseholds - householdsVisitedCount, 0);

  const electorsContacted = await prisma.canvassVisit.findMany({
    where: { ...visitsWhere, result: "SPOKE", electorId: { not: null } },
    distinct: ["electorId"],
    select: { electorId: true },
  });

  return {
    totals: {
      electors: totalElectors,
      households: totalHouseholds,
      visits,
      householdsVisited: householdsVisitedCount,
      unvisitedHouseholds: unvisitedHouseholdsCount,
      electorsContacted: electorsContacted.length,
    },
    visitResults: {
      spoke: spokeCount,
      notHome: notHomeCount,
      refused: refusedCount,
      moved: movedResult,
    },
    political: {
      supportsUs,
      supportsOpponent: supportsOpp,
      undecided,
      notVoting,
      unknownOrRefused: unknown,
    },
    register: {
      new: newElectors,
      movedIn,
      movedOut,
      addressUpdated,
      removed,
    },
    voting: {
      postal,
      mobile,
    },
    followUpsDue,
  };
}
