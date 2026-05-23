import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Input";
import { OFFICIAL_STATUSES } from "@/lib/constants";
import { compactAddress } from "@/lib/format";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  constituencyId?: string;
  status?: string;
  street?: string;
}

export default async function ElectorsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireUser();

  const where: Record<string, unknown> = {};
  if (searchParams?.q) {
    where.fullName = { contains: searchParams.q };
  }
  if (searchParams?.constituencyId) {
    where.constituencyId = searchParams.constituencyId;
  }
  if (searchParams?.status) {
    where.officialStatus = searchParams.status;
  }
  if (searchParams?.street) {
    where.currentHousehold = {
      streetName: { contains: searchParams.street },
    };
  }

  const [electors, constituencies] = await Promise.all([
    prisma.elector.findMany({
      where,
      include: { currentHousehold: true, constituency: true },
      orderBy: { fullName: "asc" },
      take: 200,
    }),
    prisma.constituency.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Electors"
        description="Search and filter the elector register."
      />
      <Card className="mb-4">
        <CardBody>
          <form method="get" className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            <Input
              name="q"
              defaultValue={searchParams?.q ?? ""}
              placeholder="Search by name"
            />
            <Input
              name="street"
              defaultValue={searchParams?.street ?? ""}
              placeholder="Street contains"
            />
            <Select name="constituencyId" defaultValue={searchParams?.constituencyId ?? ""}>
              <option value="">All constituencies</option>
              {constituencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select name="status" defaultValue={searchParams?.status ?? ""}>
              <option value="">Any status</option>
              {OFFICIAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
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
        <CardHeader title={`Showing ${electors.length} electors`} />
        <CardBody>
          {electors.length === 0 ? (
            <EmptyState
              title="No electors found"
              description="Adjust the filters or import an elector register."
            />
          ) : (
            <Table>
              <THead>
                <TH>Name</TH>
                <TH>Serial</TH>
                <TH>Address</TH>
                <TH>Constituency</TH>
                <TH>Status</TH>
              </THead>
              <TBody>
                {electors.map((e) => (
                  <TR key={e.id}>
                    <TD>
                      <Link
                        className="text-blue-600 hover:underline"
                        href={`/app/electors/${e.id}`}
                      >
                        {e.fullName}
                      </Link>
                      {e.occupation ? (
                        <div className="text-xs text-gray-500">{e.occupation}</div>
                      ) : null}
                    </TD>
                    <TD>
                      {e.officialSerialNo ? (
                        <code className="text-xs">{e.officialSerialNo}</code>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TD>
                    <TD>{compactAddress(e.currentHousehold ?? {}) || "—"}</TD>
                    <TD>{e.constituency?.name ?? "—"}</TD>
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
    </div>
  );
}
