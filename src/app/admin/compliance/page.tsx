import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { USER_ROLES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  await requireAdmin();

  const [usersByRole, sensitiveAudit, recentDeclarations] = await Promise.all([
    prisma.user.groupBy({
      by: ["role"],
      _count: { _all: true },
    }),
    prisma.auditLog.findMany({
      where: { severity: { in: ["SENSITIVE", "CRITICAL"] } },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { actor: true },
    }),
    prisma.electorPoliticalStatus.count({ where: { isCurrent: true } }),
  ]);

  const usersMap = new Map<string, number>(usersByRole.map((r) => [r.role, r._count._all]));

  return (
    <div>
      <PageHeader
        title="Compliance & privacy"
        description="Privacy posture, data separation, and recent sensitive activity."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Role distribution" />
          <CardBody>
            <Table>
              <THead>
                <TH>Role</TH>
                <TH>Count</TH>
              </THead>
              <TBody>
                {USER_ROLES.map((role) => (
                  <TR key={role}>
                    <TD>
                      <code className="text-xs">{role}</code>
                    </TD>
                    <TD>{usersMap.get(role) ?? 0}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Data separation"
            description="How data layers are organized"
          />
          <CardBody className="space-y-2 text-sm">
            <Row label="Official elector data" value="ACTIVE" tone="green" />
            <Row label="Campaign-entered contact data" value="ACTIVE" tone="green" />
            <Row label="Campaign-entered political status" value="SENSITIVE" tone="purple" />
            <Row label="Visit history" value="ACTIVE" tone="green" />
            <div className="rounded bg-gray-50 p-3 text-xs text-gray-600">
              Political status and contact data are stored in separate tables from
              the official elector register. Updates to the register never overwrite
              campaign canvassing history.
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent sensitive activity"
            description="Sensitive and critical audit log entries"
          />
          <CardBody>
            <Table>
              <THead>
                <TH>When</TH>
                <TH>Actor</TH>
                <TH>Action</TH>
                <TH>Severity</TH>
              </THead>
              <TBody>
                {sensitiveAudit.map((l) => (
                  <TR key={l.id}>
                    <TD className="text-xs">{l.createdAt.toISOString()}</TD>
                    <TD className="text-xs">{l.actor?.email ?? "system"}</TD>
                    <TD>
                      <code className="text-xs">{l.action}</code>
                    </TD>
                    <TD>
                      <Badge tone={l.severity === "CRITICAL" ? "red" : "purple"}>
                        {l.severity}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Privacy posture" />
          <CardBody className="space-y-2 text-xs text-gray-700">
            <p>
              <Badge tone="green">enforced</Badge> Political opinion data is
              permission-gated for both reads and writes.
            </p>
            <p>
              <Badge tone="green">enforced</Badge> No predictive political scoring
              based on private traits is implemented or planned.
            </p>
            <p>
              <Badge tone="green">enforced</Badge> Audit log records all sensitive
              changes with actor identity, IP, and metadata.
            </p>
            <p>
              <Badge tone="green">enforced</Badge> Exports of sensitive lists are
              limited to roles in <code>canExportSensitive</code>.
            </p>
            <p>
              <Badge tone="green">enforced</Badge> Final SuperAdmin cannot be
              demoted; SuperAdmin actions are logged as CRITICAL.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Current political declarations" />
          <CardBody>
            <div className="text-sm">
              <span className="text-2xl font-semibold">{recentDeclarations}</span>{" "}
              <span className="text-xs text-gray-500">active declarations on file</span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "yellow" | "red" | "gray" | "purple" | "blue";
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-1.5 last:border-b-0">
      <span className="text-xs text-gray-700">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}
