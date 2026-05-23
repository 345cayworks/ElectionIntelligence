import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { compactAddress, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HouseholdProfilePage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();
  const household = await prisma.household.findUnique({
    where: { id: params.id },
    include: {
      electors: { orderBy: { fullName: "asc" } },
      visits: {
        orderBy: { visitDate: "desc" },
        include: { canvasser: true },
        take: 25,
      },
      followUpTasks: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } } },
      constituency: true,
    },
  });
  if (!household) notFound();

  const lastVisit = household.visits[0];

  return (
    <div>
      <PageHeader
        title={compactAddress(household) || "Household"}
        description={`${household.constituency?.name ?? "—"} - ${household.buildingType}`}
        actions={
          <Link href={`/field/households/${household.id}`}>
            <Button>Open in field app</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Electors at this household" />
            <CardBody>
              {household.electors.length === 0 ? (
                <EmptyState title="No electors linked" />
              ) : (
                <Table>
                  <THead>
                    <TH>Name</TH>
                    <TH>Serial</TH>
                    <TH>Occupation</TH>
                    <TH>Status</TH>
                  </THead>
                  <TBody>
                    {household.electors.map((e) => (
                      <TR key={e.id}>
                        <TD>
                          <Link
                            className="text-blue-600 hover:underline"
                            href={`/app/electors/${e.id}`}
                          >
                            {e.fullName}
                          </Link>
                        </TD>
                        <TD>
                          {e.officialSerialNo ? (
                            <code className="text-xs">{e.officialSerialNo}</code>
                          ) : (
                            "—"
                          )}
                        </TD>
                        <TD>{e.occupation ?? "—"}</TD>
                        <TD>
                          <StatusBadge status={e.officialStatus} />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Visit history" />
            <CardBody>
              {household.visits.length === 0 ? (
                <EmptyState title="No visits logged" />
              ) : (
                <Table>
                  <THead>
                    <TH>Date</TH>
                    <TH>Method</TH>
                    <TH>Result</TH>
                    <TH>Canvasser</TH>
                    <TH>Notes</TH>
                  </THead>
                  <TBody>
                    {household.visits.map((v) => (
                      <TR key={v.id}>
                        <TD className="text-xs">{formatDateTime(v.visitDate)}</TD>
                        <TD>
                          <Badge tone="blue">{v.visitMethod}</Badge>
                        </TD>
                        <TD>
                          <StatusBadge status={v.result} />
                        </TD>
                        <TD className="text-xs">{v.canvasser?.email ?? "—"}</TD>
                        <TD className="text-xs">{v.notes ?? "—"}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Status" />
            <CardBody className="text-sm">
              <div className="flex items-center justify-between border-b border-gray-100 py-1.5">
                <span className="text-xs text-gray-500">Electors</span>
                <span>{household.electors.length}</span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 py-1.5">
                <span className="text-xs text-gray-500">Last visit</span>
                <span>{lastVisit ? formatDateTime(lastVisit.visitDate) : "—"}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-gray-500">Last result</span>
                <span>{lastVisit ? <StatusBadge status={lastVisit.result} /> : "—"}</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Household notes" />
            <CardBody>
              {household.notes ? (
                <div className="text-sm whitespace-pre-wrap">{household.notes}</div>
              ) : (
                <div className="text-xs text-gray-500">No notes.</div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Follow-up tasks" />
            <CardBody>
              {household.followUpTasks.length === 0 ? (
                <div className="text-xs text-gray-500">None.</div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {household.followUpTasks.map((t) => (
                    <li key={t.id} className="rounded border border-gray-200 p-2">
                      <div className="font-medium">{t.title}</div>
                      <div className="mt-1 text-xs">
                        <Badge tone="yellow">{t.priority}</Badge>{" "}
                        <StatusBadge status={t.status} />
                      </div>
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
