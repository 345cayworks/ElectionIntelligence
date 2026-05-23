import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { canViewSensitivePoliticalData } from "@/lib/permissions";
import { getSessionUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { getCampaignMetrics } from "@/lib/metrics";
import { formatNumber } from "@/lib/format";
import { AdBanner } from "@/components/ads/AdBanner";

export const dynamic = "force-dynamic";

interface SearchParams {
  electionCycleId?: string;
  constituencyId?: string;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireUser();
  const viewer = await getSessionUser();
  const canSeePolitical = canViewSensitivePoliticalData(viewer);

  const [cycles, constituencies] = await Promise.all([
    prisma.electionCycle.findMany({ orderBy: { electionDate: "desc" } }),
    prisma.constituency.findMany({ orderBy: { name: "asc" } }),
  ]);

  const metrics = await getCampaignMetrics({
    electionCycleId: searchParams?.electionCycleId || null,
    constituencyId: searchParams?.constituencyId || null,
  });

  return (
    <div>
      <PageHeader
        title="Campaign dashboard"
        description={`Welcome${viewer?.name ? `, ${viewer.name}` : ""}.`}
      />
      <AdBanner placement="dashboard_top" className="mb-4" maxHeight={160} />

      <Card className="mb-4">
        <CardBody>
          <form method="get" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Select
              name="electionCycleId"
              defaultValue={searchParams?.electionCycleId ?? ""}
            >
              <option value="">All cycles</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select
              name="constituencyId"
              defaultValue={searchParams?.constituencyId ?? ""}
            >
              <option value="">All constituencies</option>
              {constituencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Apply
            </button>
          </form>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <StatCard label="Electors" value={formatNumber(metrics.totals.electors)} />
        <StatCard
          label="Households"
          value={formatNumber(metrics.totals.households)}
        />
        <StatCard
          label="Households visited"
          value={formatNumber(metrics.totals.householdsVisited)}
          accent="green"
        />
        <StatCard
          label="Unvisited"
          value={formatNumber(metrics.totals.unvisitedHouseholds)}
          accent="gray"
        />
        <StatCard
          label="Electors contacted"
          value={formatNumber(metrics.totals.electorsContacted)}
          accent="blue"
        />
        <StatCard
          label="Follow-ups due"
          value={formatNumber(metrics.followUpsDue)}
          accent="yellow"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Visit results" />
          <CardBody className="space-y-2 text-sm">
            <Row label="Spoke" value={metrics.visitResults.spoke} tone="green" />
            <Row label="Not home" value={metrics.visitResults.notHome} tone="yellow" />
            <Row label="Refused" value={metrics.visitResults.refused} tone="red" />
            <Row label="Moved" value={metrics.visitResults.moved} tone="red" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Political snapshot"
            description={canSeePolitical ? "Live counts" : "Restricted"}
          />
          <CardBody className="space-y-2 text-sm">
            {canSeePolitical ? (
              <>
                <Row label="Supports us" value={metrics.political.supportsUs} tone="green" />
                <Row label="Supports opponent" value={metrics.political.supportsOpponent} tone="red" />
                <Row label="Undecided" value={metrics.political.undecided} tone="yellow" />
                <Row label="Not voting" value={metrics.political.notVoting} tone="gray" />
                <Row label="Unknown" value={metrics.political.unknownOrRefused} tone="gray" />
              </>
            ) : (
              <div className="text-xs text-gray-500">
                You do not have permission to view political declarations.
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Register changes" />
          <CardBody className="space-y-2 text-sm">
            <Row label="New" value={metrics.register.new} tone="green" />
            <Row label="Moved in" value={metrics.register.movedIn} tone="green" />
            <Row label="Moved out" value={metrics.register.movedOut} tone="red" />
            <Row label="Updated address" value={metrics.register.addressUpdated} tone="yellow" />
            <Row label="Removed" value={metrics.register.removed} tone="red" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Voting method" />
          <CardBody className="space-y-2 text-sm">
            <Row label="Postal" value={metrics.voting.postal} tone="blue" />
            <Row label="Mobile" value={metrics.voting.mobile} tone="blue" />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "yellow" | "red" | "gray" | "blue";
}) {
  const toneClass: Record<typeof tone, string> = {
    green: "text-green-700",
    yellow: "text-yellow-700",
    red: "text-red-700",
    gray: "text-gray-700",
    blue: "text-blue-700",
  };
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-1.5 last:border-b-0">
      <span className="text-xs uppercase tracking-wide text-gray-500">{label}</span>
      <span className={`text-sm font-medium ${toneClass[tone]}`}>
        {formatNumber(value)}
      </span>
    </div>
  );
}
