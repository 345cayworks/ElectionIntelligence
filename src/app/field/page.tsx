import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireFieldUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { compactAddress, formatDate } from "@/lib/format";
import { AdBanner } from "@/components/ads/AdBanner";

export const dynamic = "force-dynamic";

export default async function FieldDashboard() {
  const user = await requireFieldUser();

  const [assignments, todaysFollowUps, recentVisits] = await Promise.all([
    prisma.canvassAssignment.findMany({
      where: { assignedToUserId: user.id, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
      include: { household: true },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 20,
    }),
    prisma.followUpTask.findMany({
      where: {
        assignedToUserId: user.id,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      include: { elector: true, household: true },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    prisma.canvassVisit.findMany({
      where: { canvasserId: user.id },
      orderBy: { visitDate: "desc" },
      take: 10,
      include: { household: true },
    }),
  ]);

  const distinctStreets = Array.from(
    new Set(
      assignments
        .map((a) => a.household?.streetName?.trim())
        .filter((n): n is string => !!n),
    ),
  );

  return (
    <div>
      <PageHeader title="My field workspace" description={`Hi ${user.name ?? user.email}.`} />
      <AdBanner placement="field_top" className="mb-4" maxHeight={140} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Assignments" value={assignments.length} accent="blue" />
        <StatCard label="Streets" value={distinctStreets.length} accent="blue" />
        <StatCard label="Follow-ups" value={todaysFollowUps.length} accent="yellow" />
        <StatCard label="Recent visits" value={recentVisits.length} accent="green" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="My assigned households"
            description="Sorted by priority, then due date"
          />
          <CardBody>
            {assignments.length === 0 ? (
              <EmptyState title="No assignments yet" />
            ) : (
              <Table>
                <THead>
                  <TH>Address</TH>
                  <TH>Status</TH>
                  <TH>Priority</TH>
                  <TH>Due</TH>
                  <TH />
                </THead>
                <TBody>
                  {assignments.map((a) => (
                    <TR key={a.id}>
                      <TD>{compactAddress(a.household ?? {}) || "—"}</TD>
                      <TD>
                        <StatusBadge status={a.status} />
                      </TD>
                      <TD>{a.priority}</TD>
                      <TD className="text-xs">{formatDate(a.dueDate)}</TD>
                      <TD>
                        {a.household ? (
                          <Link
                            className="text-blue-600 hover:underline"
                            href={`/field/households/${a.household.id}`}
                          >
                            Open →
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Today's follow-ups" />
          <CardBody>
            {todaysFollowUps.length === 0 ? (
              <EmptyState title="No follow-ups due" />
            ) : (
              <ul className="space-y-2 text-sm">
                {todaysFollowUps.map((t) => (
                  <li
                    key={t.id}
                    className="rounded border border-gray-200 p-2 hover:bg-gray-50"
                  >
                    <div className="font-medium">{t.title}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {t.elector?.fullName ?? t.household?.normalizedAddress ?? "—"}
                    </div>
                    {t.description ? (
                      <div className="mt-1 text-xs">{t.description}</div>
                    ) : null}
                    <div className="mt-1 text-xs">
                      Due: {formatDate(t.dueDate)} · <StatusBadge status={t.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
