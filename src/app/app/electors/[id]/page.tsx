import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { canViewSensitivePoliticalData } from "@/lib/permissions";
import { getSessionUser } from "@/lib/auth/session";
import { formatDateTime, compactAddress } from "@/lib/format";
import { SponsoredCard } from "@/components/ads/SponsoredCard";

export const dynamic = "force-dynamic";

export default async function ElectorProfilePage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();
  const viewer = await getSessionUser();
  const elector = await prisma.elector.findUnique({
    where: { id: params.id },
    include: {
      currentHousehold: true,
      constituency: true,
      contacts: { orderBy: { createdAt: "desc" } },
      politicalStatuses: {
        where: { isCurrent: true },
        orderBy: { capturedAt: "desc" },
        include: { declaredCandidate: true },
        take: 5,
      },
      canvassVisits: {
        orderBy: { visitDate: "desc" },
        include: { canvasser: true },
        take: 10,
      },
      issues: { include: { issueTag: true } },
      followUpTasks: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } } },
    },
  });
  if (!elector) notFound();

  const canSeePolitical = canViewSensitivePoliticalData(viewer);

  return (
    <div>
      <PageHeader
        title={elector.fullName}
        description={
          [
            elector.officialSerialNo ? `Serial ${elector.officialSerialNo}` : null,
            elector.constituency?.name,
            elector.pollingDivision ? `PD ${elector.pollingDivision}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Elector profile"
        }
        actions={<StatusBadge status={elector.officialStatus} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Official elector data" />
            <CardBody className="space-y-2 text-sm">
              <Detail
                label="Name"
                value={elector.fullName}
              />
              <Detail
                label="Serial number"
                value={elector.officialSerialNo ?? "—"}
              />
              <Detail label="Occupation" value={elector.occupation ?? "—"} />
              <Detail
                label="Polling division"
                value={elector.pollingDivision ?? "—"}
              />
              <Detail
                label="Constituency"
                value={elector.constituency?.name ?? "—"}
              />
              <Detail
                label="Official status"
                value={<StatusBadge status={elector.officialStatus} />}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Household" />
            <CardBody>
              {elector.currentHousehold ? (
                <div className="text-sm">
                  <div className="font-medium">
                    {compactAddress(elector.currentHousehold) || "Unaddressed household"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {elector.currentHousehold.buildingType.replace(/_/g, " ")}
                  </div>
                  <Link
                    href={`/app/households/${elector.currentHousehold.id}`}
                    className="mt-1 inline-block text-xs text-blue-600 hover:underline"
                  >
                    View household →
                  </Link>
                </div>
              ) : (
                <EmptyState title="No household linked" />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Contact information" />
            <CardBody>
              {elector.contacts.length === 0 ? (
                <EmptyState title="No contact info yet" />
              ) : (
                <Table>
                  <THead>
                    <TH>Type</TH>
                    <TH>Value</TH>
                    <TH>Source</TH>
                    <TH>Captured</TH>
                  </THead>
                  <TBody>
                    {elector.contacts.map((c) => (
                      <TR key={c.id}>
                        <TD>
                          <Badge tone="blue">{c.contactType}</Badge>
                        </TD>
                        <TD>{c.value}</TD>
                        <TD>{c.source ?? "—"}</TD>
                        <TD className="text-xs text-gray-500">
                          {formatDateTime(c.createdAt)}
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
              {elector.canvassVisits.length === 0 ? (
                <EmptyState title="No visits yet" />
              ) : (
                <Table>
                  <THead>
                    <TH>Date</TH>
                    <TH>Method</TH>
                    <TH>Result</TH>
                    <TH>Notes</TH>
                    <TH>Canvasser</TH>
                  </THead>
                  <TBody>
                    {elector.canvassVisits.map((v) => (
                      <TR key={v.id}>
                        <TD className="text-xs">{formatDateTime(v.visitDate)}</TD>
                        <TD>
                          <Badge tone="blue">{v.visitMethod}</Badge>
                        </TD>
                        <TD>
                          <StatusBadge status={v.result} />
                        </TD>
                        <TD className="text-xs">{v.notes ?? "—"}</TD>
                        <TD>{v.canvasser?.email ?? "—"}</TD>
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
            <CardHeader
              title="Political status"
              description={canSeePolitical ? "Permission-gated" : "Restricted"}
            />
            <CardBody>
              {!canSeePolitical ? (
                <div className="rounded border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
                  You do not have permission to view political declarations.
                </div>
              ) : elector.politicalStatuses.length === 0 ? (
                <EmptyState title="No declarations captured" />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {elector.politicalStatuses.map((s) => (
                    <li key={s.id} className="py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <StatusBadge status={s.declaredPosition} />
                        <StatusBadge status={s.votingMethodFlag} />
                      </div>
                      {s.declaredCandidate ? (
                        <div className="mt-1 text-xs text-gray-700">
                          Declared candidate:{" "}
                          <code>{s.declaredCandidate.shorthandCode}</code> ·{" "}
                          {s.declaredCandidate.name}
                        </div>
                      ) : null}
                      <div className="mt-1 text-xs text-gray-500">
                        Confidence: {s.confidenceLevel.replace(/_/g, " ")} ·{" "}
                        {formatDateTime(s.capturedAt)}
                      </div>
                      {s.notes ? (
                        <div className="mt-1 text-xs text-gray-700">{s.notes}</div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Issues raised" />
            <CardBody>
              {elector.issues.length === 0 ? (
                <div className="text-xs text-gray-500">No issues tagged.</div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {elector.issues.map((i) => (
                    <Badge key={i.id} tone="purple">
                      {i.issueTag.label}
                    </Badge>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Open follow-ups" />
            <CardBody>
              {elector.followUpTasks.length === 0 ? (
                <div className="text-xs text-gray-500">None.</div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {elector.followUpTasks.map((t) => (
                    <li key={t.id} className="rounded border border-gray-200 p-2">
                      <div className="text-sm font-medium">{t.title}</div>
                      {t.description ? (
                        <div className="text-xs text-gray-500">{t.description}</div>
                      ) : null}
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

          <SponsoredCard placement="elector_profile_sidebar" />
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-1.5 last:border-b-0">
      <span className="text-xs uppercase tracking-wide text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}
