import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireReportViewer } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";

export const dynamic = "force-dynamic";

export default async function StreetCompletionReportPage() {
  await requireReportViewer();

  const households = await prisma.household.findMany({
    include: {
      _count: { select: { visits: true, electors: true } },
      visits: { take: 1, orderBy: { visitDate: "desc" } },
    },
  });

  const byStreet = new Map<
    string,
    { name: string; households: number; visited: number; electors: number }
  >();
  for (const h of households) {
    const key = (h.streetName ?? "(unknown)").toString().trim().toLowerCase();
    const entry = byStreet.get(key) ?? {
      name: h.streetName ?? "(unknown)",
      households: 0,
      visited: 0,
      electors: 0,
    };
    entry.households += 1;
    if (h._count.visits > 0) entry.visited += 1;
    entry.electors += h._count.electors;
    byStreet.set(key, entry);
  }
  const rows = Array.from(byStreet.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader title="Street completion report" />
      <Card>
        <CardHeader title={`${rows.length} streets`} />
        <CardBody>
          {rows.length === 0 ? (
            <EmptyState title="No street data yet" />
          ) : (
            <Table>
              <THead>
                <TH>Street</TH>
                <TH>Households</TH>
                <TH>Visited</TH>
                <TH>Electors</TH>
                <TH>% complete</TH>
              </THead>
              <TBody>
                {rows.map((r) => {
                  const pct = r.households === 0 ? 0 : Math.round((r.visited / r.households) * 100);
                  return (
                    <TR key={r.name}>
                      <TD>
                        <Link
                          className="text-blue-600 hover:underline"
                          href={`/app/streets/${encodeURIComponent(r.name.toLowerCase())}`}
                        >
                          {r.name}
                        </Link>
                      </TD>
                      <TD>{r.households}</TD>
                      <TD>{r.visited}</TD>
                      <TD>{r.electors}</TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 rounded bg-gray-200">
                            <div
                              className="h-1.5 rounded bg-green-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs">{pct}%</span>
                        </div>
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
