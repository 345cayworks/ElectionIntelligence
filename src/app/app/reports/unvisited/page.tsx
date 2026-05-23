import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireReportViewer } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { compactAddress } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function UnvisitedReportPage() {
  await requireReportViewer();

  // Households where no canvass visit exists yet.
  const households = await prisma.household.findMany({
    where: { visits: { none: {} } },
    include: { _count: { select: { electors: true } }, constituency: true },
    orderBy: { streetName: "asc" },
    take: 500,
  });

  return (
    <div>
      <PageHeader
        title="Unvisited households"
        description={`Showing first 500 households with no visit history.`}
      />
      <Card>
        <CardHeader title={`${households.length} households`} />
        <CardBody>
          {households.length === 0 ? (
            <EmptyState title="All households have visit history" />
          ) : (
            <Table>
              <THead>
                <TH>Address</TH>
                <TH>Constituency</TH>
                <TH>Electors</TH>
              </THead>
              <TBody>
                {households.map((h) => (
                  <TR key={h.id}>
                    <TD>
                      <Link
                        className="text-blue-600 hover:underline"
                        href={`/app/households/${h.id}`}
                      >
                        {compactAddress(h) || "—"}
                      </Link>
                    </TD>
                    <TD>{h.constituency?.name ?? "—"}</TD>
                    <TD>{h._count.electors}</TD>
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
