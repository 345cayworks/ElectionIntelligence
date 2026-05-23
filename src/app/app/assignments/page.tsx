import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { canAssignCanvassers } from "@/lib/permissions";
import { getSessionUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { compactAddress, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const user = await requireUser();
  const viewer = await getSessionUser();
  const canManage = canAssignCanvassers(viewer);

  const where = canManage ? {} : { assignedToUserId: user.id };
  const assignments = await prisma.canvassAssignment.findMany({
    where,
    include: {
      household: true,
      assignedTo: true,
      assignedBy: true,
    },
    orderBy: [{ status: "asc" }, { priority: "desc" }],
    take: 500,
  });

  return (
    <div>
      <PageHeader
        title="Assignments"
        description={canManage ? "All campaign assignments" : "My assignments"}
        actions={
          canManage ? (
            <Link href="/app/assignments/new">
              <Button>New assignment</Button>
            </Link>
          ) : null
        }
      />
      <Card>
        <CardHeader title={`${assignments.length} assignments`} />
        <CardBody>
          {assignments.length === 0 ? (
            <EmptyState title="No assignments yet" />
          ) : (
            <Table>
              <THead>
                <TH>Household</TH>
                <TH>Assigned to</TH>
                <TH>Priority</TH>
                <TH>Due</TH>
                <TH>Status</TH>
                <TH />
              </THead>
              <TBody>
                {assignments.map((a) => (
                  <TR key={a.id}>
                    <TD>
                      {a.household ? (
                        <Link
                          className="text-blue-600 hover:underline"
                          href={`/field/households/${a.household.id}`}
                        >
                          {compactAddress(a.household) || "—"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD>{a.assignedTo?.email ?? "—"}</TD>
                    <TD>
                      <Badge tone="yellow">{a.priority}</Badge>
                    </TD>
                    <TD className="text-xs">{formatDate(a.dueDate)}</TD>
                    <TD>
                      <StatusBadge status={a.status} />
                    </TD>
                    <TD>
                      {a.household ? (
                        <Link
                          className="text-blue-600 hover:underline"
                          href={`/field/households/${a.household.id}`}
                        >
                          Open →
                        </Link>
                      ) : (
                        "—"
                      )}
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
