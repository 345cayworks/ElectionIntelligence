import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { compactAddress, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StreetDetailPage({
  params,
}: {
  params: { streetKey: string };
}) {
  await requireUser();
  const streetKey = decodeURIComponent(params.streetKey);
  const households = await prisma.household.findMany({
    where: {
      streetName: { contains: streetKey },
    },
    include: {
      _count: { select: { electors: true, visits: true } },
      visits: { orderBy: { visitDate: "desc" }, take: 1 },
    },
    orderBy: { streetNumber: "asc" },
  });

  return (
    <div>
      <PageHeader
        title={streetKey || "Street"}
        description={`${households.length} households`}
      />
      <Card>
        <CardHeader title="Route" />
        <CardBody>
          {households.length === 0 ? (
            <EmptyState title="No households on this street" />
          ) : (
            <Table>
              <THead>
                <TH>Address</TH>
                <TH>Electors</TH>
                <TH>Visits</TH>
                <TH>Last visit</TH>
                <TH>Density</TH>
                <TH />
              </THead>
              <TBody>
                {households.map((h) => {
                  const lastVisit = h.visits[0];
                  const density =
                    h._count.electors >= 6
                      ? "HIGH"
                      : h._count.electors >= 3
                        ? "MED"
                        : "LOW";
                  return (
                    <TR key={h.id}>
                      <TD>{compactAddress(h) || "—"}</TD>
                      <TD>{h._count.electors}</TD>
                      <TD>{h._count.visits}</TD>
                      <TD className="text-xs">
                        {lastVisit ? formatDateTime(lastVisit.visitDate) : "—"}
                      </TD>
                      <TD>
                        <Badge
                          tone={
                            density === "HIGH"
                              ? "purple"
                              : density === "MED"
                                ? "blue"
                                : "gray"
                          }
                        >
                          {density}
                        </Badge>
                      </TD>
                      <TD>
                        <Link
                          className="text-blue-600 hover:underline"
                          href={`/field/households/${h.id}`}
                        >
                          Field →
                        </Link>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
