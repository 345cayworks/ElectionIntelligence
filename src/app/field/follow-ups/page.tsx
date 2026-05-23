import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireFieldUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { formatDate, compactAddress } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FieldFollowUpsPage() {
  const user = await requireFieldUser();
  const tasks = await prisma.followUpTask.findMany({
    where: {
      assignedToUserId: user.id,
      status: { in: ["OPEN", "IN_PROGRESS"] },
    },
    include: { elector: true, household: true },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
  });

  return (
    <div>
      <PageHeader title="My follow-ups" />
      <Card>
        <CardHeader title={`${tasks.length} open tasks`} />
        <CardBody>
          {tasks.length === 0 ? (
            <EmptyState title="No follow-ups assigned" />
          ) : (
            <Table>
              <THead>
                <TH>Title</TH>
                <TH>Target</TH>
                <TH>Priority</TH>
                <TH>Due</TH>
                <TH>Status</TH>
              </THead>
              <TBody>
                {tasks.map((t) => (
                  <TR key={t.id}>
                    <TD>{t.title}</TD>
                    <TD>
                      {t.elector ? (
                        <Link
                          className="text-blue-600 hover:underline"
                          href={`/app/electors/${t.elector.id}`}
                        >
                          {t.elector.fullName}
                        </Link>
                      ) : t.household ? (
                        <Link
                          className="text-blue-600 hover:underline"
                          href={`/app/households/${t.household.id}`}
                        >
                          {compactAddress(t.household) || "Household"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD>
                      <Badge tone="yellow">{t.priority}</Badge>
                    </TD>
                    <TD className="text-xs">{formatDate(t.dueDate)}</TD>
                    <TD>
                      <StatusBadge status={t.status} />
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
