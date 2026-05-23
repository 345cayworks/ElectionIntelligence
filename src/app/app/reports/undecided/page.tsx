import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireReportViewer } from "@/lib/auth/guards";
import { canViewSensitivePoliticalData } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { compactAddress, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function UndecidedReportPage() {
  const viewer = await requireReportViewer();
  if (!canViewSensitivePoliticalData(viewer)) {
    redirect("/app/reports?error=forbidden");
  }

  const statuses = await prisma.electorPoliticalStatus.findMany({
    where: { declaredPosition: "UNDECIDED", isCurrent: true },
    orderBy: { lastUpdatedAt: "desc" },
    take: 500,
    include: {
      elector: { include: { currentHousehold: true, constituency: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Undecided follow-up list"
        description="Sensitive political data - access logged."
      />
      <Card>
        <CardHeader title={`${statuses.length} undecided electors`} />
        <CardBody>
          {statuses.length === 0 ? (
            <EmptyState title="No undecided declarations" />
          ) : (
            <Table>
              <THead>
                <TH>Name</TH>
                <TH>Address</TH>
                <TH>Constituency</TH>
                <TH>Captured</TH>
              </THead>
              <TBody>
                {statuses.map((s) => (
                  <TR key={s.id}>
                    <TD>
                      <Link
                        className="text-blue-600 hover:underline"
                        href={`/app/electors/${s.elector.id}`}
                      >
                        {s.elector.fullName}
                      </Link>
                    </TD>
                    <TD>
                      {compactAddress(s.elector.currentHousehold ?? {}) || "—"}
                    </TD>
                    <TD>{s.elector.constituency?.name ?? "—"}</TD>
                    <TD className="text-xs">{formatDateTime(s.lastUpdatedAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
