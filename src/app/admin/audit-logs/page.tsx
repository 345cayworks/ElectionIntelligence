import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { canViewAuditLogs } from "@/lib/permissions";
import { getSessionUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Input";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  severity?: string;
  action?: string;
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireAdmin();
  const viewer = await getSessionUser();
  if (!canViewAuditLogs(viewer)) redirect("/app/dashboard?error=forbidden");

  const where: Record<string, unknown> = {};
  if (searchParams?.severity) where.severity = searchParams.severity;
  if (searchParams?.action) where.action = { contains: searchParams.action };
  if (searchParams?.q) where.entityId = { contains: searchParams.q };

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { actor: true },
  });

  return (
    <div>
      <PageHeader
        title="Audit logs"
        description="Read-only audit trail of sensitive system actions."
      />
      <Card className="mb-4">
        <CardBody>
          <form method="get" className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <Input
              name="action"
              defaultValue={searchParams?.action ?? ""}
              placeholder="Action contains"
            />
            <Input
              name="q"
              defaultValue={searchParams?.q ?? ""}
              placeholder="Entity ID contains"
            />
            <Select name="severity" defaultValue={searchParams?.severity ?? ""}>
              <option value="">All severities</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="SENSITIVE">SENSITIVE</option>
              <option value="CRITICAL">CRITICAL</option>
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
        <CardHeader title={`${logs.length} entries (most recent first)`} />
        <CardBody>
          {logs.length === 0 ? (
            <EmptyState title="No audit entries match" />
          ) : (
            <Table>
              <THead>
                <TH>When</TH>
                <TH>Actor</TH>
                <TH>Action</TH>
                <TH>Entity</TH>
                <TH>Severity</TH>
                <TH>Metadata</TH>
              </THead>
              <TBody>
                {logs.map((l) => (
                  <TR key={l.id}>
                    <TD className="text-xs">{formatDateTime(l.createdAt)}</TD>
                    <TD className="text-xs">{l.actor?.email ?? "system"}</TD>
                    <TD>
                      <code className="text-xs">{l.action}</code>
                    </TD>
                    <TD className="text-xs">
                      {l.entityType ? (
                        <>
                          <code>{l.entityType}</code>{" "}
                          {l.entityId ? <code>{l.entityId}</code> : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD>
                      <Badge
                        tone={
                          l.severity === "CRITICAL"
                            ? "red"
                            : l.severity === "SENSITIVE"
                              ? "purple"
                              : l.severity === "WARN"
                                ? "yellow"
                                : "gray"
                        }
                      >
                        {l.severity}
                      </Badge>
                    </TD>
                    <TD className="max-w-xs text-xs">
                      {l.metadata ? (
                        <code className="block truncate" title={l.metadata}>
                          {l.metadata}
                        </code>
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
