import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireReportViewer } from "@/lib/auth/guards";
import { canViewSensitivePoliticalData } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { compactAddress } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PostalMobilePage() {
  const viewer = await requireReportViewer();
  if (!canViewSensitivePoliticalData(viewer)) {
    redirect("/app/reports?error=forbidden");
  }

  const statuses = await prisma.electorPoliticalStatus.findMany({
    where: {
      votingMethodFlag: { in: ["POSTAL", "MOBILE"] },
      isCurrent: true,
    },
    include: { elector: { include: { currentHousehold: true } } },
    orderBy: { votingMethodFlag: "asc" },
    take: 1000,
  });

  return (
    <div>
      <PageHeader
        title="Postal & mobile voter list"
        description="Sensitive political data - access logged."
      />
      <Card>
        <CardHeader title={`${statuses.length} entries`} />
        <CardBody>
          {statuses.length === 0 ? (
            <EmptyState title="No postal/mobile flags yet" />
          ) : (
            <Table>
              <THead>
                <TH>Method</TH>
                <TH>Name</TH>
                <TH>Address</TH>
              </THead>
              <TBody>
                {statuses.map((s) => (
                  <TR key={s.id}>
                    <TD>
                      <Badge tone="blue">{s.votingMethodFlag}</Badge>
                    </TD>
                    <TD>
                      <Link
                        className="text-blue-600 hover:underline"
                        href={`/app/electors/${s.elector.id}`}
                      >
                        {s.elector.fullName}
                      </Link>
                    </TD>
                    <TD>{compactAddress(s.elector.currentHousehold ?? {}) || "—"}</TD>
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
