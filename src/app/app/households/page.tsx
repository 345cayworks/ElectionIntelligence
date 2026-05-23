import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { compactAddress } from "@/lib/format";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  street?: string;
  visited?: string;
}

export default async function HouseholdsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireUser();

  const where: Record<string, unknown> = {};
  if (searchParams?.q) {
    where.normalizedAddress = { contains: searchParams.q.toLowerCase() };
  }
  if (searchParams?.street) {
    where.streetName = { contains: searchParams.street };
  }

  const households = await prisma.household.findMany({
    where,
    include: {
      _count: { select: { electors: true, visits: true } },
      constituency: true,
    },
    orderBy: { streetName: "asc" },
    take: 200,
  });

  // Optional filter: only show households with at least one visit / no visits.
  const filtered = households.filter((h) => {
    if (searchParams?.visited === "visited") return h._count.visits > 0;
    if (searchParams?.visited === "unvisited") return h._count.visits === 0;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Households"
        description="Group electors by address and track household visit status."
      />
      <Card className="mb-4">
        <CardBody>
          <form method="get" className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <Input
              name="q"
              defaultValue={searchParams?.q ?? ""}
              placeholder="Search address"
            />
            <Input
              name="street"
              defaultValue={searchParams?.street ?? ""}
              placeholder="Street contains"
            />
            <Select name="visited" defaultValue={searchParams?.visited ?? ""}>
              <option value="">Any visit status</option>
              <option value="visited">Visited</option>
              <option value="unvisited">Unvisited</option>
            </Select>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Filter
            </button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`Showing ${filtered.length} households`} />
        <CardBody>
          {filtered.length === 0 ? (
            <EmptyState title="No households" />
          ) : (
            <Table>
              <THead>
                <TH>Address</TH>
                <TH>Constituency</TH>
                <TH>Type</TH>
                <TH>Electors</TH>
                <TH>Visits</TH>
              </THead>
              <TBody>
                {filtered.map((h) => (
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
                    <TD>
                      <Badge tone="gray">{h.buildingType}</Badge>
                    </TD>
                    <TD>{h._count.electors}</TD>
                    <TD>{h._count.visits}</TD>
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
