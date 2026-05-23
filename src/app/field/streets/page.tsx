import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireFieldUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";

export const dynamic = "force-dynamic";

export default async function FieldStreetsPage() {
  const user = await requireFieldUser();
  const assignments = await prisma.canvassAssignment.findMany({
    where: { assignedToUserId: user.id },
    include: { household: true },
  });

  const byStreet = new Map<string, { name: string; total: number; completed: number }>();
  for (const a of assignments) {
    const key = (a.household?.streetName ?? "(unknown)").toLowerCase();
    const entry = byStreet.get(key) ?? {
      name: a.household?.streetName ?? "(unknown)",
      total: 0,
      completed: 0,
    };
    entry.total += 1;
    if (a.status === "COMPLETED") entry.completed += 1;
    byStreet.set(key, entry);
  }
  const rows = Array.from(byStreet.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader title="My streets" />
      <Card>
        <CardHeader title={`${rows.length} streets`} />
        <CardBody>
          {rows.length === 0 ? (
            <EmptyState title="No streets assigned yet" />
          ) : (
            <Table>
              <THead>
                <TH>Street</TH>
                <TH>Households</TH>
                <TH>Completed</TH>
                <TH />
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.name}>
                    <TD>{r.name}</TD>
                    <TD>{r.total}</TD>
                    <TD>{r.completed}</TD>
                    <TD>
                      <Link
                        className="text-blue-600 hover:underline"
                        href={`/app/streets/${encodeURIComponent(r.name.toLowerCase())}`}
                      >
                        View →
                      </Link>
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
