import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireReportViewer } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { compactAddress, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NotHomeReportPage() {
  await requireReportViewer();

  const visits = await prisma.canvassVisit.findMany({
    where: { result: "NOT_HOME" },
    orderBy: { visitDate: "desc" },
    take: 500,
    include: { household: true, canvasser: true },
  });

  return (
    <div>
      <PageHeader
        title="Not home - revisit list"
        description="Households where the last visit returned NOT_HOME."
      />
      <Card>
        <CardHeader title={`${visits.length} visits`} />
        <CardBody>
          {visits.length === 0 ? (
            <EmptyState title="Nothing to revisit" />
          ) : (
            <Table>
              <THead>
                <TH>Address</TH>
                <TH>When</TH>
                <TH>Canvasser</TH>
                <TH>Notes</TH>
              </THead>
              <TBody>
                {visits.map((v) => (
                  <TR key={v.id}>
                    <TD>
                      {v.household ? (
                        <Link
                          className="text-blue-600 hover:underline"
                          href={`/app/households/${v.household.id}`}
                        >
                          {compactAddress(v.household) || "—"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD className="text-xs">{formatDateTime(v.visitDate)}</TD>
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
  );
}
