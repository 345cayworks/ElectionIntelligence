import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireFieldUser } from "@/lib/auth/guards";
import { canEditSensitivePoliticalData } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { QuickActionGrid } from "@/components/field/QuickActionGrid";
import { compactAddress, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FieldHouseholdPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireFieldUser();
  const household = await prisma.household.findUnique({
    where: { id: params.id },
    include: {
      electors: { orderBy: { fullName: "asc" } },
      visits: {
        orderBy: { visitDate: "desc" },
        include: { canvasser: true },
        take: 5,
      },
    },
  });
  if (!household) notFound();

  const issueTags = await prisma.issueTag.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  // Determine the active election cycle (the latest ACTIVE one, or the most recent).
  const activeCycle =
    (await prisma.electionCycle.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { electionDate: "desc" },
    })) ??
    (await prisma.electionCycle.findFirst({ orderBy: { electionDate: "desc" } }));

  return (
    <div>
      <PageHeader
        title={compactAddress(household) || "Household"}
        description={`${household.electors.length} electors · ${household.buildingType}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Log this visit"
              description="Tap a quick action. Visits are logged immediately."
            />
            <CardBody>
              <QuickActionGrid
                householdId={household.id}
                electors={household.electors.map((e) => ({
                  id: e.id,
                  name: e.fullName,
                }))}
                issueTags={issueTags.map((t) => ({ id: t.id, key: t.key, label: t.label }))}
                electionCycleId={activeCycle?.id ?? null}
                canEditPolitical={canEditSensitivePoliticalData(user)}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Electors here" />
            <CardBody>
              {household.electors.length === 0 ? (
                <div className="text-xs text-gray-500">No electors linked.</div>
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {household.electors.map((e) => (
                    <li key={e.id} className="py-2">
                      <div className="font-medium">{e.fullName}</div>
                      {e.officialSerialNo ? (
                        <div className="text-xs text-gray-500">
                          Serial {e.officialSerialNo}
                        </div>
                      ) : null}
                      <div className="mt-1">
                        <StatusBadge status={e.officialStatus} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent visits" />
            <CardBody>
              {household.visits.length === 0 ? (
                <div className="text-xs text-gray-500">No previous visits.</div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {household.visits.map((v) => (
                    <li key={v.id} className="rounded border border-gray-100 p-2">
                      <div className="flex items-center justify-between">
                        <StatusBadge status={v.result} />
                        <Badge tone="blue">{v.visitMethod}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {formatDateTime(v.visitDate)} · {v.canvasser?.email ?? "—"}
                      </div>
                      {v.notes ? (
                        <div className="mt-1 text-xs text-gray-700">{v.notes}</div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
