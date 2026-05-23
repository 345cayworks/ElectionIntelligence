import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";

export const dynamic = "force-dynamic";

export default async function StreetsPage() {
  await requireUser();
  const households = await prisma.household.findMany({
    include: {
      _count: { select: { electors: true, visits: true, assignments: true } },
    },
  });

  const byStreet = new Map<
    string,
    {
      name: string;
      key: string;
      households: number;
      visited: number;
      assignments: number;
      electors: number;
    }
  >();
  for (const h of households) {
    const name = h.streetName ?? "(unknown)";
    const key = name.toLowerCase();
    const entry = byStreet.get(key) ?? {
      name,
      key,
      households: 0,
      visited: 0,
      assignments: 0,
      electors: 0,
    };
    entry.households += 1;
    if (h._count.visits > 0) entry.visited += 1;
    entry.assignments += h._count.assignments;
    entry.electors += h._count.electors;
    byStreet.set(key, entry);
  }
  const rows = Array.from(byStreet.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader title="Streets" />
      <Card>
        <CardHeader title={`${rows.length} streets`} />
        <CardBody>
          {rows.length === 0 ? (
            <EmptyState title="No streets yet - upload elector data first" />
          ) : (
            <Table>
              <THead>
                <TH>Street</TH>
                <TH>Households</TH>
                <TH>Visited</TH>
                <TH>Electors</TH>
                <TH>Assignments</TH>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.key}>
                    <TD>
                      <Link
                        className="text-blue-600 hover:underline"
                        href={`/app/streets/${encodeURIComponent(r.key)}`}
                      >
                        {r.name}
                      </Link>
                    </TD>
                    <TD>{r.households}</TD>
                    <TD>{r.visited}</TD>
                    <TD>{r.electors}</TD>
                    <TD>{r.assignments}</TD>
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
