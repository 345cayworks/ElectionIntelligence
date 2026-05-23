import { prisma } from "@/lib/db";
import { requireFieldUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function VolunteersPage() {
  await requireFieldUser();
  const volunteers = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      role: { in: ["CANVASSER", "FIELD_COORDINATOR"] },
    },
    orderBy: { email: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Volunteers"
        description="Day-of staffing roster."
      />
      <Card>
        <CardHeader title={`${volunteers.length} active volunteers`} />
        <CardBody>
          {volunteers.length === 0 ? (
            <EmptyState title="No volunteers yet" />
          ) : (
            <Table>
              <THead>
                <TH>Email</TH>
                <TH>Name</TH>
                <TH>Role</TH>
              </THead>
              <TBody>
                {volunteers.map((v) => (
                  <TR key={v.id}>
                    <TD>{v.email}</TD>
                    <TD>{v.name ?? "—"}</TD>
                    <TD>
                      <Badge tone="blue">{v.role.replace(/_/g, " ")}</Badge>
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
